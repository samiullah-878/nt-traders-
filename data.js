// data.js — Firebase se baat sirf yahan hoti hai. sdk bahar se aata hai (boot.js asal SDK deta hai, test naqli).
import {
  BUSINESS_ID, DEFAULT_CONFIG, SHOP, normalizePhone, normalizeAttendance, pkDate, pkTime24, pkMinutes, parseTime, to24,
  monthRange, addMonths, resolveSchedule, lateMinutes, scoreForLate, salaryCalc, salarySnapshot, isMonth, isDate
} from './core.js';
import { isOwnerUser } from './auth.js';

const clean = value => JSON.parse(JSON.stringify(value ?? null));
const timeout = (promise, ms) => { let t; return Promise.race([promise, new Promise((_, reject) => { t = setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'app/slow-network' })), ms); })]).finally(() => clearTimeout(t)); };

export function createData({ sdk, firebaseConfig, onChange = () => {}, onProblem = () => {} }) {
  const app = sdk.initializeApp(firebaseConfig);
  let auth;
  try {
    auth = sdk.initializeAuth
      ? sdk.initializeAuth(app, { persistence: [sdk.indexedDBLocalPersistence, sdk.browserLocalPersistence, sdk.inMemoryPersistence].filter(Boolean) })
      : sdk.getAuth(app);
  } catch { auth = sdk.getAuth(app); }
  let fs;
  try {
    // Phone mein local copy: kamzor internet par bhi screen khulti hai aur hazri qataar mein mehfooz rehti hai.
    fs = sdk.initializeFirestore && sdk.persistentLocalCache
      ? sdk.initializeFirestore(app, { localCache: sdk.persistentLocalCache({ tabManager: sdk.persistentMultipleTabManager?.() }) })
      : sdk.getFirestore(app);
  } catch { fs = sdk.getFirestore(app); }

  const col = name => sdk.collection(fs, 'businesses', BUSINESS_ID, name);
  const ref = (name, id) => sdk.doc(fs, 'businesses', BUSINESS_ID, name, id);

  const state = fresh();
  function fresh() {
    return {
      role: null, phone: '', loaded: new Set(), config: { ...DEFAULT_CONFIG },
      staff: [], months: new Map(), requests: [], schedules: new Map(), payroll: [],
      account: null, myAttendance: []
    };
  }
  let unsubs = [], monthSubs = new Map(), epoch = 0, legacyChecked = false;
  const changed = () => onChange(state);
  const live = (query, name, handler) => {
    const token = epoch;
    unsubs.push(sdk.onSnapshot(query, snap => { if (token !== epoch) return; handler(snap); state.loaded.add(name); changed(); },
      error => { if (token === epoch) onProblem(name, error); }));
  };
  function stop() {
    epoch++;
    for (const u of unsubs) try { u(); } catch { /* ignore */ }
    for (const u of monthSubs.values()) try { u(); } catch { /* ignore */ }
    unsubs = []; monthSubs = new Map(); legacyChecked = false;
    Object.assign(state, fresh());
  }
  const readConfig = snap => {
    if (!snap.exists()) return;
    const d = clean(snap.data());
    state.config = { ...DEFAULT_CONFIG, ...d, scores: { ...DEFAULT_CONFIG.scores, ...(d.scores || {}) } };
  };
  const readList = snap => { const out = []; snap.forEach(d => out.push({ id: d.id, ...clean(d.data()) })); return out; };
  const toAccount = (id, d) => ({ ...d, id, phone: normalizePhone(d.phone || id) || id, name: d.name || id });

  /* ---------- owner ---------- */
  function startOwner() {
    stop(); state.role = 'owner';
    live(ref('staffConfig', 'main'), 'config', readConfig);
    live(col('staffAccounts'), 'staff', snap => {
      state.staff = readList(snap).map(d => toAccount(d.id, d)).sort((a, b) => String(a.name).localeCompare(String(b.name)));
      if (!state.staff.length && !legacyChecked) { legacyChecked = true; void importLegacyStaff(); }
    });
    live(col('staffRequests'), 'requests', snap => { state.requests = readList(snap).map(r => ({ ...r, phone: normalizePhone(r.phone) || r.phone })); });
    live(col('staffSchedules'), 'schedules', snap => { state.schedules = new Map(readList(snap).map(s => [s.id, s])); });
    live(col('staffPayroll'), 'payroll', snap => { state.payroll = readList(snap); });
    const month = pkDate().slice(0, 7);
    watchMonth(month); watchMonth(addMonths(month, -1));
  }
  /** Purani app sirf "staff" collection mein likhti thi. Agar naye accounts khali hon to wahan se utha lo. */
  async function importLegacyStaff() {
    try {
      const snap = await sdk.getDocs(col('staff'));
      for (const d of readList(snap)) {
        const phone = normalizePhone(d.phone || d.id); if (!phone) continue;
        await sdk.setDoc(ref('staffAccounts', phone), clean({ name: d.name || '', role: d.role || 'Staff', address: d.address || '', phone, photo: d.photo || '', active: d.active !== false, loginEnabled: d.loginEnabled !== false, salary: d.salary || null, salaryExtras: d.salaryExtras || [], updatedAt: Date.now() }), { merge: true });
      }
    } catch (error) { onProblem('legacy-staff', error); }
  }
  /** Poori history nahi, sirf zaroorat ka mahina load hota hai (selfie wale record bhari hote hain). */
  function watchMonth(month) {
    if (!isMonth(month) || state.role !== 'owner') return;
    if (monthSubs.has(month)) return;
    if (monthSubs.size >= 6) { // purana mahina chhor do
      const current = pkDate().slice(0, 7), keep = new Set([current, addMonths(current, -1), month]);
      const oldest = [...monthSubs.keys()].find(m => !keep.has(m));
      if (oldest) { try { monthSubs.get(oldest)(); } catch { /* ignore */ } monthSubs.delete(oldest); state.months.delete(oldest); }
    }
    const { from, to } = monthRange(month), token = epoch;
    const q = sdk.query(col('staffAttendance'), sdk.where('date', '>=', from), sdk.where('date', '<=', to));
    monthSubs.set(month, sdk.onSnapshot(q, snap => {
      if (token !== epoch) return;
      const rows = []; snap.forEach(d => rows.push(normalizeAttendance(clean(d.data()), d.id)));
      state.months.set(month, rows); state.loaded.add('att:' + month); changed();
    }, error => { if (token === epoch) onProblem('attendance', error); }));
  }
  function attendanceBetween(from, to) {
    const out = [];
    for (const rows of state.months.values()) for (const a of rows) if (a.date >= from && a.date <= to) out.push(a);
    return out;
  }
  const allAttendance = () => state.role === 'staff' ? state.myAttendance : [...state.months.values()].flat();
  const monthLoaded = month => state.role === 'staff' ? state.loaded.has('myAttendance') : state.loaded.has('att:' + month);

  /* ---------- staff ---------- */
  function startStaff(phone, cachedAccount) {
    stop(); state.role = 'staff'; state.phone = phone;
    state.account = cachedAccount ? toAccount(phone, cachedAccount) : null;
    live(ref('staffConfig', 'main'), 'config', readConfig);
    live(ref('staffAccounts', phone), 'account', snap => { if (snap.exists()) state.account = toAccount(phone, clean(snap.data())); });
    const mine = name => sdk.query(col(name), sdk.where('phone', '==', phone));
    live(mine('staffAttendance'), 'myAttendance', snap => {
      const rows = []; snap.forEach(d => rows.push(normalizeAttendance(clean(d.data()), d.id)));
      state.myAttendance = rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    });
    live(mine('staffRequests'), 'requests', snap => { state.requests = readList(snap); });
    live(mine('staffSchedules'), 'schedules', snap => { state.schedules = new Map(readList(snap).map(s => [s.id, s])); });
    live(mine('staffPayroll'), 'payroll', snap => { state.payroll = readList(snap); });
  }

  /* ---------- helpers ---------- */
  function guardOwner() { if (state.role !== 'owner' || !isOwnerUser(auth.currentUser)) throw new Error('Malik ka login zaroori hai.'); }
  function audit(tx, type, target, before, after, reason) {
    tx.set(sdk.doc(col('staffAudit')), { type, target, before: JSON.stringify(before ?? null), after: JSON.stringify(after ?? null), reason: reason || '', by: auth.currentUser.uid, at: Date.now() });
  }
  const scheduleFor = phone => resolveSchedule(state.config, state.schedules.get(phone));
  const payrollFor = (phone, month) => state.payroll.find(p => p.id === `${month}_${phone}`) || null;
  function calcFor(account, month) {
    const { from, to } = monthRange(month);
    const recs = state.role === 'staff' ? state.myAttendance.filter(a => a.date >= from && a.date <= to) : attendanceBetween(from, to);
    return salaryCalc({ account, month, attendance: recs, payroll: payrollFor(account.phone, month) });
  }
  /** Purani app salary settings/main mein bhi rakhti thi; dono jagah barabar rakhte hain. Fail ho to koi masla nahi. */
  async function mirrorSalaryToSettings(phone, salary, extras) {
    if (!sdk.updateDoc) return;
    try { await sdk.updateDoc(ref('settings', 'main'), { [`salaryConfig.${phone}`]: clean(salary || {}), [`salaryExtras.${phone}`]: clean(extras || []) }); } catch { /* purana doc nahi hai */ }
  }

  /* ---------- owner: staff ---------- */
  async function saveStaff(input, originalPhone = '') {
    guardOwner();
    const phone = normalizePhone(input.phone);
    if (!phone) throw new Error('Mobile number 11 hindson ka likhein, jaise 03001234567.');
    if (!String(input.name || '').trim()) throw new Error('Naam likhein.');
    const old = originalPhone ? state.staff.find(s => s.phone === originalPhone) : null;
    if (originalPhone && originalPhone !== phone) throw new Error('Number badalna ho to naya staff banayein aur purana band kar dein (hazri purane number par hi rehti hai).');
    if (!old && state.staff.some(s => s.phone === phone)) throw new Error('Is number ka staff pehle se mojood hai.');
    const salary = {
      ...(old?.salary || {}),
      monthlySalary: Number(input.monthlySalary || 0), dutyHours: Number(input.dutyHours || 10), workingDays: Number(input.workingDays || 30),
      overtimeRate: Number(input.overtimeRate || 0), pointRate: Number(input.pointRate ?? old?.salary?.pointRate ?? 0),
      mealMode: ['daily', 'monthly', 'none'].includes(input.mealMode) ? input.mealMode : 'none', mealRate: Math.max(0, Number(input.mealRate || 0)), mealInSalary: !!input.mealInSalary
    };
    const account = clean({
      name: String(input.name).trim(), role: String(input.role || 'Staff').trim() || 'Staff', address: String(input.address || '').trim(), phone,
      photo: input.photo ?? old?.photo ?? '', active: input.active !== false, loginEnabled: input.loginEnabled !== false,
      joinDate: isDate(input.joinDate) ? input.joinDate : (old?.joinDate || (old ? '' : pkDate())),
      salary, salaryExtras: old?.salaryExtras || [], updatedAt: Date.now()
    });
    const schedule = clean({
      phone, useDefaultShift: input.useDefaultShift !== false, shiftStart: input.shiftStart || state.config.shiftStart || '09:00', shiftEnd: input.shiftEnd || '',
      grace: Math.max(0, Number(input.grace ?? 10)), weeklyOff: input.weeklyOff === '' || input.weeklyOff == null ? [] : [Number(input.weeklyOff)]
    });
    await sdk.runTransaction(fs, async tx => {
      tx.set(ref('staffAccounts', phone), account, { merge: true });
      tx.set(ref('staff', phone), { ...account, id: phone }, { merge: true }); // purani hisab app ke liye
      tx.set(ref('staffSchedules', phone), schedule, { merge: true });
      if (JSON.stringify(old?.salary || null) !== JSON.stringify(salary)) audit(tx, 'salary settings', phone, old?.salary || null, salary, old ? 'Malik ne salary settings badli' : 'Naya staff');
    });
    void mirrorSalaryToSettings(phone, salary, account.salaryExtras);
    return phone;
  }
  async function deleteStaff(phone) {
    guardOwner();
    await sdk.runTransaction(fs, async tx => {
      const r = ref('staffAccounts', phone), snap = await tx.get(r);
      tx.delete(r); tx.delete(ref('staff', phone));
      audit(tx, 'staff delete', phone, snap.exists() ? { name: snap.data().name } : null, null, 'Malik ne staff delete kiya');
    });
  }
  async function saveConfig(patch) {
    guardOwner();
    const next = clean({ shiftStart: patch.shiftStart || '09:00', shiftEnd: patch.shiftEnd || '', radius: Math.max(20, Number(patch.radius || SHOP.radius)), instruction: String(patch.instruction || '') });
    await sdk.runTransaction(fs, async tx => {
      tx.set(ref('staffConfig', 'main'), next, { merge: true });
      audit(tx, 'settings', 'main', { shiftStart: state.config.shiftStart, shiftEnd: state.config.shiftEnd, radius: state.config.radius }, next, 'Malik ne settings badli');
    });
  }

  /* ---------- owner: attendance ---------- */
  async function saveAttendance({ phone, date, checkIn, checkOut, note, finalScore }) {
    guardOwner();
    if (!isDate(date)) throw new Error('Tareekh durust nahi.');
    if (date > pkDate()) throw new Error('Aane wali tareekh ki hazri nahi lag sakti.');
    const inT = to24(checkIn), outT = to24(checkOut);
    if (!inT) throw new Error('Aane ka waqt likhein.');
    if (checkOut && !outT) throw new Error('Jane ka waqt durust nahi.');
    const account = state.staff.find(s => s.phone === phone) || { phone, name: phone };
    const schedule = scheduleFor(phone), id = `${date}_${phone}`;
    const late = lateMinutes({ checkIn: inT }, schedule);
    const autoScore = scoreForLate(Math.max(0, late - Number(schedule.grace ?? 10) + 10), state.config.scores);
    await sdk.runTransaction(fs, async tx => {
      const r = ref('staffAttendance', id), snap = await tx.get(r), before = snap.exists() ? snap.data() : null;
      const patch = clean({
        id, date, phone, name: account.name || '', checkIn: inT, checkOut: outT, minutesLate: late, autoScore,
        finalScore: finalScore === '' || finalScore == null ? (before?.finalScore != null && before.checkIn === inT ? before.finalScore : autoScore) : Math.max(0, Math.min(10, Number(finalScore))),
        shiftStart: schedule.shiftStart || '', ownerNote: String(note || ''), editedAt: Date.now(), editedBy: auth.currentUser.uid
      });
      if (!before) { patch.checkInTs = null; patch.manual = true; }
      if (before && to24(before.checkIn) !== inT) patch.checkInTs = null;
      if (before && to24(before.checkOut) !== outT) patch.checkOutTs = null;
      tx.set(r, patch, { merge: true });
      const light = before ? { checkIn: before.checkIn || '', checkOut: before.checkOut || '', finalScore: before.finalScore ?? null } : null;
      audit(tx, 'attendance', id, light, { checkIn: inT, checkOut: outT, finalScore: patch.finalScore }, note || 'Malik ne hazri durust ki');
    });
  }
  async function deleteAttendance(id, reason) {
    guardOwner();
    await sdk.runTransaction(fs, async tx => {
      const r = ref('staffAttendance', id), snap = await tx.get(r);
      if (!snap.exists()) return;
      const b = snap.data(); tx.delete(r);
      audit(tx, 'attendance delete', id, { checkIn: b.checkIn || '', checkOut: b.checkOut || '' }, null, reason || 'Malik ne hazri hatayi');
    });
  }
  /** Malik khud chutti laga de (staff ki request ke baghair). */
  async function markLeave({ phone, date, to, reason }) {
    guardOwner();
    if (!isDate(date) || !isDate(to || date) || (to || date) < date) throw new Error('Chutti ki tareekh durust likhein.');
    const id = sdk.doc(col('staffRequests')).id;
    await sdk.setDoc(ref('staffRequests', id), clean({ phone, kind: 'leave', date, to: to || date, checkIn: '', checkOut: '', reason: String(reason || 'Malik ne chutti lagayi'), status: 'approved', createdAt: Date.now(), by: auth.currentUser.uid, ownerNote: 'Malik ne lagayi', reviewedAt: Date.now(), reviewedBy: auth.currentUser.uid }));
  }
  async function cancelLeave(id) { guardOwner(); await sdk.setDoc(ref('staffRequests', id), { status: 'rejected', ownerNote: 'Chutti cancel', reviewedAt: Date.now(), reviewedBy: auth.currentUser.uid }, { merge: true }); }
  async function reviewRequest(id, status, note = '') {
    guardOwner();
    await sdk.runTransaction(fs, async tx => {
      const rr = ref('staffRequests', id), snap = await tx.get(rr);
      if (!snap.exists() || snap.data().status !== 'pending') throw new Error('Ye request pehle hi dekhi ja chuki hai.');
      const r = snap.data(), phone = normalizePhone(r.phone) || r.phone;
      const patch = { status, ownerNote: note, reviewedAt: Date.now(), reviewedBy: auth.currentUser.uid };
      if (r.kind === 'correction' && status === 'approved') {
        const ar = ref('staffAttendance', `${r.date}_${phone}`), old = await tx.get(ar);
        const p = { ownerNote: note || 'Correction manzoor', editedAt: Date.now(), editedBy: auth.currentUser.uid };
        if (r.checkIn) { p.checkIn = to24(r.checkIn) || r.checkIn; p.checkInTs = null; p.minutesLate = lateMinutes({ checkIn: p.checkIn }, scheduleFor(phone)); }
        if (r.checkOut) { p.checkOut = to24(r.checkOut) || r.checkOut; p.checkOutTs = null; }
        if (!old.exists()) {
          if (!r.checkIn) throw new Error('Us din ki hazri nahi hai aur request mein aane ka waqt bhi nahi. "Hazri durust karein" se khud lagayein.');
          Object.assign(p, { id: ar.id, date: r.date, phone, name: state.staff.find(s => s.phone === phone)?.name || '', manual: true });
        }
        tx.set(ar, clean(p), { merge: true });
        audit(tx, 'attendance', ar.id, old.exists() ? { checkIn: old.data().checkIn || '', checkOut: old.data().checkOut || '' } : null, { checkIn: p.checkIn, checkOut: p.checkOut }, note || 'Correction manzoor');
      }
      tx.set(rr, patch, { merge: true });
      audit(tx, 'request', id, { status: r.status }, patch, note);
    });
  }

  /* ---------- owner: salary ---------- */
  async function addExtra(phone, { month, kind, amount, note, date }) {
    guardOwner();
    amount = Number(amount);
    if (!(amount > 0)) throw new Error('Raqam durust likhein.');
    if (!isMonth(month)) throw new Error('Mahina chunein.');
    if (payrollFor(phone, month)?.state === 'final') throw new Error('Ye mahina final ho chuka hai. Pehle "Dobara kholein" karein.');
    const item = { id: 'sx' + Date.now() + Math.random().toString(36).slice(2, 6), month, kind: kind === 'advance' ? 'advance' : 'bonus', amount, note: String(note || ''), date: isDate(date) ? date : pkDate(), by: 'Malik', at: Date.now() };
    let extras;
    await sdk.runTransaction(fs, async tx => {
      const r = ref('staffAccounts', phone), snap = await tx.get(r);
      if (!snap.exists()) throw new Error('Staff nahi mila.');
      extras = [...(Array.isArray(snap.data().salaryExtras) ? snap.data().salaryExtras : []), item];
      tx.set(r, { salaryExtras: clean(extras), updatedAt: Date.now() }, { merge: true });
      audit(tx, 'salary adjustment', phone, null, item, item.note);
    });
    void mirrorSalaryToSettings(phone, state.staff.find(s => s.phone === phone)?.salary, extras);
  }
  async function removeExtra(phone, extraId) {
    guardOwner();
    let extras;
    await sdk.runTransaction(fs, async tx => {
      const r = ref('staffAccounts', phone), snap = await tx.get(r);
      if (!snap.exists()) throw new Error('Staff nahi mila.');
      const list = Array.isArray(snap.data().salaryExtras) ? snap.data().salaryExtras : [], item = list.find(x => String(x.id) === String(extraId));
      if (!item) return;
      if (payrollFor(phone, item.month)?.state === 'final') throw new Error('Ye mahina final ho chuka hai. Pehle "Dobara kholein" karein.');
      extras = list.filter(x => String(x.id) !== String(extraId));
      tx.set(r, { salaryExtras: clean(extras), updatedAt: Date.now() }, { merge: true });
      audit(tx, 'salary adjustment delete', phone, item, null, 'Malik ne entry hatayi');
    });
    if (extras) void mirrorSalaryToSettings(phone, state.staff.find(s => s.phone === phone)?.salary, extras);
  }
  async function toggleFinal(phone, month, note) {
    guardOwner();
    const account = state.staff.find(s => s.phone === phone); if (!account) throw new Error('Staff nahi mila.');
    if (!monthLoaded(month)) throw new Error('Is mahine ki hazri abhi load ho rahi hai. Thori der baad dobara dabayein.');
    const known = payrollFor(phone, month), calc = calcFor(account, month);
    if (known?.state !== 'final' && calc.openDays) throw new Error(`${calc.openDays} din ka Check-Out baqi hai. Pehle wo durust karein, phir final karein.`);
    const { from, to } = monthRange(month), recs = attendanceBetween(from, to).filter(a => a.phone === phone);
    await sdk.runTransaction(fs, async tx => {
      const r = ref('staffPayroll', `${month}_${phone}`), snap = await tx.get(r), current = snap.exists() ? snap.data() : null;
      if ((current?.state || 'draft') !== (known?.state || 'draft')) throw new Error('Salary abhi abhi badli hai. Dobara dekh kar final karein.');
      const reopening = current?.state === 'final';
      const patch = { phone, month, state: reopening ? 'draft' : 'final', snapshot: reopening ? current.snapshot : salarySnapshot(calc, recs), paid: current?.paid || 0, payments: current?.payments || [], updatedAt: Date.now() };
      tx.set(r, clean(patch));
      audit(tx, reopening ? 'salary reopen' : 'salary final', r.id, current ? { state: current.state, final: current.snapshot?.final } : null, { state: patch.state, final: patch.snapshot?.final }, note || '');
    });
  }
  async function addPayment(phone, month, { amount, date, note }) {
    guardOwner();
    amount = Number(amount);
    if (!(amount > 0)) throw new Error('Raqam durust likhein.');
    if (!isDate(date)) throw new Error('Tareekh durust likhein.');
    await sdk.runTransaction(fs, async tx => {
      const r = ref('staffPayroll', `${month}_${phone}`), snap = await tx.get(r);
      if (!snap.exists() || snap.data().state !== 'final') throw new Error('Pehle is mahine ki salary final karein, phir payment likhein.');
      const old = snap.data(), paid = (old.paid || 0) + amount;
      if (paid > Number(old.snapshot?.final || 0) + 0.5) throw new Error('Ye raqam baqi salary se zyada hai.');
      const patch = { paid, payments: [...(old.payments || []), { amount, date, note: String(note || ''), by: auth.currentUser.uid, at: Date.now() }] };
      tx.set(r, patch, { merge: true });
      audit(tx, 'salary payment', r.id, { paid: old.paid || 0 }, { paid }, note || '');
    });
  }

  /* ---------- staff: check-in / out / request ---------- */
  async function checkIn({ selfie, gps }) {
    if (state.role !== 'staff') throw new Error('Staff login zaroori hai.');
    const phone = state.phone, schedule = scheduleFor(phone), date = pkDate(), id = `${date}_${phone}`;
    const radius = Number(state.config.radius || SHOP.radius);
    if (!selfie) throw new Error('Pehle selfie lein.');
    if (!gps) throw new Error('Location nahi mili.');
    if (gps.distance > radius) throw Object.assign(new Error(`Aap dukaan se ${Math.round(gps.distance)}m door hain. Had ${radius}m hai.`), { code: 'app/too-far' });
    const start = parseTime(schedule.shiftStart) ?? 540;
    const minutesLate = Math.max(0, pkMinutes() - start);
    const autoScore = scoreForLate(Math.max(0, minutesLate - Number(schedule.grace ?? 10) + 10), state.config.scores);
    const write = sdk.setDoc(ref('staffAttendance', id), clean({
      id, date, phone, name: state.account?.name || '', address: state.account?.address || '',
      checkIn: pkTime24(), checkInTs: Date.now(), checkInLat: gps.lat, checkInLng: gps.lng, checkInAccuracy: gps.accuracy, checkInDistance: gps.distance,
      selfie, shopLat: SHOP.lat, shopLng: SHOP.lng, shopRadius: radius, minutesLate, autoScore, finalScore: autoScore, shiftStart: schedule.shiftStart || '09:00'
    }), { merge: true });
    return settle(write);
  }
  async function checkOut(row, gps) {
    if (state.role !== 'staff') throw new Error('Staff login zaroori hai.');
    if (!row?.checkIn || row.checkOut) throw new Error('Check-In ka record nahi mila.');
    const write = sdk.setDoc(ref('staffAttendance', row.id || `${row.date}_${state.phone}`), clean({
      phone: state.phone, checkOut: pkTime24(), checkOutTs: Date.now(), checkOutLat: gps?.lat ?? null, checkOutLng: gps?.lng ?? null, checkOutAccuracy: gps?.accuracy ?? null, checkOutDistance: gps?.distance ?? null
    }), { merge: true });
    return settle(write);
  }
  /** Server ka jawab 12 second mein na aaye to hazri phone mein qataar mein rehti hai aur signal aate hi chali jati hai. */
  async function settle(write) {
    try { await timeout(write, 12000); return { queued: false }; }
    catch (error) { if (error.code === 'app/slow-network') { write.catch(e => onProblem('queued-write', e)); return { queued: true }; } throw error; }
  }
  async function sendRequest({ kind, date, to, checkIn, checkOut, reason }) {
    if (state.role !== 'staff') throw new Error('Staff login zaroori hai.');
    if (!['leave', 'correction'].includes(kind)) throw new Error('Request ki qisam chunein.');
    if (!isDate(date)) throw new Error('Tareekh chunein.');
    const end = kind === 'correction' ? date : (isDate(to) ? to : date);
    if (end < date) throw new Error('Aakhri tareekh pehli se pehle nahi ho sakti.');
    if (kind === 'correction' && !checkIn && !checkOut) throw new Error('Sahi waqt likhein.');
    if (!String(reason || '').trim()) throw new Error('Wajah likhein.');
    const id = sdk.doc(col('staffRequests')).id;
    // Ye keys firestore.rules mein ginti ki hui hain — koi aur key mat barhana.
    await sdk.setDoc(ref('staffRequests', id), { phone: state.phone, kind, date, to: end, checkIn: checkIn || '', checkOut: checkOut || '', reason: String(reason).trim().slice(0, 1000), status: 'pending', createdAt: Date.now(), by: auth.currentUser.uid });
  }

  return {
    auth, state, stop, startOwner, startStaff, watchMonth, attendanceBetween, allAttendance, monthLoaded, scheduleFor, payrollFor, calcFor,
    accounts: {
      async getSession(uid) { const s = await sdk.getDoc(ref('staffSessions', uid)); return s.exists() ? s.data() : null; },
      async getAccount(phone) { const s = await sdk.getDoc(ref('staffAccounts', phone)); return s.exists() ? { ...s.data(), phone } : null; },
      async createSession(uid, phone) { await sdk.setDoc(ref('staffSessions', uid), { phone, createdAt: Date.now() }); }
    },
    saveStaff, deleteStaff, saveConfig, saveAttendance, deleteAttendance, markLeave, cancelLeave, reviewRequest,
    addExtra, removeExtra, toggleFinal, addPayment, checkIn, checkOut, sendRequest
  };
}
