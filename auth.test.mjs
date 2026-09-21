import test from 'node:test'; import assert from 'node:assert/strict';
import { createAuthController, parseLogin, loginErrorMessage, withRetry } from './auth.js';
import { fakeSdk, memoryStorage, B } from './test-fake-sdk.mjs';

const tick = () => new Promise(r => setTimeout(r, 5));
function setup({ records = new Map(), initialUser = null, storage = memoryStorage() } = {}) {
  const f = fakeSdk({ records, initialUser }), events = [];
  const doc = p => ({ path: B + p });
  const accounts = {
    async getSession(uid) { if (f.fail.read) { const e = f.fail.read; f.fail.read = null; throw e; } return records.get(B + 'staffSessions/' + uid) || null; },
    async getAccount(phone) { const a = records.get(B + 'staffAccounts/' + phone); return a ? { ...a, phone } : null; },
    async createSession(uid, phone) { if (!records.get(B + 'staffAccounts/' + phone)) throw Object.assign(new Error('denied'), { code: 'permission-denied' }); await f.sdk.setDoc(doc('staffSessions/' + uid), { phone, createdAt: 1 }); }
  };
  const c = createAuthController({ auth: f.auth, sdk: f.sdk, accounts, storage, wait: async () => {}, onReset: () => events.push('reset'), onSession: s => events.push(s), onError: e => events.push({ error: e.code }) });
  return { f, c, events, storage, records };
}
const staffRecords = () => new Map([[B + 'staffAccounts/03001234567', { name: 'Ali', phone: '03001234567' }]]);

test('login form: staff sirf number; malik khali username = admin', () => {
  assert.deepEqual(parseLogin({ role: 'staff', password: '0300-1234567' }), { role: 'staff', phone: '03001234567' });
  assert.deepEqual(parseLogin({ role: 'staff', username: 'admin', password: '+923001234567' }), { role: 'staff', phone: '03001234567' });
  assert.throws(() => parseLogin({ role: 'staff', password: '12345' }), { code: 'login/staff-phone' });
  assert.equal(parseLogin({ role: 'owner', username: '', password: 'x' }).emails.length, 3);
  assert.deepEqual(parseLogin({ role: 'owner', username: 'HP6235@gmail.com', password: 'x' }).emails, ['hp6235@gmail.com']);
  assert.throws(() => parseLogin({ role: 'owner', username: 'koi@aur.com', password: 'x' }), { code: 'login/owner-username' });
  assert.throws(() => parseLogin({ role: 'owner', password: '' }), { code: 'login/password-required' });
});
test('staff login: session banta hai, account milta hai', async () => {
  const { c, events, records } = setup({ records: staffRecords() }); await tick();
  await c.login({ role: 'staff', password: '03001234567' });
  const s = events.at(-1); assert.equal(s.role, 'staff'); assert.equal(s.phone, '03001234567'); assert.equal(s.account.name, 'Ali');
  assert.equal([...records.keys()].filter(k => k.includes('staffSessions')).length, 1);
});
test('staff login: number register nahi → saaf paigham, koi session nahi', async () => {
  const { c, f } = setup(); await tick();
  await assert.rejects(c.login({ role: 'staff', password: '03001234567' }), e => /register nahi|login band/.test(loginErrorMessage(e)));
  assert.equal(f.auth.currentUser, null);
});
test('staff login: band account → andar nahi', async () => {
  const records = staffRecords(); records.get(B + 'staffAccounts/03001234567').loginEnabled = false;
  const { c } = setup({ records }); await tick();
  await assert.rejects(c.login({ role: 'staff', password: '03001234567' }), { code: 'login/staff-disabled' });
});
test('kamzor internet: khud dobara koshish, phir kamyab', async () => {
  const { c, f, events } = setup({ records: staffRecords() }); await tick();
  f.fail.signIn.push(Object.assign(new Error('net'), { code: 'auth/network-request-failed' }), Object.assign(new Error('net'), { code: 'auth/network-request-failed' }));
  await c.login({ role: 'staff', password: '03001234567' });
  assert.equal(events.at(-1).role, 'staff');
});
test('withRetry: ghalat password par dobara koshish nahi', async () => {
  let n = 0; await assert.rejects(withRetry(async () => { n++; throw Object.assign(new Error('x'), { code: 'auth/invalid-credential' }); }, { wait: async () => {} })); assert.equal(n, 1);
  n = 0; await assert.rejects(withRetry(async () => { n++; throw Object.assign(new Error('x'), { code: 'unavailable' }); }, { wait: async () => {} })); assert.equal(n, 3);
});
test('malik login: chalne wali email yaad rehti hai, agli dafa sirf aik koshish', async () => {
  const storage = memoryStorage(); let { c, f, events } = setup({ storage }); await tick();
  await c.login({ role: 'owner', username: 'admin', password: 'malik-ka-password' });
  assert.equal(events.at(-1).role, 'owner'); assert.deepEqual(f.sdk.attempts, ['admin@nt-traders.firebaseapp.com', 'hp6235@gmail.com']);
  ({ c, f, events } = setup({ storage })); await tick();
  await c.login({ role: 'owner', username: '', password: 'malik-ka-password' });
  assert.deepEqual(f.sdk.attempts, ['hp6235@gmail.com']);
});
test('malik login: ghalat password aur too-many-requests ke paigham', async () => {
  const { c, f } = setup(); await tick();
  await assert.rejects(c.login({ role: 'owner', password: 'ghalat' }), e => loginErrorMessage(e) === 'Password ghalat hai.');
  f.fail.signIn.push(Object.assign(new Error('x'), { code: 'auth/too-many-requests' }));
  await assert.rejects(c.login({ role: 'owner', password: 'malik-ka-password' }), e => /10-15 minute/.test(loginErrorMessage(e)));
});
test('app dobara kholna: staff cache se foran andar, internet na ho tab bhi', async () => {
  const storage = memoryStorage(), records = staffRecords();
  const first = setup({ records, storage }); await tick();
  await first.c.login({ role: 'staff', password: '03001234567' });
  const user = first.f.auth.currentUser;
  const second = setup({ records, storage, initialUser: user });
  second.f.fail.read = Object.assign(new Error('offline'), { code: 'unavailable' });
  await tick(); await tick();
  const s = second.events.find(e => e.role === 'staff'); assert.ok(s); assert.equal(s.fromCache, true); assert.equal(s.phone, '03001234567');
  assert.equal(second.events.some(e => e.error), false);
});
test('app dobara kholna: malik ne login band kar diya → bahar', async () => {
  const storage = memoryStorage(), records = staffRecords();
  const first = setup({ records, storage }); await tick();
  await first.c.login({ role: 'staff', password: '03001234567' });
  records.get(B + 'staffAccounts/03001234567').active = false;
  const second = setup({ records, storage, initialUser: first.f.auth.currentUser }); await tick(); await tick(); await tick();
  assert.equal(second.events.at(-1).error, 'login/staff-disabled'); assert.equal(second.f.auth.currentUser, null);
});
test('doosre larke ka cache kabhi istemal nahi hota', async () => {
  const storage = memoryStorage(); storage.setItem('nt-hazri-session-v200', JSON.stringify({ uid: 'kisi-aur-ka', phone: '03009999999', account: { name: 'X' } }));
  const { events } = setup({ records: staffRecords(), storage, initialUser: { uid: 'anon-naya', isAnonymous: true } }); await tick(); await tick();
  assert.equal(events.some(e => e.role === 'staff'), false); assert.equal(events.at(-1).error, 'login/staff-session');
});
test('logout: cache saaf', async () => {
  const { c, storage, events } = setup({ records: staffRecords() }); await tick();
  await c.login({ role: 'staff', password: '03001234567' }); assert.ok(storage.getItem('nt-hazri-session-v200'));
  await c.logout(); assert.equal(storage.getItem('nt-hazri-session-v200'), null); assert.equal(events.at(-1), 'reset');
});
