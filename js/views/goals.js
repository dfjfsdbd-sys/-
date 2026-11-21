// الأهداف: سنة ← شهر ← أسبوع. التقدّم بيتحسب لحاله من المكتبة والعادات والمهام،
// ومنقارنه بالوقت اللي مضى: متقدّم، على المسار، أو متأخر
import { h, icon, badge, bar, ring, fill, openSheet, toast, haptic, segmented, openPicker, confirmSheet, chips } from '../ui.js';
import { store, uid } from '../store.js';
import { logicalToday } from '../prayer.js';
import { weekStartOf, weekLabel, addDays, monthLabel, addMonths, daysBetween, parseISO, daysInMonth, iso } from '../dates.js';
import { isDoneOn } from '../tasks.js';
import { habitDaysOk } from '../habits.js';
import { quranStats } from '../worship.js';
import { ITEM_ICON_CHOICES, TINT_KEYS, tintHex } from '../icons.js';
import { secTitle, taskRow } from './components.js';
import { openCapture, openTaskSheet } from './capture.js';

const HZ = { year: 'السنة', month: 'الشهر', week: 'الأسبوع' };
let horizon = 'month';
const cursor = { year: null, month: null, week: null };

export function periodOf(hz, key) {
  if (hz === 'year') return { from: `${key}-01-01`, to: `${key}-12-31` };
  if (hz === 'month') { const [y, m] = key.split('-').map(Number); return { from: `${key}-01`, to: `${key}-${String(daysInMonth(y, m - 1)).padStart(2, '0')}` }; }
  return { from: key, to: addDays(key, 6) };
}
const keyFor = (hz, today) => (hz === 'year' ? today.slice(0, 4) : hz === 'month' ? today.slice(0, 7) : weekStartOf(today));
const labelFor = (hz, key) => (hz === 'year' ? `سنة ${key}` : hz === 'month' ? monthLabel(key) : weekLabel(key));
const shiftKey = (hz, key, n) => (hz === 'year' ? String(Number(key) + n) : hz === 'month' ? addMonths(key, n) : addDays(key, 7 * n));

function itemProgress(ref) {
  const s = store.state;
  if (!ref) return null;
  if (ref.kind === 'subject') { const x = s.subjects.find((y) => y.id === ref.id); const u = x?.lectures || []; return u.length ? u.reduce((a, l) => a + Math.min(100, l.mastery || 0), 0) / u.length / 100 : 0; }
  if (ref.kind === 'book') { const b = s.books.find((y) => y.id === ref.id); if (!b) return 0; if (b.mode === 'pages') return b.totalPages ? Math.min(1, (b.pagesRead || 0) / b.totalPages) : 0; const u = b.units || []; return u.length ? u.reduce((a, l) => a + Math.min(100, l.mastery || 0), 0) / u.length / 100 : 0; }
  if (ref.kind === 'series') { const x = s.series.find((y) => y.id === ref.id); const e = x?.episodes || []; return e.length ? e.reduce((a, ep) => a + (ep.done ? 1 : (ep.progress || 0)), 0) / e.length : 0; }
  if (ref.kind === 'quran') return quranStats(logicalToday()).pct;
  return null;
}
export function goalProgress(g, today = logicalToday()) {
  const kids = store.state.goals.filter((x) => x.parentId === g.id);
  const m = g.measure || { type: kids.length ? 'children' : 'tasks' };
  switch (m.type) {
    case 'manual': return (m.pct || 0) / 100;
    case 'count': return m.target ? Math.min(1, (m.current || 0) / m.target) : 0;
    case 'item': return itemProgress(m.ref) ?? 0;
    case 'habit': {
      const p = periodOf(g.horizon, g.key);
      const end = p.to < today ? p.to : today;
      const target = m.target || (daysBetween(p.from, p.to) + 1);
      return Math.min(1, habitDaysOk(m.ref?.id, p.from, end) / target);
    }
    case 'children': return kids.length ? kids.reduce((a, k) => a + goalProgress(k, today), 0) / kids.length : 0;
    default: {
      const ts = store.state.tasks.filter((t) => t.goalId === g.id && !t.recur);
      if (!ts.length) return kids.length ? kids.reduce((a, k) => a + goalProgress(k, today), 0) / kids.length : 0;
      return ts.filter((t) => t.done).length / ts.length;
    }
  }
}
export function goalPace(g, today = logicalToday()) {
  const p = periodOf(g.horizon, g.key);
  const total = daysBetween(p.from, p.to) + 1;
  const elapsed = Math.max(0, Math.min(total, daysBetween(p.from, today) + 1));
  const expected = elapsed / total;
  const prog = goalProgress(g, today);
  if (g.done || prog >= 1) return { prog, expected, label: 'تمّ', cls: 'good' };
  if (today < p.from) return { prog, expected: 0, label: 'لسّا ما بلّش', cls: '' };
  if (prog >= expected + 0.08) return { prog, expected, label: 'متقدّم', cls: 'good' };
  if (prog >= expected - 0.12) return { prog, expected, label: 'على المسار', cls: 'accent' };
  return { prog, expected, label: 'متأخر', cls: 'warn' };
}

export function renderGoals(ctx) { return renderGoalsInline(ctx); }
export function goalsActions() { return h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'هدف جديد', onclick: () => openGoalEdit(null, { horizon, key: cursor[horizon] }) }, icon('plus', 20)); }

export function renderGoalsInline(ctx) {
  const today = ctx.today;
  for (const k of Object.keys(cursor)) if (!cursor[k]) cursor[k] = keyFor(k, today);
  const key = cursor[horizon];
  const list = store.state.goals.filter((g) => g.horizon === horizon && g.key === key);
  const avg = list.length ? list.reduce((a, g) => a + goalProgress(g, today), 0) / list.length : 0;
  const per = periodOf(horizon, key);
  const total = daysBetween(per.from, per.to) + 1;
  const elapsed = Math.max(0, Math.min(total, daysBetween(per.from, today) + 1));
  return h('div', null,
    h('div', { style: { padding: '10px 16px 0' } }, segmented(Object.entries(HZ).map(([v, l]) => ({ value: v, label: `أهداف ${l}` })), horizon, (v) => { horizon = v; ctx.refresh(); })),
    h('div', { class: 'wk-nav' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'السابق', onclick: () => { cursor[horizon] = shiftKey(horizon, key, -1); ctx.refresh(); } }, icon('chevR', 20)),
      h('button', { type: 'button', class: 'wk-label', onclick: () => { cursor[horizon] = keyFor(horizon, today); ctx.refresh(); } }, h('b', null, labelFor(horizon, key)), h('small', null, `مضى ${Math.round((elapsed / total) * 100)}% من الوقت`)),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'التالي', onclick: () => { cursor[horizon] = shiftKey(horizon, key, 1); ctx.refresh(); } }, icon('chevL', 20))),
    list.length ? h('div', { class: 'goal-sum' },
      ring(avg, 54, { stroke: 5, color: 'var(--gold)', label: `${Math.round(avg * 100)}%` }),
      h('div', null, h('b', null, `${list.length} أهداف`), h('small', null, `${list.filter((g) => goalPace(g, today).cls === 'warn').length} متأخرة — ${list.filter((g) => goalProgress(g, today) >= 1).length} خالصة`)),
      h('div', { class: 'pace-bar' }, h('i', { style: { width: `${(elapsed / total) * 100}%` } }))) : null,
    list.length ? h('div', { class: 'group rows' }, list.map((g) => goalRow(g, today))) : h('div', { class: 'group' }, h('div', { class: 'empty' },
      h('p', null, horizon === 'year' ? 'شو بدك تحقق هالسنة؟ مثلاً: ختم القرآن 4 مرات، خلّص كتاب السنة، وزن 70.' : horizon === 'month' ? 'وزّع أهداف السنة على هالشهر: كم محاضرة، كم صفحة، كم حلقة…' : 'شو أهم شي لازم يخلص هالأسبوع؟'),
      h('button', { type: 'button', class: 'btn', onclick: () => openGoalEdit(null, { horizon, key }) }, icon('plus', 18), 'هدف جديد'))),
    list.length ? h('div', { class: 'section-actions' }, h('button', { type: 'button', class: 'btn secondary', onclick: () => openGoalEdit(null, { horizon, key }) }, icon('plus', 18), `هدف لل${HZ[horizon].slice(2)}`)) : null);
}

function goalRow(g, today) {
  const pc = goalPace(g, today);
  const kids = store.state.goals.filter((x) => x.parentId === g.id);
  return h('button', { type: 'button', class: 'row goal-row', onclick: () => openGoal(g.id) },
    badge(g.icon || 'target', g.color || 'gold', 40),
    h('span', { class: 'row-main' },
      h('span', { class: 'row-title wrap' }, g.title),
      h('span', { class: 'goal-bar' }, h('i', { style: { width: `${Math.round(pc.prog * 100)}%` } }), h('em', { style: { insetInlineStart: `${Math.round(pc.expected * 100)}%` } })),
      h('span', { class: 'row-sub' }, `${Math.round(pc.prog * 100)}%${kids.length ? ` — ${kids.length} أهداف فرعية` : ''}`)),
    h('span', { class: `pill ${pc.cls}` }, pc.label));
}

function measureLabel(g) {
  const m = g.measure;
  if (!m) return 'من المهام المرتبطة';
  if (m.type === 'manual') return 'يدوي';
  if (m.type === 'count') return `عدّاد: ${m.current || 0} من ${m.target} ${m.unit || ''}`;
  if (m.type === 'children') return 'متوسط الأهداف الفرعية';
  if (m.type === 'habit') return `عادة: ${store.state.habits.find((x) => x.id === m.ref?.id)?.name || ''}`;
  if (m.type === 'item') {
    const r = m.ref || {};
    const list = { subject: store.state.subjects, book: store.state.books, series: store.state.series }[r.kind] || [];
    return r.kind === 'quran' ? 'ختمة القرآن' : `${{ subject: 'مادة', book: 'كتاب', series: 'سلسلة' }[r.kind] || ''}: ${list.find((x) => x.id === r.id)?.name || ''}`;
  }
  return '';
}

export function openGoal(id) {
  const today = logicalToday();
  openSheet('الهدف', (body, close, { setTitle }) => {
    function render() {
      const g = store.state.goals.find((x) => x.id === id);
      if (!g) { close(); return; }
      setTitle(HZ[g.horizon] ? `هدف ${HZ[g.horizon]}` : 'الهدف');
      const pc = goalPace(g, today);
      const kids = store.state.goals.filter((x) => x.parentId === g.id);
      const tasks = store.state.tasks.filter((t) => t.goalId === g.id);
      const m = g.measure || {};
      fill(body, [
        h('div', { class: 'gl-head' }, ring(pc.prog, 64, { stroke: 5, color: 'var(--gold)', label: `${Math.round(pc.prog * 100)}%` }),
          h('div', null, h('strong', null, g.title), h('small', null, labelFor(g.horizon, g.key)), h('span', { class: `pill ${pc.cls}` }, pc.label))),
        h('p', { class: 'hint' }, `القياس: ${measureLabel(g)}. مضى ${Math.round(pc.expected * 100)}% من الوقت.`),
        m.type === 'count' ? h('div', { class: 'stepper', style: { justifyContent: 'center', marginBottom: '12px' } },
          h('button', { type: 'button', class: 'icon-btn', onclick: () => { store.update((s) => { const x = s.goals.find((y) => y.id === id); x.measure.current = Math.max(0, (x.measure.current || 0) - 1); }); render(); } }, icon('minus', 18)),
          h('b', { class: 'stepper-val' }, `${m.current || 0}/${m.target}`),
          h('button', { type: 'button', class: 'icon-btn', onclick: () => { store.update((s) => { const x = s.goals.find((y) => y.id === id); x.measure.current = (x.measure.current || 0) + 1; }); haptic('select'); render(); } }, icon('plus', 18))) : null,
        m.type === 'manual' ? h('div', { class: 'chips', style: { marginBottom: '12px' } }, [0, 10, 25, 50, 75, 90, 100].map((v) => h('button', { type: 'button', class: 'chip small', 'aria-pressed': String((m.pct || 0) === v), onclick: () => { store.update((s) => { s.goals.find((y) => y.id === id).measure.pct = v; }); render(); } }, `${v}%`))) : null,
        g.horizon !== 'week' ? [h('div', { class: 'sheet-section' }, `أهداف فرعية (${g.horizon === 'year' ? 'بالأشهر' : 'بالأسابيع'})`),
          h('div', { class: 'rows sheet-rows' }, kids.map((k) => { const kp = goalPace(k, today); return h('button', { type: 'button', class: 'row', onclick: () => { close(); setTimeout(() => openGoal(k.id), 250); } }, h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, k.title), h('span', { class: 'row-sub' }, `${labelFor(k.horizon, k.key)} — ${Math.round(kp.prog * 100)}%`)), h('span', { class: `pill ${kp.cls}` }, kp.label)); }),
            h('button', { type: 'button', class: 'row', onclick: () => { close(); setTimeout(() => openGoalEdit(null, { horizon: g.horizon === 'year' ? 'month' : 'week', key: g.horizon === 'year' ? today.slice(0, 7) : weekStartOf(today), parentId: g.id, color: g.color, icon: g.icon }), 250); } }, icon('plus', 18), h('span', { class: 'row-main' }, 'وزّعه: هدف فرعي')))] : null,
        h('div', { class: 'sheet-section' }, 'مهام هالهدف'),
        h('div', { class: 'rows sheet-rows trows' }, tasks.map((t) => taskRow(t, t.date || today, { onOpen: (x) => openTaskSheet(x.id), showDate: true, today })),
          h('button', { type: 'button', class: 'row', onclick: () => openCapture({ goalId: g.id }) }, icon('plus', 18), h('span', { class: 'row-main' }, 'أضف مهمة لهالهدف'))),
        h('div', { class: 'two' },
          h('button', { type: 'button', class: 'btn secondary', onclick: () => { close(); setTimeout(() => openGoalEdit(id), 250); } }, icon('edit', 16), 'عدّل'),
          h('button', { type: 'button', class: 'btn danger', onclick: async () => { if (await confirmSheet('حذف الهدف', `حذف «${g.title}»؟ المهام بتضل.`, 'احذف')) { store.update((s) => { s.goals = s.goals.filter((x) => x.id !== id && x.parentId !== id); s.tasks.forEach((t) => { if (t.goalId === id) t.goalId = null; }); }); close(); } } }, icon('trash', 16), 'حذف')),
      ]);
    }
    render();
  });
}

export function openGoalEdit(id, preset = {}) {
  const ex = id ? store.state.goals.find((g) => g.id === id) : null;
  const d = ex ? JSON.parse(JSON.stringify(ex)) : { title: '', horizon: preset.horizon || 'month', key: preset.key || keyFor(preset.horizon || 'month', logicalToday()), parentId: preset.parentId || null, icon: preset.icon || 'target', color: preset.color || 'gold', measure: null };
  openSheet(ex ? 'تعديل الهدف' : 'هدف جديد', (body, close) => {
    function render() {
      const m = d.measure || { type: 'tasks' };
      const s = store.state;
      fill(body, [
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'الهدف'), h('input', { type: 'text', value: d.title, placeholder: 'متل: خلّص 20 حلقة من فقه النفس', 'data-autofocus': true, oninput: (e) => { d.title = e.target.value; } })),
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'لمدة'), chips(Object.entries(HZ).map(([v, l]) => ({ value: v, label: l })), d.horizon, (v) => { d.horizon = v; d.key = keyFor(v, logicalToday()); render(); })),
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'كيف بينقاس التقدّم؟'),
          chips([{ value: 'tasks', label: 'من المهام' }, { value: 'item', label: 'من المكتبة' }, { value: 'habit', label: 'من عادة' }, { value: 'count', label: 'عدّاد' }, { value: 'manual', label: 'يدوي' }, { value: 'children', label: 'من الفرعية' }], m.type, (v) => { d.measure = v === 'tasks' ? null : { type: v, ...(v === 'count' ? { target: 10, current: 0, unit: '' } : {}), ...(v === 'manual' ? { pct: 0 } : {}) }; render(); })),
        m.type === 'item' ? h('button', { type: 'button', class: 'select-btn', onclick: () => openPicker({
          title: 'من وين؟', value: m.ref ? `${m.ref.kind}:${m.ref.id}` : null,
          options: [{ value: 'quran:q', label: 'ختمة القرآن', icon: 'quran', tint: 'mint' },
            ...s.subjects.map((x) => ({ value: `subject:${x.id}`, label: x.name, sub: 'مادة', icon: 'grad', tint: x.color, image: x.image })),
            ...s.books.map((x) => ({ value: `book:${x.id}`, label: x.name, sub: 'كتاب', icon: 'book', tint: x.color, image: x.image })),
            ...s.series.map((x) => ({ value: `series:${x.id}`, label: x.name, sub: 'سلسلة', icon: 'video', tint: x.color, image: x.image }))],
          onPick: (v) => { const [kind, rid] = v.split(':'); d.measure = { type: 'item', ref: { kind, id: rid } }; if (!d.title) d.title = v.startsWith('quran') ? 'ختم القرآن' : `خلّص ${(s.subjects.concat(s.books, s.series).find((x) => x.id === rid) || {}).name || ''}`; render(); },
        }) }, icon('link', 18), h('span', { class: m.ref ? 'sb-val' : 'sb-val ph' }, m.ref ? measureLabel(d) : 'اختار مادة، كتاب، سلسلة…'), icon('chevD', 18)) : null,
        m.type === 'habit' ? h('button', { type: 'button', class: 'select-btn', onclick: () => openPicker({ title: 'العادة', value: m.ref?.id, options: s.habits.filter((x) => !x.archived).map((x) => ({ value: x.id, label: x.name, icon: x.icon, tint: x.color })), onPick: (v) => { d.measure = { type: 'habit', ref: { id: v } }; render(); } }) }, icon('leaf', 18), h('span', { class: m.ref ? 'sb-val' : 'sb-val ph' }, m.ref ? measureLabel(d) : 'اختار العادة'), icon('chevD', 18)) : null,
        m.type === 'count' ? h('div', { class: 'two' },
          h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'العدد المطلوب'), h('input', { type: 'number', value: m.target, oninput: (e) => { d.measure.target = Number(e.target.value) || 1; } })),
          h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'الوحدة'), h('input', { type: 'text', value: m.unit || '', placeholder: 'مرة، كتاب…', oninput: (e) => { d.measure.unit = e.target.value; } }))) : null,
        h('div', { class: 'field', style: { marginTop: '12px' } }, h('span', { class: 'field-label' }, 'الأيقونة واللون'),
          h('div', { class: 'icon-grid' }, ITEM_ICON_CHOICES.slice(0, 16).map((ic) => h('button', { type: 'button', class: 'icon-choice', 'aria-pressed': String(d.icon === ic), style: { '--tint': tintHex(d.color) }, onclick: () => { d.icon = ic; render(); } }, icon(ic, 20)))),
          h('div', { class: 'tint-row', style: { marginTop: '10px' } }, TINT_KEYS.map((k) => h('button', { type: 'button', class: 'tint-dot', 'aria-pressed': String(d.color === k), style: { '--tint': tintHex(k) }, onclick: () => { d.color = k; render(); } })))),
        h('button', { type: 'button', class: 'btn block', onclick: save }, ex ? 'احفظ' : 'أضف الهدف'),
      ]);
    }
    function save() {
      if (!d.title.trim()) { toast('اكتب الهدف.', { kind: 'warn' }); return; }
      store.update((s) => {
        if (ex) { const i = s.goals.findIndex((x) => x.id === id); s.goals[i] = { ...s.goals[i], ...d, title: d.title.trim() }; }
        else s.goals.push({ id: uid('g'), createdAt: Date.now(), ...d, title: d.title.trim() });
      });
      close();
      toast(ex ? 'انحفظ' : 'انضاف الهدف');
    }
    render();
  });
}
