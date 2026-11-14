// logic.js — sirf hisab (koi Firebase nahi), taake test ho sake.
export const TZ = 'Asia/Karachi';
const pad = n => String(n).padStart(2, '0');

export function pkDate(d = new Date()) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const g = t => p.find(x => x.type === t)?.value || '';
  return `${g('year')}-${g('month')}-${g('day')}`;
}
export function pkMinutes(d = new Date()) {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  return Number(p.find(x => x.type === 'hour')?.value || 0) * 60 + Number(p.find(x => x.type === 'minute')?.value || 0);
}
export function parseTime(v) {
  const m = String(v ?? '').trim().match(/(\d{1,2})[:.](\d{2})\s*([AaPp])?/);
  if (!m) return null;
  let h = Number(m[1]); const mi = Number(m[2]), ap = (m[3] || '').toUpperCase();
  if (ap === 'P' && h < 12) h += 12;
  if (ap === 'A' && h === 12) h = 0;
  return h > 23 || mi > 59 ? null : h * 60 + mi;
}
export const fmt12 = min => `${(Math.floor(min / 60) % 12) || 12}:${pad(min % 60)} ${min < 720 ? 'am' : 'pm'}`;
/** Us staff ki duty (apni ho to apni, warna sab wali). */
export function scheduleFor(config = {}, own = null) {
  const base = { shiftStart: config.shiftStart || '09:15', shiftEnd: config.shiftEnd || '', grace: Number(config.grace ?? 10) };
  if (!own || own.useDefaultShift !== false) return { ...base, weeklyOff: (own?.weeklyOff || []).map(Number) };
  return { shiftStart: own.shiftStart || base.shiftStart, shiftEnd: own.shiftEnd || base.shiftEnd, grace: Number(own.grace ?? base.grace), weeklyOff: (own.weeklyOff || []).map(Number) };
}
export const weekday = date => new Date(date + 'T12:00:00Z').getUTCDay();
const onLeave = (requests, phone, date) => requests.some(r => r.phone === phone && r.kind === 'leave' && r.status === 'approved' && r.date <= date && (r.to || r.date) >= date && !r.half);
/** Duty ke X minute baad bhi jo nahi aaye (chutti, weekly off, dukaan band aur join se pehle wale nahi ginte). */
export function notArrived({ staff = [], attendance = [], requests = [], schedules = {}, config = {}, date, nowMin, after = 30 }) {
  if ((config.closedDays || []).some(d => d?.date === date)) return [];
  const came = new Set(attendance.filter(a => a.date === date && a.checkIn).map(a => a.phone));
  return staff.filter(s => s.active !== false && s.loginEnabled !== false)
    .filter(s => !came.has(s.phone))
    .filter(s => !(s.joinDate && date < s.joinDate))
    .filter(s => !onLeave(requests, s.phone, date))
    .filter(s => {
      const sch = scheduleFor(config, schedules[s.phone]);
      if ((sch.weeklyOff || []).includes(weekday(date))) return false;
      const start = parseTime(sch.shiftStart);
      return start != null && nowMin >= start + after && nowMin < start + after + 20;
    })
    .map(s => ({ phone: s.phone, name: s.name || s.phone }));
}
/** Duty khatam ke X minute baad bhi jin ka Check-Out nahi laga. */
export function checkoutPending({ staff = [], attendance = [], schedules = {}, config = {}, date, nowMin, after = 30 }) {
  const byPhone = new Map(staff.map(s => [s.phone, s]));
  return attendance.filter(a => a.date === date && a.checkIn && !a.checkOut && byPhone.has(a.phone))
    .filter(a => {
      const sch = scheduleFor(config, schedules[a.phone]), end = parseTime(sch.shiftEnd);
      if (end == null) return false;
      return nowMin >= end + after && nowMin < end + after + 20;
    })
    .map(a => ({ phone: a.phone, name: byPhone.get(a.phone)?.name || a.phone }));
}
/** Khane ka break jin ka waqt guzar gaya (aur abhi tak khabar nahi di gayi). */
export function breaksOverdue(outs = [], now = Date.now(), grace = 5) {
  return outs.filter(o => o.kind === 'break' && o.status === 'approved' && !o.overdueAlert
    && Number(o.outAt) + (Number(o.minutes) + grace) * 60000 <= now)
    .map(o => ({ id: o.id, phone: o.phone, name: o.name || o.phone, late: Math.round((now - Number(o.outAt)) / 60000) - Number(o.minutes) }));
}
/** Check-In late hai ya nahi (aadhi chutti subah wali ho to nahi). */
export function lateOnCheckIn({ attendance, schedule, requests = [], date }) {
  const start = parseTime(schedule.shiftStart), came = parseTime(attendance.checkIn);
  if (start == null || came == null) return 0;
  const half = requests.find(r => r.phone === attendance.phone && r.kind === 'leave' && r.status === 'approved' && r.date <= date && (r.to || r.date) >= date && r.half);
  if (half) return 0;
  const late = came - start - Number(schedule.grace ?? 10);
  return late > 0 ? came - start : 0;
}
export const list = (names, max = 4) => names.slice(0, max).join(', ') + (names.length > max ? ` +${names.length - max}` : '');

/** v251: 👥 Blue Khata ke liye aaj ki hazri ka khulasa (sirf hisab; WhatsApp report dukan ka PC banata hai).
 *  rows: {n naam, s duty shuru, e duty khatam, i aaya, o gaya, l late minute, lv 'f' chutti | 'h' aadhi, off weekly off,
 *         b [[k break | b bahar, 'HH:MM', minute (-1 = abhi bahar), wajah]], t bina-bataye tickets} */
export function blueSummary({ staff = [], attendance = [], requests = [], schedules = {}, config = {}, date, outs = [], tickets = [], now = Date.now() }) {
  const closed = (config.closedDays || []).some(d => d?.date === date);
  const att = new Map(attendance.filter(a => a.date === date).map(a => [a.phone, a]));
  const hm = ms => { const m = pkMinutes(new Date(Number(ms))); return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; };
  const rows = staff.filter(s => s && s.active !== false && !(s.joinDate && date < s.joinDate)).map(s => {
    const sch = scheduleFor(config, schedules[s.phone]), a = att.get(s.phone) || null;
    const lv = requests.find(r => r.phone === s.phone && r.kind === 'leave' && r.status === 'approved' && r.date <= date && (r.to || r.date) >= date);
    const r = { n: String(s.name || s.phone || '').slice(0, 40), s: String(sch.shiftStart || ''), e: String(sch.shiftEnd || '') };
    if (a?.checkIn) { r.i = String(a.checkIn).slice(0, 10); const l = lateOnCheckIn({ attendance: a, schedule: sch, requests, date }); if (l) r.l = l; }
    if (a?.checkOut) r.o = String(a.checkOut).slice(0, 10);
    if (lv) r.lv = lv.half ? 'h' : 'f';
    if ((sch.weeklyOff || []).includes(weekday(date))) r.off = 1;
    const mine = outs.filter(o => o.phone === s.phone && o.date === date && ['approved', 'returned'].includes(o.status) && Number(o.outAt) > 0).sort((x, y) => Number(x.outAt) - Number(y.outAt));
    if (mine.length) r.b = mine.slice(0, 8).map(o => [o.kind === 'break' ? 'k' : 'b', hm(o.outAt), Number(o.returnAt) > 0 ? Math.max(0, Math.round((Number(o.returnAt) - Number(o.outAt)) / 60000)) : -1, String(o.reason || '').slice(0, 20)]);
    const tk = tickets.filter(t => t.phone === s.phone && t.date === date).length; if (tk) r.t = tk;
    return r;
  });
  return { v: 1, d: date, at: now, closed: closed ? 1 : 0, rows };
}
