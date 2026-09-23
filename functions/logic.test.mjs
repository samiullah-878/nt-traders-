// Cloud Functions ke hisab ka test (koi Firebase nahi — sirf logic).
import test from 'node:test'; import assert from 'node:assert/strict';
import { notArrived, checkoutPending, breaksOverdue, lateOnCheckIn, scheduleFor, parseTime, fmt12, list, pkDate } from './logic.js';

const staff = [
  { phone: '03001111111', name: 'Ali' },
  { phone: '03002222222', name: 'Bilal' },
  { phone: '03003333333', name: 'Sonu' },
  { phone: '03004444444', name: 'Purana', active: false },
  { phone: '03005555555', name: 'Naya', joinDate: '2026-10-01' }
];
const config = { shiftStart: '09:15', shiftEnd: '19:00', grace: 10 };
const date = '2026-09-23';

test('duty ke 30 minute baad: kaun nahi aaya', () => {
  const attendance = [{ date, phone: '03001111111', checkIn: '09:10' }];
  const requests = [{ phone: '03002222222', kind: 'leave', status: 'approved', date, to: date }];
  const at = m => notArrived({ staff, attendance, requests, schedules: {}, config, date, nowMin: m }).map(x => x.name);
  assert.deepEqual(at(9 * 60 + 45), ['Sonu'], 'Ali aa gaya, Bilal chutti par, band/naya nahi ginte');
  assert.deepEqual(at(9 * 60 + 30), [], 'waqt se pehle khabar nahi');
  assert.deepEqual(at(12 * 60), [], 'window guzarne ke baad dobara nahi');
  // weekly off wala nahi ginta
  assert.deepEqual(notArrived({ staff: [staff[2]], attendance: [], requests: [], schedules: { '03003333333': { useDefaultShift: false, shiftStart: '09:15', weeklyOff: [3] } }, config, date, nowMin: 9 * 60 + 45 }), []);
  // dukaan band
  assert.deepEqual(notArrived({ staff, attendance: [], requests: [], schedules: {}, config: { ...config, closedDays: [{ date }] }, date, nowMin: 9 * 60 + 45 }), []);
});
test('duty khatam ke baad: kis ka Check-Out baqi', () => {
  const attendance = [{ date, phone: '03001111111', checkIn: '09:10', checkOut: '' }, { date, phone: '03002222222', checkIn: '09:20', checkOut: '19:05' }];
  assert.deepEqual(checkoutPending({ staff, attendance, schedules: {}, config, date, nowMin: 19 * 60 + 35 }).map(x => x.name), ['Ali']);
  assert.deepEqual(checkoutPending({ staff, attendance, schedules: {}, config, date, nowMin: 19 * 60 + 10 }), []);
});
test('break ka waqt guzar gaya', () => {
  const now = Date.parse('2026-09-23T14:00:00+05:00');
  const outs = [
    { id: 'a', kind: 'break', status: 'approved', phone: '1', name: 'Ali', outAt: now - 40 * 60000, minutes: 30 },
    { id: 'b', kind: 'break', status: 'approved', phone: '2', name: 'Bilal', outAt: now - 10 * 60000, minutes: 30 },
    { id: 'c', kind: 'break', status: 'approved', phone: '3', name: 'X', outAt: now - 60 * 60000, minutes: 30, overdueAlert: true },
    { id: 'd', kind: 'break', status: 'returned', phone: '4', outAt: now - 60 * 60000, minutes: 30 }
  ];
  const over = breaksOverdue(outs, now);
  assert.deepEqual(over.map(o => o.id), ['a']); assert.equal(over[0].late, 10);
});
test('late Check-In (aadhi chutti subah wali par nahi)', () => {
  const sch = scheduleFor(config);
  assert.equal(lateOnCheckIn({ attendance: { phone: 'p', checkIn: '09:40' }, schedule: sch, date }), 25);
  assert.equal(lateOnCheckIn({ attendance: { phone: 'p', checkIn: '09:20' }, schedule: sch, date }), 0, 'riayat ke andar');
  assert.equal(lateOnCheckIn({ attendance: { phone: 'p', checkIn: '14:00' }, schedule: sch, date, requests: [{ phone: 'p', kind: 'leave', status: 'approved', date, to: date, half: 'am' }] }), 0);
});
test('chhoti cheezein', () => {
  assert.equal(parseTime('09:15'), 555); assert.equal(fmt12(555), '9:15 am'); assert.equal(fmt12(19 * 60), '7:00 pm');
  assert.equal(list(['a', 'b', 'c', 'd', 'e']), 'a, b, c, d +1');
  assert.match(pkDate(), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(scheduleFor(config, { useDefaultShift: false, shiftStart: '11:00' }).shiftStart, '11:00');
});
