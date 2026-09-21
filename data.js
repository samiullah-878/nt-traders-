// data.js — Firebase se baat sirf yahan hoti hai. sdk bahar se aata hai (boot.js asal SDK deta hai, test naqli).
import {
  BUSINESS_ID, DEFAULT_CONFIG, SHOP, normalizePhone, normalizeAttendance, pkDate, pkTime24, pkMinutes, parseTime, to24,
  monthRange, addMonths, addDays, resolveSchedule, lateMinutes, scoreForLate, salaryCalc, salarySnapshot, isMonth, isDate, shiftMinutes, salaryConfig, workMinutes, fmtTime
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
      account: null, myAttendance: [], errors: {}, lastSync: {}, pendingWrites: 0
    };
  }
  let unsubs = [], monthSubs = new Map(), epoch = 0, legacyChecked = false;
  const changed = () => onChange(state);
  const problem = (name, error) => { state.errors[name] = error?.code || error?.message || 'error'; changed(); onProblem(name, error); };
  const live = (query, name, handler, options) => {
    const token = epoch;
    const next = snap => { if (token !== epoch) return; handler(snap); state.loaded.add(name); delete state.errors[name]; if (!snap.metadata?.fromCache) state.lastSync[name] = Date.now(); changed(); };
    const fail = error => { if (token === epoch) problem(name, error); };
    unsubs.push(options ? sdk.onSnapshot(query, options, next, fail) : sdk.onSnapshot(query, next, fail));
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
      state.months.set(month, rows); state.loaded.add('att:' + month); delete state.errors['att:' + month];
      if (!snap.metadata?.fromCache) state.lastSync['att:' + month] = Date.now();
      changed();
    }, error => { if (token === epoch) problem('att:' + month, error); }));
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
    // includeMetadataChanges: pata chalta hai ke hazri server par pohanch gayi ya abhi phone mein ruki hai.
    live(mine('staffAttendance'), 'myAttendance', snap => {
      const rows = []; snap.forEach(d => rows.push({ ...normalizeAttendance(clean(d.data()), d.id), pending: !!d.metadata?.hasPendingWrites }));
      state.myAttendance = rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }, { includeMetadataChanges: true });
    live(mine('staffRequests'), 'requests', snap => { state.requests = readList(snap); });
    live(mine('staffSchedules'), 'schedules', snap => { state.schedules = new Map(readList(snap).map(s => [s.id, s])); });
    live(mine('staffPayroll'), 'payroll', snap => { state.payroll = readList(snap); });
  }

  /* ---------- helpers ---------- */
  /* ---------- tez save ----------
     Pehle har save par server ka jawab (transaction) ka intezar hota tha — kamzor net par 3-10 second.
     Ab: parhna phone mein mojood data se, likhna aik writeBatch mein, aur screen foran badal jati hai.
     Server tak pohanchne ka intezar peeche hota hai (state.pendingWrites); ghalti aaye to toast.
     Salary FINAL aur PAYMENT ab bhi runTransaction se hain (paison mein double entry ka khatra nahi lena). */
  async function localGet(r) {
    const parts = String(r.path || '').split('/'), name = parts[2], id = parts[3];
    const hit = v => ({ exists: () => v != null, data: () => clean(v) });
    if (name === 'staffAccounts' && state.loaded.has('staff')) return hit(state.staff.find(s => s.phone === id || s.id === id) || null);
    if (name === 'staffRequests' && state.loaded.has('requests')) return hit(state.requests.find(x => x.id === id) || null);
    if (name === 'staffConfig' && id === 'main' && state.loaded.has('config')) return hit(state.config);
    if (name === 'staffAttendance') { const m = id.slice(0, 7); if (state.loaded.has('att:' + m)) return hit((state.months.get(m) || []).find(a => a.id === id) || null); }
    if (sdk.getDocFromCache) { try { return await sdk.getDocFromCache(r); } catch { /* cache mein nahi */ } }
    return sdk.getDoc(r);
  }
  async function fast(fn) {
    const batch = sdk.writeBatch(fs); let n = 0;
    const tx = { get: localGet, set: (r, d, o) => { n++; o ? batch.set(r, d, o) : batch.set(r, d); }, delete: r => { n++; batch.delete(r); } };
    const result = await fn(tx);
    if (!n) return result;
    const token = epoch, p = batch.commit();
    state.pendingWrites = (state.pendingWrites || 0) + 1; changed();
    p.catch(error => { if (token === epoch) problem('save', error); })
      .finally(() => { if (token === epoch) { state.pendingWrites = Math.max(0, state.pendingWrites - 1); changed(); } });
    // Foran ghalti (jaise ijazat nahi) 0.4 s mein aa jaye to dikha do; warna aage chalo — data phone mein mehfooz hai.
    let t; await Promise.race([p, new Promise(resolve => { t = setTimeout(resolve, 400); })]).finally(() => clearTimeout(t));
    return result;
  }
  function guardOwner() { if (state.role !== 'owner' || !isOwnerUser(auth.currentUser)) throw new Error('Malik ka login zaroori hai.'); }
  function audit(tx, type, target, before, after, reason) {
    tx.set(sdk.doc(col('staffAudit')), { type, target, before: JSON.stringify(before ?? null), after: JSON.stringify(after ?? null), reason: reason || '', by: auth.currentUser.uid, at: Date.now() });
  }
  const scheduleFor = phone => resolveSchedule(state.config, state.schedules.get(phone));
  const payrollFor = (phone, month) => state.payroll.find(p => p.id === `${month}_${phone}`) || null;
  function calcFor(account, month) {
    const { from, to } = monthRange(month);
    const recs = state.role === 'staff' ? state.myAttendance.filter(a => a.date >= from && a.date <= to) : attendanceBetween(from, to);
    return salaryCalc({ account, month, attendance: recs, payroll: payrollFor(account.phone, month), config: state.config, schedule: scheduleFor(account.phone), requests: state.requests.filter(r => r.phone === account.phone) });
  }
  const salaryFor = account => salaryConfig(account, state.config, scheduleFor(account.phone));
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
      ...(old?.salary || {}), useDefault: input.useDefaultSalary !== false,
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
      phone, useDefaultShift: input.useDefaultShift !== false, shiftStart: input.shiftStart || state.config.shiftStart || '09:15', shiftEnd: input.shiftEnd || '',
      grace: Math.max(0, Number(input.grace ?? state.config.grace ?? 10)), weeklyOff: input.weeklyOff === '' || input.weeklyOff == null ? [] : [Number(input.weeklyOff)]
    });
    await fast(async tx => {
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
    await fast(async tx => {
      const r = ref('staffAccounts', phone), snap = await tx.get(r);
      tx.delete(r); tx.delete(ref('staff', phone));
      audit(tx, 'staff delete', phone, snap.exists() ? { name: snap.data().name } : null, null, 'Malik ne staff delete kiya');
    });
  }
  async function saveConfig(patch) {
    guardOwner();
    const num = (v, d) => { const n = Number(v); return v === '' || v == null || !Number.isFinite(n) ? d : n; };
    if (patch.shiftStart && patch.shiftEnd && patch.shiftStart === patch.shiftEnd) throw new Error('Duty shuru aur khatam ka waqt alag ho.');
    const next = clean({
      shiftStart: patch.shiftStart || '09:15', shiftEnd: patch.shiftEnd || '', grace: Math.max(0, num(patch.grace, 10)),
      radius: Math.max(20, num(patch.radius, SHOP.radius)), instruction: String(patch.instruction || ''),
      salaryDefault: {
        monthlySalary: Math.max(0, num(patch.defSalary, 0)), workingDays: Math.min(31, Math.max(1, num(patch.defDays, 30))), overtimeRate: Math.max(0, num(patch.defOt, 0)),
        mode: patch.salaryMode === 'days' ? 'days' : 'hours', leavePaid: patch.leavePaid !== false,
        lateEvery: Math.max(0, Math.floor(num(patch.lateEvery, 0))), lateFineDays: Math.max(0, num(patch.lateFineDays, 0.5))
      }
    });
    await fast(async tx => {
      tx.set(ref('staffConfig', 'main'), next, { merge: true });
      audit(tx, 'settings', 'main', { shiftStart: state.config.shiftStart, shiftEnd: state.config.shiftEnd, radius: state.config.radius }, next, 'Malik ne settings badli');
    });
  }

  /** Sab staff par default duty (waqt + riayat). Hafta-war chutti har aik ki apni rehti hai. */
  async function applyDefaultShiftAll() {
    guardOwner();
    await fast(async tx => {
      for (const s of state.staff) tx.set(ref('staffSchedules', s.phone), { phone: s.phone, useDefaultShift: true }, { merge: true });
      audit(tx, 'default shift sab par', 'all', null, { count: state.staff.length }, 'Malik ne sab par default duty lagayi');
    });
  }
  /** Sab staff par default salary. Un ki apni likhi raqam mehfooz rehti hai (wapas "apni salary" karne par wohi aa jati hai). */
  async function applyDefaultSalaryAll() {
    guardOwner();
    await fast(async tx => {
      for (const s of state.staff) {
        const salary = clean({ ...(s.salary || {}), useDefault: true });
        tx.set(ref('staffAccounts', s.phone), { salary, updatedAt: Date.now() }, { merge: true });
        tx.set(ref('staff', s.phone), { salary }, { merge: true });
      }
      audit(tx, 'default salary sab par', 'all', null, { count: state.staff.length }, 'Malik ne sab par default salary lagayi');
    });
  }
  /** Dukaan band (Eid / chutti): us din koi ghair hazir nahi ginta. Dobara dabane se hat jata hai. */
  async function toggleClosed(date, reason = '') {
    guardOwner();
    if (!isDate(date)) throw new Error('Tareekh durust nahi.');
    await fast(async tx => {
      const r = ref('staffConfig', 'main'), snap = await tx.get(r);
      const list = (snap.exists() && Array.isArray(snap.data().closedDays) ? snap.data().closedDays : []).filter(d => d && d.date);
      const on = list.some(d => d.date === date);
      const next = on ? list.filter(d => d.date !== date) : [...list, { date, reason: String(reason || 'Dukaan band') }].sort((a, b) => a.date.localeCompare(b.date)).slice(-120);
      tx.set(r, { closedDays: next }, { merge: true });
      audit(tx, on ? 'dukaan band hataya' : 'dukaan band', date, null, { date, reason }, reason || '');
    });
  }
  /** Aik tap: hazir lagao. Aane ka waqt = duty shuru; pichle din ke liye jane ka waqt = duty khatam. */
  async function quickPresent(phone, date, at = '') {
    const sch = scheduleFor(phone);
    const inT = to24(at) || to24(sch.shiftStart) || '09:15';
    const outT = date < pkDate() ? (to24(sch.shiftEnd) || endFrom(inT, phone)) : '';
    await saveAttendance({ phone, date, checkIn: inT, checkOut: outT, note: 'Malik ne lagayi' });
  }
  const endFrom = (inT, phone) => { const acc = state.staff.find(s => s.phone === phone) || {}; const m = (parseTime(inT) + Math.round(salaryFor(acc).dutyHours * 60)) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
  /** Bhoola hua Check-Out: duty khatam ke waqt par band. */
  async function closeCheckouts(rows) {
    guardOwner();
    let n = 0;
    for (const a of rows) {
      const sch = scheduleFor(a.phone), inT = to24(a.checkIn); if (!inT || a.checkOut) continue;
      const outT = to24(sch.shiftEnd) || endFrom(inT, a.phone);
      await saveAttendance({ phone: a.phone, date: a.date, checkIn: inT, checkOut: outT, note: 'Check-Out bhool gaya — duty ke waqt par band', finalScore: a.finalScore ?? '' });
      n++;
    }
    return n;
  }

  /* ---------- owner: attendance ---------- */
  async function saveAttendance({ phone, date, checkIn, checkOut, note, finalScore }) {
    guardOwner();
    if (!isDate(date)) throw new Error('Tareekh durust nahi.');
    if (date > pkDate()) throw new Error('Aane wali tareekh ki hazri nahi lag sakti.');
    const inT = to24(checkIn), outT = to24(checkOut);
    if (!inT) throw new Error('Aane ka waqt likhein.');
    if (checkOut && !outT) throw new Error('Jane ka waqt durust nahi.');
    if (outT && workMinutes({ checkIn: inT, checkOut: outT }) == null) throw new Error(`Jane ka waqt (${fmtTime(outT)}) aane ke waqt (${fmtTime(inT)}) se pehle hai ya 16 ghante se zyada farq hai. AM / PM check karein.`);
    const account = state.staff.find(s => s.phone === phone) || { phone, name: phone };
    const schedule = scheduleFor(phone), id = `${date}_${phone}`;
    const late = lateMinutes({ checkIn: inT }, schedule);
    const autoScore = scoreForLate(Math.max(0, late - Number(schedule.grace ?? 10) + 10), state.config.scores);
    await fast(async tx => {
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
    await fast(async tx => {
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
    await fast(async tx => tx.set(ref('staffRequests', id), clean({ phone, kind: 'leave', date, to: to || date, checkIn: '', checkOut: '', reason: String(reason || 'Malik ne chutti lagayi'), status: 'approved', createdAt: Date.now(), by: auth.currentUser.uid, ownerNote: 'Malik ne lagayi', reviewedAt: Date.now(), reviewedBy: auth.currentUser.uid })));
  }
  async function cancelLeave(id) { guardOwner(); await fast(async tx => tx.set(ref('staffRequests', id), { status: 'rejected', ownerNote: 'Chutti cancel', reviewedAt: Date.now(), reviewedBy: auth.currentUser.uid }, { merge: true })); }
  async function reviewRequest(id, status, note = '') {
    guardOwner();
    await fast(async tx => {
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
  async function addExtra(phone, { month, kind, amount, note, date, perMonth }) {
    guardOwner();
    amount = Number(amount);
    if (!(amount > 0)) throw new Error('Raqam durust likhein.');
    if (kind === 'loan' && !(Number(perMonth) > 0)) throw new Error('Har mahine kitni qist kategi, wo likhein.');
    if (!isMonth(month)) throw new Error('Mahina chunein.');
    if (payrollFor(phone, month)?.state === 'final') throw new Error('Ye mahina final ho chuka hai. Pehle "Dobara kholein" karein.');
    const item = { id: 'sx' + Date.now() + Math.random().toString(36).slice(2, 6), month, kind: ['advance', 'loan'].includes(kind) ? kind : 'bonus', amount, ...(kind === 'loan' ? { perMonth: Math.min(amount, Number(perMonth)) } : {}), note: String(note || ''), date: isDate(date) ? date : pkDate(), by: 'Malik', at: Date.now() };
    let extras;
    await fast(async tx => {
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
    await fast(async tx => {
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
  /** Server ka jawab 2.5 second mein na aaye to hazri phone mein qataar mein rehti hai aur signal aate hi chali jati hai. */
  async function settle(write) {
    try { await timeout(write, 2500); return { queued: false }; }
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
    const write = sdk.setDoc(ref('staffRequests', id), { phone: state.phone, kind, date, to: end, checkIn: checkIn || '', checkOut: checkOut || '', reason: String(reason).trim().slice(0, 1000), status: 'pending', createdAt: Date.now(), by: auth.currentUser.uid });
    write.catch(e => problem('save', e));
    let t; await Promise.race([write, new Promise(r => { t = setTimeout(r, 400); })]).finally(() => clearTimeout(t));
  }

  return {
    auth, state, projectId: firebaseConfig?.projectId || 'nt-traders', stop, startOwner, startStaff, watchMonth, attendanceBetween, allAttendance, monthLoaded, scheduleFor, payrollFor, calcFor, salaryFor,
    applyDefaultShiftAll, applyDefaultSalaryAll, toggleClosed, quickPresent, closeCheckouts,
    accounts: {
      async getSession(uid) { const s = await sdk.getDoc(ref('staffSessions', uid)); return s.exists() ? s.data() : null; },
      async getAccount(phone) { const s = await sdk.getDoc(ref('staffAccounts', phone)); return s.exists() ? { ...s.data(), phone } : null; },
      async createSession(uid, phone) { await sdk.setDoc(ref('staffSessions', uid), { phone, createdAt: Date.now() }); }
    },
    saveStaff, deleteStaff, saveConfig, saveAttendance, deleteAttendance, markLeave, cancelLeave, reviewRequest,
    addExtra, removeExtra, toggleFinal, addPayment, checkIn, checkOut, sendRequest
  };
}
