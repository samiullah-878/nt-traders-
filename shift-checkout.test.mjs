import {checkoutDueV113} from '../staff-upgrades.js';
import test from 'node:test';
import assert from 'node:assert/strict';
test('checkout reminder respects shift end, overnight date and completed attendance',()=>{
 const a={date:'2026-09-11',checkIn:'09:00'},s={shiftStart:'09:00',shiftEnd:'19:00'};
 const at=t=>Date.parse(t+'+05:00');
 assert.equal(checkoutDueV113(a,s,at('2026-09-11T18:59:00')),false);
 assert.equal(checkoutDueV113(a,s,at('2026-09-11T19:00:00')),true);
 assert.equal(checkoutDueV113({...a,checkOut:'19:00'},s,at('2026-09-12T09:00:00')),false);
 const night={shiftStart:'21:00',shiftEnd:'06:00'};
 assert.equal(checkoutDueV113(a,night,at('2026-09-11T23:00:00')),false);
 assert.equal(checkoutDueV113(a,night,at('2026-09-12T06:00:00')),true);
 assert.equal(checkoutDueV113({date:a.date},s,at('2026-09-12T06:00:00')),false);
});
