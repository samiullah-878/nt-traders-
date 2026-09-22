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
  assert.equal(C.resolveSchedule({ shiftStart: '09:00', grace: 15 }, { useDefaultShift: true, grace: 5 }).grace, 15);
  assert.equal(C.resolveSchedule({ shiftStart: '09:00' }, { useDefaultShift: false, grace: 5 }).grace, 5);
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

test('tareekh hamesha YYYY-MM-DD, har phone par', () => {
  assert.match(C.pkDate(), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(C.pkDate(new Date('2026-09-21T20:30:00Z')), '2026-09-22'); // Pakistan mein raat 1:30
  assert.equal(C.pkDate(new Date('2026-09-21T18:59:00Z')), '2026-09-21');
});
test('shift ke ghante aur dukaan band', () => {
  assert.equal(C.shiftMinutes({ shiftStart: '09:00', shiftEnd: '19:00' }), 600);
  assert.equal(C.shiftMinutes({ shiftStart: '20:00', shiftEnd: '04:00' }), 480);
  assert.equal(C.shiftMinutes({ shiftStart: '09:00' }), null);
  const schedule = C.resolveSchedule({ shiftStart: '09:00', closedDays: [{ date: '2026-09-18', reason: 'Eid' }] });
  assert.equal(C.statusFor({ account: { phone: '1' }, attendance: {}, date: '2026-09-18', schedule, today: '2026-09-21', nowMin: 600 }), 'closed');
  assert.equal(C.statusFor({ account: { phone: '1' }, attendance: { checkIn: '09:00' }, date: '2026-09-18', schedule, today: '2026-09-21', nowMin: 600 }), 'present');
  assert.equal(C.countStatuses([{ status: 'closed' }, { status: 'off' }]).off, 2);
});
const P = '03001234567';
const cfg = { shiftStart: '09:00', shiftEnd: '17:00', salaryDefault: { monthlySalary: 30000, workingDays: 30, mode: 'hours' } };
test('default salary: raqam default se, ghante duty se', () => {
  const c = C.salaryConfig({ phone: P }, cfg);
  assert.equal(c.useDefault, true); assert.equal(c.monthlySalary, 30000); assert.equal(c.dutyHours, 8);
  const own = C.salaryConfig({ phone: P, salary: { monthlySalary: 40000, dutyHours: 10 } }, cfg);
  assert.equal(own.useDefault, false); assert.equal(own.monthlySalary, 40000); assert.equal(own.dutyHours, 10);
  const back = C.salaryConfig({ phone: P, salary: { monthlySalary: 40000, useDefault: true } }, cfg);
  assert.equal(back.monthlySalary, 30000);
});
test('din ke hisab se salary: ghair hazir din kat-te hain, chutti nahi', () => {
  const config = { ...cfg, salaryDefault: { ...cfg.salaryDefault, mode: 'days' } };
  const att = [{ phone: P, date: '2026-09-01', checkIn: '09:00', checkOut: '17:00' }, { phone: P, date: '2026-09-02', checkIn: '09:00', checkOut: '18:00' }];
  const requests = [{ phone: P, kind: 'leave', status: 'approved', date: '2026-09-03', to: '2026-09-03' }];
  const c = C.salaryCalc({ account: { phone: P }, month: '2026-09', attendance: att, config, requests, today: '2026-09-05', nowMin: 1200 });
  assert.equal(c.absentDays, 2); assert.equal(c.perDay, 1000); assert.equal(c.absentCut, 2000); assert.equal(c.normalSalary, 28000);
  assert.equal(c.otMin, 60); assert.equal(Math.round(c.overtimeAmount), 125); assert.equal(Math.round(c.final), 28125);
  const unpaid = C.salaryCalc({ account: { phone: P }, month: '2026-09', attendance: att, config: { ...config, salaryDefault: { ...config.salaryDefault, leavePaid: false } }, requests, today: '2026-09-05', nowMin: 1200 });
  assert.equal(unpaid.absentDays, 2); assert.equal(unpaid.leaveCut, 1000); assert.equal(unpaid.leaveLines.length, 1); assert.equal(Math.round(unpaid.final), 27125);
  const joined = C.salaryCalc({ account: { phone: P, joinDate: '2026-09-04' }, month: '2026-09', attendance: [], config, today: '2026-09-05', nowMin: 1200 });
  assert.equal(joined.absentDays, 5, 'join se pehle ke 3 din + 2 ghair hazir');
});
test('late jurmana aur qarz ki qist', () => {
  const config = { ...cfg, salaryDefault: { ...cfg.salaryDefault, lateEvery: 3, lateFineDays: 0.5 } };
  const att = ['01', '02', '03', '04'].map(d => ({ phone: P, date: '2026-09-' + d, checkIn: '09:30', checkOut: '17:30' }));
  const account = { phone: P, salaryExtras: [{ id: 'l1', kind: 'loan', month: '2026-08', amount: 5000, perMonth: 3000 }] };
  const c = C.salaryCalc({ account, month: '2026-09', attendance: att, config, today: '2026-09-04', nowMin: 1200 });
  assert.equal(c.lateCount, 4); assert.equal(c.lateFine, 500); assert.equal(c.loanCut, 2000); assert.equal(c.loans[0].remainingAfter, 0);
  assert.equal(c.deductions, 2500);
  assert.equal(C.salaryCalc({ account, month: '2026-08', attendance: [], config, today: '2026-09-04' }).loanCut, 3000);
  assert.equal(C.salaryCalc({ account, month: '2026-10', attendance: [], config, today: '2026-09-04' }).loanCut, 0);
});
test('hafte ka khulasa', () => {
  const w = C.weekSummary({ staff: [{ phone: P, name: 'A' }], config: { shiftStart: '09:00' }, today: '2026-09-23', nowMin: 1200,
    attendance: [{ phone: P, date: '2026-09-21', checkIn: '09:30', checkOut: '17:30' }, { phone: P, date: '2026-09-22', checkIn: '09:00', checkOut: '17:00' }] });
  assert.deepEqual([w.from, w.rows[0].present, w.rows[0].late, w.rows[0].absent, w.rows[0].minutes], ['2026-09-21', 2, 1, 1, 960]);
});

test('bahar ki parchi: minute, din ka khulasa, salary kati', () => {
  const t0 = Date.parse('2026-09-21T15:00:00+05:00');
  assert.equal(C.outMinutes({ status: 'returned', outAt: t0, returnAt: t0 + 35 * 60000 }), 35);
  assert.equal(C.outMinutes({ status: 'approved', outAt: t0 }, t0 + 10 * 60000), 10);
  assert.equal(C.outMinutes({ status: 'approved', outAt: t0 }), null);
  const outs = [{ phone: P, date: '2026-09-21', status: 'returned', outAt: t0, returnAt: t0 + 30 * 60000, requestedAt: 1 }, { phone: P, date: '2026-09-21', status: 'approved', outAt: t0 + 60 * 60000, requestedAt: 2 }, { phone: P, date: '2026-09-21', status: 'rejected', requestedAt: 3 }];
  const d = C.dayOuts(outs, P, '2026-09-21', t0 + 80 * 60000);
  assert.equal(d.done.length, 1); assert.ok(d.open); assert.equal(d.total, 50); assert.equal(d.count, 2);
  const config = { ...cfg, salaryDefault: { ...cfg.salaryDefault, outDeduct: true } };
  const c = C.salaryCalc({ account: { phone: P }, month: '2026-09', attendance: [], config, outs, today: '2026-09-21' });
  assert.equal(c.outMin, 30); assert.equal(c.outCount, 1); assert.equal(Math.round(c.outCut), Math.round(0.5 * c.hourly));
  assert.equal(C.salaryCalc({ account: { phone: P }, month: '2026-09', attendance: [], config: cfg, outs, today: '2026-09-21' }).outCut, 0);
  assert.match(C.dayColor('2026-09-21'), /^hsl\(/);
});

test('parchi Urdu: wajah aur waqt', () => {
  assert.equal(C.reasonUr('Washroom (bari hajat)'), 'واش روم — بڑی حاجت');
  assert.equal(C.minutesUr(3), '3 منٹ'); assert.equal(C.minutesUr(60), '1 گھنٹہ'); assert.equal(C.minutesUr(90), 'ڈیڑھ گھنٹہ'); assert.equal(C.minutesUr(120), '2 گھنٹے');
  assert.deepEqual(C.OUT_MINUTES.slice(0, 3), [3, 5, 7]);
  assert.ok(C.OUT_REASONS.every(r => r.key.length <= 40), 'rules: wajah 40 harf tak');
});

test('chhota waqt', () => {
  assert.equal(C.durText(0), '1 min se kam'); assert.equal(C.durText(7), '7 min'); assert.equal(C.durText(65), '1h 05m');
});

test('khana break parchi se alag ginti', () => {
  const t0 = Date.parse('2026-09-21T13:00:00+05:00');
  const outs = [{ phone: P, date: '2026-09-21', status: 'returned', kind: 'break', outAt: t0, returnAt: t0 + 30 * 60000 }, { phone: P, date: '2026-09-21', status: 'returned', outAt: t0 + 60 * 60000, returnAt: t0 + 70 * 60000 }];
  assert.equal(C.dayOuts(outs, P, '2026-09-21').total, 10); assert.equal(C.dayOuts(outs, P, '2026-09-21', t0, 'break').total, 30);
  const c = C.salaryCalc({ account: { phone: P }, month: '2026-09', attendance: [], config: cfg, outs, today: '2026-09-21' });
  assert.equal(c.outMin, 10); assert.equal(c.breakMin, 30); assert.equal(c.breakCut, 0);
  assert.ok(C.salaryCalc({ account: { phone: P }, month: '2026-09', attendance: [], config: { ...cfg, salaryDefault: { ...cfg.salaryDefault, breakDeduct: true } }, outs, today: '2026-09-21' }).breakCut > 0);
  assert.deepEqual(C.rosterOf([{ phone: '03009999999', name: 'Z', breakGroup: 2 }, { phone: '03001111111', name: 'A', active: false }]), [{ phone: '03009999999', name: 'Z', group: 2 }]);
});

test('bina bataye gaya: plan wali misal', () => {
  const t = { date: '2026-09-22', from: Date.parse('2026-09-22T13:15:00+05:00'), returnAt: Date.parse('2026-09-22T14:45:00+05:00'), status: 'decided', decision: 'katauti', amount: 125, phone: P };
  assert.equal(C.ticketMinutes(t), 90);
  assert.equal(C.ticketSuggest(30000 / 30 / 12, 90), 125, 'Rs 30,000, 30 din, 12 ghante, 1.5 ghanta -> Rs 125');
  assert.equal(C.ticketText(t), 'Bina bataye gaya — 22 Sep, 1:15 se 2:45 — Rs 125');
  assert.equal(C.round5(123), 125); assert.equal(C.round5(122), 120);
  const c = C.salaryCalc({ account: { phone: P }, month: '2026-09', attendance: [], config: cfg, tickets: [t, { ...t, decision: 'warning', amount: 0 }, { ...t, status: 'returned' }], today: '2026-09-22' });
  assert.equal(c.ticketCut, 125); assert.equal(c.ticketLines.length, 1); assert.ok(c.deductions >= 125);
});

test('aadhi chutti: status, late nahi, check-out baqi nahi, paisa katega / nahi', () => {
  const schedule = C.resolveSchedule({ shiftStart: '09:00', shiftEnd: '19:00' });
  const reqs = h => [{ phone: P, kind: 'leave', status: 'approved', date: '2026-09-10', to: '2026-09-10', half: h }];
  // subah ki chutti: 2:30 pm aaya -> 'half', late 0
  let rows = C.dayRows({ staff: [{ phone: P }], attendance: [{ phone: P, date: '2026-09-10', checkIn: '14:30', checkOut: '' }], requests: reqs('am'), config: { shiftStart: '09:00', shiftEnd: '19:00' }, date: '2026-09-10', today: '2026-09-10', nowMin: 900, now: Date.parse('2026-09-10T20:00:00+05:00') });
  assert.equal(rows[0].status, 'half'); assert.equal(rows[0].late, 0);
  // shaam ki chutti: 2:00 pm ke baad check-out baqi nahi (duty aadhe din par khatam = 14:00)
  rows = C.dayRows({ staff: [{ phone: P }], attendance: [{ phone: P, date: '2026-09-10', checkIn: '09:00', checkOut: '' }], requests: reqs('pm'), config: { shiftStart: '09:00', shiftEnd: '19:00' }, date: '2026-09-10', today: '2026-09-10', nowMin: 700, now: Date.parse('2026-09-10T13:00:00+05:00') });
  assert.equal(rows[0].due, false);
  assert.equal(C.halfSchedule(schedule, 'am').shiftStart, '14:00'); assert.equal(C.halfSchedule(schedule, 'pm').shiftEnd, '14:00');
  // salary (din ke hisab): aadhi chutti paisa katega = aadha din; aaya hi nahi = aadha ghair hazir + aadhi chutti
  const config = { shiftStart: '09:00', shiftEnd: '19:00', salaryDefault: { monthlySalary: 30000, workingDays: 30, mode: 'days' } };
  let c = C.salaryCalc({ account: { phone: P }, month: '2026-09', attendance: [{ phone: P, date: '2026-09-10', checkIn: '14:00', checkOut: '19:00' }], config, requests: [{ ...reqs('am')[0], paid: false }], today: '2026-09-10', nowMin: 1200 });
  assert.equal(c.leaveCut, 500); assert.equal(c.leaveLines[0].text, 'Chutti 10 Sep (aadha din)');
  c = C.salaryCalc({ account: { phone: P }, month: '2026-09', attendance: [{ phone: P, date: '2026-09-10', checkIn: '14:00', checkOut: '19:00' }], config, requests: [{ ...reqs('am')[0], paid: true }], today: '2026-09-10', nowMin: 1200 });
  assert.equal(c.leaveCut, 0);
  c = C.salaryCalc({ account: { phone: P }, month: '2026-09', attendance: [], config, requests: [{ ...reqs('am')[0], paid: true }], today: '2026-09-10', nowMin: 1200 });
  assert.equal(c.leaveCut, 0); assert.equal(c.absentCut, 9 * 1000 + 500, '9 poore ghair hazir + aadha');
  // ghanton ke hisab: paise wali chutti ke ghante jurte hain
  const h = C.salaryCalc({ account: { phone: P }, month: '2026-09', attendance: [], config: { ...config, salaryDefault: { ...config.salaryDefault, mode: 'hours' } }, requests: [{ phone: P, kind: 'leave', status: 'approved', date: '2026-09-09', to: '2026-09-09', paid: true }], today: '2026-09-10', nowMin: 1200 });
  assert.equal(Math.round(h.leavePay), 1000, 'aik din ke 10 ghante × Rs 100');
});
