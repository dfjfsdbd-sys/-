// الإضافة السريعة (سطر واحد يفهمه التطبيق) وورقة تعديل المهمة الكاملة
import { h, icon, fill, openSheet, toast, haptic, chips, openDatePicker, openTimePicker, openPicker, confirmSheet, field } from '../ui.js';
import { store, uid } from '../store.js';
import { parseTask, describeParse } from '../parse.js';
import { addTask, updateTask, taskById, TAGS, RECUR_LABEL, setDone, isDoneOn } from '../tasks.js';
import { logicalToday, PERIODS, PERIOD_SHORT, PERIOD_SKY, periodOfTime } from '../prayer.js';
import { dayLabel, addDays, time12, shortDate, WEEKDAYS, parseISO } from '../dates.js';
import { tintHex } from '../icons.js';
import { SHIFT_RULES } from '../shifts.js';
import { confirmDelete } from './components.js';
import { googleCalendarUrl } from '../notify.js';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

// إضافة: تكتب جملة، بتشوف شو فهم التطبيق، وبتعدّل بلمسة إذا لزم
export function openCapture(preset = {}) {
  const today = logicalToday();
  let override = { ...preset };
  openSheet('مهمة جديدة', (body, close) => {
    const input = h('textarea', { class: 'cap-input', rows: 2, placeholder: 'متل: بكرة الساعة 10 تحليل دم\nأو: قبل 7 الشهر جيب الأوراق', 'data-autofocus': true, 'aria-label': 'المهمة' });
    const preview = h('div', { class: 'cap-preview' });
    const extra = h('div');
    const parsedOf = () => {
      const lines = input.value.split('\n').map((x) => x.trim()).filter(Boolean);
      return lines.map((l) => ({ ...parseTask(l, today), ...stripEmpty(override) }));
    };
    function stripEmpty(o) { const r = {}; for (const [k, v] of Object.entries(o)) if (v !== undefined) r[k] = v; return r; }
    function draw() {
      const ps = parsedOf();
      const p = ps[0];
      if (!p) { fill(preview, [h('p', { class: 'cap-hint' }, 'اكتب بكلامك العادي — التطبيق بيفهم اليوم والساعة والتكرار. كل سطر مهمة.')]); }
      else {
        const bits = describeParse(p, today);
        fill(preview, [
          h('div', { class: 'cap-title' }, p.title || h('span', { class: 'dim' }, 'اكتب اسم المهمة')),
          bits.length ? h('div', { class: 'cap-bits' }, bits.map((b) => h('span', { class: 'pill accent' }, icon(b.ic, 12), b.t))) : h('div', { class: 'cap-bits' }, h('span', { class: 'pill' }, icon('inbox', 12), 'بلا موعد — بتنحط بصندوق الوارد')),
          ps.length > 1 ? h('p', { class: 'cap-hint' }, `${ps.length} مهام — كل سطر وحدة`) : null,
        ]);
      }
      const cur = p || { ...override };
      fill(extra, [
        h('div', { class: 'cap-row' },
          h('span', { class: 'cap-label' }, 'اليوم'),
          h('div', { class: 'scroller' }, [
            ['بلا موعد', null], ['اليوم', today], ['بكرة', addDays(today, 1)], ['بعد بكرة', addDays(today, 2)],
          ].map(([l, v]) => h('button', { type: 'button', class: 'chip small', 'aria-pressed': String((cur.date ?? null) === v && !cur.recur), onclick: () => { override.date = v; override.recur = null; draw(); } }, l)),
          h('button', { type: 'button', class: 'chip small', onclick: () => openDatePicker({ value: cur.date, today, onPick: (d) => { override.date = d; draw(); } }) }, icon('calendar', 14), cur.date && cur.date > addDays(today, 2) ? dayLabel(cur.date, today) : 'تاريخ'))),
        h('div', { class: 'cap-row' },
          h('span', { class: 'cap-label' }, 'الوقت'),
          h('div', { class: 'scroller' },
            PERIODS.map((k) => h('button', { type: 'button', class: 'chip small', style: { '--tint': PERIOD_SKY[k] }, 'aria-pressed': String(cur.period === k && !cur.time), onclick: () => { override.period = cur.period === k ? null : k; override.time = null; draw(); } }, PERIOD_SHORT[k])),
            h('button', { type: 'button', class: 'chip small', 'aria-pressed': String(Boolean(cur.time)), onclick: () => openTimePicker({ value: cur.time, onPick: (t) => { override.time = t; override.period = null; draw(); } }) }, icon('clock', 14), cur.time ? time12(cur.time) : 'ساعة'))),
        h('div', { class: 'cap-row' },
          h('span', { class: 'cap-label' }, 'النوع'),
          h('div', { class: 'scroller' }, Object.entries(TAGS).map(([k, t]) => h('button', { type: 'button', class: 'chip small', 'aria-pressed': String((cur.tag || 'general') === k), style: { '--tint': tintHex(t.tint) }, onclick: () => { override.tag = k; draw(); } }, t.name)))),
      ]);
    }
    const save = (more = false) => {
      const ps = parsedOf().filter((p) => p.title);
      if (!ps.length) { input.focus(); toast('اكتب المهمة أول.', { kind: 'warn' }); return; }
      const ids = [];
      for (const p of ps) {
        const t = addTask({
          title: p.title, date: p.recur && !p.date ? today : p.date, time: p.time, period: p.time ? periodOfTime(p.time, p.date || today) : p.period,
          due: p.due, recur: p.recur, priority: p.priority, tag: p.tag || 'general', remind: p.remind,
          goalId: preset.goalId || null, link: preset.link || null,
        });
        ids.push(t.id);
      }
      haptic('success');
      const first = ps[0];
      const where = first.recur ? RECUR_LABEL(first.recur) : first.date ? dayLabel(first.date, today) : first.due ? `قبل ${shortDate(first.due)}` : 'صندوق الوارد';
      toast(ps.length > 1 ? `انضافت ${ps.length} مهام` : `انضافت — ${where}`, {
        action: 'تراجع', onAction: () => store.update((s) => { s.tasks = s.tasks.filter((t) => !ids.includes(t.id)); }),
      });
      if (more) { input.value = ''; override = { ...preset }; draw(); input.focus(); } else close();
    };
    input.addEventListener('input', draw);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); } });
    const mic = SR ? h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'احكي المهمة', onclick: () => listen(input, draw) }, icon('mic', 20)) : null;
    fill(body, [
      h('div', { class: 'cap-box' }, input, mic),
      preview,
      extra,
      h('div', { class: 'two', style: { marginTop: '14px' } },
        h('button', { type: 'button', class: 'btn secondary', onclick: () => save(true) }, icon('plus', 18), 'وكمان وحدة'),
        h('button', { type: 'button', class: 'btn', onclick: () => save(false) }, icon('check', 18), 'أضف')),
    ]);
    if (preset.title) input.value = preset.title;
    draw();
  });
}

function listen(input, onText) {
  if (!SR) return;
  const rec = new SR();
  rec.lang = 'ar-SY'; rec.interimResults = true; rec.continuous = false;
  const base = input.value ? `${input.value} ` : '';
  input.classList.add('listening');
  rec.onresult = (e) => {
    let t = '';
    for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
    input.value = base + t; onText();
  };
  rec.onerror = (e) => { if (e.error === 'not-allowed') toast('لازم تسمح باستعمال المايك.', { kind: 'warn' }); };
  rec.onend = () => input.classList.remove('listening');
  try { rec.start(); haptic('select'); } catch { /* */ }
}

/* ---------- ورقة المهمة ---------- */
export function openTaskSheet(id, day = logicalToday()) {
  const today = logicalToday();
  openSheet('المهمة', (body, close) => {
    function render() {
      const t = taskById(id);
      if (!t) { close(); return; }
      const done = isDoneOn(t, day);
      const set = (patch) => { updateTask(id, patch); render(); };
      const title = h('input', { type: 'text', value: t.title, 'aria-label': 'العنوان', class: 'ts-title', onchange: (e) => set({ title: e.target.value.trim() || t.title }) });
      const notes = h('textarea', { rows: 2, placeholder: 'ملاحظات…', onchange: (e) => set({ notes: e.target.value }) }, t.notes || '');
      const newItem = h('input', { type: 'text', placeholder: 'أضف بند (مثلاً: شاحن)', onkeydown: (e) => { if (e.key === 'Enter' && e.target.value.trim()) { const v = e.target.value.trim(); set({ checklist: [...(t.checklist || []), { id: uid('c'), text: v, done: false }] }); } } });
      fill(body, [
        h('div', { class: 'ts-head' },
          h('button', { type: 'button', class: `tcheck big${done ? ' on' : ''}`, 'aria-label': 'تمّت', onclick: () => { setDone(id, day, !done); haptic('done'); render(); } }, icon('check', 20, { stroke: 2.6 })),
          title,
          h('button', { type: 'button', class: `icon-btn ghost${t.priority ? ' star-on' : ''}`, 'aria-label': 'مهمة', onclick: () => set({ priority: t.priority ? 0 : 1 }) }, icon('star', 20, { fill: t.priority ? 'currentColor' : 'none' }))),
        h('div', { class: 'rows sheet-rows' },
          optRow('calendar', 'اليوم', t.recur ? RECUR_LABEL(t.recur) : t.date ? dayLabel(t.date, today) : 'بلا موعد', () => openDatePicker({ value: t.date, today, allowEmpty: true, emptyLabel: 'بلا موعد (صندوق الوارد)', onPick: (d) => set({ date: d }) })),
          optRow('clock', 'الوقت', t.time ? time12(t.time) : t.period ? PERIOD_SHORT[t.period] : 'بأي وقت', () => openWhen(t, set)),
          optRow('repeat', 'التكرار', t.recur ? RECUR_LABEL(t.recur) : 'مرة وحدة', () => openRecur(t, set, today)),
          optRow('flag', 'آخر موعد', t.due ? shortDate(t.due) : 'ما في', () => openDatePicker({ value: t.due, today, title: 'لازم تنعمل قبل', allowEmpty: true, emptyLabel: 'بلا موعد نهائي', onPick: (d) => set({ due: d }) })),
          optRow('bell', 'تذكير', t.remind == null ? 'بلا تذكير' : t.remind === 0 ? 'بوقتها' : `قبلها بـ ${t.remind >= 60 ? `${t.remind / 60} ساعة` : `${t.remind} د`}`, () => openPicker({
            title: 'التذكير', value: t.remind,
            options: [{ value: null, label: 'بلا تذكير' }, { value: 0, label: 'بوقتها' }, { value: 15, label: 'قبل بربع ساعة' }, { value: 60, label: 'قبل بساعة' }, { value: 1440, label: 'قبل بيوم' }],
            onPick: (v) => { set({ remind: v }); if (v != null && !t.time) toast('حدد ساعة للمهمة مشان يشتغل التذكير.', { kind: 'warn' }); },
          })),
          optRow('tag', 'النوع', (TAGS[t.tag] || TAGS.general).name, () => openPicker({ title: 'النوع', value: t.tag, options: Object.entries(TAGS).map(([k, v]) => ({ value: k, label: v.name, icon: v.icon, tint: v.tint })), onPick: (v) => set({ tag: v }) }))),
        h('div', { class: 'sheet-section' }, 'قائمة أغراض/خطوات'),
        h('div', { class: 'rows sheet-rows' },
          (t.checklist || []).map((c) => h('div', { class: 'row' },
            h('button', { type: 'button', class: `tcheck small${c.done ? ' on' : ''}`, onclick: () => set({ checklist: t.checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)) }) }, icon('check', 13, { stroke: 2.6 })),
            h('span', { class: `row-main${c.done ? ' dim' : ''}` }, c.text),
            h('button', { type: 'button', class: 'icon-btn ghost small', 'aria-label': 'شيل', onclick: () => set({ checklist: t.checklist.filter((x) => x.id !== c.id) }) }, icon('close', 16)))),
          h('div', { class: 'row' }, icon('plus', 18), newItem)),
        notes,
        h('div', { class: 'ts-actions' },
          !t.recur && t.date !== addDays(today, 1) ? h('button', { type: 'button', class: 'btn secondary small', onclick: () => { set({ date: addDays(today, 1) }); toast('انتقلت لبكرة'); } }, icon('chevL', 16), 'لبكرة') : null,
          t.time && (t.date || t.recur) ? h('a', { class: 'btn secondary small', href: googleCalendarUrl(t, day), target: '_blank', rel: 'noopener' }, icon('external', 16), 'تقويم جوجل') : null,
          h('button', { type: 'button', class: 'btn danger small', onclick: async () => { close(); setTimeout(() => confirmDelete(t), 200); } }, icon('trash', 16), 'حذف')),
      ]);
    }
    render();
  });
}

function optRow(ic, label, value, onClick) {
  return h('button', { type: 'button', class: 'row', onclick: onClick },
    h('span', { class: 'row-ic' }, icon(ic, 18)),
    h('span', { class: 'row-main' }, h('span', { class: 'row-sub' }, label), h('span', { class: 'row-title' }, value)),
    icon('chevL', 18));
}

function openWhen(t, set) {
  openSheet('متى؟', (body, close) => {
    fill(body, [
      h('p', { class: 'hint' }, 'اختار فترة من اليوم، أو ساعة محددة.'),
      h('div', { class: 'period-grid' }, PERIODS.map((k) => h('button', {
        type: 'button', class: 'period-pick', style: { '--sky': PERIOD_SKY[k] }, 'aria-pressed': String(t.period === k && !t.time),
        onclick: () => { set({ period: k, time: null }); close(); },
      }, h('i'), PERIOD_SHORT[k]))),
      h('div', { class: 'two', style: { marginTop: '12px' } },
        h('button', { type: 'button', class: 'btn secondary', onclick: () => { set({ period: null, time: null }); close(); } }, 'بأي وقت'),
        h('button', { type: 'button', class: 'btn', onclick: () => { close(); setTimeout(() => openTimePicker({ value: t.time, onPick: (v) => set({ time: v, period: v ? periodOfTime(v, t.date || logicalToday()) : t.period }) }), 250); } }, icon('clock', 18), 'ساعة محددة')),
    ]);
  });
}

function openRecur(t, set, today) {
  openSheet('التكرار', (body, close) => {
    let days = t.recur?.type === 'weekly' ? [...(t.recur.days || [])] : [];
    const pick = (r) => { set({ recur: r, date: r && !t.date ? today : t.date }); close(); };
    function render() {
      fill(body, [
        h('div', { class: 'rows sheet-rows' },
          [['مرة وحدة', null], ['كل يوم', { type: 'daily' }], ['كل أسبوع بنفس اليوم', { type: 'weekly', days: [parseISO(t.date || today).getDay()] }], ['كل شهر بنفس التاريخ', { type: 'monthly', day: Number((t.date || today).slice(8)) }], ['كل سنة', { type: 'yearly' }]]
            .map(([l, r]) => h('button', { type: 'button', class: 'row', onclick: () => pick(r) }, h('span', { class: 'row-main' }, l)))),
        h('div', { class: 'sheet-section' }, 'أيام محددة بالأسبوع'),
        h('div', { class: 'chips' }, [6, 0, 1, 2, 3, 4, 5].map((d) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(days.includes(d)), onclick: () => { days = days.includes(d) ? days.filter((x) => x !== d) : [...days, d]; render(); } }, WEEKDAYS[d]))),
        days.length ? h('button', { type: 'button', class: 'btn block', onclick: () => pick({ type: 'weekly', days }) }, 'تمام') : null,
        h('div', { class: 'sheet-section' }, 'مع النوبات (البيت والشغل)'),
        h('div', { class: 'rows sheet-rows' }, Object.entries(SHIFT_RULES).map(([k, l]) => h('button', { type: 'button', class: 'row', onclick: () => pick({ type: 'shift', when: k }) }, h('span', { class: 'row-ic' }, icon(k.includes('Work') || k === 'workDays' ? 'briefcase' : 'house', 18)), h('span', { class: 'row-main' }, l)))),
        store.state.settings.shift?.enabled ? null : h('p', { class: 'field-hint' }, 'فعّل النوبات من الإعدادات مشان تشتغل هالخيارات.'),
      ]);
    }
    render();
  });
}
