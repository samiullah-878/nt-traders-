// index.js — Noor Traders Hazri ke notifications (Firebase Cloud Functions, Node 20).
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { pkDate, pkMinutes, parseTime, fmt12, scheduleFor, notArrived, checkoutPending, breaksOverdue, lateOnCheckIn, list } from './logic.js';

initializeApp();
const db = getFirestore();
const BIZ = 'businesses/noor-traders';
const col = name => db.collection(`${BIZ}/${name}`);
const region = 'asia-south1';      // Mumbai — Pakistan ke qareeb
// v214: parchi wali function hamesha jagti (minInstances 1). v219: ab SAB foran wali khabrein isi aik function (onHazriWrite) mein.
const FAST = { region, memory: '256MiB', minInstances: 1, concurrency: 20 };
const NORMAL = { region, memory: '256MiB' };
const TZ = 'Asia/Karachi';

const rows = async (name, q) => (await (q ? q : col(name)).get()).docs.map(d => ({ id: d.id, ...d.data() }));
let cfgCache = null, cfgAt = 0;
const config = async () => {
  if (cfgCache && Date.now() - cfgAt < 60000) return cfgCache;   // aik minute yaad — har khabar par parhna na pade
  cfgCache = (await db.doc(`${BIZ}/staffConfig/main`).get()).data() || {}; cfgAt = Date.now();
  return cfgCache;
};
// v234: camera ki khabrein malik app ke Nigrani > Khabar se chunta hai (cameraPC/settings.notify). Na likha ho = chalu (saaf nahi = band).
let camCache = null, camAt = 0;
const camNotify = async () => {
  if (camCache && Date.now() - camAt < Number(process.env.NT_CAM_TTL ?? 60000)) return camCache;
  camCache = ((await db.doc(`${BIZ}/cameraPC/settings`).get()).data() || {}).notify || {}; camAt = Date.now();
  return camCache;
};
const camOn = async (k, dflt = true) => { const n = await camNotify(); return n[k] === undefined ? dflt : n[k] !== false; };
const schedulesMap = async () => Object.fromEntries((await rows('staffSchedules')).map(s => [s.id, s]));

/** Kis kis ke phone par khabar jaye: malik + manager (staff ke apne phone par nahi). */
async function tokensFor(kinds = ['owner', 'manager']) {
  const snap = await col('pushTokens').get();
  const all = [];
  for (const d of snap.docs) { const t = d.data(); if (kinds.includes(t.role) && t.token) all.push({ id: d.id, token: t.token, at: Number(t.at || 0), dev: (String(t.device || '').match(/^d:(\w+)/) || [])[1] || '' }); }
  // v219: aik phone (device id) par sirf sab se naya token, aur aik token aik dafa — pehle aik phone ko 3 dafa khabar jati thi
  all.sort((a, b) => b.at - a.at);
  const seenTok = new Set(), seenDev = new Set(), out = [];
  for (const t of all) { if (seenTok.has(t.token) || (t.dev && seenDev.has(t.dev))) continue; seenTok.add(t.token); if (t.dev) seenDev.add(t.dev); out.push(t); }
  return out;
}
/** Bhejo. Jo token kaam na kare use hata do (phone se app hat gayi hogi). */
async function push({ title, body, tag = 'nt', kinds, link = '/' }) {
  const targets = await tokensFor(kinds);
  if (!targets.length) { logger.info('koi phone register nahi'); return 0; }
  const message = {
    data: { title: String(title).slice(0, 120), body: String(body).slice(0, 300), tag, link },
    android: { priority: 'high' },
    webpush: { headers: { Urgency: 'high', TTL: '86400' }, fcmOptions: { link } }
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
async function handleOut(event) {
  const o = event.data?.data(); if (!o || o.status !== 'pending') return;
  await push({
    title: `${o.name || o.phone} bahar jana chahta hai`,
    body: `${o.reason}${o.note ? ' — ' + o.note : ''} · ${o.minutes} min — app khol kar Haan / Nahi karein`,
    tag: 'out-' + event.params.id, link: await appLink('#open=outs')
  });
}
async function handleRequest(event) {
  const r = event.data?.data(); if (!r || r.status !== 'pending') return;
  const name = r.name || (await db.doc(`${BIZ}/staffAccounts/${r.phone}`).get()).data()?.name || r.phone;
  const half = r.half === 'am' ? ' (aadha din — subah)' : r.half === 'pm' ? ' (aadha din — shaam)' : '';
  await push({
    title: r.kind === 'leave' ? `${name} ne chutti mangi` : `${name}: hazri durust karne ki request`,
    body: `${r.date}${r.to && r.to !== r.date ? ' – ' + r.to : ''}${half} · ${String(r.reason || '').slice(0, 120)}`,
    tag: 'req-' + event.params.id, link: await appLink('#open=requests')
  });
}
async function handleTicket(event) {
  const t = event.data?.data(); if (!t) return;
  await push({
    title: `Ticket: ${t.name || t.phone} bina bataye gaya`,
    body: `${t.from ? fmt12(pkMinutes(new Date(Number(t.from)))) : ''} se${t.returnAt ? ' ' + fmt12(pkMinutes(new Date(Number(t.returnAt)))) + ' tak' : ' (abhi bahar)'} · ticket: ${t.byName || '—'} — faisla app mein`,
    tag: 'tkt-' + event.params.id, link: await appLink('#open=tickets')
  });
}
async function handleCheckIn(event) {
  const a = event.data?.data(); if (!a?.checkIn) return;
  const [cfg, own] = await Promise.all([config(), db.doc(`${BIZ}/staffSchedules/${a.phone}`).get()]);
  const sch = scheduleFor(cfg, own.exists ? own.data() : null);
  // pehli jaanch bina Firestore ke: waqt par aaya to aage kuch parhna hi nahi
  if (!lateOnCheckIn({ attendance: a, schedule: sch, date: a.date })) return;
  const requests = await rows('staffRequests', col('staffRequests').where('phone', '==', a.phone).where('kind', '==', 'leave'));
  const late = lateOnCheckIn({ attendance: a, schedule: sch, requests, date: a.date });
  if (!late) return;
  const name = a.name || (await db.doc(`${BIZ}/staffAccounts/${a.phone}`).get()).data()?.name || a.phone;
  await push({
    title: `${name} late aaya`,
    body: `${fmt12(parseTime(a.checkIn))} par Check-In — ${late} min late (duty ${fmt12(parseTime(sch.shiftStart))})`,
    tag: 'late-' + a.date + '-' + a.phone, link: await appLink()
  });
}

/* ---------- test: app se "Test notification bhejein" (pushTokens par testAt) ---------- */
async function handlePushTest(before, after) {
  if (!after?.token || !after.testAt || before?.testAt === after.testAt) return;
  const link = await appLink();
  await getMessaging().send({
    token: after.token,
    data: { title: 'NT Hazri — test', body: 'Notification theek chal raha hai.', tag: 'test', link },
    android: { priority: 'high' },
    webpush: { headers: { Urgency: 'high', TTL: '600' }, fcmOptions: { link } }
  }).catch(e => logger.error('test push', e));
}


/* ---------- v222: galla par SHAK — sirf malik ko (manager bhi staff hai, nigrani us ke liye band) ---------- */
/* ---------- v225: malik ki mangwayi clip tayyar (req -> ok) ---------- */
async function handleClip(event, before) {
  const c = event.data?.data(); if (!c || c.kind !== 'req' || c.status !== 'ok' || (before?.status || '') === 'ok') return;
  if (!(await camOn('clip'))) return;
  const t = ms => new Date(Number(ms) || Date.now()).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).toLowerCase();
  await push({ title: `Clip tayyar: ${c.title || t(c.from) + ' – ' + t(c.to)}`, body: 'Nigrani mein "Mangwayi hui clips" ke neeche ▶ Dekhein', tag: `clip-${event.params.id}`, kinds: ['owner'] });
}
/* ---------- v224: bill cancel / badla — sirf malik ko ---------- */
const money = n => 'Rs ' + Math.round(Number(n) || 0).toLocaleString('en-PK');
async function handlePosAlert(event) {
  const a = event.data?.data(); if (!a) return;
  if (!(await camOn('bill'))) return;
  const t = ms => new Date(Number(ms) || Date.now()).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).toLowerCase();
  const title = a.kind === 'cancel' ? `Bill cancel: #${a.no} · ${money(a.before)}` : a.kind === 'edit' ? `Bill badla: #${a.no} · ${money(a.before)} → ${money(a.after)}` : `Bill ke items badle: #${a.no} · ${money(a.before)}`;
  const body = `${t(a.at)} ka bill ${t(a.when)} par ${a.kind === 'cancel' ? 'cancel' : 'edit'} hua${a.by ? ' (' + a.by + ')' : ''}${a.replacedBy ? ` — naya #${a.replacedBy.no} ${money(a.replacedBy.amount)}` : ''} · Nigrani mein dekhein`;
  await push({ title, body, tag: `bill-${event.params.id}`, kinds: ['owner'] });
}
const FLOW_TXT = { aaya: 'paisa aaya', nikla: 'paisa nikla', len_den: 'len-den hua' };
async function handleCamEvent(event, before = null) {
  const e = event.data?.data(); if (!e) return;
  const time = new Date(Number(e.at) || Date.now()).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).toLowerCase();
  // naya event: shak par foran
  if (!before && e.verdict === 'shak') {
    if (!(await camOn('shak'))) return;
    await push({ title: `Galla: shak · ${e.camName || 'camera'} · ${time}`, body: `${String(e.why || 'AI ko shak hua').slice(0, 140)} — photos Nigrani mein`, tag: `cam-${event.params.id}`, kinds: ['owner'] });
    return;
  }
  // v234: AI ko parchi saaf nazar nahi aayi — sirf jab malik ne chalu kiya ho (default band)
  if (!before && e.verdict === 'saaf_nahi' && (e.flags || []).includes('parchi_saaf')) {
    if (await camOn('saaf', false)) await push({ title: `Galla: parchi saaf nahi · ${e.camName || 'camera'} · ${time}`, body: `${String(e.why || '').slice(0, 140)} — photos Nigrani mein`, tag: `cams-${event.params.id}`, kinds: ['owner'] });
    return;
  }
  // v223 GALLA MILAAN: 5 minute tak bill / entry na mili (wait -> missing) — sirf aik dafa
  if (e.matchState === 'missing' && (before?.matchState || '') !== 'missing' && e.verdict !== 'shak') {
    if (!(await camOn('shak'))) return;
    await push({ title: `Galla: entry nahi · ${e.camName || 'camera'} · ${time}`, body: `${FLOW_TXT[e.flow] || 'paisa hila'} lekin POS bill / Galla screen entry nahi mili — photos Nigrani mein`, tag: `camm-${event.params.id}`, kinds: ['owner'] });
  }
}

/* ---------- v219: AIK HI JAGTI FUNCTION — sab foran wali khabrein ----------
   Pehle chaar alag functions thin (onOut FAST, baqi NORMAL = so jati thin, 1-2 minute der). Ab aik hi function (minInstances 1)
   businesses/noor-traders ki har likhai sunti hai aur kaam ki cheez par foran khabar deti hai: parchi, chutti/correction, ticket,
   late Check-In, aur "Test notification". Jagta instance aik hi hai — kharcha taqreeban pehle jitna. Baqi likhai (audit, selfie,
   diag, Blue Khata waghera) par foran wapas (chand millisecond). */
export const onHazriWrite = onDocumentWritten({ ...FAST, document: `${BIZ}/{coll}/{docId}` }, async event => {
  const { coll, docId } = event.params || {};
  const before = event.data?.before, after = event.data?.after;
  if (!after?.exists) return;                                   // mitaya gaya
  const created = !before?.exists, ev = { data: after, params: { id: docId } };
  try {
    if (coll === 'pushTokens') return await handlePushTest(before?.exists ? before.data() : null, after.data());
    if (coll === 'cameraEvents' && !created) return await handleCamEvent(ev, before.data()); // v223: milaan badla (wait -> missing)
    if (coll === 'cameraClips' && !created) return await handleClip(ev, before.data()); // v225: farmaish wali clip tayyar
    if (!created) return;
    if (coll === 'staffOuts') return await handleOut(ev);
    if (coll === 'staffRequests') return await handleRequest(ev);
    if (coll === 'staffTickets') return await handleTicket(ev);
    if (coll === 'staffAttendance') return await handleCheckIn(ev);
    if (coll === 'cameraEvents') return await handleCamEvent(ev);
    if (coll === 'posAlerts') return await handlePosAlert(ev);
  } catch (error) { logger.error('khabar', coll, docId, error); }
});

/* ---------- khud aane wali khabrein (har 15 minute par jaanch) ---------- */
const stateRef = date => db.doc(`${BIZ}/pushState/${date}`);
export const watchDay = onSchedule({ ...NORMAL, schedule: 'every 15 minutes', timeZone: TZ }, async () => {
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
  // v234: 4) Camera PC band — dukaan ke waqt (9 am - 10 pm) 20 minute se PC ki khabar nahi (aik dafa; wapas aaye to phir se)
  try {
    const pc = (await db.doc(`${BIZ}/cameraPC/status`).get()).data();
    if (pc?.at && (await camOn('pcband'))) {
      const down = now - Number(pc.at) > 20 * 60000, open = nowMin >= 9 * 60 && nowMin <= 22 * 60;
      if (down && open && !state.camDown) {
        await push({ title: 'Camera PC band hai', body: `${pc.host || 'PC'} ne ${Math.round((now - Number(pc.at)) / 60000)} minute se khabar nahi bheji — nigrani ruki hui. PC / laptop on karein.`, tag: 'camdown-' + date, kinds: ['owner'] });
        await stateRef(date).set({ camDown: true }, { merge: true });
      } else if (!down && state.camDown) await stateRef(date).set({ camDown: false }, { merge: true });
    }
  } catch (err) { logger.error('camera pc band', err); }
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
export const monthlySalary = onSchedule({ ...NORMAL, schedule: '0 10 1 * *', timeZone: TZ }, async () => {
  const cfg = await config();
  if (cfg.push?.on === false) return;
  const d = new Date(), prev = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 15)).toISOString().slice(0, 7);
  const [staff, payroll] = await Promise.all([rows('staffAccounts'), rows('staffPayroll')]);
  const open = staff.filter(s => s.active !== false).filter(s => payroll.find(p => p.id === `${prev}_${s.phone}`)?.state !== 'final');
  if (!open.length) return;
  await push({ title: 'Pichle mahine ki salary final karna baqi hai', body: `${open.length} staff: ${list(open.map(s => s.name || s.phone))}`, tag: 'salary-' + prev, link: await appLink('#open=salary') });
});
