// core.js — Noor Traders Hazri + Salary
// Sirf hisab-kitab. Yahan na DOM hai na Firebase, is liye ye file Node mein test hoti hai.

export const APP_VERSION = 'v200';
export const TZ = 'Asia/Karachi';
export const BUSINESS_ID = 'noor-traders';
export const SHOP = { name: 'Noor Traders Gulyana', lat: 32.7979125, lng: 73.956984375, radius: 200 };
export const DEFAULT_CONFIG = {
  shiftStart: '09:00', shiftEnd: '', radius: 200, grace: 10,
  instruction: '',
  scores: { m10: 10, m20: 8, m30: 6, m45: 4, late: 2 }
};
export const STATUS_LABEL = {
  present: 'Hazir', late: 'Late', absent: 'Ghair hazir', leave: 'Chutti',
  off: 'Weekly off', waiting: 'Abhi nahi aaya', na: '—'
};
export const STATUS_MARK = { present: 'P', late: 'L', absent: 'A', leave: 'C', off: 'O', waiting: '·', na: '' };
export const DAY_NAMES = ['Itwar', 'Peer', 'Mangal', 'Budh', 'Jumerat', 'Juma', 'Hafta'];
export const DAY_SHORT = ['Itw', 'Peer', 'Mng', 'Budh', 'Jum', 'Juma', 'Haf'];
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/* ---------- text ---------- */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function money(n) {
  const v = Math.round(Number(n) || 0);
  return 'Rs ' + v.toLocaleString('en-PK');
}
export function hasArabic(text) { return /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(String(text || '')); }

/* ---------- phone ---------- */
export function normalizePhone(value) {
  let phone = String(value ?? '').trim()
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x6f0))
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x660));
  if (!/^[+\d\s()-]+$/.test(phone)) return '';
  phone = phone.replace(/\D/g, '');
  if (phone.startsWith('0092')) phone = '0' + phone.slice(4);
  else if (phone.startsWith('92') && phone.length === 12) phone = '0' + phone.slice(2);
  if (phone.length === 10 && phone.startsWith('3')) phone = '0' + phone;
  return /^03\d{9}$/.test(phone) ? phone : '';
}

/* ---------- date / time (hamesha Pakistan ka waqt) ---------- */
const pad = n => String(n).padStart(2, '0');
export function pkDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
}
export function pkMinutes(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  const h = +(parts.find(x => x.type === 'hour')?.value || 0), m = +(parts.find(x => x.type === 'minute')?.value || 0);
  return (h % 24) * 60 + m;
}
export function pkTime24(d = new Date()) { const m = pkMinutes(d); return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }

/** "9:05 am", "09:05", "21:10", "9.05 PM" -> din ke minute. Ghalat ho to null. */
export function parseTime(value) {
  const m = String(value ?? '').trim().match(/(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?\s*([AaPp])?\.?\s*[Mm]?/);
  if (!m) return null;
  let h = Number(m[1]); const mi = Number(m[2]), ap = (m[3] || '').toUpperCase();
  if (!Number.isFinite(h) || !Number.isFinite(mi) || mi > 59) return null;
  if (ap === 'P' && h < 12) h += 12;
  if (ap === 'A' && h === 12) h = 0;
  if (h > 23) return null;
  return h * 60 + mi;
}
export function to24(value) { const m = parseTime(value); return m == null ? '' : pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
export function fmtTime(value) {
  const m = parseTime(value); if (m == null) return '—';
  const h = Math.floor(m / 60), mi = m % 60;
  return ((h % 12) || 12) + ':' + pad(mi) + (h < 12 ? ' am' : ' pm');
}
export function hm(min) {
  const m = Math.max(0, Math.round(min || 0));
  return Math.floor(m / 60) + 'h ' + pad(m % 60) + 'm';
}
export function isDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }
export function isMonth(s) { return /^\d{4}-\d{2}$/.test(String(s || '')); }
export function addDays(date, n) {
  const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function addMonths(month, n) {
  const d = new Date(month + '-15T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
}
export function weekday(date) { return new Date(date + 'T12:00:00Z').getUTCDay(); }
export function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${pad(days)}`, days };
}
export function monthDates(month) {
  const { days } = monthRange(month);
  return Array.from({ length: days }, (_, i) => `${month}-${pad(i + 1)}`);
}
export function monthLabel(month) {
  if (!isMonth(month)) return String(month || '');
  const [y, m] = month.split('-').map(Number);
  return MONTH_NAMES[m - 1] + ' ' + y;
}
export function dateLabel(date) {
  if (!isDate(date)) return String(date || '');
  const [y, m, d] = date.split('-').map(Number);
  return `${DAY_NAMES[weekday(date)]}, ${d} ${MONTH_NAMES[m - 1].slice(0, 3)} ${y}`;
}
export function shortDate(date) {
  if (!isDate(date)) return String(date || '');
  const [, m, d] = date.split('-').map(Number);
  return `${d} ${MONTH_NAMES[m - 1].slice(0, 3)}`;
}
/** Hafta Peer se shuru hota hai. */
export function weekRange(date) {
  const back = (weekday(date) + 6) % 7;
  const from = addDays(date, -back);
  return { from, to: addDays(from, 6) };
}

/* ---------- attendance ---------- */
export function normalizeAttendance(value, id = '') {
  const a = { ...(value || {}) };
  const docId = a.id || id || '';
  const idPhone = (String(docId).match(/^\d{4}-\d{2}-\d{2}_(.+)$/) || [])[1] || '';
  const idDate = (String(docId).match(/^(\d{4}-\d{2}-\d{2})_/) || [])[1] || '';
  return {
    ...a, id: docId,
    date: a.date || idDate,
    phone: normalizePhone(a.phone || idPhone) || String(a.phone || idPhone),
    checkIn: a.checkIn || a.checkInTime || '',
    checkOut: a.checkOut || a.checkOutTime || '',
    minutesLate: Number(a.minutesLate ?? a.lateMinutes ?? a.late ?? 0) || 0
  };
}
/** Kaam ke minute. Raat ki shift (aadhi raat paar) theek ginti hai. 16 ghante se zyada = ghalat record. */
export function workMinutes(rec) {
  if (!rec) return null;
  const i = parseTime(rec.checkIn), o = parseTime(rec.checkOut);
  if (i == null || o == null) return null;
  let d = o - i; if (d < 0) d += 1440;
  if (d <= 0 || d > 16 * 60) return null;
  return d;
}
export function hoursText(rec) {
  if (!rec?.checkIn) return '—';
  if (!rec.checkOut) return 'Jari hai';
  const d = workMinutes(rec); return d == null ? '—' : hm(d);
}
export function resolveSchedule(config = {}, own = null) {
  const base = { grace: 10, weeklyOff: [], ...DEFAULT_CONFIG, ...config };
  if (!own) return base;
  const merged = { ...base, ...own };
  if (own.useDefaultShift) { merged.shiftStart = base.shiftStart; merged.shiftEnd = base.shiftEnd; }
  merged.grace = Number(merged.grace ?? 10);
  merged.weeklyOff = Array.isArray(merged.weeklyOff) ? merged.weeklyOff.map(Number) : [];
  return merged;
}
export function lateMinutes(att, schedule = {}) {
  const actual = parseTime(att?.checkIn), start = parseTime(schedule.shiftStart);
  if (actual == null) return 0;
  if (start == null) return Math.max(0, Number(att.minutesLate || 0));
  return Math.max(0, actual - start);
}
export function scoreForLate(mins, scores = {}) {
  const s = { ...DEFAULT_CONFIG.scores, ...scores };
  if (mins <= 10) return +s.m10; if (mins <= 20) return +s.m20; if (mins <= 30) return +s.m30; if (mins <= 45) return +s.m45;
  return +s.late;
}
export function attendanceScore(a) { const n = Number(a?.finalScore ?? a?.autoScore); return Number.isFinite(n) ? n : null; }

/**
 * Aik staff, aik din ka status.
 * today/nowMin diye jayen to aaj shift se pehle "waiting" aata hai (pehle ye subah hi "absent" dikhata tha).
 */
export function statusFor({ account = {}, attendance = {}, requests = [], date, schedule = {}, today = pkDate(), nowMin = pkMinutes() }) {
  if (attendance?.checkIn) {
    return lateMinutes(attendance, schedule) > Number(schedule.grace ?? 10) ? 'late' : 'present';
  }
  if (date > today) return 'na';
  if (account.joinDate && date < account.joinDate) return 'na';
  const phone = account.phone;
  if (requests.some(r => r.phone === phone && r.kind === 'leave' && r.status === 'approved' && r.date <= date && r.to >= date)) return 'leave';
  if ((schedule.weeklyOff || []).includes(weekday(date))) return 'off';
  if (date === today) {
    const start = parseTime(schedule.shiftStart);
    if (start != null && nowMin <= start + Number(schedule.grace ?? 10)) return 'waiting';
  }
  return 'absent';
}
/** Check-in hai, check-out nahi, aur shift khatam ho chuki. */
export function checkoutDue(a = {}, schedule = {}, now = Date.now()) {
  if (!a.checkIn || a.checkOut || !isDate(a.date)) return false;
  const day = Date.parse(a.date + 'T00:00:00+05:00');
  const end = parseTime(schedule.shiftEnd);
  if (end == null) return now >= day + 86400000;
  const start = parseTime(schedule.shiftStart) ?? 540;
  return now >= day + (end + (end <= start ? 1440 : 0)) * 60000;
}
/** Staff ka khula record jis par Check-Out lagna hai (raat ki shift mein kal ka bhi ho sakta hai). */
export function openRecord(rows = [], now = Date.now()) {
  return rows
    .filter(a => a.checkIn && !a.checkOut && isDate(a.date))
    .filter(a => {
      const started = a.checkInTs || (Date.parse(a.date + 'T00:00:00+05:00') + (parseTime(a.checkIn) || 0) * 60000);
      return now - started >= 0 && now - started <= 16 * 3600000;
    })
    .sort((x, y) => (y.date || '').localeCompare(x.date || ''))[0] || null;
}
export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000, rad = x => x * Math.PI / 180;
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Aik din ke liye sab staff ki qataar. */
export function dayRows({ staff = [], attendance = [], requests = [], schedules = new Map(), config = {}, date, today = pkDate(), nowMin = pkMinutes(), now = Date.now() }) {
  const byPhone = new Map(attendance.filter(a => a.date === date).map(a => [a.phone, a]));
  return staff.map(account => {
    const schedule = resolveSchedule(config, schedules.get(account.phone));
    const a = byPhone.get(account.phone) || {};
    const status = statusFor({ account, attendance: a, requests, date, schedule, today, nowMin });
    return { account, a, schedule, status, late: a.checkIn ? lateMinutes(a, schedule) : 0, due: checkoutDue(a, schedule, now), minutes: workMinutes(a) };
  });
}
export function countStatuses(rows) {
  const c = { present: 0, late: 0, absent: 0, leave: 0, off: 0, waiting: 0, na: 0 };
  for (const r of rows) c[r.status] = (c[r.status] || 0) + 1;
  return c;
}
/** Aik staff ka poora mahina. */
export function monthSummary({ account, attendance = [], requests = [], schedule = {}, month, today = pkDate(), nowMin = pkMinutes() }) {
  const byDate = new Map(attendance.filter(a => a.phone === account.phone).map(a => [a.date, a]));
  const days = monthDates(month).map(date => {
    const a = byDate.get(date) || {};
    const status = statusFor({ account, attendance: a, requests, date, schedule, today, nowMin });
    return { date, a, status, late: a.checkIn ? lateMinutes(a, schedule) : 0, minutes: workMinutes(a) };
  });
  const count = countStatuses(days);
  const totalMin = days.reduce((n, d) => n + (d.minutes || 0), 0);
  const lateMin = days.filter(d => d.status === 'late').reduce((n, d) => n + d.late, 0);
  return { days, count, totalMin, lateMin, open: days.filter(d => d.a.checkIn && !d.a.checkOut && d.date < today).length };
}

/* ---------- salary ---------- */
export function mealConfig(salary = {}, account = {}) {
  const legacy = Number(account.mealAmount || account.khanaAmount || 0);
  const mode = ['daily', 'monthly', 'none'].includes(salary.mealMode) ? salary.mealMode : legacy > 0 ? (account.meal === 'monthly' ? 'monthly' : 'daily') : 'none';
  return { mealMode: mode, mealRate: Math.max(0, Number(salary.mealRate ?? legacy) || 0), mealInSalary: salary.mealInSalary === true };
}
export function salaryConfig(account = {}) {
  const d = account.salary || {};
  return {
    ...mealConfig(d, account),
    monthlySalary: Number(d.monthlySalary || 0),
    dutyHours: Number(d.dutyHours || 10),
    workingDays: Number(d.workingDays || 30),
    overtimeRate: Number(d.overtimeRate || 0),
    pointRate: Number(d.pointRate || 0)
  };
}
/**
 * Mahine ki salary. Formula purani app wala hi hai:
 * hourly = monthly / (dutyHours × workingDays); normal ghante × hourly + overtime + points + bonus + khana − advance.
 * Agar mahina "final" ho chuka hai to wahi jama hua hisab wapas aata hai (badalta nahi).
 */
export function salaryCalc({ account = {}, month, attendance = [], payroll = null }) {
  const paid = Number(payroll?.paid || 0), payments = payroll?.payments || [];
  if (payroll?.state === 'final' && payroll.snapshot) {
    const s = payroll.snapshot;
    return { ...s, frozen: true, paid, payments, balance: Number(s.final || 0) - paid };
  }
  const cfg = salaryConfig(account), { from, to } = monthRange(month);
  const recs = attendance.filter(a => a.phone === account.phone && a.date >= from && a.date <= to);
  const dutyMin = Math.max(0, Math.round(cfg.dutyHours * 60));
  let normalMin = 0, otMin = 0, daysWorked = 0, attPoints = 0, openDays = 0;
  for (const a of recs) {
    const sc = attendanceScore(a); if (sc != null) attPoints += sc;
    const w = workMinutes(a);
    if (w == null) { if (a.checkIn && !a.checkOut) openDays++; continue; }
    daysWorked++;
    normalMin += dutyMin ? Math.min(w, dutyMin) : w;
    otMin += dutyMin ? Math.max(0, w - dutyMin) : 0;
  }
  const expectedHours = cfg.dutyHours * cfg.workingDays;
  const hourly = expectedHours > 0 ? cfg.monthlySalary / expectedHours : 0;
  const otRate = cfg.overtimeRate > 0 ? cfg.overtimeRate : hourly;
  const normalSalary = (normalMin / 60) * hourly, overtimeAmount = (otMin / 60) * otRate;
  const points = attPoints, pointsAmount = points * cfg.pointRate;
  const extras = (Array.isArray(account.salaryExtras) ? account.salaryExtras : []).filter(x => x.month === month);
  const sum = k => extras.filter(x => x.kind === k).reduce((n, x) => n + Number(x.amount || 0), 0);
  const bonus = sum('bonus'), advance = sum('advance');
  const mealDays = new Set(recs.filter(a => a.checkIn).map(a => a.date)).size;
  const mealTotal = cfg.mealMode === 'monthly' ? cfg.mealRate : cfg.mealMode === 'daily' ? cfg.mealRate * mealDays : 0;
  const mealSalary = cfg.mealInSalary ? mealTotal : 0;
  const final = normalSalary + overtimeAmount + pointsAmount + bonus + mealSalary - advance;
  return {
    phone: account.phone, month, periodLabel: monthLabel(month), from, to, ...cfg, expectedHours, hourly, otRate,
    daysWorked, openDays, normalMin, otMin, normalSalary, overtimeAmount, attPoints, taskPoints: 0, points, pointsAmount,
    extras, bonus, advance, mealDays, mealTotal, mealSalary, final, frozen: false, paid, payments, balance: final - paid
  };
}
/** Final karte waqt Firestore mein jane wala halka snapshot (selfie waghera ke baghair). */
export function salarySnapshot(calc, recs = []) {
  const { frozen, paid, payments, balance, ...rest } = calc;
  return JSON.parse(JSON.stringify({
    ...rest,
    recs: recs.map(({ phone, date, checkIn, checkOut, finalScore, autoScore }) => ({ phone, date, checkIn: checkIn || '', checkOut: checkOut || '', finalScore: finalScore ?? null, autoScore: autoScore ?? null }))
  }));
}

/* ---------- smart search ---------- */
const STATUS_WORDS = [
  ['checkoutDue', /\b(check\s?-?out|chekout|chutti nahi ki)\s*(baqi|baki|nahi|nhi|missing|pending|rehta)?\b|\bbaqi check\s?-?out\b/],
  ['absent', /\b(ghair|gair|gher|ghar)\s?-?\s?(hazir|hazri|haazir)\b|\babsent\b|\bnahi aaya\b|\bnhi aya\b|\bnahi aya\b|\bgayab\b|\bghaib\b/],
  ['late', /\blate\b|\blet\b|\bder se\b|\bdair se\b|\bdeir\b/],
  ['leave', /\bchutti\b|\bchhutti\b|\bchuti\b|\bleave\b|\bchuttian\b/],
  ['off', /\bweekly off\b|\boff day\b|\boff\b/],
  ['present', /\bhazir\b|\bhaazir\b|\bpresent\b|\baaya\b|\baya\b|\bwaqt par\b|\bon time\b/],
  ['salaryDue', /\b(salary|tankhwah|tankha|tankhah|pay)\s*(baqi|baki|due|pending|rehti)\b|\bbaqi salary\b/],
  ['advance', /\badvance\b|\badvans\b|\bpeshgi\b/]
];
const MONTH_WORDS = { jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12 };

function cleanQuery(q) {
  return String(q || '').toLowerCase()
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x6f0))
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x660))
    .replace(/[,;|]+/g, ' ').replace(/\s+/g, ' ').trim();
}
/**
 * Likha hua sawal -> filter. Misalein: "late is hafte", "ghair hazir aaj", "ali pichle mahine",
 * "checkout baqi", "salary baqi", "0300", "15 sep", "12/9".
 */
export function parseQuery(query, today = pkDate()) {
  let q = ' ' + cleanQuery(query) + ' ';
  const out = { statuses: [], from: '', to: '', rangeLabel: '', text: '', salaryDue: false, advance: false, checkoutDue: false, empty: !q.trim() };
  const take = re => { const m = q.match(re); if (m) q = q.replace(m[0], ' '); return m; };

  for (const [key, re] of STATUS_WORDS) {
    if (take(re)) {
      if (key === 'salaryDue') out.salaryDue = true; else if (key === 'advance') out.advance = true;
      else if (key === 'checkoutDue') out.checkoutDue = true; else out.statuses.push(key);
    }
  }
  const month = today.slice(0, 7);
  const setRange = (from, to, label) => { if (!out.from) { out.from = from; out.to = to; out.rangeLabel = label; } };
  if (take(/\b(pichle|pichlay|pichla|guzishta|last|previous)\s+(mahine|mahina|month|maah)\b/)) { const m = addMonths(month, -1), r = monthRange(m); setRange(r.from, r.to, monthLabel(m)); }
  if (take(/\b(pichle|pichlay|pichla|guzishta|last|previous)\s+(hafte|hafta|week)\b/)) { const r = weekRange(addDays(today, -7)); setRange(r.from, r.to, 'Pichla hafta'); }
  if (take(/\b(is|iss|this|isi)?\s*(mahine|mahina|month|maah)\b/)) { const r = monthRange(month); setRange(r.from, r.to > today ? today : r.to, monthLabel(month)); }
  if (take(/\b(is|iss|this|isi)?\s*(hafte|hafta|week)\b/)) { const r = weekRange(today); setRange(r.from, r.to > today ? today : r.to, 'Is hafte'); }
  if (take(/\b(parson|parso)\b/)) { const d = addDays(today, -2); setRange(d, d, shortDate(d)); }
  if (take(/\b(kal|yesterday|guzishta roz)\b/)) { const d = addDays(today, -1); setRange(d, d, 'Kal'); }
  if (take(/\b(aaj|aj|today|abhi)\b/)) setRange(today, today, 'Aaj');

  let m;
  if ((m = take(/\b(\d{4})-(\d{2})-(\d{2})\b/))) { const d = `${m[1]}-${m[2]}-${m[3]}`; setRange(d, d, shortDate(d)); }
  if ((m = take(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/))) {
    const dd = +m[1], mm = +m[2]; let yy = m[3] ? +m[3] : +today.slice(0, 4); if (yy < 100) yy += 2000;
    if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12) { const d = `${yy}-${pad(mm)}-${pad(dd)}`; setRange(d, d, shortDate(d)); }
  }
  const monthRe = new RegExp('\\b(?:(\\d{1,2})\\s+)?(' + Object.keys(MONTH_WORDS).sort((a, b) => b.length - a.length).join('|') + ')(?:\\s+(\\d{1,2}))?(?:\\s+(\\d{4}))?\\b');
  if ((m = take(monthRe))) {
    const mm = MONTH_WORDS[m[2]], dd = +(m[1] || m[3] || 0); let yy = m[4] ? +m[4] : +today.slice(0, 4);
    if (!m[4] && `${yy}-${pad(mm)}` > month) yy -= 1;
    if (dd) { const d = `${yy}-${pad(mm)}-${pad(dd)}`; setRange(d, d, shortDate(d)); }
    else { const mo = `${yy}-${pad(mm)}`, r = monthRange(mo); setRange(r.from, r.to > today ? today : r.to, monthLabel(mo)); }
  }
  q = q.replace(/\b(ko|ka|ki|ke|mein|me|main|se|tak|wale|walay|wala|larke|larka|staff|sab|kon|kaun|kis|ne|hai|hain|the|tha|dikhao|dikha|batao|list|hazri|attendance)\b/g, ' ');
  out.text = q.replace(/\s+/g, ' ').trim();
  return out;
}
function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}
const squash = s => String(s || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').trim();
/** Naam / number / role ka milaan. Thori spelling ghalti (1-2 harf) maaf hai: "ahmd" -> "Ahmad". */
export function matchStaff(account, text) {
  const t = squash(text); if (!t) return true;
  const digits = t.replace(/\D/g, '');
  if (digits.length >= 3 && String(account.phone || '').includes(digits)) return true;
  const hay = squash(`${account.name || ''} ${account.role || ''} ${account.address || ''}`);
  const words = hay.split(' ').filter(Boolean);
  return t.split(' ').filter(Boolean).every(tok => {
    if (hay.includes(tok)) return true;
    if (tok.length < 3) return false;
    const allow = tok.length >= 6 ? 2 : 1;
    const bare = tok.replace(/[aeiou]/g, '');
    return words.some(w => editDistance(w.slice(0, tok.length + 1), tok) <= allow || (bare.length >= 2 && w.replace(/[aeiou]/g, '') === bare));
  });
}
/**
 * Poori smart search. Wapas: { people, rows, summary, range }.
 * people = staff list (naam/number ke hisab se), rows = (staff × din) jo status filter par poore utre.
 */
export function smartSearch({ query, staff = [], attendance = [], requests = [], schedules = new Map(), config = {}, payroll = [], today = pkDate(), nowMin = pkMinutes(), now = Date.now() }) {
  const p = parseQuery(query, today);
  const people = staff.filter(s => matchStaff(s, p.text));
  const wantsDays = p.statuses.length || p.checkoutDue || p.from;
  const rows = [];
  if (wantsDays) {
    let from = p.from, to = p.to;
    if (!from) { from = to = today; if (p.checkoutDue) { from = monthRange(addMonths(today.slice(0, 7), -1)).from; } }
    if (to > today) to = today;
    for (let d = to; d >= from; d = addDays(d, -1)) {
      for (const r of dayRows({ staff: people, attendance, requests, schedules, config, date: d, today, nowMin, now })) {
        if (p.checkoutDue && !r.due) continue;
        if (p.statuses.length && !p.statuses.includes(r.status)) continue;
        if (r.status === 'na') continue;
        rows.push({ ...r, date: d });
      }
      if (rows.length > 400) break;
    }
  }
  let money = [];
  if (p.salaryDue || p.advance) {
    const month = (p.from || today).slice(0, 7);
    money = people.map(account => ({ account, calc: salaryCalc({ account, month, attendance, payroll: payroll.find(x => x.id === `${month}_${account.phone}`) }) }))
      .filter(x => p.advance ? x.calc.advance > 0 : x.calc.balance > 0.5);
  }
  const bits = [];
  if (p.statuses.length) bits.push(p.statuses.map(s => STATUS_LABEL[s]).join(' / '));
  if (p.checkoutDue) bits.push('Check-out baqi');
  if (p.salaryDue) bits.push('Salary baqi'); if (p.advance) bits.push('Advance');
  if (p.rangeLabel) bits.push(p.rangeLabel); else if (wantsDays) bits.push('Aaj');
  if (p.text) bits.push('"' + p.text + '"');
  return { parsed: p, people, rows, money, mode: (p.salaryDue || p.advance) ? 'money' : wantsDays ? 'days' : 'people', summary: bits.join(' · ') };
}
