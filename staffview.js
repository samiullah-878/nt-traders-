// staffview.js — staff ka apna panel. Sirf apni hazri, apni salary, apni request.
import {
  APP_VERSION, STATUS_LABEL, DAY_SHORT, SHOP, esc, money, hm, fmtTime, pkDate, pkMinutes, addMonths, weekday, monthLabel, dateLabel, shortDate,
  monthSummary, openRecord, workMinutes, parseTime, checkoutDue, shiftMinutes
} from './core.js';
import { icon, avatar, nameHtml, toast, busy, takeSelfie, getGps, deliverPdf, errorText, timeField, IN_TICKETS, OUT_TICKETS } from './ui.js';
import { loadPdfLib, browserTextImages, staffMonthPdf } from './pdf.js';

export function createStaffView({ data, rerender, logout, checkUpdate }) {
  const S = data.state;
  const ui = { tab: 'hazri', month: pkDate().slice(0, 7), step: '', reqKind: 'leave' };
  const me = () => S.account || { phone: S.phone, name: '' };
  const schedule = () => data.scheduleFor(S.phone);
  const closedToday = () => !openRecord(S.myAttendance) && !S.myAttendance.some(a => a.date === pkDate()) && (S.config.closedDays || []).some(d => d.date === pkDate());
  const summary = month => monthSummary({ account: me(), attendance: S.myAttendance, requests: S.requests, schedule: schedule(), month, today: pkDate(), nowMin: pkMinutes() });

  const dutyMin = () => shiftMinutes(schedule()) || Math.round(data.salaryFor(me()).dutyHours * 60);
  const dutyTags = () => { const sch = schedule(); return `<div class="tags center"><span class="tag">${icon('clock', 14)} Duty ${fmtTime(sch.shiftStart)}${sch.shiftEnd ? ' – ' + fmtTime(sch.shiftEnd) : ''}</span><span class="tag">${hm(dutyMin()).replace(' 00m', '')} roz</span></div>`; };
  const syncLine = row => row?.pending ? `<p class="sync-line is-wait">${icon('clock', 16)} Hazri abhi phone mein hai — internet milte hi malik tak pohanch jayegi. App band na karein.</p>` : row ? `<p class="sync-line">${icon('check', 16)} Malik tak pohanch gayi</p>` : '';
  function actionCard() {
    const today = pkDate(), rows = S.myAttendance, todayRow = rows.find(a => a.date === today), open = openRecord(rows), sch = schedule();
    const radius = Number(S.config.radius || SHOP.radius);
    if (S.errors?.myAttendance) return `<section class="punch"><p class="error-line">${icon('alert', 18)} <span>Aap ki hazri server se nahi aayi (${esc(S.errors.myAttendance)}). Internet check karein, phir Logout kar ke dobara login karein.</span></p></section>`;
    if (closedToday()) return `<section class="punch is-done"><p class="punch-state">${esc(dateLabel(today))}</p><p class="punch-big">Aaj dukaan band hai</p><p class="punch-sub">Aaj hazri nahi lagani.</p></section>`;
    if (!S.loaded.has('myAttendance')) return `<section class="punch"><p class="loading-line">Aap ki hazri aa rahi hai…</p></section>`;
    if (open) {
      const inMin = parseTime(open.checkIn), nowAbs = pkMinutes() + (open.date !== today ? 1440 : 0);
      const mins = open.checkInTs ? Math.max(0, Math.round((Date.now() - open.checkInTs) / 60000)) : (inMin != null ? Math.max(0, nowAbs - inMin) : 0);
      const left = dutyMin() - mins;
      return `<section class="punch is-in"><p class="punch-state">${icon('check', 18)} Aap kaam par hain</p>
        <p class="punch-big">${fmtTime(open.checkIn)} <small>se${open.date !== today ? ' (' + esc(shortDate(open.date)) + ')' : ''}</small></p>
        <div class="progress" role="img" aria-label="Duty ka hissa"><i style="width:${Math.min(100, Math.round(mins / Math.max(1, dutyMin()) * 100))}%"></i></div>
        <p class="punch-sub"><b>${hm(mins)}</b> ho gaye &nbsp;|&nbsp; ${left > 0 ? `<b>${hm(left)}</b> baqi` : `<b class="txt-ok">Duty poori${left < 0 ? ', ' + hm(-left) + ' overtime' : ''}</b>`}${sch.shiftEnd ? ' &nbsp;|&nbsp; Chutti ' + fmtTime(sch.shiftEnd) : ''}</p>
        ${syncLine(open)}
        <button type="button" class="btn btn-out btn-xl" data-action="check-out">${icon('out', 22)} Check-Out karein</button>
        <p class="punch-step" id="punchStep">${esc(ui.step)}</p></section>`;
    }
    if (todayRow?.checkIn) {
      return `<section class="punch is-done"><p class="punch-state">${icon('check', 18)} Aaj ki hazri mukammal</p>
        <p class="punch-big">${fmtTime(todayRow.checkIn)} <small>se</small> ${fmtTime(todayRow.checkOut)}</p>
        <p class="punch-sub">${workMinutes(todayRow) != null ? hm(workMinutes(todayRow)) + ' kaam kiya' + (workMinutes(todayRow) > dutyMin() ? ` (${hm(workMinutes(todayRow) - dutyMin())} overtime)` : '') : ''}</p>${syncLine(todayRow)}</section>`;
    }
    const start = parseTime(sch.shiftStart), lateBy = start != null ? pkMinutes() - start - Number(sch.grace ?? 10) : 0;
    return `<section class="punch"><p class="punch-state">${esc(dateLabel(today))}</p>
      <p class="punch-big">Duty ${fmtTime(sch.shiftStart)}</p>${dutyTags()}
      <p class="punch-sub ${lateBy > 0 ? 'txt-late' : ''}">${lateBy > 0 ? `Waqt guzar chuka hai — abhi Check-In karein` : 'Dukaan pohanch kar Check-In karein'}</p>
      <button type="button" class="btn btn-in btn-xl" data-action="check-in">${icon('camera', 22)} Check-In karein</button>
      <p class="punch-step" id="punchStep">${esc(ui.step) || `Selfie aur location lagegi. Dukaan se ${radius}m ke andar hona zaroori hai.`}</p></section>`;
  }
  function monthBlock() {
    const month = ui.month, sum = summary(month), today = pkDate();
    const missed = S.myAttendance.filter(a => a.date < today && checkoutDue(a, schedule()) && a !== openRecord(S.myAttendance));
    return `${missed.length ? `<button type="button" class="att-card tone-bad" data-action="fix-missed" data-date="${missed[0].date}">${icon('alert', 22)}<span><b>${esc(shortDate(missed[0].date))} ka Check-Out reh gaya</b><small>Yahan daba kar malik ko sahi waqt ki request bhejein</small></span></button>` : ''}
      <div class="toolbar"><h2 class="section-label">Meri hazri</h2><button type="button" class="btn btn-ink btn-sm" data-action="my-pdf">${icon('pdf', 18)} PDF</button></div>
      <div class="datebar"><button type="button" class="icon-btn" data-action="month-step" data-arg="-1" aria-label="Pichla mahina">${icon('left')}</button><span class="date-static">${esc(monthLabel(month))}</span><button type="button" class="icon-btn" data-action="month-step" data-arg="1" aria-label="Agla mahina" ${month >= today.slice(0, 7) ? 'disabled' : ''}>${icon('right')}</button></div>
      <div class="counts"><div class="st-present"><b>${sum.count.present + sum.count.late}</b><small>Hazir</small></div><div class="st-late"><b>${sum.count.late}</b><small>Late</small></div><div class="st-absent"><b>${sum.count.absent}</b><small>Ghair hazir</small></div><div class="st-leave"><b>${sum.count.leave + sum.count.off}</b><small>Chutti</small></div><div><b>${hm(sum.totalMin)}</b><small>Ghante</small></div></div>
      <section class="panel"><ol class="days">${sum.days.filter(d => d.status !== 'na' && d.status !== 'waiting').reverse().map(d => `<li class="s-${d.status}"><div>
        <span class="d-date"><b>${+d.date.slice(8)}</b><small>${DAY_SHORT[weekday(d.date)]}</small></span>
        <span class="d-time">${d.a.checkIn ? `${fmtTime(d.a.checkIn)} <span class="arrow">to</span> ${d.a.checkOut ? fmtTime(d.a.checkOut) : '<b class="txt-bad">baqi</b>'}` : '<span class="muted">—</span>'}${d.minutes != null ? `<small>${hm(d.minutes)}</small>` : ''}</span>
        <span class="stamp st-${d.status}">${d.status === 'late' ? 'Late ' + d.late + 'm' : STATUS_LABEL[d.status]}</span></div></li>`).join('') || '<li class="muted pad">Is mahine abhi koi record nahi.</li>'}</ol></section>`;
  }
  function hazriTab() {
    return `${actionCard()}${S.config.instruction ? `<p class="notice">${icon('note', 18)} <span>${nameHtml(S.config.instruction)}</span></p>` : ''}${monthBlock()}`;
  }
  function salaryTab() {
    const month = ui.month, c = data.calcFor(me(), month), today = pkDate();
    const line = (label, value, cls = '') => `<tr class="${cls}"><td>${label}</td><td>${value}</td></tr>`;
    return `<div class="toolbar"><h1 class="page-title">Meri salary</h1><span class="stamp ${c.frozen ? 'st-present' : 'st-waiting'}">${c.frozen ? 'Final' : 'Andaza'}</span></div>
      <div class="datebar"><button type="button" class="icon-btn" data-action="month-step" data-arg="-1" aria-label="Pichla mahina">${icon('left')}</button><span class="date-static">${esc(monthLabel(month))}</span><button type="button" class="icon-btn" data-action="month-step" data-arg="1" aria-label="Agla mahina" ${month >= today.slice(0, 7) ? 'disabled' : ''}>${icon('right')}</button></div>
      <section class="panel pad"><table class="calc"><tbody>
        ${line('Mahana salary', money(c.monthlySalary))}
        ${c.mode === 'days' ? line(`Ghair hazir <small>${c.absentDays} din</small>`, '− ' + money(c.absentCut), c.absentCut ? 'txt-bad' : '') : line(`Aam ghante <small>${hm(c.normalMin)}</small>`, money(c.normalSalary))}
        ${line(`Overtime <small>${hm(c.otMin)}</small>`, '+ ' + money(c.overtimeAmount))}
        ${c.pointsAmount ? line(`Points <small>${c.points}</small>`, '+ ' + money(c.pointsAmount)) : ''}
        ${c.mealSalary ? line('Khana', '+ ' + money(c.mealSalary)) : ''}
        ${c.bonus ? line('Bonus', '+ ' + money(c.bonus)) : ''}
        ${c.advance ? line('Advance (kat gaya)', '− ' + money(c.advance), 'txt-bad') : ''}
        ${c.loanCut ? line(`Qarz ki qist <small>${(c.loans || []).filter(l => l.cut).map(l => 'baqi ' + money(l.remainingAfter)).join(', ')}</small>`, '− ' + money(c.loanCut), 'txt-bad') : ''}
        ${c.lateFine ? line(`Late jurmana <small>${c.lateCount} dafa late</small>`, '− ' + money(c.lateFine), 'txt-bad') : ''}
        ${line('Kul banti salary', money(c.final), 'is-total')}
        ${line('Mil chuki', money(c.paid))}
        ${line('Baqi', money(c.balance), 'is-balance')}
      </tbody></table>
      ${c.frozen ? '' : '<p class="hint">Ye andaza hai. Mahine ke aakhir mein malik final karte hain, tab raqam pakki hoti hai.</p>'}
      <h3 class="sub">Advance, bonus aur payments</h3>
      <ul class="ledger">${[...(c.extras || []).map(x => ({ ...x, label: x.kind === 'advance' ? 'Advance' : 'Bonus' })), ...(c.payments || []).map(x => ({ ...x, label: 'Salary mili' }))].sort((a, b) => String(a.date).localeCompare(String(b.date))).map(x => `<li><span><b>${x.label}</b> <small>${esc(shortDate(x.date))}${x.note ? ' · ' + esc(x.note) : ''}</small></span><span>${money(x.amount)}</span></li>`).join('') || '<li class="muted">Is mahine koi entry nahi.</li>'}</ul></section>`;
  }
  function requestTab() {
    const kind = ui.reqKind, today = pkDate();
    const list = S.requests.filter(r => r.kind !== 'suggestion').sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 30);
    return `<div class="toolbar"><h1 class="page-title">Request</h1></div>
      <section class="panel pad"><form class="form" data-form="request">
        <div class="switch full" role="tablist"><button type="button" role="tab" aria-selected="${kind === 'leave'}" data-action="req-kind" data-arg="leave">Chutti chahiye</button><button type="button" role="tab" aria-selected="${kind === 'correction'}" data-action="req-kind" data-arg="correction">Hazri ghalat hai</button></div>
        <input type="hidden" name="kind" value="${kind}">
        ${kind === 'leave'
          ? `<div class="two"><label>Kab se<input name="date" type="date" value="${esc(ui.reqDate || today)}" required></label><label>Kab tak<input name="to" type="date" value="${esc(ui.reqDate || today)}" required></label></div>`
          : `<label>Kis din ki hazri<input name="date" type="date" value="${esc(ui.reqDate || today)}" max="${today}" required></label>${timeField('checkIn', '', { label: 'Sahi aane ka waqt', tickets: IN_TICKETS, optional: true, guess: 'in' })}${timeField('checkOut', '', { label: 'Sahi jane ka waqt', tickets: OUT_TICKETS, optional: true, guess: 'out' })}<p class="hint">Jo waqt theek hai use khali chhor dein.</p>`}
        <label>Wajah<textarea name="reason" rows="3" maxlength="1000" required placeholder="${kind === 'leave' ? 'Chutti kyun chahiye' : 'Maslan: Check-Out karna bhool gaya'}"></textarea></label>
        <div class="btn-row"><button class="btn btn-primary btn-lg">Malik ko bhejein</button></div></form></section>
      <h2 class="section-label">Meri requests</h2>
      <section class="panel"><ul class="reqs">${list.map(r => `<li class="req"><p><b>${r.kind === 'leave' ? 'Chutti' : 'Hazri durust'}</b> <span class="stamp ${r.status === 'pending' ? 'st-late' : r.status === 'approved' ? 'st-present' : 'st-absent'}">${r.status === 'pending' ? 'Jawab ka intezar' : r.status === 'approved' ? 'Manzoor' : 'Na-manzoor'}</span></p>
        <p>${esc(shortDate(r.date))}${r.to && r.to !== r.date ? ' – ' + esc(shortDate(r.to)) : ''}${r.kind === 'correction' ? ` &nbsp;|&nbsp; ${fmtTime(r.checkIn)} to ${fmtTime(r.checkOut)}` : ''}</p><p class="muted">${nameHtml(r.reason || '')}</p>${r.ownerNote ? `<p class="muted">Malik: ${esc(r.ownerNote)}</p>` : ''}</li>`).join('') || '<li class="muted pad">Abhi koi request nahi bheji.</li>'}</ul></section>`;
  }

  const setStep = text => { ui.step = text; const el = document.getElementById('punchStep'); if (el) el.textContent = text; };
  const actions = {
    tab(el) { ui.tab = el.dataset.arg; rerender(); window.scrollTo?.(0, 0); },
    'month-step'(el) { const m = addMonths(ui.month, +el.dataset.arg); if (m <= pkDate().slice(0, 7)) ui.month = m; rerender(); },
    'req-kind'(el) { ui.reqKind = el.dataset.arg; rerender(); },
    'fix-missed'(el) { ui.tab = 'request'; ui.reqKind = 'correction'; ui.reqDate = el.dataset.date; rerender(); window.scrollTo?.(0, 0); },
    async 'check-in'(el) {
      await busy(el, async () => {
        try {
          setStep('1/3  Selfie lein…');
          const selfie = await takeSelfie();
          setStep('2/3  Location dekh rahe hain… (15 second tak lag sakte hain)');
          const gps = await getGps();
          setStep(`3/3  Dukaan se ${Math.round(gps.distance)}m. Hazri lag rahi hai…`);
          const result = await data.checkIn({ selfie, gps });
          setStep('');
          toast(result.queued ? 'Internet kamzor hai — hazri phone mein mehfooz hai, signal aate hi khud chali jayegi.' : 'Check-In ho gaya', 'ok');
        } catch (error) {
          setStep(error.code === 'app/cancelled' ? '' : errorText(error));
          if (error.code !== 'app/cancelled') throw error;
        }
      });
      rerender();
    },
    async 'check-out'(el) {
      const open = openRecord(S.myAttendance);
      if (!open) { toast('Check-In ka record nahi mila. Page dobara kholein.', 'bad'); return; }
      if (!confirm('Check-Out karein? Is ke baad aaj dobara Check-In nahi hoga.')) return;
      await busy(el, async () => {
        setStep('Location dekh rahe hain…');
        let gps = null; try { gps = await getGps(); } catch { /* check-out location ke baghair bhi ho jata hai */ }
        setStep('Check-Out lag raha hai…');
        const result = await data.checkOut(open, gps);
        setStep('');
        toast(result.queued ? 'Internet kamzor hai — Check-Out phone mein mehfooz hai, signal aate hi chala jayega.' : 'Check-Out ho gaya', 'ok');
      });
      rerender();
    },
    async 'my-pdf'(el) {
      await busy(el, async () => {
        const lib = await loadPdfLib(), month = ui.month;
        deliverPdf(await staffMonthPdf(lib, { account: me(), month, summary: summary(month), calc: data.calcFor(me(), month), schedule: schedule(), textImages: browserTextImages }));
      });
    },
    update(el) { busy(el, () => checkUpdate(true)); },
    logout() { if (confirm('Logout karein?')) logout(); }
  };
  const forms = {
    async request(form, v, button) {
      await busy(button, async () => { await data.sendRequest(v); ui.reqDate = ''; form.reset(); }, 'Request malik ko chali gayi');
      rerender();
    }
  };

  function render() {
    const tabs = [['hazri', 'Hazri', 'clock'], ['salary', 'Salary', 'wallet'], ['request', 'Request', 'note']];
    const pend = S.requests.filter(r => r.status === 'pending' && r.kind !== 'suggestion').length;
    return `<header class="top"><div class="top-in">
        <div class="brand">${avatar(me())}<span><b>${nameHtml(me().name || 'Staff')}</b><small>${esc(me().role || 'Noor Traders')}</small></span></div>
        <nav class="tabs" aria-label="Hisse">${tabs.map(([k, label, ic]) => `<button type="button" data-action="tab" data-arg="${k}" aria-current="${ui.tab === k ? 'page' : 'false'}">${icon(ic, 22)}<span>${label}</span>${k === 'request' && pend ? `<em class="badge">${pend}</em>` : ''}</button>`).join('')}</nav>
        <button type="button" class="icon-btn on-ink" data-action="logout" aria-label="Logout">${icon('out')}</button>
      </div></header>
      <main class="view view-staff">${ui.tab === 'hazri' ? hazriTab() : ui.tab === 'salary' ? salaryTab() : requestTab()}
        <p class="foot"><button type="button" class="link" data-action="update">Update check karein</button> &nbsp; ${APP_VERSION}</p></main>`;
  }
  return { render, actions, forms, changes: {}, inputs: {}, ui, onData() {} };
}
