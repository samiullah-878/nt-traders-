// v219: aik hi jagti function (onHazriWrite) — sahi likhai par sahi khabar, baqi par kuch nahi; aik phone ko aik hi khabar.
// Chalana (functions mein npm install ke baad):  node --test --experimental-test-module-mocks functions/router.test.mjs — Firebase naqli (mock), asal nahi
import { test, mock } from 'node:test'; import assert from 'node:assert/strict';
const store = new Map(), sent = [];
const snap = (path, data) => ({ id: path.split('/').pop(), exists: data !== undefined, data: () => data });
const colRef = path => ({
  path, _w: [],
  where(f, op, v) { const c = colRef(path); c._w = [...this._w, [f, v]]; return c; },
  async get() { const docs = [...store].filter(([k]) => k.startsWith(path + '/') && !k.slice(path.length + 1).includes('/')).filter(([, v]) => this._w.every(([f, val]) => v[f] === val)).map(([k, v]) => ({ id: k.split('/').pop(), data: () => v })); return { docs }; },
  doc: id => ({ async get() { return snap(path + '/' + id, store.get(path + '/' + id)); }, async delete() { store.delete(path + '/' + id); } })
});
mock.module('firebase-admin/app', { namedExports: { initializeApp: () => ({}) } });
mock.module('firebase-admin/firestore', { namedExports: { FieldValue: {}, getFirestore: () => ({ collection: colRef, doc: path => ({ async get() { return snap(path, store.get(path)); }, async set(v) { store.set(path, v); } }) }) } });
mock.module('firebase-admin/messaging', { namedExports: { getMessaging: () => ({ async sendEach(list) { sent.push(...list); return { successCount: list.length, responses: list.map(() => ({ success: true })) }; }, async send(m) { sent.push(m); } }) } });
let handler = null, opts = null;
mock.module('firebase-functions/v2/firestore', { namedExports: { onDocumentWritten: (o, fn) => { opts = o; handler = fn; return fn; }, onDocumentCreated: () => () => {} } });
mock.module('firebase-functions/v2/scheduler', { namedExports: { onSchedule: () => () => {} } });
mock.module('firebase-functions', { namedExports: { logger: { info() {}, error() {}, warn() {} } } });
const BIZ = 'businesses/noor-traders';
store.set(`${BIZ}/staffConfig/main`, { shiftStart: '09:00', shiftEnd: '19:00', appUrl: 'https://x.test/' });
store.set(`${BIZ}/staffAccounts/03001112223`, { name: 'Sonu' });
// aik hi phone (device id d:abc) ke do token + aik purana (id ke baghair) + manager
store.set(`${BIZ}/pushTokens/t1`, { token: 'OLD', role: 'owner', device: 'd:abc123 · Android 10', at: 1 });
store.set(`${BIZ}/pushTokens/t2`, { token: 'NEW', role: 'owner', device: 'd:abc123 · Android 10', at: 5 });
store.set(`${BIZ}/pushTokens/t3`, { token: 'MGR', role: 'manager', device: 'd:mmm999 · Android 12', at: 3 });
store.set(`${BIZ}/pushTokens/t4`, { token: 'STAFF', role: 'staff', device: 'x', at: 3 });
await import('./index.js');
const write = async (coll, id, after, before) => { sent.length = 0; await handler({ params: { coll, docId: id }, data: { before: snap('b', before), after: snap('a', after) } }); return [...sent]; };

test('aik hi jagti function: minInstances 1, sab likhai sunti hai', () => {
  assert.equal(opts.minInstances, 1); assert.equal(opts.document, `${BIZ}/{coll}/{docId}`);
});
test('nayi parchi / request / ticket -> foran khabar; aik phone ko aik hi (naya token)', async () => {
  const a = await write('staffOuts', 'o1', { phone: '03001112223', name: 'Sonu', reason: 'Bank', minutes: 20, status: 'pending' });
  assert.deepEqual(a.map(m => m.token).sort(), ['MGR', 'NEW'], 'purana token OLD aur staff ko nahi');
  assert.match(a[0].data.title, /Sonu bahar jana chahta hai/); assert.equal(a[0].data.tag, 'out-o1');
  const r = await write('staffRequests', 'r1', { phone: '03001112223', kind: 'leave', date: '2026-09-27', to: '2026-09-27', reason: 'Shadi', status: 'pending' });
  assert.match(r[0].data.title, /Sonu ne chutti mangi/);
  const t = await write('staffTickets', 'k1', { phone: '03001112223', name: 'Sonu', from: Date.now(), byName: 'Usman', status: 'open' });
  assert.match(t[0].data.title, /bina bataye gaya/);
});
test('update / mitana / faltu collection par kuch nahi', async () => {
  assert.equal((await write('staffOuts', 'o1', { status: 'approved' }, { status: 'pending' })).length, 0, 'update');
  assert.equal((await write('staffAudit', 'z', { type: 'x' })).length, 0, 'audit');
  assert.equal((await write('blueKhata', 'z', { a: 1 })).length, 0, 'Blue Khata');
  sent.length = 0; await handler({ params: { coll: 'staffOuts', docId: 'o1' }, data: { before: snap('b', { status: 'pending' }), after: snap('a', undefined) } });
  assert.equal(sent.length, 0, 'mitaya');
});
test('Test notification: testAt badle to usi token par', async () => {
  const s = await write('pushTokens', 't2', { token: 'NEW', testAt: 9 }, { token: 'NEW', testAt: 1 });
  assert.equal(s.length, 1); assert.equal(s[0].token, 'NEW'); assert.equal(s[0].data.tag, 'test');
  assert.equal((await write('pushTokens', 't2', { token: 'NEW', testAt: 9, at: 7 }, { token: 'NEW', testAt: 9 })).length, 0, 'testAt wahi — dobara nahi');
});

test('v222: galla SHAK -> sirf malik ko khabar; normal par kuch nahi', async () => {
  const a = await write('cameraEvents', 'aa11-ch1-1700000000000', { cam: 'aa11-ch1', camName: 'Galla', at: Date.now(), date: '2026-09-28', verdict: 'shak', why: 'Note jeb ki taraf gaya' });
  assert.deepEqual(a.map(m => m.token), ['NEW'], 'sirf owner (manager ko nahi)');
  assert.match(a[0].data.title, /Galla: shak · Galla/); assert.equal(a[0].data.tag, 'cam-aa11-ch1-1700000000000'); assert.match(a[0].data.body, /jeb/);
  assert.equal((await write('cameraEvents', 'x2', { verdict: 'normal', why: 'baqaya diya' })).length, 0);
});

test('v223: galla milaan — wait -> missing par aik dafa "entry nahi"; ok par kuch nahi', async () => {
  const base = { cam: 'aa11-ch1', camName: 'Galla', at: Date.now(), date: '2026-09-28', verdict: 'normal', why: 'paisa rakha', flow: 'aaya' };
  const a = await write('cameraEvents', 'ev9', { ...base, matchState: 'missing' }, { ...base, matchState: 'wait' });
  assert.deepEqual(a.map(m => m.token), ['NEW']); assert.match(a[0].data.title, /Galla: entry nahi/); assert.match(a[0].data.body, /paisa aaya lekin POS bill/);
  assert.equal((await write('cameraEvents', 'ev9', { ...base, matchState: 'missing', reviewed: 'ok' }, { ...base, matchState: 'missing' })).length, 0, 'dobara nahi');
  assert.equal((await write('cameraEvents', 'ev9', { ...base, matchState: 'ok' }, { ...base, matchState: 'wait' })).length, 0, 'mil gaya');
  assert.equal((await write('cameraEvents', 'ev10', { ...base, matchState: 'wait' })).length, 0, 'naya normal: kuch nahi');
});

test('v224: bill cancel / badla -> sirf malik ko khabar (naye par hi)', async () => {
  const a = await write('posAlerts', '00119008-1', { kind: 'cancel', no: '00119008', before: 9000, after: 0, amount: 9000, at: Date.now() - 120000, when: Date.now(), by: 'Ali', date: '2026-09-28', eventId: '', replacedBy: { no: '00119009', amount: 100, at: Date.now() } });
  assert.deepEqual(a.map(m => m.token), ['NEW']); assert.match(a[0].data.title, /Bill cancel: #00119008 · Rs 9,000/); assert.match(a[0].data.body, /naya #00119009 Rs 100/);
  const e = await write('posAlerts', 'x-2', { kind: 'edit', no: '5', before: 9000, after: 100, amount: 9000, at: 1, when: 2, by: '', date: '2026-09-28', eventId: '' });
  assert.match(e[0].data.title, /Bill badla: #5 · Rs 9,000 → Rs 100/);
  assert.equal((await write('posAlerts', 'x-2', { kind: 'edit', replacedBy: { no: '6' } }, { kind: 'edit' })).length, 0, 'update par dobara nahi');
});

test('v225: mangwayi clip tayyar (req -> ok) -> malik ko khabar; shak wali khud ki clip par nahi', async () => {
  const a = await write('cameraClips', 'req-1', { kind: 'req', status: 'ok', from: 1, to: 2, title: '5 baje' }, { kind: 'req', status: 'making' });
  assert.deepEqual(a.map(m => m.token), ['NEW']); assert.match(a[0].data.title, /Clip tayyar: 5 baje/);
  assert.equal((await write('cameraClips', 'ev-1', { kind: 'shak', status: 'ok' }, { kind: 'shak', status: 'making' })).length, 0);
  assert.equal((await write('cameraClips', 'req-1', { kind: 'req', status: 'ok', keep: true }, { kind: 'req', status: 'ok' })).length, 0, 'dobara nahi');
});
