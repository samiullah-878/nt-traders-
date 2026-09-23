// index.js — Noor Traders Hazri ke notifications (Firebase Cloud Functions, Node 20).
// App band ho tab bhi khabar jati hai, kyun ke ye code Firebase par chalta hai — kisi phone par nahi.
// Deploy: GitHub Actions (.github/workflows/deploy-functions.yml) ya computer se: firebase deploy --only functions
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { pkDate, pkMinutes, parseTime, fmt12, scheduleFor, notArrived, checkoutPending, breaksOverdue, lateOnCheckIn, list } from './logic.js';

initializeApp();
const db = getFirestore();
const BIZ = 'businesses/noor-traders';
const col = name => db.collection(`${BIZ}/${name}`);
const region = 'asia-south1';      // Mumbai — Pakistan ke qareeb
const TZ = 'Asia/Karachi';

const rows = async (name, q) => (await (q ? q : col(name)).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const config = async () => (await db.doc(`${BIZ}/staffConfig/main`).get()).data() || {};
const schedulesMap = async () => Object.fromEntries((await rows('staffSchedules')).map(s => [s.id, s]));

/** Kis kis ke phone par khabar jaye: malik + manager (staff ke apne phone par nahi). */
async function tokensFor(kinds = ['owner', 'manager']) {
  const snap = await col('pushTokens').get();
  const out = [];
  for (const d of snap.docs) { const t = d.data(); if (kinds.includes(t.role) && t.token) out.push({ id: d.id, token: t.token }); }
  return out;
}
/** Bhejo. Jo token kaam na kare use hata do (phone se app hat gayi hogi). */
async function push({ title, body, tag = 'nt', kinds, link = '/' }) {
  const targets = await tokensFor(kinds);
  if (!targets.length) { logger.info('koi phone register nahi'); return 0; }
  const message = {
    data: { title: String(title).slice(0, 120), body: String(body).slice(0, 300), tag, link },
    webpush: { headers: { Urgency: 'high', TTL: '3600' }, fcmOptions: { link } }
  };
  const res = await getMessaging().sendEach(targets.map(t => ({ ...message, token: t.token })));
  const dead = [];
  res.responses.forEach((r, i) => { if (!r.success && /registration-token-not-registered|invalid-argument/.test(r.error?.code || '')) dead.push(targets[i].id); });
  await Promise.all(dead.map(id => col('pushTokens').doc(id).delete().catch(() => {})));
  logger.info(`bheja: ${res.successCount}/${targets.length}`);
  return res.successCount;
}
const appLink = async (hash = '') => ((await config()).appUrl || '/') + hash;

/* ---------- foran wali khabrein ---------- */
export const onOut = onDocumentCreated({ region, document: `${BIZ}/staffOuts/{id}` }, async event => {
  const o = event.data?.data(); if (!o || o.status !== 'pending') return;
  await push({
    title: `${o.name || o.phone} bahar jana chahta hai`,
    body: `${o.reason}${o.note ? ' — ' + o.note : ''} · ${o.minutes} min — app khol kar Haan / Nahi karein`,
    tag: 'out-' + event.params.id, link: await appLink('#open=outs')
  });
});
export const onRequest = onDocumentCreated({ region, document: `${BIZ}/staffRequests/{id}` }, async event => {
  const r = event.data?.data(); if (!r || r.status !== 'pending') return;
  const staff = await rows('staffAccounts');
  const name = staff.find(s => s.phone === r.phone)?.name || r.phone;
  const half = r.half === 'am' ? ' (aadha din — subah)' : r.half === 'pm' ? ' (aadha din — shaam)' : '';
  await push({
    title: r.kind === 'leave' ? `${name} ne chutti mangi` : `${name}: hazri durust karne ki request`,
    body: `${r.date}${r.to && r.to !== r.date ? ' – ' + r.to : ''}${half} · ${String(r.reason || '').slice(0, 120)}`,
    tag: 'req-' + event.params.id, link: await appLink('#open=requests')
  });
});
export const onTicket = onDocumentCreated({ region, document: `${BIZ}/staffTickets/{id}` }, async event => {
  const t = event.data?.data(); if (!t) return;
  await push({
    title: `Ticket: ${t.name || t.phone} bina bataye gaya`,
    body: `${t.from ? fmt12(pkMinutes(new Date(Number(t.from)))) : ''} se${t.returnAt ? ' ' + fmt12(pkMinutes(new Date(Number(t.returnAt)))) + ' tak' : ' (abhi bahar)'} · ticket: ${t.byName || '—'} — faisla app mein`,
    tag: 'tkt-' + event.params.id, link: await appLink('#open=tickets')
  });
});
export const onCheckIn = onDocumentCreated({ region, document: `${BIZ}/staffAttendance/{id}` }, async event => {
  const a = event.data?.data(); if (!a?.checkIn) return;
  const cfg = await config(), scheds = await schedulesMap();
  const sch = scheduleFor(cfg, scheds[a.phone]);
  const requests = await rows('staffRequests', col('staffRequests').where('phone', '==', a.phone));
  const late = lateOnCheckIn({ attendance: a, schedule: sch, requests, date: a.date });
  if (!late) return;
  const staff = await rows('staffAccounts');
  const name = staff.find(s => s.phone === a.phone)?.name || a.name || a.phone;
  await push({
    title: `${name} late aaya`,
    body: `${fmt12(parseTime(a.checkIn))} par Check-In — ${late} min late (duty ${fmt12(parseTime(sch.shiftStart))})`,
    tag: 'late-' + a.date + '-' + a.phone, link: await appLink()
  });
});

/* ---------- khud aane wali khabrein (har 15 minute par jaanch) ---------- */
const stateRef = date => db.doc(`${BIZ}/pushState/${date}`);
export const watchDay = onSchedule({ region, schedule: 'every 15 minutes', timeZone: TZ }, async () => {
  const date = pkDate(), nowMin = pkMinutes(), now = Date.now();
  const cfg = await config();
  if (cfg.push?.on === false) return;
  const [staff, attendance, requests, scheds, outs] = await Promise.all([
    rows('staffAccounts'),
    rows('staffAttendance', col('staffAttendance').where('date', '==', date)),
    rows('staffRequests'),
    schedulesMap(),
    rows('staffOuts', col('staffOuts').where('date', '==', date))
  ]);
  const schedules = scheds;
  const state = (await stateRef(date).get()).data() || {};

  // 1) Duty shuru ke 30 minute baad bhi kaun nahi aaya
  if (!state.absent) {
    const missing = notArrived({ staff, attendance, requests, schedules, config: cfg, date, nowMin, after: Number(cfg.push?.absentAfter ?? 30) });
    if (missing.length) {
      await push({ title: `${fmt12(nowMin)} tak nahi aaye: ${missing.length}`, body: list(missing.map(m => m.name)), tag: 'absent-' + date, link: await appLink() });
      await stateRef(date).set({ absent: true, at: FieldValue.serverTimestamp() }, { merge: true });
    }
  }
  // 2) Khane ka break jin ka waqt guzar gaya
  const over = breaksOverdue(outs, now);
  if (over.length) {
    await push({ title: `Break ka waqt khatam — ${over.length} abhi bahar`, body: list(over.map(o => `${o.name} (${o.late} min zyada)`)), tag: 'break-' + date, link: await appLink() });
    const b = db.batch();
    for (const o of over) b.set(col('staffOuts').doc(o.id), { overdueAlert: true }, { merge: true });
    await b.commit();
  }
  // 3) Duty khatam ke 30 minute baad bhi Check-Out baqi
  if (!state.checkout) {
    const pend = checkoutPending({ staff, attendance, schedules, config: cfg, date, nowMin, after: Number(cfg.push?.checkoutAfter ?? 30) });
    if (pend.length) {
      await push({ title: `${pend.length} ka Check-Out baqi hai`, body: list(pend.map(p => p.name)), tag: 'checkout-' + date, link: await appLink() });
      await stateRef(date).set({ checkout: true, at: FieldValue.serverTimestamp() }, { merge: true });
    }
  }
});

/* ---------- mahine ki 1 tareekh: salary final karne ki yaad-dehani ---------- */
export const monthlySalary = onSchedule({ region, schedule: '0 10 1 * *', timeZone: TZ }, async () => {
  const cfg = await config();
  if (cfg.push?.on === false) return;
  const d = new Date(), prev = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 15)).toISOString().slice(0, 7);
  const [staff, payroll] = await Promise.all([rows('staffAccounts'), rows('staffPayroll')]);
  const open = staff.filter(s => s.active !== false).filter(s => payroll.find(p => p.id === `${prev}_${s.phone}`)?.state !== 'final');
  if (!open.length) return;
  await push({ title: 'Pichle mahine ki salary final karna baqi hai', body: `${open.length} staff: ${list(open.map(s => s.name || s.phone))}`, tag: 'salary-' + prev, link: await appLink('#open=salary') });
});
