// index.js — Noor Traders Hazri ke notifications (Firebase Cloud Functions, Node 22 — v251: Google ne Node 20 runtime 31 Oct 2026 ko band kiya, deploy 22 par).
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';
import { timingSafeEqual } from 'node:crypto';
import { logger } from 'firebase-functions';
import { pkDate, pkMinutes, parseTime, fmt12, scheduleFor, notArrived, checkoutPending, breaksOverdue, lateOnCheckIn, list, blueSummary } from './logic.js';

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
  // v250 (PC v2.21): galle se paisa bahar ('bahar' flag) — kisi aur / mulazim / jeb ko = alag khabar (setting 'aurko', default chalu);
  // usi customer ko baqaya = sirf jab malik chalu kare ('baqaya', default band). Bina parchi (screen 1) pehle jaisa 'shak' setting se.
  const fl = e.flags || [], bahar = fl.includes('bahar');
  const aur = bahar && e.verdict === 'shak' && ['aurko', 'mulazim', 'jeb'].some(f => fl.includes(f));
  const shak1 = e.verdict === 'shak' && (!bahar || fl.includes('noparchi') || fl.includes('noparchi_out'));
  if (!before && (aur || shak1)) {
    if (aur && await camOn('aurko')) {
      await push({ title: `Galla: paisa kisi aur ko · ${e.camName || 'camera'} · ${time}`, body: `${String(e.why || 'Galle se paisa baqaya ke ilawa diya').slice(0, 140)} — video Nigrani > Galle se bahar`, tag: `cam-${event.params.id}`, kinds: ['owner'] });
      return;
    }
    if (!shak1 || !(await camOn('shak'))) return;
    await push({ title: `Galla: shak · ${e.camName || 'camera'} · ${time}`, body: `${String(e.why || 'AI ko shak hua').slice(0, 140)} — photos Nigrani mein`, tag: `cam-${event.params.id}`, kinds: ['owner'] });
    return;
  }
  if (!before && bahar && fl.includes('baqaya') && e.verdict === 'normal') {
    if (await camOn('baqaya', false)) await push({ title: `Galla: baqaya diya · ${e.camName || 'camera'} · ${time}`, body: `${String(e.why || '').slice(0, 140)} — Nigrani > Galle se bahar`, tag: `camb-${event.params.id}`, kinds: ['owner'] });
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

/* ---------- v251: 👥 BLUE KHATA KO AAJ KI HAZRI (malik: "hazri app ko Blue Khata se jor do, larkon ki report WhatsApp par") ----------
   Blue Khata ALAG Firebase project hai. Malik Blue Khata se "👥 Hazri app jorein" dabata hai -> hazri app chaabi cameraPC/vault.blue.k
   mein rakhti hai (sirf malik + camera PC parh sakte) -> yeh function aaj ka khulasa Blue Khata ke hazriIn mein {k, p} REST se likhta hai
   (wahan ke rules chaabi jaanchte hain) -> dukan ka PC (raat-report) WhatsApp par bhejta hai. Chaabi na ho = kuch nahi. Hazri mein kuch nahi likhta. */
const BLUE_URL = 'https://firestore.googleapis.com/v1/projects/note-traders-khata-7ccc1/databases/(default)/documents/businesses/noor-traders/hazriIn';
let blueK = '', blueKAt = 0, blueStat = null, blueStatAt = 0, blueLast = '', blueAt = 0, blueBusy = false;
async function blueSync(force = false) {
  if (blueBusy || (!force && Date.now() - blueAt < 20000)) return 0;
  blueBusy = true;
  try {
    if (Date.now() - blueKAt > 60000) { blueK = String(((await db.doc(`${BIZ}/cameraPC/vault`).get()).data() || {}).blue?.k || ''); blueKAt = Date.now(); }
    if (blueK.length < 24) return 0;
    const date = pkDate();
    if (!blueStat || Date.now() - blueStatAt > 5 * 60000) {   // staff / duty / chutti 5 minute yaad — har likhai par dobara parhna na pade
      const [staff, requests, schedules] = await Promise.all([rows('staffAccounts'), rows('staffRequests', col('staffRequests').where('kind', '==', 'leave')), schedulesMap()]);
      blueStat = { staff, requests, schedules }; blueStatAt = Date.now();
    }
    const [cfg, attendance, outs, tickets, pend] = await Promise.all([config(),
      rows('staffAttendance', col('staffAttendance').where('date', '==', date)),
      rows('staffOuts', col('staffOuts').where('date', '==', date)),
      rows('staffTickets', col('staffTickets').where('date', '==', date)),
      rows('staffRequests', col('staffRequests').where('status', '==', 'pending'))]);
    const sum = blueSummary({ ...blueStat, attendance, outs, tickets, pend, config: cfg, date, now: Date.now() });
    const sig = JSON.stringify(sum.rows) + JSON.stringify(sum.rq) + sum.d + sum.closed;
    blueAt = Date.now();
    if (!force && sig === blueLast) return 0;
    const res = await fetch(BLUE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8000),
      body: JSON.stringify({ fields: { k: { stringValue: blueK }, p: { stringValue: JSON.stringify(sum) } } }) });
    if (!res.ok) { logger.warn('blue khata ne nahi liya', res.status, (await res.text()).slice(0, 200)); return 0; }
    blueLast = sig; return 1;
  } finally { blueBusy = false; }
}

/* ---------- v252: 🚶 WHATSAPP SE BAHAR JANE KI REQUEST (malik 14 Nov: "larka Business number par apna code likhe -> wajah chune -> roz ki pehli 2 khud manzoor,
   hamein sirf khabar · teesri se hum WhatsApp par OK karein") ----------
   Dukan ka PC (Blue Khata wa-out / hz-wa) yahan POST karta hai, WAHI chaabi (cameraPC/vault.blue.k). Yeh function sirf staffOuts likhta hai — wohi record jo app banati hai
   (salary / report / push sab pehle jaisa). a: out {phone, reason, minutes, free} · ok / no {id, by} · back {phone, by} · in {phones, by} · unin {phone, by}. Chaabi ghalat = 403. */
async function blueAct(b) {
  const a = String(b.a || ''), date = pkDate(), now = Date.now(), by = String(b.by || 'WhatsApp').slice(0, 60);
  const todayOf = async phone => (await rows('staffOuts', col('staffOuts').where('date', '==', date))).filter(o => o.phone === phone);
  if (a === 'out') {
    const phone = String(b.phone || '').slice(0, 20), acc = phone ? (await db.doc(`${BIZ}/staffAccounts/${phone}`).get()).data() : null;
    if (!acc || acc.active === false) return { ok: false, err: 'staff' };
    const mine = (await todayOf(phone)).filter(o => ['pending', 'approved', 'returned'].includes(o.status));
    if (mine.some(o => o.status === 'approved' && !o.returnAt)) return { ok: false, err: 'out' };
    if (mine.some(o => o.status === 'pending')) return { ok: false, err: 'pending' };
    const n = mine.filter(o => o.kind !== 'break').length + 1, free = Math.max(0, Math.min(10, Number.isFinite(Number(b.free)) ? Number(b.free) : 2)), auto = n <= free;
    const ref = col('staffOuts').doc(), name = String(acc.name || phone).slice(0, 80);
    const doc = { phone, name, date, reason: String(b.reason || 'Bahar').slice(0, 40), note: 'WhatsApp se (' + by + ')', minutes: Math.max(5, Math.min(480, Math.round(Number(b.minutes) || 30))),
      status: auto ? 'approved' : 'pending', requestedAt: now, serverAt: FieldValue.serverTimestamp(), by: 'whatsapp', via: 'wa' };
    if (auto) Object.assign(doc, { approvedAt: now, outAt: now, approvedBy: 'whatsapp', approvedByName: `Khud (roz ki pehli ${free})`, ownerNote: '' });
    await ref.set(doc);
    return { ok: true, id: ref.id, st: doc.status, n, name };
  }
  if (a === 'ok' || a === 'no') {
    const ref = col('staffOuts').doc(String(b.id || 'x').slice(0, 80));
    return db.runTransaction(async tx => {
      const sn = await tx.get(ref), o = sn.exists ? sn.data() : null;
      if (!o) return { ok: false, err: 'gone' };
      if (o.status !== 'pending') return { ok: false, err: 'done', st: o.status, by: String(o.approvedByName || ''), name: o.name || '', phone: o.phone || '' };
      tx.set(ref, a === 'ok' ? { status: 'approved', approvedAt: now, outAt: now, approvedBy: 'whatsapp', approvedByName: by, ownerNote: 'WhatsApp se' }
        : { status: 'rejected', rejectedAt: now, approvedBy: 'whatsapp', approvedByName: by, ownerNote: 'WhatsApp se' }, { merge: true });
      return { ok: true, st: a === 'ok' ? 'approved' : 'rejected', name: o.name || '', phone: o.phone || '', reason: o.reason || '' };
    });
  }
  if (a === 'back') {
    const phone = String(b.phone || '').slice(0, 20), o = (await todayOf(phone)).filter(x => x.status === 'approved' && !x.returnAt && Number(x.outAt) > 0).sort((x, y) => Number(y.outAt) - Number(x.outAt))[0];
    if (!o) return { ok: false, err: 'notout' };
    await col('staffOuts').doc(o.id).set({ status: 'returned', returnAt: now, returnBy: 'whatsapp', returnByName: by, returnServerAt: FieldValue.serverTimestamp() }, { merge: true });
    return { ok: true, mins: Math.max(0, Math.round((now - Number(o.outAt)) / 60000)), reason: o.reason || '', name: o.name || '' };
  }
  // v255 (malik 15 Nov: 'number select kar ke hazri lag jaye — duty par aane ka waqt ho · sirf main / Mubeen'): a: in {phones[], by} = aaj ki hazri ABHI ke waqt par
  //   (wohi record jo malik ki app 'Malik ne lagayi' banati hai — manual, via wa). Pehle se lagi = nahi chhuti. a: unin {phone, by} = sirf WhatsApp wali, bina Check-Out hazri wapas.
  if (a === 'in') {
    const phones = [...new Set((Array.isArray(b.phones) ? b.phones : [b.phone]).map(x => String(x || '').slice(0, 20)).filter(Boolean))].slice(0, 60);
    if (!phones.length) return { ok: false, err: 'a' };
    const [cfg, scheds] = await Promise.all([config(), schedulesMap()]), min = pkMinutes(), hhmm = String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
    const sc = { m10: 10, m20: 8, m30: 6, m45: 4, late: 2, ...(cfg.scores || {}) }, score = m => m <= 10 ? +sc.m10 : m <= 20 ? +sc.m20 : m <= 30 ? +sc.m30 : m <= 45 ? +sc.m45 : +sc.late;
    const res = [];
    for (const phone of phones) {
      const acc = (await db.doc(`${BIZ}/staffAccounts/${phone}`).get()).data();
      if (!acc || acc.active === false) { res.push({ phone, st: 'staff' }); continue; }
      const sch = scheduleFor(cfg, scheds[phone] || null), start = parseTime(sch.shiftStart), late = start == null ? 0 : Math.max(0, min - start), auto = score(Math.max(0, late - Number(sch.grace ?? 10) + 10));
      const id = `${date}_${phone}`, ref = col('staffAttendance').doc(id), name = String(acc.name || phone).slice(0, 80);
      const r = await db.runTransaction(async tx => {
        const sn = await tx.get(ref), o = sn.exists ? sn.data() : null;
        if (o && o.checkIn) return { phone, st: 'had', name, t: String(o.checkIn).slice(0, 5) };
        tx.set(ref, { id, date, phone, name, checkIn: hhmm, minutesLate: late, autoScore: auto, finalScore: auto, shiftStart: sch.shiftStart || '', ownerNote: 'WhatsApp se (' + by + ')',
          editedAt: now, editedBy: 'whatsapp', checkInTs: null, manual: true, via: 'wa' }, { merge: true });
        return { phone, st: 'ok', name, t: hhmm, late };
      });
      res.push(r);
    }
    return { ok: true, res, t: hhmm };
  }
  if (a === 'unin') {
    const phone = String(b.phone || '').slice(0, 20), ref = col('staffAttendance').doc(`${date}_${phone}`);
    return db.runTransaction(async tx => {
      const sn = await tx.get(ref), o = sn.exists ? sn.data() : null;
      if (!o || !o.checkIn) return { ok: false, err: 'none' };
      if (o.via !== 'wa' || !o.manual) return { ok: false, err: 'own', name: o.name || '' };
      if (o.checkOut) return { ok: false, err: 'outdone', name: o.name || '' };
      tx.delete(ref);
      return { ok: true, name: o.name || '', t: String(o.checkIn).slice(0, 5) };
    });
  }
  return { ok: false, err: 'a' };
}
export const bluein = onRequest({ region, memory: '256MiB', invoker: 'public', maxInstances: 5 }, async (req, res) => {
  try {
    if (req.method !== 'POST') { res.status(405).json({ ok: false, err: 'method' }); return; }
    const b = req.body && typeof req.body === 'object' ? req.body : {};
    if (Date.now() - blueKAt > 60000) { blueK = String(((await db.doc(`${BIZ}/cameraPC/vault`).get()).data() || {}).blue?.k || ''); blueKAt = Date.now(); }
    const k = Buffer.from(String(b.k || '')), want = Buffer.from(blueK);
    if (want.length < 24 || k.length !== want.length || !timingSafeEqual(k, want)) { res.status(403).json({ ok: false, err: 'key' }); return; }
    res.json(await blueAct(b));
  } catch (error) { logger.error('bluein', error); res.status(500).json({ ok: false, err: String(error?.message || error).slice(0, 120) }); }
});

/* ---------- v219: AIK HI JAGTI FUNCTION — sab foran wali khabrein ----------
   Pehle chaar alag functions thin (onOut FAST, baqi NORMAL = so jati thin, 1-2 minute der). Ab aik hi function (minInstances 1)
   businesses/noor-traders ki har likhai sunti hai aur kaam ki cheez par foran khabar deti hai: parchi, chutti/correction, ticket,
   late Check-In, aur "Test notification". Jagta instance aik hi hai — kharcha taqreeban pehle jitna. Baqi likhai (audit, selfie,
   diag, Blue Khata waghera) par foran wapas (chand millisecond). */
export const onHazriWrite = onDocumentWritten({ ...FAST, document: `${BIZ}/{coll}/{docId}` }, async event => {
  const { coll, docId } = event.params || {};
  const before = event.data?.before, after = event.data?.after;
  // v251: hazri / bahar / ticket / chutti ki har likhai (mitana bhi) + chaabi lagte hi -> Blue Khata ko taza khulasa (khabar ke saath saath, us ko rokta nahi)
  const vault = coll === 'cameraPC' && docId === 'vault';
  if (vault) blueKAt = 0;
  if (coll === 'staffRequests') blueStatAt = 0;
  const blueP = (vault || ['staffAttendance', 'staffOuts', 'staffTickets', 'staffRequests'].includes(coll)) ? blueSync(vault).catch(error => logger.error('blue khata', error)) : null;
  if (!after?.exists) { await blueP; return; }                  // mitaya gaya
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
  finally { await blueP; }
});

/* ---------- khud aane wali khabrein (har 15 minute par jaanch) ---------- */
const stateRef = date => db.doc(`${BIZ}/pushState/${date}`);
export const watchDay = onSchedule({ ...NORMAL, schedule: 'every 15 minutes', timeZone: TZ }, async () => {
  const date = pkDate(), nowMin = pkMinutes(), now = Date.now();
  try { await blueSync(true); } catch (error) { logger.error('blue khata', error); }   // v251: har 15 minute zaroor (din badalna, PC ne mita diya ho)
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
