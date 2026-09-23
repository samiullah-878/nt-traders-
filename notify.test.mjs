// v211: ntfy notifications (app band ho tab bhi) — paigham sahi banta hai aur sahi waqt jata hai.
import test from 'node:test'; import assert from 'node:assert/strict';
import { sendNotify, newTopic } from './notify.js';
import { createData } from './data.js';
import { fakeSdk, B } from './test-fake-sdk.mjs';
import * as C from './core.js';

test('sendNotify: band ho to kuch nahi; chalu ho to ntfy.sh ko JSON', async () => {
  const calls = []; const f = async (url, o) => { calls.push({ url, o }); return { ok: true }; };
  assert.equal(await sendNotify({}, 'out', { title: 'x' }, f), false);
  assert.equal(await sendNotify({ notify: { on: true, topic: 't1', out: false } }, 'out', { title: 'x' }, f), false);
  assert.equal(await sendNotify({ notify: { on: true, topic: 't1' } }, 'out', { title: 'Ali bahar', message: 'Bank', priority: 4, click: 'https://a/' }, f), true);
  assert.equal(calls.length, 1); assert.equal(calls[0].url, 'https://ntfy.sh/');
  const body = JSON.parse(calls[0].o.body); assert.deepEqual([body.topic, body.title, body.message, body.priority, body.click], ['t1', 'Ali bahar', 'Bank', 4, 'https://a/']);
  assert.equal(calls[0].o.headers, undefined, 'simple request (CORS preflight nahi)');
  assert.match(newTopic(), /^nt-hazri-[a-z2-9]{12}$/);
});
test('staff ki parchi aur late Check-In par khabar jati hai', async () => {
  const today = C.pkDate(), P = '03001234567';
  const records = new Map([
    [B + 'staffConfig/main', { shiftStart: '00:00', shiftEnd: '23:59', grace: 0, radius: 200, notify: { on: true, topic: 'nt-hazri-test', out: true, late: true, leave: true, ticket: true } }],
    [B + 'staffAccounts/' + P, { name: 'Ali', phone: P }]
  ]);
  const fake = fakeSdk({ records, initialUser: { uid: 'anon-1', isAnonymous: true } }); const sent = [];
  const data = createData({ sdk: fake.sdk, firebaseConfig: {}, notifyFetch: async (u, o) => { sent.push(JSON.parse(o.body)); return { ok: true }; } });
  data.startStaff(P, { name: 'Ali', phone: P });
  const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(r => setTimeout(r, 4)); };
  await settle();
  await data.checkIn({ selfie: 'data:image/jpeg;base64,AA', gps: { lat: 1, lng: 1, accuracy: 5, distance: 10 } }); await settle();
  if (C.pkMinutes() > 1) assert.ok(sent.some(m => /Ali late aaya/.test(m.title)), 'late ki khabar');
  await data.requestOut({ reason: 'Bank', minutes: 15 }); await settle();
  const out = sent.find(m => /bahar jana chahta hai/.test(m.title)); assert.ok(out, 'parchi ki khabar'); assert.equal(out.topic, 'nt-hazri-test'); assert.equal(out.priority, 4);
  await data.sendRequest({ kind: 'leave', date: today, reason: 'Shadi' }); await settle();
  assert.ok(sent.some(m => /chutti mangi/.test(m.title)), 'chutti ki khabar');
  data.stop();
});
