// v244: duty se pehle Check-Out band + jaldi jane ki ijazat
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkoutLock, earlyFor } from './core.js';
const at = s => Date.parse(s + '+05:00');
const sch = { shiftStart: '09:15', shiftEnd: '19:00', weeklyOff: [], closedDays: [] };
const a = { phone: '03001234567', date: '2026-10-12', checkIn: '09:20' };
test('duty khatam hone se pehle band, baad mein khula', () => {
  const L = checkoutLock(a, sch, { now: at('2026-10-12T17:35:00') });
  assert.equal(L.until, '19:00'); assert.equal(L.left, 85);
  assert.equal(checkoutLock(a, sch, { now: at('2026-10-12T19:00:00') }), null);
  assert.equal(checkoutLock({ ...a, checkOut: '18:00' }, sch, { now: at('2026-10-12T17:00:00') }), null);
});
test('setting band, off day, dukaan band', () => {
  assert.equal(checkoutLock(a, sch, { now: at('2026-10-12T12:00:00'), on: false }), null);
  assert.equal(checkoutLock(a, { ...sch, weeklyOff: [1] }, { now: at('2026-10-12T12:00:00') }), null); // 12 Oct 2026 = Peer
  assert.equal(checkoutLock(a, { ...sch, closedDays: [{ date: '2026-10-12' }] }, { now: at('2026-10-12T12:00:00') }), null);
  assert.equal(checkoutLock(a, { ...sch, shiftEnd: '' }, { now: at('2026-10-12T12:00:00') }), null);
});
test('jaldi jana: pending band, manzoor khula, mana band', () => {
  const req = status => [{ phone: a.phone, kind: 'early', date: a.date, checkOut: '16:00', status, createdAt: 1 }];
  const now = at('2026-10-12T15:00:00');
  assert.ok(checkoutLock(a, sch, { now, requests: req('pending') }));
  assert.equal(checkoutLock(a, sch, { now, requests: req('approved') }), null);
  assert.ok(checkoutLock(a, sch, { now, requests: req('rejected') }));
  assert.equal(earlyFor([...req('rejected'), { ...req('approved')[0], createdAt: 5 }], a.phone, a.date).status, 'approved');
  // doosre din / doosre larke ki ijazat yahan nahi chalti
  assert.ok(checkoutLock(a, sch, { now, requests: [{ ...req('approved')[0], date: '2026-10-11' }] }));
  assert.ok(checkoutLock(a, sch, { now, requests: [{ ...req('approved')[0], phone: '03000000000' }] }));
});
test('chutti: poori = khula, shaam ki aadhi = aadhi duty par', () => {
  const lv = half => [{ phone: a.phone, kind: 'leave', date: a.date, to: a.date, half, status: 'approved' }];
  assert.equal(checkoutLock(a, sch, { now: at('2026-10-12T12:00:00'), requests: lv('') }), null);
  const L = checkoutLock(a, sch, { now: at('2026-10-12T13:00:00'), requests: lv('pm') });
  assert.equal(L.until, '14:08'); assert.equal(L.half, true);
  assert.equal(checkoutLock(a, sch, { now: at('2026-10-12T14:08:00'), requests: lv('pm') }), null);
});
test('raat ki duty (aadhi raat paar)', () => {
  const night = { ...sch, shiftStart: '20:00', shiftEnd: '04:00' }, b = { ...a, checkIn: '20:05' };
  assert.ok(checkoutLock(b, night, { now: at('2026-10-12T23:00:00') }));
  assert.equal(checkoutLock(b, night, { now: at('2026-10-13T04:00:00') }), null);
});
