// Poori app naqli Firebase + happy-dom par: login se le kar salary final tak. Asal browser ka badal nahi, lekin runtime ghaltiyan pakarta hai.
import test from 'node:test'; import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { fakeSdk, memoryStorage, B } from './test-fake-sdk.mjs';

const win = new Window({ url: 'https://example.test/app/' });
Object.assign(globalThis, { window: win, document: win.document, File: win.File, requestAnimationFrame: fn => setTimeout(fn, 0) });
Object.defineProperty(globalThis, 'navigator', { value: win.navigator, configurable: true, writable: true });
win.confirm = () => true; globalThis.confirm = win.confirm; win.prompt = (q, d) => d ?? 'Eid'; globalThis.prompt = win.prompt;
win.fetch = async () => ({ ok: true, json: async () => ({ version: 'v200' }) });
win.scrollTo = () => {};
win.document.body.innerHTML = '<div id="app" data-screen="boot"></div><div id="sheetHost"></div><div id="toast"></div>';
const { startApp } = await import('./app.js');
const C = await import('./core.js');

const today = C.pkDate(), month = today.slice(0, 7), yesterday = C.addDays(today, -1);
const records = new Map([
  [B + 'staffConfig/main', { shiftStart: '09:00', shiftEnd: '19:00', radius: 200 }],
  [B + 'staffAccounts/03001234567', { name: 'Ali Raza', phone: '03001234567', role: 'Salesman', salary: { monthlySalary: 30000, dutyHours: 10, workingDays: 30 } }],
  [B + 'staffAccounts/03007654321', { name: 'بلال احمد', phone: '03007654321', role: 'Helper', salary: { monthlySalary: 24000, dutyHours: 10, workingDays: 30 } }],
  [B + `staffAttendance/${today}_03001234567`, { date: today, phone: '03001234567', checkIn: '9:25 am', checkOut: '', autoScore: 6 }],
  [B + `staffRequests/r1`, { phone: '03007654321', kind: 'leave', date: today, to: today, checkIn: '', checkOut: '', reason: 'Bimar', status: 'pending', createdAt: 5, by: 'x' }]
]);
if (yesterday.slice(0, 7) === month) records.set(B + `staffAttendance/${yesterday}_03001234567`, { date: yesterday, phone: '03001234567', checkIn: '09:00', checkOut: '19:30', autoScore: 10 });
const fake = fakeSdk({ records }), storage = memoryStorage();
const app = startApp({ sdk: fake.sdk, firebaseConfig: {}, storage, win });
const doc = win.document, $ = s => doc.querySelector(s), $$ = s => [...doc.querySelectorAll(s)];
const settle = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise(r => setTimeout(r, 4)); };
const click = async sel => { const el = typeof sel === 'string' ? $(sel) : sel; assert.ok(el, 'nahi mila: ' + sel); el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true })); await settle(); };
const submit = async form => { form.dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true })); await settle(10); };
const fill = (form, values) => { for (const [k, v] of Object.entries(values)) { const el = form.elements[k] || form.querySelector(`[name=${k}]`); assert.ok(el, 'field nahi: ' + k); if (el.type === 'checkbox') el.checked = v; else el.value = v; } };
const toastText = () => $('#toast').textContent;

test('login screen khulti hai, staff tab pehle', async () => {
  await settle();
  assert.equal($('#app').dataset.screen, 'login'); assert.ok($('input[name=phone]'));
});
test('ghalat number par saaf paigham', async () => {
  fill($('form[data-form=login]'), { phone: '123' }); await submit($('form[data-form=login]'));
  assert.match($('.login-error').textContent, /mobile number/);
});
test('malik login → Hazri tab, qataarein, tawajju', async () => {
  await click('[data-action=login-role][data-arg=owner]');
  fill($('form[data-form=login]'), { password: 'malik-ka-password' }); await submit($('form[data-form=login]'));
  assert.equal($('#app').dataset.screen, 'owner');
  assert.equal($$('.register .row').length, 2);
  assert.match($('.register').textContent, /Ali Raza/); assert.match($('.register').textContent, /Late 25m/);
  assert.ok($('.ur'), 'Urdu naam apne font class ke sath');
  assert.match($('.attention').textContent, /request/);
  assert.ok($$('.row-pdf').length === 2, 'har staff par PDF button');
  assert.match($('.register').textContent, /9:00 am – 7:00 pm/); assert.match($('.register').textContent, /10h duty/);
  assert.match($('.register').textContent, /Aaya 9:25 am/);
});
test('filter, din badalna, mahine ka jaal', async () => {
  await click('[data-action=filter][data-arg=late]'); assert.equal($$('.register .row').length, 1);
  await click('[data-action=filter][data-arg=all]');
  await click('[data-action=step][data-arg="-1"]'); assert.ok($('[data-action=today]'));
  await click('[data-action=today]');
  await click('[data-action=view][data-arg=month]'); assert.ok($('table.grid')); assert.equal($$('table.grid tbody tr').length, 2);
  await click('[data-action=view][data-arg=day]');
});
test('profile sheet → hazri durust → save', async () => {
  await click('.row-main[data-phone="03001234567"]'); assert.ok($('[data-sheet=profile]'));
  assert.match($('[data-sheet=profile]').textContent, /Hazir/);
  await click(`[data-sheet=profile] [data-action=edit-att][data-date="${today}"]`);
  const form = $('form[data-form=att]'); assert.equal(form.elements.checkIn.value, '09:25');
  fill(form, { checkOut: '19:45', note: 'Bhool gaya tha' }); await submit(form);
  assert.equal(records.get(B + `staffAttendance/${today}_03001234567`).checkOut, '19:45'); assert.match(toastText(), /save/);
  assert.ok([...records.keys()].some(k => k.includes('staffAudit')));
  await click('[data-sheet=profile] [data-sheet-close]'); assert.equal($('[data-sheet=profile]'), null);
});
test('request manzoor → staff chutti par', async () => {
  await click('[data-action=requests]'); await click('[data-action=req][data-arg=approved]');
  assert.equal(records.get(B + 'staffRequests/r1').status, 'approved');
  await click('[data-sheet=requests] [data-sheet-close]');
  assert.match($('.register').textContent, /Chutti/);
});
test('smart talash', async () => {
  await click('[data-action=search]'); const input = $('#smartInput'); input.value = 'late aaj'; input.dispatchEvent(new win.Event('input', { bubbles: true })); await settle();
  assert.match($('#smartResults').textContent, /1 record/); assert.match($('#smartResults').textContent, /Ali Raza/);
  await click('[data-sheet=search] .chip[data-arg="salary baqi"]'); assert.match($('#smartResults').textContent, /staff/);
  input.value = 'بلال'; input.dispatchEvent(new win.Event('input', { bubbles: true })); await settle(); assert.match($('#smartResults').textContent, /1 staff/);
  await click('[data-sheet=search] [data-sheet-close]');
});
test('naya staff + settings', async () => {
  await click('[data-action=tab][data-arg=staff]'); await click('[data-action=staff-new]');
  const form = $('form[data-form=staff]'); fill(form, { name: 'Usman', phone: '0311-1112223', role: 'Helper', monthlySalary: '20000' }); await submit(form);
  const saved = records.get(B + 'staffAccounts/03111112223'); assert.equal(saved.name, 'Usman'); assert.equal(saved.salary.monthlySalary, 20000); assert.equal(saved.joinDate, today);
  assert.ok(records.get(B + 'staffSchedules/03111112223')); assert.ok(records.get(B + 'staff/03111112223'));
  assert.equal($('[data-sheet=staff-form]'), null);
  await click('[data-action=staff-new]'); fill($('form[data-form=staff]'), { name: 'Dobara', phone: '03111112223' }); await submit($('form[data-form=staff]'));
  assert.match(toastText(), /pehle se mojood/); await click('[data-sheet=staff-form] [data-sheet-close]');
  await click('[data-action=settings]'); fill($('form[data-form=settings]'), { shiftStart: '10:00', radius: '150' }); await submit($('form[data-form=settings]'));
  assert.equal(records.get(B + 'staffConfig/main').shiftStart, '10:00'); assert.equal(records.get(B + 'staffConfig/main').radius, 150);
});
test('salary: advance → final → payment', async () => {
  await click('[data-action=tab][data-arg=salary]'); assert.ok($('.totals'));
  await click('.row-main[data-action=salary][data-phone="03001234567"]');
  const extra = $('form[data-form=extra]'); fill(extra, { kind: 'advance', amount: '500', note: 'Kharcha' }); await submit(extra);
  assert.equal(records.get(B + 'staffAccounts/03001234567').salaryExtras.length, 1);
  assert.match($('[data-sheet=salary]').textContent, /Advance/);
  await click('[data-sheet=salary] [data-action=final]');
  const pay = records.get(B + `staffPayroll/${month}_03001234567`); assert.equal(pay.state, 'final'); assert.equal(pay.snapshot.advance, 500);
  const payment = $('form[data-form=payment]'); assert.ok(payment, 'final ke baad payment form'); fill(payment, { amount: '100' }); await submit(payment);
  assert.equal(records.get(B + `staffPayroll/${month}_03001234567`).paid, 100);
  assert.equal($('form[data-form=extra]'), null, 'final mahine mein advance band');
  await click('[data-sheet=salary] [data-sheet-close]');
});
test('v201: default duty + default salary settings', async () => {
  await click('[data-action=tab][data-arg=staff]'); await click('[data-action=settings]');
  const f = $('form[data-form=settings]');
  fill(f, { shiftStart: '09:00', shiftEnd: '18:00', defSalary: '26000', defDays: '26', salaryMode: 'days', lateEvery: '3', lateFineDays: '0.5' }); await submit(f);
  const cfg = records.get(B + 'staffConfig/main');
  assert.equal(cfg.shiftEnd, '18:00'); assert.deepEqual([cfg.salaryDefault.monthlySalary, cfg.salaryDefault.workingDays, cfg.salaryDefault.mode, cfg.salaryDefault.lateEvery], [26000, 26, 'days', 3]);
  await click('[data-action=settings]'); assert.ok($('[data-action=apply-salary-all]'), 'purane staff apni salary par hain');
  await click('[data-action=apply-salary-all]');
  assert.equal(records.get(B + 'staffAccounts/03001234567').salary.useDefault, true);
  assert.equal(records.get(B + 'staffAccounts/03001234567').salary.monthlySalary, 30000, 'purani raqam mehfooz');
  await click('[data-sheet=settings] [data-sheet-close]');
  await click('[data-action=tab][data-arg=salary]'); assert.match($('.rule-card').textContent, /Rs 26,000/); assert.match($('.view').textContent, /Default Rs 26,000/);
});
test('v201: jaldi hazir, dukaan band, check-out band, qarz, slips, khata, jaanch', async () => {
  await click('[data-action=tab][data-arg=hazri]');
  const quick = $('[data-action=tix][data-kind=in][data-phone="03111112223"][data-arg="09:00"]'); assert.ok(quick, 'naye staff par Aaya ticket'); await click(quick);
  assert.equal(records.get(B + `staffAttendance/${today}_03111112223`).checkIn, '09:00');
  await click(`[data-action=toggle-closed][data-arg="${today}"]`);
  assert.equal(records.get(B + 'staffConfig/main').closedDays[0].date, today); assert.ok($('.closed-line'));
  await click(`[data-action=toggle-closed][data-arg="${today}"]`); assert.equal(records.get(B + 'staffConfig/main').closedDays.length, 0);
  records.set(B + `staffAttendance/2026-01-05_03001234567`, { date: '2026-01-05', phone: '03001234567', checkIn: '09:00', checkOut: '' });
  await app.data.closeCheckouts([{ id: '2026-01-05_03001234567', date: '2026-01-05', phone: '03001234567', checkIn: '09:00' }]);
  assert.equal(records.get(B + 'staffAttendance/2026-01-05_03001234567').checkOut, '18:00');
  await click('[data-action=tab][data-arg=salary]'); await click('.row-main[data-action=salary][data-phone="03007654321"]');
  const ex = $('form[data-form=extra]'); ex.elements.kind.value = 'loan'; ex.elements.kind.dispatchEvent(new win.Event('change', { bubbles: true }));
  assert.equal(ex.elements.perMonth.hidden, false);
  fill(ex, { amount: '6000', perMonth: '2000' }); await submit(ex);
  const loan = records.get(B + 'staffAccounts/03007654321').salaryExtras.find(x => x.kind === 'loan'); assert.equal(loan.perMonth, 2000);
  assert.match($('[data-sheet=salary]').textContent, /Qarz ki qist/);
  await click('[data-sheet=salary] [data-sheet-close]');
  await click('[data-action=khata]'); assert.match($('[data-sheet=khata]').textContent, /Rs 6,000/); await click('[data-sheet=khata] [data-sheet-close]');
  await click('[data-action=tab][data-arg=staff]'); await click('[data-action=diag]');
  assert.match($('[data-sheet=diag]').textContent, new RegExp(today)); assert.match($('[data-sheet=diag]').textContent, /Aaj ke record/);
  await click('[data-sheet=diag] [data-sheet-close]');
});
test('v202: Aaya/Gaya tickets aur aasan time picker', async () => {
  await click('[data-action=tab][data-arg=hazri]');
  // Ali: aaya hai, gaya nahi -> Gaya tickets
  const row = () => $('.row-main[data-phone="03001234567"]').closest('.row');
  await click(row().querySelector('[data-action=tix-open]')); // Ali ka Gaya pehle se laga hai -> "Waqt badlein"
  const out = row().querySelector('[data-action=tix][data-kind=out][data-arg="20:30"]'); assert.ok(out, 'Gaya 8:30 ka ticket');
  await click(out); assert.equal(records.get(B + `staffAttendance/${today}_03001234567`).checkOut, '20:30');
  await click(row().querySelector('[data-action=tix][data-kind=in][data-arg="09:15"]'));
  assert.equal(records.get(B + `staffAttendance/${today}_03001234567`).checkIn, '09:15'); assert.equal(records.get(B + `staffAttendance/${today}_03001234567`).checkOut, '20:30');
  // Naye staff (Usman) ki hazri hata kar Aaya ticket
  await app.data.deleteAttendance(`${today}_03111112223`); await settle();
  const inT = $('.row-main[data-phone="03111112223"]').closest('.row').querySelector('[data-action=tix][data-kind=in][data-arg="09:30"]'); assert.ok(inT, 'Aaya 9:30 ka ticket');
  await click(inT); assert.equal(records.get(B + `staffAttendance/${today}_03111112223`).checkIn, '09:30');
  // Time picker: 7 + PM = 19:xx, ticket, khali
  await click(`[data-action=edit-att][data-phone="03001234567"][data-date="${today}"]`.replace('edit-att', 'profile'));
  await click(`[data-sheet=profile] [data-action=edit-att][data-date="${today}"]`);
  const box = [...doc.querySelectorAll('form[data-form=att] [data-tp]')][1], hidden = box.querySelector('input[type=hidden]');
  box.querySelector('[data-tp-h]').value = '7'; box.querySelector('[data-tp-m]').value = '0'; // (happy-dom 'selected' theek nahi parhta, is liye minute khud)
  box.querySelector('[data-tp-h]').dispatchEvent(new win.Event('change', { bubbles: true }));
  await click(box.querySelector('[data-tp-ap="pm"]')); assert.equal(hidden.value, '19:00'); assert.match(box.querySelector('.tp-show').textContent, /7:00 PM/);
  await click(box.querySelector('[data-tp-ap="am"]')); assert.equal(hidden.value, '07:00');
  await submit($('form[data-form=att]')); assert.match(toastText(), /pehle hai/, 'Gaya aane se pehle nahi ho sakta');
  await click(box.querySelector('[data-tp-set="21:00"]')); assert.equal(hidden.value, '21:00');
  await click(box.querySelector('.tp-clear')); assert.equal(hidden.value, '');
  await click(box.querySelector('[data-tp-set="19:30"]')); await submit($('form[data-form=att]'));
  assert.equal(records.get(B + `staffAttendance/${today}_03001234567`).checkOut, '19:30');
  await click('[data-sheet=profile] [data-sheet-close]');
});
test('v202: raat ki duty ghalti se save ho to warning', async () => {
  await app.data.saveConfig({ shiftStart: '21:15', shiftEnd: '07:52', radius: 200 }); await settle();
  assert.match($('.attention').textContent, /ghalat lag rahi/);
  await click('.attention [data-action=settings]'); assert.match($('[data-sheet=settings]').textContent, /raat ki duty/);
  const f = $('form[data-form=settings]'); await click(f.querySelector('[data-tp-set="09:15"]')); await click([...f.querySelectorAll('[data-tp]')][1].querySelector('[data-tp-set="19:00"]'));
  await submit(f); assert.deepEqual([records.get(B + 'staffConfig/main').shiftStart, records.get(B + 'staffConfig/main').shiftEnd], ['09:15', '19:00']);
  assert.equal($('.attention')?.textContent.includes('ghalat lag rahi') || false, false);
});
test('logout → staff login → check-in / check-out', async () => {
  records.delete(B + `staffAttendance/${today}_03111112223`); // upar malik ne hazri lagayi thi
  await click('[data-action=tab][data-arg=staff]'); await click('[data-action=logout]'); await settle();
  assert.equal($('#app').dataset.screen, 'login');
  await click('[data-action=login-role][data-arg=staff]');
  fill($('form[data-form=login]'), { phone: '0311 1112223' }); await submit($('form[data-form=login]')); await settle(10);
  assert.equal($('#app').dataset.screen, 'staff'); assert.match($('.brand').textContent, /Usman/);
  assert.ok($('[data-action=check-in]'), 'Check-In button'); assert.match($('.punch').textContent, /9h 45m roz/);
  const r = await app.data.checkIn({ selfie: 'data:image/jpeg;base64,AAAA', gps: { lat: 32.7979, lng: 73.9569, accuracy: 10, distance: 12 } }); assert.equal(r.queued, false); await settle();
  assert.ok(records.get(B + `staffAttendance/${today}_03111112223`).checkIn);
  await assert.rejects(app.data.checkIn({ selfie: 'x', gps: { distance: 900 } }), /door/);
  assert.ok($('[data-action=check-out]'), 'ab Check-Out button'); assert.match($('.punch').textContent, /baqi/); assert.match($('.punch').textContent, /Malik tak pohanch gayi/);
  Object.defineProperty(win.navigator, 'geolocation', { value: undefined, configurable: true });
  await click('[data-action=check-out]'); await settle(10);
  assert.ok(records.get(B + `staffAttendance/${today}_03111112223`).checkOut); assert.match($('.punch').textContent, /mukammal/);
});
test('staff: request bhejna (sirf rules wali keys), salary tab', async () => {
  await click('[data-action=tab][data-arg=request]');
  const form = $('form[data-form=request]'); fill(form, { reason: 'Shadi hai' }); await submit(form);
  const req = [...records].find(([k, v]) => k.includes('staffRequests/') && v.reason === 'Shadi hai')[1];
  assert.deepEqual(Object.keys(req).sort(), ['by', 'checkIn', 'checkOut', 'createdAt', 'date', 'kind', 'phone', 'reason', 'status', 'to']);
  await click('[data-action=tab][data-arg=salary]'); assert.match($('.calc').textContent, /Mahana salary/);
  await click('[data-action=tab][data-arg=hazri]'); assert.ok($('.days'));
});

test.after(async () => { app.data.stop(); await win.happyDOM.abort(); win.close(); });
