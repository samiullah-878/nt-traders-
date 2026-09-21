import test from 'node:test'; import assert from 'node:assert/strict';
import * as C from './core.js';

test('phone: har tarah ka likha hua number aik hi shakal', () => {
  for (const v of ['03001234567', '0300-1234567', '+92 300 1234567', '923001234567', '3001234567', '00923001234567', '۰۳۰۰۱۲۳۴۵۶۷']) assert.equal(C.normalizePhone(v), '03001234567', v);
  for (const v of ['', 'admin', '0300123', '04001234567', '03001234567x']) assert.equal(C.normalizePhone(v), '', v);
});
test('waqt: purane "9:05 am" aur naye "09:05" dono parhe jate hain', () => {
  assert.equal(C.parseTime('9:05 am'), 545); assert.equal(C.parseTime('09:05'), 545); assert.equal(C.parseTime('9:05 PM'), 1265);
  assert.equal(C.parseTime('12:10 am'), 10); assert.equal(C.parseTime('12:10 pm'), 730); assert.equal(C.parseTime('25:00'), null); assert.equal(C.parseTime(''), null);
  assert.equal(C.fmtTime('21:07'), '9:07 pm'); assert.equal(C.fmtTime('00:30'), '12:30 am'); assert.equal(C.fmtTime(''), '—'); assert.equal(C.to24('7:31 pm'), '19:31');
});
test('kaam ke ghante: aam din, raat ki shift, ghalat record', () => {
  assert.equal(C.workMinutes({ checkIn: '09:00', checkOut: '19:30' }), 630);
  assert.equal(C.workMinutes({ checkIn: '8:00 pm', checkOut: '4:00 am' }), 480);
  assert.equal(C.workMinutes({ checkIn: '09:00', checkOut: '' }), null);
  assert.equal(C.workMinutes({ checkIn: '09:00', checkOut: '09:00' }), null);
  assert.equal(C.workMinutes({ checkIn: '06:00', checkOut: '23:30' }), null);
});
test('tareekh: mahina, hafta (Peer se), din jorna', () => {
  assert.deepEqual(C.monthRange('2026-02'), { from: '2026-02-01', to: '2026-02-28', days: 28 });
  assert.deepEqual(C.weekRange('2026-09-21'), { from: '2026-09-21', to: '2026-09-27' });
  assert.deepEqual(C.weekRange('2026-09-27'), { from: '2026-09-21', to: '2026-09-27' });
  assert.equal(C.addDays('2026-02-28', 1), '2026-03-01'); assert.equal(C.addMonths('2026-01', -1), '2025-12'); assert.equal(C.weekday('2026-09-25'), 5);
});
const sch = C.resolveSchedule({ shiftStart: '09:00', shiftEnd: '19:00' });
test('status: hazir / late / waiting / absent / chutti / off / join se pehle', () => {
  const base = { account: { phone: '03001234567' }, schedule: sch, today: '2026-09-21', nowMin: 12 * 60, requests: [] };
  assert.equal(C.statusFor({ ...base, date: '2026-09-21', attendance: { checkIn: '09:10' } }), 'present');
  assert.equal(C.statusFor({ ...base, date: '2026-09-21', attendance: { checkIn: '9:11 am' } }), 'late');
  assert.equal(C.statusFor({ ...base, date: '2026-09-21', attendance: {} }), 'absent');
  assert.equal(C.statusFor({ ...base, date: '2026-09-21', attendance: {}, nowMin: 9 * 60 + 5 }), 'waiting');
  assert.equal(C.statusFor({ ...base, date: '2026-09-22', attendance: {} }), 'na');
  assert.equal(C.statusFor({ ...base, date: '2026-09-18', attendance: {}, requests: [{ phone: '03001234567', kind: 'leave', status: 'approved', date: '2026-09-17', to: '2026-09-19' }] }), 'leave');
  assert.equal(C.statusFor({ ...base, date: '2026-09-18', attendance: {}, requests: [{ phone: '03001234567', kind: 'leave', status: 'pending', date: '2026-09-17', to: '2026-09-19' }] }), 'absent');
  assert.equal(C.statusFor({ ...base, date: '2026-09-18', attendance: {}, schedule: { ...sch, weeklyOff: [5] } }), 'off');
  assert.equal(C.statusFor({ ...base, account: { phone: '03001234567', joinDate: '2026-09-10' }, date: '2026-09-05', attendance: {} }), 'na');
});
test('apni alag shift aur default shift', () => {
  assert.equal(C.resolveSchedule({ shiftStart: '09:00' }, { useDefaultShift: true, shiftStart: '11:00', grace: 5 }).shiftStart, '09:00');
  assert.equal(C.resolveSchedule({ shiftStart: '09:00' }, { useDefaultShift: false, shiftStart: '11:00', grace: 5 }).shiftStart, '11:00');
  assert.equal(C.resolveSchedule({ shiftStart: '09:00' }, { useDefaultShift: true, grace: 5 }).grace, 5);
});
test('check-out baqi: shift khatam hone ke baad hi', () => {
  const a = { date: '2026-09-21', checkIn: '09:00', checkOut: '' };
  assert.equal(C.checkoutDue(a, sch, Date.parse('2026-09-21T18:59:00+05:00')), false);
  assert.equal(C.checkoutDue(a, sch, Date.parse('2026-09-21T19:00:00+05:00')), true);
  assert.equal(C.checkoutDue({ ...a, checkOut: '19:00' }, sch, Date.parse('2026-09-22T19:00:00+05:00')), false);
  assert.equal(C.checkoutDue(a, { shiftStart: '20:00', shiftEnd: '04:00' }, Date.parse('2026-09-22T03:00:00+05:00')), false);
  assert.equal(C.checkoutDue(a, {}, Date.parse('2026-09-22T00:00:00+05:00')), true);
});
test('khula record: raat ki shift ka kal wala record milta hai, 16 ghante purana nahi', () => {
  const now = Date.parse('2026-09-22T02:00:00+05:00');
  assert.equal(C.openRecord([{ date: '2026-09-21', checkIn: '20:00', checkOut: '', checkInTs: Date.parse('2026-09-21T20:00:00+05:00') }], now)?.date, '2026-09-21');
  assert.equal(C.openRecord([{ date: '2026-09-20', checkIn: '09:00', checkOut: '' }], now), null);
  assert.equal(C.openRecord([{ date: '2026-09-21', checkIn: '20:00', checkOut: '23:00' }], now), null);
});
test('salary: purani app wala formula', () => {
  const account = { phone: '03001234567', salary: { monthlySalary: 30000, dutyHours: 10, workingDays: 30, pointRate: 5, mealMode: 'daily', mealRate: 100, mealInSalary: true }, salaryExtras: [{ month: '2026-09', kind: 'advance', amount: 2000 }, { month: '2026-09', kind: 'bonus', amount: 500 }, { month: '2026-08', kind: 'advance', amount: 9999 }] };
  const att = [
    { phone: '03001234567', date: '2026-09-01', checkIn: '09:00', checkOut: '19:00', finalScore: 10 },
    { phone: '03001234567', date: '2026-09-02', checkIn: '09:00', checkOut: '21:00', autoScore: 8 },
    { phone: '03001234567', date: '2026-09-03', checkIn: '09:00', checkOut: '' },
    { phone: '03009999999', date: '2026-09-01', checkIn: '09:00', checkOut: '19:00' },
    { phone: '03001234567', date: '2026-08-31', checkIn: '09:00', checkOut: '19:00' }
  ];
  const c = C.salaryCalc({ account, month: '2026-09', attendance: att });
  assert.equal(c.hourly, 100); assert.equal(c.normalMin, 1200); assert.equal(c.otMin, 120); assert.equal(c.daysWorked, 2); assert.equal(c.openDays, 1);
  assert.equal(c.normalSalary, 2000); assert.equal(c.overtimeAmount, 200); assert.equal(c.points, 18); assert.equal(c.pointsAmount, 90);
  assert.equal(c.mealDays, 3); assert.equal(c.mealSalary, 300); assert.equal(c.advance, 2000); assert.equal(c.bonus, 500);
  assert.equal(c.final, 2000 + 200 + 90 + 500 + 300 - 2000); assert.equal(c.balance, c.final);
  const frozen = C.salaryCalc({ account, month: '2026-09', attendance: [], payroll: { state: 'final', snapshot: { final: 5000, advance: 100 }, paid: 1500, payments: [{ amount: 1500 }] } });
  assert.equal(frozen.frozen, true); assert.equal(frozen.final, 5000); assert.equal(frozen.balance, 3500);
  assert.equal(C.salarySnapshot(c, att.slice(0, 1)).recs.length, 1); assert.equal('frozen' in C.salarySnapshot(c), false);
});
test('smart talash: sawal samajhna', () => {
  const t = '2026-09-23';
  let p = C.parseQuery('late is hafte', t); assert.deepEqual([p.statuses, p.from, p.to, p.text], [['late'], '2026-09-21', '2026-09-23', '']);
  p = C.parseQuery('ghair hazir kal', t); assert.deepEqual([p.statuses, p.from, p.text], [['absent'], '2026-09-22', '']);
  p = C.parseQuery('ali pichle mahine', t); assert.deepEqual([p.from, p.to, p.text], ['2026-08-01', '2026-08-31', 'ali']);
  p = C.parseQuery('checkout baqi', t); assert.equal(p.checkoutDue, true);
  p = C.parseQuery('salary baqi', t); assert.equal(p.salaryDue, true);
  p = C.parseQuery('15 sep', t); assert.equal(p.from, '2026-09-15');
  p = C.parseQuery('12/9', t); assert.equal(p.from, '2026-09-12');
  p = C.parseQuery('december', t); assert.equal(p.from, '2025-12-01');
  p = C.parseQuery('0300-1234567', t); assert.equal(p.from, ''); assert.equal(p.text, '0300-1234567');
  p = C.parseQuery('nahi aaya aaj', t); assert.deepEqual(p.statuses, ['absent']);
});
test('smart talash: naam ki ghalat spelling aur number', () => {
  const s = { name: 'Muhammad Ahmad', phone: '03001234567', role: 'Salesman' };
  for (const q of ['ahmad', 'ahmd', 'ahmed', 'muhammad ahmad', '1234', 'sales', '']) assert.equal(C.matchStaff(s, q), true, q);
  for (const q of ['bilal', '9999', 'zz']) assert.equal(C.matchStaff(s, q), false, q);
  assert.equal(C.matchStaff({ name: 'علی رضا', phone: '03001112222' }, 'علی'), true);
});
test('smart talash: poora nateeja', () => {
  const staff = [{ phone: '03001234567', name: 'Ali Raza' }, { phone: '03007654321', name: 'Bilal' }];
  const attendance = [{ phone: '03001234567', date: '2026-09-22', checkIn: '09:40', checkOut: '19:00' }, { phone: '03007654321', date: '2026-09-22', checkIn: '09:00', checkOut: '' }];
  const ctx = { staff, attendance, config: { shiftStart: '09:00', shiftEnd: '19:00' }, today: '2026-09-23', nowMin: 600, now: Date.parse('2026-09-23T10:00:00+05:00') };
  let r = C.smartSearch({ query: 'late kal', ...ctx }); assert.equal(r.mode, 'days'); assert.deepEqual(r.rows.map(x => x.account.name), ['Ali Raza']);
  r = C.smartSearch({ query: 'checkout baqi', ...ctx }); assert.deepEqual(r.rows.map(x => x.account.name), ['Bilal']);
  r = C.smartSearch({ query: 'bilal', ...ctx }); assert.equal(r.mode, 'people'); assert.equal(r.people.length, 1);
  r = C.smartSearch({ query: 'ghair hazir aaj', ...ctx }); assert.equal(r.rows.length, 2);
});
test('mahine ka khulasa', () => {
  const account = { phone: '03001234567', joinDate: '2026-09-10' };
  const s = C.monthSummary({ account, month: '2026-09', schedule: sch, today: '2026-09-12', nowMin: 1200, attendance: [{ phone: '03001234567', date: '2026-09-10', checkIn: '09:00', checkOut: '19:00' }, { phone: '03001234567', date: '2026-09-11', checkIn: '09:30', checkOut: '' }] });
  assert.deepEqual([s.count.present, s.count.late, s.count.absent, s.count.na], [1, 1, 1, 27]); assert.equal(s.totalMin, 600); assert.equal(s.open, 1);
});
