// v203: tez kholna aur tez save.
import test from 'node:test'; import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { fakeSdk, memoryStorage, B } from './test-fake-sdk.mjs';

const win = new Window({ url: 'https://samiullah-878.github.io/nt-traders-/' });
Object.assign(globalThis, { window: win, document: win.document, File: win.File, requestAnimationFrame: fn => setTimeout(fn, 0), location: win.location });
Object.defineProperty(globalThis, 'navigator', { value: win.navigator, configurable: true, writable: true });
win.confirm = () => true; globalThis.confirm = win.confirm; win.scrollTo = () => {};
win.fetch = async () => ({ ok: true, json: async () => ({ version: 'v203' }) });
win.document.body.innerHTML = '<div id="app" data-screen="boot"></div><div id="sheetHost"></div><div id="toast"></div>';
const { startApp } = await import('./app.js');
const C = await import('./core.js');
const today = C.pkDate();
const records = new Map([
  [B + 'staffConfig/main', { shiftStart: '09:15', shiftEnd: '19:00' }],
  [B + 'staffAccounts/03001234567', { name: 'Ali', phone: '03001234567' }]
]);
const fake = fakeSdk({ records });
let release; const slowSdk = new Promise(r => { release = () => r(fake.sdk); });
const app = startApp({ sdkPromise: slowSdk, firebaseConfig: { projectId: 'nt-traders' }, storage: memoryStorage(), win });
const $ = s => win.document.querySelector(s);
const settle = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise(r => setTimeout(r, 4)); };
const click = async el => { el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true })); await settle(); };

test('login screen Firebase aane se PEHLE nazar aati hai, likha hua number nahi mit-ta', async () => {
  assert.equal($('#app').dataset.screen, 'login'); assert.ok($('input[name=phone]'));
  $('input[name=phone]').value = '0300'; release(); await settle();
  assert.equal($('#app').dataset.screen, 'login'); assert.equal($('input[name=phone]').value, '0300');
});
test('save foran: server dheema ho tab bhi screen foran badalti hai', async () => {
  await click($('[data-action=login-role][data-arg=owner]'));
  const f = $('form[data-form=login]'); f.elements.password.value = 'malik-ka-password';
  f.dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true })); await settle(12);
  assert.equal($('#app').dataset.screen, 'owner');
  const realBatch = fake.sdk.writeBatch; let finish;
  fake.sdk.writeBatch = () => { const b = realBatch(); const c = b.commit; b.commit = () => new Promise(r => { finish = () => c().then(r); }); return b; };
  const started = Date.now();
  const tick = $('[data-action=tix][data-kind=in][data-arg="09:15"]'); assert.ok(tick);
  await click(tick); await new Promise(r => setTimeout(r, 450));
  assert.ok(Date.now() - started < 1500, 'server ke intezar ke baghair');
  assert.match($('.brand').textContent, /1 entry server par ja rahi/);
  finish(); await settle();
  assert.equal(records.get(B + `staffAttendance/${today}_03001234567`).checkIn, '09:15');
  assert.doesNotMatch($('.brand').textContent, /server par ja rahi/);
  fake.sdk.writeBatch = realBatch;
});
test('server save na kare to saaf paigham', async () => {
  const realBatch = fake.sdk.writeBatch;
  fake.sdk.writeBatch = () => { const b = realBatch(); b.commit = async () => { throw Object.assign(new Error('x'), { code: 'permission-denied' }); }; return b; };
  await app.data.saveConfig({ shiftStart: '09:15', shiftEnd: '19:00' }).catch(() => {}); await settle();
  assert.match($('#toast').textContent, /server par save nahi hui/);
  fake.sdk.writeBatch = realBatch;
});
test('update ke links: GitHub ka pata website se, Firebase rules', async () => {
  await click($('[data-action=tab][data-arg=settings]')); await click($('[data-action=links]'));
  const hrefs = [...win.document.querySelectorAll('[data-sheet=links] a')].map(a => a.getAttribute('href'));
  assert.ok(hrefs.includes('https://github.com/samiullah-878/nt-traders-/upload/main'));
  assert.ok(hrefs.includes('https://console.firebase.google.com/project/nt-traders/firestore/rules'));
});
test.after(async () => { app.data?.stop(); await win.happyDOM.abort(); win.close(); });
