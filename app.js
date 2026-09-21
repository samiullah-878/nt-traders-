// app.js — app ka dhancha: login screen, malik/staff ka panel chalana, buttons ka aik hi jagah se intezam.
import { APP_VERSION, esc } from './core.js';
import { createAuthController, loginErrorMessage } from './auth.js';
import { createData } from './data.js';
import { createOwnerView } from './owner.js';
import { createStaffView } from './staffview.js';
import { $, icon, toast, formValues, closeSheets, refreshSheets, errorText } from './ui.js';

const ROLE_KEY = 'nt-hazri-last-role';
const FIELD = /^(INPUT|TEXTAREA|SELECT)$/;

export function startApp({ sdk, firebaseConfig, storage = safeLocalStorage(), win = window }) {
  const doc = win.document, root = $('#app', doc);
  let view = null, dirty = false, login = { role: storage?.getItem(ROLE_KEY) || 'staff', error: '', busy: false, showPass: false };

  const data = createData({
    sdk, firebaseConfig,
    onChange: () => { softRender(); view?.onData?.(); },
    onProblem: (name, error) => { console.warn('data', name, error); if (error?.code === 'permission-denied') toast('Kuch data ki ijazat nahi mili (' + name + '). Logout kar ke dobara login karein.', 'bad'); }
  });
  const controller = createAuthController({
    auth: data.auth, sdk, accounts: data.accounts, storage,
    onReset() { data.stop(); view = null; closeSheets(); login.busy = false; showLogin(); },
    onSession(session) {
      clearTimeout(win.__bootTimer);
      login.error = ''; login.busy = false;
      try { storage?.setItem(ROLE_KEY, session.role); } catch { /* ignore */ }
      const shared = { data, controller, rerender: render, logout: () => controller.logout().catch(e => toast(errorText(e), 'bad')), checkUpdate };
      if (session.role === 'owner') { data.startOwner(); view = createOwnerView(shared); }
      else { data.startStaff(session.phone, session.account); view = createStaffView(shared); }
      root.dataset.screen = session.role;
      render();
    },
    onError(error, role) { login.role = role || login.role; login.error = loginErrorMessage(error); login.busy = false; showLogin(); }
  });

  /* ---------- login screen ---------- */
  function showLogin() {
    clearTimeout(win.__bootTimer);
    root.dataset.screen = 'login';
    const staff = login.role === 'staff';
    root.innerHTML = `<main class="login">
      <div class="login-card">
        <div class="login-brand"><span class="brand-mark lg" aria-hidden="true">NT</span><h1>Noor Traders</h1><p>Hazri aur salary ka register</p></div>
        <div class="switch full" role="tablist" aria-label="Kaun login kar raha hai"><button type="button" role="tab" aria-selected="${staff}" data-action="login-role" data-arg="staff">Staff</button><button type="button" role="tab" aria-selected="${!staff}" data-action="login-role" data-arg="owner">Malik</button></div>
        <form class="form" data-form="login" novalidate>
          ${staff
            ? `<label>Apna mobile number<input name="phone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="03001234567" maxlength="16" required ${login.busy ? 'disabled' : ''}></label><p class="hint">Wohi number likhein jo malik ne Staff list mein likha hai. Password ki zaroorat nahi.</p>`
            : `<label>Password<span class="pass"><input name="password" type="${login.showPass ? 'text' : 'password'}" autocomplete="current-password" required ${login.busy ? 'disabled' : ''}><button type="button" class="link" data-action="login-show">${login.showPass ? 'Chhupayein' : 'Dikhayein'}</button></span></label>
               <details><summary>Email se login (ikhtiyari)</summary><label>Email<input name="username" type="email" autocomplete="username" placeholder="khali = admin" ${login.busy ? 'disabled' : ''}></label></details>`}
          <p class="login-error" role="alert" ${login.error ? '' : 'hidden'}>${esc(login.error)}</p>
          <button class="btn btn-primary btn-xl" ${login.busy ? 'disabled' : ''}>${login.busy ? 'Check ho raha hai…' : 'Login'}</button>
          ${login.busy ? '<p class="hint center">Kamzor internet par 10-20 second lag sakte hain. Button dobara na dabayein.</p>' : ''}
        </form>
      </div>
      <p class="foot">${APP_VERSION} &nbsp; <button type="button" class="link" data-action="app-update">Update check karein</button></p>
    </main>`;
  }
  async function submitLogin(form) {
    if (login.busy) return;
    const v = formValues(form);
    login.busy = true; login.error = ''; login.phoneDraft = v.phone || '';
    showLogin();
    const phoneInput = $('input[name=phone]', root); if (phoneInput) phoneInput.value = login.phoneDraft;
    try {
      await controller.login(login.role === 'staff' ? { role: 'staff', password: v.phone } : { role: 'owner', username: v.username, password: v.password });
    } catch (error) {
      login.busy = false; login.error = loginErrorMessage(error); showLogin();
      const again = $('input[name=phone]', root); if (again) again.value = login.phoneDraft;
    }
  }

  /* ---------- render ---------- */
  function render(options = {}) {
    if (!view) return;
    dirty = false;
    const scroll = win.scrollY;
    root.innerHTML = view.render();
    if (options.keepFocus?.dataset?.input) { const el = $(`[data-input="${options.keepFocus.dataset.input}"]`, root); if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch { /* search type */ } } }
    if (scroll) win.scrollTo?.(0, scroll);
  }
  /** Data badalne par screen taza hoti hai, lekin agar koi kuch likh raha ho to us ka likha hua nahi mit-ta. */
  function softRender() {
    if (!view) return;
    const active = doc.activeElement;
    if (active && FIELD.test(active.tagName) && root.contains(active)) { dirty = true; return; }
    render();
  }
  doc.addEventListener('focusout', () => { if (dirty) setTimeout(() => { if (dirty) softRender(); }, 150); });
  win.setInterval?.(() => { if (view && doc.visibilityState !== 'hidden') { softRender(); refreshSheets(); } }, 60000);
  doc.addEventListener('visibilitychange', () => { if (doc.visibilityState === 'visible' && view) { softRender(); refreshSheets(); } });

  /* ---------- aik hi jagah se saare buttons / forms ---------- */
  const shellActions = {
    'login-role'(el) { login.role = el.dataset.arg; login.error = ''; showLogin(); },
    'login-show'() { const input = $('input[name=password]', root), value = input?.value || ''; login.showPass = !login.showPass; showLogin(); const next = $('input[name=password]', root); if (next) { next.value = value; next.focus(); } },
    'app-update'() { void checkUpdate(true); }
  };
  doc.addEventListener('click', event => {
    const el = event.target.closest?.('[data-action]'); if (!el || el.disabled) return;
    const fn = view?.actions[el.dataset.action] || shellActions[el.dataset.action];
    if (!fn) return;
    event.preventDefault();
    Promise.resolve().then(() => fn(el, event)).catch(error => { console.error(error); toast(errorText(error), 'bad'); });
  });
  doc.addEventListener('submit', event => {
    const form = event.target.closest?.('form[data-form]'); if (!form) return;
    event.preventDefault();
    if (form.dataset.form === 'login') { void submitLogin(form); return; }
    if (!form.checkValidity?.() && !form.noValidate) { form.reportValidity?.(); return; }
    const fn = view?.forms[form.dataset.form]; if (!fn) return;
    const button = event.submitter || $('button:not([type=button])', form);
    Promise.resolve().then(() => fn(form, formValues(form), button)).catch(error => { console.error(error); toast(errorText(error), 'bad'); });
  });
  doc.addEventListener('change', event => { const el = event.target.closest?.('[data-change]'); if (el) view?.changes?.[el.dataset.change]?.(el); });
  doc.addEventListener('input', event => { const el = event.target.closest?.('[data-input]'); if (el) view?.inputs?.[el.dataset.input]?.(el); });

  /* ---------- update ---------- */
  const newer = (a, b) => (parseInt(String(a).replace(/\D/g, ''), 10) || 0) > (parseInt(String(b).replace(/\D/g, ''), 10) || 0);
  async function checkUpdate(manual = false) {
    try {
      const res = await win.fetch('./version.json?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('version');
      const latest = (await res.json()).version;
      if (!newer(latest, APP_VERSION)) { if (manual) toast('App bilkul taza hai (' + APP_VERSION + ')', 'ok'); return; }
      const guard = 'nt-hazri-updated-to';
      if (!manual && storage?.getItem(guard) === latest) return; // aik version ke liye sirf aik dafa khud reload
      try { storage?.setItem(guard, latest); } catch { /* ignore */ }
      toast('Nayi version ' + latest + ' aa rahi hai…');
      try { const keys = await win.caches?.keys?.() || []; await Promise.all(keys.map(k => win.caches.delete(k))); } catch { /* ignore */ }
      try { const regs = await win.navigator.serviceWorker?.getRegistrations?.() || []; await Promise.all(regs.map(r => r.update())); } catch { /* ignore */ }
      win.location.reload();
    } catch { if (manual) toast('Internet nahi mila. Thori der baad dobara dekhein.', 'bad'); }
  }
  if (win.navigator?.serviceWorker && /^https?:$/.test(win.location?.protocol || '')) {
    win.navigator.serviceWorker.register('./sw.js').catch(() => { /* app SW ke baghair bhi chalti hai */ });
  }
  win.setTimeout?.(() => checkUpdate(false), 4000);

  return { data, controller, render, get view() { return view; } };
}

function safeLocalStorage() { try { const s = window.localStorage; s.getItem('x'); return s; } catch { return null; } }
