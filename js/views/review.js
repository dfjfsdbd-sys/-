// مراجعة الأسبوع: 4 خطوات قصيرة — أرقامك، وين قصّرت، المتأخر، والأسبوع الجاي.
import { h, icon, fill, openSheet, toast, haptic } from '../ui.js';
import { store } from '../store.js';
import { logicalToday, PRAYERS, PRAYER_NAMES } from '../prayer.js';
import { addDays, weekDates, weekLabel, weekStartOf, dayLabel, daysText } from '../dates.js';
import { dayTaskStats, updateTask, deleteTask, restoreTask, TAGS } from '../tasks.js';
import { prayerOn, pagesReadOn, adhkarDone, adhkarSettings, allAdhkarLists } from '../worship.js';
import { activeHabits, habitScore, passThreshold } from '../habits.js';
import { commitActive, dayVerdict } from '../commit.js';
import { shiftOn } from '../shifts.js';
import { award } from '../rewards.js';
import { tintHex } from '../icons.js';
import { muhasabaDone } from './muhasaba.js';
import { goalPace, openGoalEdit } from './goals.js';

export const reviewDone = (ws) => Boolean(store.state.reviews?.[ws]?.at);

function weekStats(ws, today) {
  const days = weekDates(ws).filter((d) => d <= today);
  let tDone = 0, tTot = 0, prOk = 0, prTot = 0, cDone = 0, cTot = 0, pages = 0, focus = 0, nights = 0;
  for (const d of days) {
    const st = dayTaskStats(d, today); tDone += st.done; tTot += st.total;
    for (const k of PRAYERS) { prTot += 1; const s = prayerOn(d, k); if (s === 'ontime' || s === 'jamaah') prOk += 1; }
    if (commitActive()) { const v = dayVerdict(d); if (v === 'done') cDone += 1; if (v !== 'future') cTot += 1; }
    pages += pagesReadOn(d);
    if (muhasabaDone(d)) nights += 1;
  }
  for (const f of store.state.focusLog || []) if (f.d >= ws && f.d <= addDays(ws, 6)) focus += f.sec;
  const units = (store.state.unitLog || []).filter((e) => e.d >= ws && e.d <= addDays(ws, 6) && (e.kind === 'subject' || e.kind === 'book') && (e.m || 0) > 0).length;
  return { tDone, tTot, prOk, prTot, cDone, cTot, pages, focus, nights, units, days: days.length };
}

function weakPoints(ws, today) {
  const days = weekDates(ws).filter((d) => d < today);
  const out = [];
  // يوم ما انسجلت فيه ولا صلاة = ما سجّلت، مش فاتتك
  const unlogged = days.filter((d) => PRAYERS.every((k) => !prayerOn(d, k)));
  if (unlogged.length >= 2) out.push({ ic: 'mosque', sev: unlogged.length, warn: true, t: `ما سجّلت صلواتك ${daysText(unlogged.length)}`, s: 'علّمها من «مدار اليوم» أول بأول مشان المراجعة تكون دقيقة' });
  const logged = days.filter((d) => !unlogged.includes(d));
  for (const k of PRAYERS) {
    const missed = logged.filter((d) => { const s = prayerOn(d, k); return !s || s === 'missed'; });
    if (missed.length >= 2) {
      const workDays = missed.filter((d) => shiftOn(d)?.kind === 'work').length;
      out.push({ ic: 'mosque', sev: missed.length, t: `صلاة ${PRAYER_NAMES[k]} فاتتك ${missed.length} مرات`, s: workDays === missed.length && workDays ? 'كلها بأيام الشغل — جرّب منبّه قبلها' : 'جرّب منبّه قبلها بربع ساعة' });
    }
  }
  const th = passThreshold();
  for (const hb of activeHabits()) {
    const low = days.filter((d) => { const sc = habitScore(d, hb.id); return sc != null && sc < th; });
    const none = days.filter((d) => habitScore(d, hb.id) == null);
    if (low.length) out.push({ ic: hb.icon || 'compass', sev: low.length + 0.5, t: `${hb.name} تحت الحد ${daysText(low.length)}`, s: low.map((d) => dayLabel(d, today)).join('، ') });
    else if (hb.core && none.length >= 3) out.push({ ic: hb.icon || 'compass', sev: 1, warn: true, t: `ما قيّمت «${hb.name}» ${daysText(none.length)}`, s: 'قيّمها كل ليلة مشان يكون التعهّد دقيق' });
  }
  for (const g of store.state.goals.filter((x) => x.horizon === 'week' && x.key === ws)) {
    const p = goalPace(g, today);
    if (p.label === 'متأخر') out.push({ ic: g.icon || 'target', sev: 1, warn: true, t: `متأخر بهدف «${g.title}»`, s: `وصلت ${Math.round(p.prog * 100)}%` });
  }
  return out.sort((a, b) => b.sev - a.sev).slice(0, 5);
}
function strengths(ws, today) {
  const days = weekDates(ws).filter((d) => d <= today);
  const out = [];
  for (const k of PRAYERS) if (days.length >= 3 && days.every((d) => { const s = prayerOn(d, k); return s && s !== 'missed'; })) out.push(`${PRAYER_NAMES[k]} ${days.length}/${days.length}`);
  for (const l of allAdhkarLists()) if (adhkarSettings(l.id).enabled && days.length >= 3 && days.every((d) => adhkarDone(d, l.id))) out.push(`${l.short || l.name} كل يوم`);
  return out.slice(0, 5);
}

export function openWeekReview(ws = weekStartOf(logicalToday())) {
  const today = logicalToday();
  let step = 0;
  const prevWs = addDays(ws, -7), nextWs = addDays(ws, 7);
  const note = { text: store.state.reviews?.[ws]?.note || '' };
  openSheet(null, (body, close) => {
    function render() {
      const steps = h('div', { class: 'rv-steps' }, [0, 1, 2, 3].map((i) => h('i', { class: i <= step ? 'on' : '' })));
      const nav = h('div', { class: 'rv-nav' },
        step > 0 ? h('button', { type: 'button', class: 'btn secondary', onclick: () => { step -= 1; render(); } }, icon('chevR', 13), 'رجوع') : h('span'),
        step < 3 ? h('button', { type: 'button', class: 'btn', onclick: () => { step += 1; haptic('select'); render(); } }, 'التالي', icon('chevL', 13))
          : h('button', { type: 'button', class: 'btn', onclick: finish }, icon('check', 14), reviewDone(ws) ? 'احفظ' : 'خلصت المراجعة (+10)'));
      const head = h('div', { class: 'rv-head' },
        h('button', { type: 'button', class: 'fs-icon-btn', 'aria-label': 'إغلاق', onclick: () => close() }, icon('close', 14)),
        h('span', { class: 'pill accent' }, icon('calendar-check', 11), 'مراجعة الأسبوع'));
      fill(body, [head, steps, [stepOne, stepTwo, stepThree, stepFour][step](), nav]);
    }
    function kpi(label, val, prev, unit = '', good = true) {
      let dl = null;
      if (prev != null && val !== prev) {
        const up = val > prev;
        dl = h('span', { class: `rv-dl ${up === good ? 'up' : 'down'}` }, icon(up ? 'arrow-up' : 'arrow-down', 9), `${Math.abs(val - prev)}${unit} عن الماضي`);
      }
      return h('div', { class: 'rv-kp' }, h('small', null, label), h('b', { class: 'num' }, typeof val === 'string' ? val : `${val}${unit}`), dl);
    }
    function stepOne() {
      const a = weekStats(ws, today), b = weekStats(prevWs, today);
      return h('div', null,
        h('h3', { class: 'rv-h' }, `أسبوعك ${weekLabel(ws)}`), h('p', { class: 'rv-sub' }, 'الحمد لله على كل شي'),
        h('div', { class: 'rv-kpis' },
          h('div', { class: 'rv-kp' }, h('small', null, 'المهام'), h('b', { class: 'num' }, `${a.tDone} / ${a.tTot}`), b.tTot ? h('span', { class: `rv-dl ${a.tDone >= b.tDone ? 'up' : 'down'}` }, `الماضي ${b.tDone}/${b.tTot}`) : null),
          h('div', { class: 'rv-kp' }, h('small', null, 'الصلوات بوقتها'), h('b', { class: 'num' }, `${a.prOk} / ${a.prTot}`), b.prTot ? h('span', { class: `rv-dl ${a.prOk >= b.prOk ? 'up' : 'down'}` }, `الماضي ${b.prOk}`) : null),
          commitActive() ? h('div', { class: 'rv-kp' }, h('small', null, 'أيام التعهّد'), h('b', { class: 'num' }, `${a.cDone} / ${a.cTot}`), h('span', { class: `rv-dl ${a.cDone >= b.cDone ? 'up' : 'down'}` }, `الماضي ${b.cDone}`)) : null,
          kpi('القرآن', a.pages, b.pages, ' ص'),
          kpi('الدراسة', a.units, b.units, ' وحدة'),
          kpi('التركيز', Math.round(a.focus / 60), Math.round(b.focus / 60), ' د'),
          kpi('محاسبة النفس', a.nights, b.nights, ' ليالي')));
    }
    function stepTwo() {
      const w = weakPoints(ws, today), s = strengths(ws, today);
      return h('div', null,
        h('h3', { class: 'rv-h' }, 'وين قصّرت'), h('p', { class: 'rv-sub' }, 'التطبيق طلّعهم من سجلّك — بصراحة ومن غير جلد للذات'),
        w.length ? h('div', { class: 'rv-weak' }, w.map((x) => h('div', { class: `rv-w${x.warn ? ' warn' : ''}` }, h('span', { class: 'rv-wi' }, icon(x.ic, 15)), h('div', null, h('b', null, x.t), h('small', null, x.s))))) : h('p', { class: 'muted' }, 'ما لقينا تقصير واضح هالأسبوع. ما شاء الله!'),
        s.length ? [h('div', { class: 'f-label', style: { margin: '14px 0 8px' } }, 'وأحسنت بـ'), h('div', { class: 'rv-good' }, s.map((x) => h('span', null, icon('check', 10), x)))] : null);
    }
    function stepThree() {
      const late = store.state.tasks.filter((t) => !t.recur && !t.done && t.date && t.date >= ws && t.date < today);
      return h('div', null,
        h('h3', { class: 'rv-h' }, 'اللي ما خلص'), h('p', { class: 'rv-sub' }, late.length ? `${late.length} من هالأسبوع — لوين بدك تنقلهم؟` : 'ما في شي متأخر من هالأسبوع'),
        late.length ? h('div', { class: 'mo-list' }, late.map((t) => {
          const tag = TAGS[t.tag] || TAGS.general;
          return h('div', { class: 'mo-od', style: { '--c': tintHex(tag.tint) } },
            h('div', { class: 'mo-in' }, h('b', null, t.title), h('small', null, `كانت ${dayLabel(t.date, today)}`)),
            h('div', { class: 'mo-opts' },
              h('button', { type: 'button', class: 'mo-opt', onclick: () => { updateTask(t.id, { date: today }); render(); } }, 'لليوم'),
              h('button', { type: 'button', class: 'mo-opt', onclick: () => { updateTask(t.id, { date: nextWs }); render(); } }, 'الأسبوع الجاي'),
              h('button', { type: 'button', class: 'mo-opt del', onclick: () => { const cp = deleteTask(t.id); toast('انحذفت', { action: 'تراجع', onAction: () => { restoreTask(cp); render(); } }); render(); } }, icon('trash', 12))));
        })) : null);
    }
    function stepFour() {
      const nd = weekDates(nextWs);
      const work = nd.filter((d) => shiftOn(d)?.kind === 'work');
      const goals = store.state.goals.filter((g) => g.horizon === 'week' && g.key === nextWs);
      return h('div', null,
        h('h3', { class: 'rv-h' }, 'الأسبوع الجاي'), h('p', { class: 'rv-sub' }, weekLabel(nextWs)),
        work.length ? h('div', { class: 'rv-shift' }, icon('briefcase', 13), work.length === 7 ? 'كل الأسبوع بالشغل — خطط شي خفيف' : `بالشغل ${work.length} أيام (من ${dayLabel(work[0], today)}) — خفّف بهالأيام`) : null,
        h('div', { class: 'f-label', style: { margin: '12px 0 8px' } }, 'أهداف الأسبوع الجاي'),
        goals.map((g) => h('div', { class: 'rv-goal' }, icon(g.icon || 'target', 13), h('span', null, g.title))),
        h('button', { type: 'button', class: 'rv-goal add', onclick: () => openGoalEdit(null, { horizon: 'week', key: nextWs }) }, icon('plus', 12), 'هدف للأسبوع الجاي'),
        h('div', { class: 'f-label', style: { margin: '14px 0 8px' } }, 'كلمة لحالك (اختياري)'),
        h('textarea', { rows: 2, placeholder: 'شو بدك تتذكّر الأسبوع الجاي؟', oninput: (e) => { note.text = e.target.value; } }, note.text));
    }
    function finish() {
      const first = !reviewDone(ws);
      store.update((s) => { s.reviews = s.reviews || {}; s.reviews[ws] = { at: Date.now(), note: note.text.trim() }; });
      if (first) award(`review:${ws}`, 10, 'مراجعة الأسبوع', today);
      haptic('success'); toast('خلصت مراجعة الأسبوع — الله يوفقك بالجاي', { kind: 'gold' }); close();
    }
    render();
  }, { cls: 'rv-sheet', tall: true });
}
