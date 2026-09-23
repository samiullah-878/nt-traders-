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
