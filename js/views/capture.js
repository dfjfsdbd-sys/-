// نافذة إضافة/تعديل المهمة — نفس فكرة النسخة الأولى: النوع ← الاختيار من المكتبة ← الاسم ← الوقت المتوقع ← اليوم ← الفترة
// «عامة» بتفهم الكلام العادي كمان: «بكرة الساعة 10 تحليل دم» بتنحط ببكرة الساعة 10 لحالها.
import { h, icon, fill, openSheet, toast, haptic, openDatePicker, openTimePicker, openPicker } from '../ui.js';
import { store, uid } from '../store.js';
import { parseTask, describeParse } from '../parse.js';
import { addTask, updateTask, taskById, TAGS, TYPE_ORDER, RECUR_LABEL, setDone, isDoneOn } from '../tasks.js';
import { logicalToday, PERIODS, PERIOD_SKY, periodsFor, periodOfTime } from '../prayer.js';
import { dayLabel, addDays, time12, shortDate, WEEKDAYS, WEEK_SHORT, parseISO, fromMin, daysText, tasksText } from '../dates.js';
import { tintHex } from '../icons.js';
import { SHIFT_RULES } from '../shifts.js';
import { allAdhkarLists, adhkarSettings } from '../worship.js';
import { activeHabits } from '../habits.js';
import { WORKOUT_TYPES } from '../sport.js';
import { masteryLabel } from '../library.js';
import { confirmDelete } from './components.js';
import { googleCalendarUrl } from '../notify.js';
import { libItems, unitsFor, unitWord, plannedUnits, nextUnit, makeLink, autoTitle, typeOf, itemProgress, linkItemId } from '../libitems.js';

export const STATION_NAMES = { fajr: 'بعد الفجر', morning: 'فترة الصباح', dhuhr: 'بعد الظهر', asr: 'بعد العصر', maghrib: 'بعد المغرب', isha: 'بعد العشاء' };
const SHORT = { fajr: 'الفجر', morning: 'الصباح', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' };
const NEEDS_TIME = new Set(['general', 'study', 'book', 'self', 'series', 'break', 'sport']);
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

// الفترة الحالية أو الجاية بيوم معيّن (للاقتراح)
function suggestPeriod(date) {
  const today = logicalToday();
  if (date !== today) return 'morning';
  const p = periodsFor(today);
  const now = new Date();
  let t = now.getHours() * 60 + now.getMinutes();
  if (t < p.fajr.from - 60) t += 1440;
  for (const k of PERIODS) if (t < p[k].to) return k;
  return 'isha';
}

/* ---------- مصادر المكتبة لكل نوع: بـ libitems.js ---------- */

/* ---------- النافذة ---------- */
export function openCapture(preset = {}) { openTaskForm(null, preset); }
export function openTaskSheet(id, day) { openTaskForm(id, { day }); }

export function openTaskForm(id, preset = {}) {
  const today = logicalToday();
  const editing = id ? taskById(id) : null;
  if (id && !editing) return;
  const f = editing ? {
    type: typeOf(editing), itemId: editing.link?.itemId ? (editing.link.kind === 'adhkar' ? `adhkar:${editing.link.itemId}` : linkItemId(editing.link)) : null,
    unitId: editing.link?.unitId || null, title: editing.title, estimate: editing.estimate || 0,
    date: editing.date, period: editing.period, time: editing.time, recur: editing.recur, due: editing.due,
    remind: editing.remind, priority: editing.priority || 0, notes: editing.notes || '', checklist: [...(editing.checklist || [])],
  } : {
    type: preset.type || 'general', itemId: null, unitId: null, title: preset.title || '', estimate: 0,
    date: preset.date === undefined ? today : preset.date, period: preset.period || null, time: preset.time || null,
    recur: null, due: null, remind: null, priority: 0, notes: '', checklist: [],
  };
  if (!editing && !f.period && !f.time && f.date) f.period = suggestPeriod(f.date);
  let titleTouched = Boolean(editing) || Boolean(preset.title);
  let parsed = null;
  let manualWhen = Boolean(editing);
  let multi = false;
  let multiDays = new Set(f.date ? [f.date] : []);
  let dist = 'next';

  openSheet(null, (body, close) => {
    const hasUnits = () => Boolean(f.itemId && unitsFor(f.type, f.itemId)?.length);
    function setType(t) {
      if (f.type === t) return;
      f.type = t; f.itemId = null; f.unitId = null;
      if (!titleTouched) f.title = t === 'break' ? 'استراحة' : '';
      if (t === 'break' && !f.estimate) f.estimate = 15;
      haptic('select'); render();
    }
    function pickItem(itemId) {
      f.itemId = f.itemId === itemId ? null : itemId;
      const units = f.itemId ? unitsFor(f.type, f.itemId) : null;
      f.unitId = units ? (nextUnit(units)?.id || null) : null;
      if (!titleTouched || !f.title) { f.title = f.itemId ? autoTitle(f.type, f.itemId, f.unitId) : ''; titleTouched = false; }
      haptic('select'); render();
    }
    function pickUnit(unitId) {
      f.unitId = unitId;
      if (!titleTouched) f.title = autoTitle(f.type, f.itemId, f.unitId);
      haptic('select'); render();
    }
    // خطة التوزيع: لكل يوم مختار، شو المهمة اللي رح تنضاف
    function planRows() {
      const days = [...multiDays].sort();
      const units = f.itemId ? unitsFor(f.type, f.itemId) : null;
      if (dist === 'next' && units?.length) {
        const start = Math.max(0, units.findIndex((u) => u.id === f.unitId));
        const planned = plannedUnits();
        const seq = units.slice(start).filter((u) => u.id === f.unitId || (!(u.done || (u.mastery || 0) >= 100) && !planned.has(u.id)));
        return days.map((d, i) => ({ d, unit: seq[i] || null, title: seq[i] ? autoTitle(f.type, f.itemId, seq[i].id) : null }));
      }
      return days.map((d) => ({ d, unit: units?.find((u) => u.id === f.unitId) || null, title: (f.title || '').trim() || autoTitle(f.type, f.itemId, f.unitId) }));
    }

    function head() {
      let when;
      if (multi) when = multiDays.size ? `${multiDays.size} ${multiDays.size === 1 ? 'يوم' : 'أيام'}${f.period ? ` · ${STATION_NAMES[f.period]}` : ''}` : 'اختار الأيام من الشريط';
      else when = f.date ? `${dayLabel(f.date, today)} · ${WEEKDAYS[parseISO(f.date).getDay()]} ${shortDate(f.date)}${f.time ? ` · ${time12(f.time)}` : f.period ? ` · ${STATION_NAMES[f.period]}` : ''}` : 'بلا موعد — بتنحط بصندوق التراكم';
      return h('div', { class: 'am-title' },
        h('h3', null, icon(editing ? 'pen' : 'plus', 14), editing ? 'تعديل المهمة' : 'مهمة جديدة',
          h('button', { type: 'button', class: 'am-x', 'aria-label': 'إغلاق', onclick: () => close() }, icon('close', 16))),
        h('small', null, editing && f.recur ? RECUR_LABEL(f.recur) : when));
    }
    function typeGrid() {
      return h('div', { class: 'f-row' }, h('label', { class: 'f-label' }, 'النوع'),
        h('div', { class: 'ty-grid' }, TYPE_ORDER.map((k) => {
          const tg = TAGS[k];
          return h('button', { type: 'button', class: `ty${f.type === k ? ' on' : ''}`, style: { '--c': tintHex(tg.tint) }, onclick: () => setType(k) },
            h('span', { class: 'ty-ic' }, icon(tg.icon, 20)), h('span', { class: 'ty-nm' }, tg.name));
        })));
    }
    function libraryArea() {
      if (f.type === 'general' || f.type === 'break') return null;
      const items = libItems(f.type);
      const tint = tintHex(TAGS[f.type].tint);
      const where = { study: 'المواد', book: 'الكتب', self: 'فقه النفس', series: 'السلاسل', worship: 'العبادات', behavior: 'السلوك', sport: 'الرياضة' }[f.type];
      if (!items.length) return h('div', { class: 'f-row' }, h('p', { class: 'pick-empty' }, `ما في شي بقسم «${where}» بالمكتبة لسّا. أضفه من المكتبة، أو اكتب اسم المهمة تحت.`));
      const units = f.itemId ? unitsFor(f.type, f.itemId) : null;
      const big = ['study', 'book', 'self', 'series'].includes(f.type);
      const nx = units ? nextUnit(units) : null;
      return h('div', { class: 'f-row' },
        h('label', { class: 'f-label' }, { study: 'المادة', book: 'الكتاب', self: 'السلسلة', series: 'السلسلة', worship: 'شو بالضبط؟', behavior: 'العادة', sport: 'نوع التمرين' }[f.type]),
        big ? h('div', { class: 'it-row' }, items.map((it) => {
          const pr = itemProgress(f.type, it.id);
          return h('button', { type: 'button', class: `it-card${f.itemId === it.id ? ' on' : ''}`, style: { '--c': it.color ? tintHex(it.color) : tint }, onclick: () => pickItem(it.id) },
            h('span', { class: 'it-im' }, it.image ? h('img', { src: it.image, alt: '', loading: 'lazy' }) : icon(it.icon, 26)),
            h('b', null, it.name), pr ? h('small', null, `${Math.round(pr.pct * 100)}% · ${pr.n}`) : null);
        })) : h('div', { class: 'pick-pool' }, items.map((it) => h('button', {
          type: 'button', class: `chip-choice${f.itemId === it.id ? ' selected' : ''}`, style: { '--tc': it.color ? tintHex(it.color) : tint }, onclick: () => pickItem(it.id),
        }, it.image ? h('img', { class: 'pill-ico', src: it.image, alt: '' }) : icon(it.icon, 16), h('span', null, it.name)))),
        units ? (units.length ? h('div', { class: 'unit-pick' },
          h('label', { class: 'f-label' }, multi && dist === 'next' ? `من أي ${unitWord(f.type, f.itemId)} نبلّش؟` : `اختر ${unitWord(f.type, f.itemId)}`),
          h('div', { class: 'units-box' }, units.map((u, i) => {
            const m = u.mastery || 0;
            const isEp = f.type === 'self' || f.type === 'series';
            const prog = isEp ? Math.round((u.done ? 1 : u.progress || 0) * 100) : null;
            return h('button', { type: 'button', class: `un-row${f.unitId === u.id ? ' on' : ''}${(u.done || m >= 100) ? ' is-done' : ''}`, onclick: () => pickUnit(u.id) },
              u.image || u.videoId ? h('img', { class: 'unit-thumb', src: u.image || `https://i.ytimg.com/vi/${u.videoId}/mqdefault.jpg`, alt: '', loading: 'lazy' }) : h('span', { class: 'un-n num' }, String(i + 1)),
              h('span', { class: 'un-main' }, h('b', null, u.title || `${unitWord(f.type, f.itemId)} ${i + 1}`, nx && nx.id === u.id ? h('em', null, ' · التالية') : null),
                isEp ? h('small', null, u.done ? 'خلصتها' : prog ? `حضرت ${prog}%` : 'لسّا') : null),
              isEp ? null : h('span', { class: 'un-dots' }, [50, 75, 100].map((v) => h('i', { class: m >= v ? 'on' : '' }))),
              f.unitId === u.id ? icon('check', 14) : null);
          }))) : h('p', { class: 'pick-empty' }, `ما في ${unitWord(f.type, f.itemId)}ات بهالعنصر لسّا.`)) : null);
    }
    let parseEl = null;
    function titleRow() {
      if (multi && dist === 'next' && hasUnits()) return null;
      const input = h('input', {
        type: 'text', value: f.title, placeholder: f.type === 'general' ? 'ماذا تريد أن تنجز؟ (مثلاً: بكرة الساعة 10 تحليل دم)' : 'اختر من القائمة أعلاه أو اكتب اسماً',
        'data-autofocus': f.type === 'general' && !editing ? true : null,
        oninput: (e) => {
          f.title = e.target.value; titleTouched = true;
          if (f.type === 'general' && !editing) {
            parsed = parseTask(f.title, today); drawParse();
            if (!manualWhen) {
              if (parsed.date) { f.date = parsed.date; multiDays = new Set([parsed.date]); }
              if (parsed.time) { f.time = parsed.time; f.period = periodOfTime(parsed.time, f.date || today); } else if (parsed.period) { f.period = parsed.period; f.time = null; }
              if (parsed.recur) f.recur = parsed.recur;
              if (parsed.due) f.due = parsed.due;
              drawWhen();
            }
          }
        },
        onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } },
      });
      const mic = SR && !editing ? h('button', { type: 'button', class: 'am-mic', 'aria-label': 'احكي المهمة', onclick: () => listen(input) }, icon('mic', 15)) : null;
      parseEl = h('div', { class: 'parse-hint' });
      return h('div', { class: 'f-row' }, h('label', { class: 'f-label' }, f.type === 'general' ? 'الاسم' : 'الاسم (يُملأ من اختيارك)'),
        h('div', { class: 'am-input' }, input, mic), parseEl);
    }
    function drawParse() {
      if (!parseEl) return;
      const bits = parsed ? describeParse(parsed, today) : [];
      fill(parseEl, bits.length ? [h('span', { class: 'ph-k' }, icon('wand', 11), 'فهمت:'), ...bits.map((b) => h('span', { class: 'ph-bit' }, b.t))] : []);
    }
    function whenBox() {
      const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
      const p = periodsFor((multi ? [...multiDays].sort()[0] : f.date) || today);
      const sel = (d) => (multi ? multiDays.has(d) : f.date === d);
      const custom = !multi && f.date && !days.includes(f.date);
      const extra = multi ? [...multiDays].filter((d) => !days.includes(d)) : [];
      return h('div', { class: 'f-row' }, h('label', { class: 'f-label' }, 'متى؟'),
        h('div', { class: 'when-box' },
          !editing ? h('button', { type: 'button', class: `when-multi${multi ? ' on' : ''}`, onclick: () => { multi = !multi; manualWhen = true; if (multi) { multiDays = new Set(f.date ? [f.date] : [today]); f.recur = null; } render(); } },
            h('i', { class: 'mini-switch' }), 'أكتر من يوم', multi ? h('small', null, 'اختار كل الأيام اللي بدك') : null) : null,
          h('div', { class: 'wk-strip' },
            days.map((d, i) => h('button', { type: 'button', class: `wk-d${sel(d) ? ' on' : ''}${i === 0 ? ' td' : ''}`, onclick: () => {
              manualWhen = true;
              if (multi) { if (multiDays.has(d)) multiDays.delete(d); else multiDays.add(d); } else { f.date = d; if (!f.time && !f.period) f.period = suggestPeriod(d); }
              haptic('select'); render();
            } }, h('small', null, i === 0 ? 'اليوم' : WEEK_SHORT[parseISO(d).getDay()]), h('b', null, String(parseISO(d).getDate())))),
            h('button', { type: 'button', class: `wk-d cal${custom || extra.length ? ' on' : ''}`, 'aria-label': 'تاريخ تاني', onclick: () => openDatePicker({ value: multi ? null : f.date, today, onPick: (d) => { if (!d) return; manualWhen = true; if (multi) multiDays.add(d); else f.date = d; render(); } }) },
              icon('calendar', 15), custom ? h('small', null, shortDate(f.date)) : extra.length ? h('small', null, `+${extra.length}`) : null)),
          (f.date || multi || f.recur) ? h('div', { class: 'pr-line' }, PERIODS.map((k) => h('button', {
            type: 'button', class: `pr-seg${f.period === k && !f.time ? ' on' : ''}${f.time && periodOfTime(f.time, f.date || today) === k ? ' has-time' : ''}`, style: { '--sk': PERIOD_SKY[k] },
            onclick: () => { manualWhen = true; f.period = k; f.time = null; haptic('select'); render(); },
          }, h('b', null, SHORT[k]), h('small', null, time12(fromMin(p[k].from)).replace(' ص', '').replace(' م', ''))))) : null,
          h('div', { class: 'when-ex' },
            (f.date || multi || f.recur) ? h('button', { type: 'button', class: `chip-x${f.time ? ' on' : ''}`, onclick: () => openTimePicker({ value: f.time, onPick: (v) => { manualWhen = true; f.time = v; if (v) f.period = periodOfTime(v, f.date || today); render(); } }) }, icon('clock', 12), f.time ? `الساعة ${time12(f.time)}` : 'ساعة محددة') : null,
            f.time ? h('button', { type: 'button', class: 'chip-x', onclick: () => { f.time = null; render(); } }, icon('close', 10), 'بلا ساعة') : null,
            !multi ? h('button', { type: 'button', class: `chip-x${!f.date ? ' on' : ''}`, onclick: () => { manualWhen = true; f.date = null; f.recur = null; render(); } }, icon('inbox', 12), 'بلا موعد') : null,
            !multi ? h('button', { type: 'button', class: `chip-x${f.recur ? ' on' : ''}`, onclick: () => openRecur(f, today, render) }, icon('repeat', 12), f.recur ? RECUR_LABEL(f.recur) : 'تكرار') : null),
          multi ? distBlock() : null));
    }
    function distBlock() {
      const rows = planRows();
      return h('div', { class: 'dist' },
        hasUnits() ? h('div', { class: 'dist-mode' },
          h('button', { type: 'button', class: dist === 'next' ? 'on' : '', onclick: () => { dist = 'next'; render(); } }, `${unitWord(f.type, f.itemId)} جديدة كل يوم`),
          h('button', { type: 'button', class: dist === 'same' ? 'on' : '', onclick: () => { dist = 'same'; render(); } }, 'نفس المهمة كل يوم')) : null,
        rows.length ? h('div', { class: 'dist-prev' }, rows.map((r) => h('div', { class: r.title ? '' : 'miss' },
          h('b', null, r.d === today ? 'اليوم' : r.d === addDays(today, 1) ? 'بكرة' : WEEKDAYS[parseISO(r.d).getDay()]), h('span', null, r.title || 'خلصت الوحدات'), h('small', null, f.time ? time12(f.time) : f.period ? SHORT[f.period] : '')))) : h('p', { class: 'muted' }, 'اختار يوم أو أكتر من الشريط.'));
    }
    function durRow() {
      if (!NEEDS_TIME.has(f.type)) return null;
      const v = f.estimate || 0;
      const label = v >= 60 ? [String(+(v / 60).toFixed(2)).replace(/\.?0+$/, ''), h('small', null, ' ساعة')] : [String(v), h('small', null, ' دقيقة')];
      return h('div', { class: 'f-row' }, h('label', { class: 'f-label' }, multi ? 'المدة المتوقعة لكل يوم' : 'المدة المتوقعة'),
        h('div', { class: 'dur-box' },
          h('button', { type: 'button', class: 'dur-pm', 'aria-label': 'أقل', onclick: () => { f.estimate = Math.max(0, v - 15); render(); } }, icon('minus', 13)),
          h('span', { class: 'dur-v num' }, v ? label : h('small', null, 'بلا')),
          h('button', { type: 'button', class: 'dur-pm', 'aria-label': 'أكتر', onclick: () => { f.estimate = Math.min(600, v + 15); render(); } }, icon('plus', 13)),
          h('span', { class: 'dur-pre' }, [[15, '15د'], [30, '30د'], [60, '1س'], [120, '2س']].map(([m, l]) => h('button', { type: 'button', class: v === m ? 'on' : '', onclick: () => { f.estimate = v === m ? 0 : m; render(); } }, l)))));
    }
    function moreFold() {
      const sumBits = [f.due ? `قبل ${shortDate(f.due)}` : null, f.priority ? 'أساسية' : null, f.remind != null ? 'تذكير' : null, f.checklist.length ? `${f.checklist.length} بنود` : null].filter(Boolean);
      return h('details', { class: 'f-fold', open: editing && (f.checklist.length || f.notes) ? true : null },
        h('summary', null, 'خيارات إضافية', sumBits.length ? h('span', { class: 'fold-bits' }, sumBits.join(' · ')) : h('span', { class: 'fold-hint' }, 'آخر موعد، تذكير، أساسية، قائمة، ملاحظات')),
        h('div', { class: 'fold-body' },
          h('div', { class: 'act-list' },
            optBtn('flag', 'آخر موعد', f.due ? shortDate(f.due) : 'ما في', () => openDatePicker({ value: f.due, today, title: 'لازم تنعمل قبل', allowEmpty: true, emptyLabel: 'بلا موعد نهائي', onPick: (d) => { f.due = d; render(); } })),
            optBtn('bell', 'تذكير', f.remind == null ? 'بلا تذكير' : f.remind === 0 ? 'بوقتها' : `قبلها بـ ${f.remind >= 60 ? `${f.remind / 60} ساعة` : `${f.remind} د`}`, () => openPicker({
              title: 'التذكير', value: f.remind,
              options: [{ value: null, label: 'بلا تذكير' }, { value: 0, label: 'بوقتها' }, { value: 15, label: 'قبل بربع ساعة' }, { value: 60, label: 'قبل بساعة' }, { value: 1440, label: 'قبل بيوم' }],
              onPick: (v) => { f.remind = v; if (v != null && !f.time) toast('حدد ساعة للمهمة مشان يشتغل التذكير.', { kind: 'warn' }); render(); },
            })),
            h('button', { type: 'button', class: `act-btn${f.priority ? ' is-on' : ''}`, onclick: () => { f.priority = f.priority ? 0 : 1; render(); } },
              icon('star', 14), h('span', null, 'مهمة أساسية', h('small', null, f.priority ? 'بتطلع بوسم «أساسية»' : 'عادية')), h('i', { class: 'mini-switch' }))),
          h('label', { class: 'f-label', style: { marginTop: '14px' } }, 'قائمة أغراض أو خطوات'),
          h('div', { class: 'check-list' },
            f.checklist.map((c) => h('div', { class: 'cl-item' },
              h('button', { type: 'button', class: `cl-box${c.done ? ' on' : ''}`, onclick: () => { c.done = !c.done; render(); } }, c.done ? icon('check', 12) : null),
              h('span', { class: c.done ? 'dim' : '' }, c.text),
              h('button', { type: 'button', class: 'cl-x', 'aria-label': 'شيل', onclick: () => { f.checklist = f.checklist.filter((x) => x !== c); render(); } }, icon('close', 12)))),
            h('input', { type: 'text', placeholder: '+ أضف بند (مثلاً: شاحن)', onkeydown: (e) => { if (e.key === 'Enter' && e.target.value.trim()) { e.preventDefault(); f.checklist.push({ id: uid('c'), text: e.target.value.trim(), done: false }); render(); } } })),
          h('label', { class: 'f-label', style: { marginTop: '14px' } }, 'ملاحظات'),
          h('textarea', { rows: 2, placeholder: 'اختياري', oninput: (e) => { f.notes = e.target.value; } }, f.notes)));
    }
    function actions() {
      let label;
      if (editing) label = 'حفظ';
      else if (multi) { const n = planRows().filter((r) => r.title).length; label = n === 1 ? 'أضف مهمة وحدة' : n === 2 ? 'أضف مهمتين' : `أضف ${n} مهام`; }
      else if (!f.date) label = 'أضف للصندوق';
      else {
        const dl = f.date === today ? 'لليوم' : f.date === addDays(today, 1) ? 'لبكرة' : `ليوم ${WEEKDAYS[parseISO(f.date).getDay()]}`;
        label = `أضف ${dl}${f.time ? ` — ${time12(f.time)}` : f.period ? ` — ${SHORT[f.period]}` : ''}`;
      }
      const day = preset.day || editing?.date || today;
      return [
        editing ? h('div', { class: 'am-edit-acts' },
          h('button', { type: 'button', class: 'cw-side', onclick: () => { setDone(editing.id, day, !isDoneOn(editing, day)); close(); } },
            icon(isDoneOn(editing, day) ? 'undo' : 'check', 13), isDoneOn(editing, day) ? 'تراجع عن الإنجاز' : 'تمّت'),
          !editing.recur && editing.date !== addDays(today, 1) ? h('button', { type: 'button', class: 'cw-side', onclick: () => { updateTask(editing.id, { date: addDays(today, 1) }); toast('انتقلت لبكرة'); close(); } }, icon('chevL', 13), 'لبكرة') : null,
          editing.time && (editing.date || editing.recur) ? h('a', { class: 'cw-side', href: googleCalendarUrl(editing, editing.date || today), target: '_blank', rel: 'noopener' }, icon('calendar', 13), 'تقويم جوجل') : null,
          h('button', { type: 'button', class: 'cw-side danger', onclick: () => { close(); setTimeout(() => confirmDelete(editing), 220); } }, icon('trash', 13), 'حذف')) : null,
        h('div', { class: 'am-sticky' },
          h('button', { type: 'button', class: 'btn', style: { flex: 2 }, onclick: () => save() }, icon(editing ? 'check' : 'plus', 15), label),
          h('button', { type: 'button', class: 'btn secondary', style: { flex: 1 }, onclick: () => close() }, 'إلغاء')),
      ];
    }

    function save() {
      if (multi && !editing) return saveMulti();
      let title = (f.title || '').trim();
      let { date, time, period, recur, due, priority, remind } = f;
      let tag = f.type === 'general' ? 'general' : f.type;
      if (f.type === 'general' && !editing && title) {
        const p = parseTask(title, today);
        if (p.title) title = p.title;
        if (!manualWhen) {
          if (p.date) date = p.date;
          if (p.time) { time = p.time; period = periodOfTime(p.time, date || today); } else if (p.period) period = p.period;
          if (p.recur) { recur = p.recur; if (!date) date = today; }
          if (p.due) due = p.due;
        }
        if (p.priority) priority = 1;
        if (p.remind != null && remind == null) remind = p.remind;
        if (p.tag && p.tag !== 'general') tag = p.tag;
      }
      if (editing && f.type === 'general' && editing.tag && !TYPE_ORDER.includes(editing.tag)) tag = editing.tag;
      if (!title && f.itemId) title = autoTitle(f.type, f.itemId, f.unitId);
      if (!title) { toast('اكتب اسم المهمة أو اختار من القائمة.', { kind: 'warn' }); return; }
      const link = f.itemId ? makeLink(f.type, f.itemId, f.unitId) : (editing?.link?.kind === 'penalty' ? editing.link : null);
      const fields = { title, tag, link, estimate: f.estimate || 0, date, time, period: time ? periodOfTime(time, date || today) : period, recur, due, priority, remind, notes: f.notes, checklist: f.checklist };
      haptic('success');
      if (editing) { updateTask(editing.id, fields); toast('انحفظت التعديلات'); close(); return; }
      const t = addTask({ ...fields, goalId: preset.goalId || null, link: link || preset.link || null });
      const where = recur ? RECUR_LABEL(recur) : date ? dayLabel(date, today) : due ? `قبل ${shortDate(due)}` : 'صندوق التراكم';
      toast(`انضافت — ${where}`, { action: 'تراجع', onAction: () => store.update((s) => { s.tasks = s.tasks.filter((x) => x.id !== t.id); }) });
      close();
    }
    function saveMulti() {
      const rows = planRows().filter((r) => r.title);
      if (!rows.length) { toast(multiDays.size ? 'اختار شو بدك تضيف.' : 'اختار يوم أو أكتر.', { kind: 'warn' }); return; }
      const tag = f.type === 'general' ? (parseTask(f.title || '', today).tag || 'general') : f.type;
      const ids = [];
      for (const r of rows) {
        const link = f.itemId ? makeLink(f.type, f.itemId, r.unit?.id || f.unitId) : null;
        const t = addTask({
          title: r.title, tag, link, estimate: f.estimate || 0, date: r.d, time: f.time, period: f.time ? periodOfTime(f.time, r.d) : f.period,
          due: f.due, priority: f.priority, remind: f.remind, notes: f.notes, checklist: f.checklist.map((c) => ({ ...c, id: uid('c') })), goalId: preset.goalId || null,
        });
        ids.push(t.id);
      }
      haptic('success');
      toast(`انضافت ${tasksText(ids.length)} على ${daysText(ids.length)}`, { action: 'تراجع', onAction: () => store.update((s) => { s.tasks = s.tasks.filter((x) => !ids.includes(x.id)); }) });
      close();
    }

    let headBox, whenEl, actBox;
    function drawWhen() {
      if (!whenEl) return;
      fill(whenEl, [whenBox()]);
      fill(headBox, [head()]);
      fill(actBox, actions());
    }
    function render() {
      const keepScroll = body.closest('.sheet')?.scrollTop || 0;
      headBox = h('div'); whenEl = h('div'); actBox = h('div');
      fill(body, [headBox, typeGrid(), libraryArea(), titleRow(), whenEl, durRow(), moreFold(), actBox]);
      drawWhen(); drawParse();
      const sh = body.closest('.sheet'); if (sh) sh.scrollTop = keepScroll;
    }
    render();
  }, { cls: 'task-form' });
}

function optBtn(ic, label, value, onClick) {
  return h('button', { type: 'button', class: 'act-btn', onclick: onClick }, icon(ic, 14), h('span', null, label, h('small', null, value)), icon('chevL', 12));
}

function listen(input) {
  if (!SR) return;
  const rec = new SR();
  rec.lang = 'ar-SY'; rec.interimResults = true; rec.continuous = false;
  const base = input.value ? `${input.value} ` : '';
  input.classList.add('listening');
  rec.onresult = (e) => {
    let t = '';
    for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
    input.value = base + t; input.dispatchEvent(new Event('input'));
  };
  rec.onerror = (e) => { if (e.error === 'not-allowed') toast('لازم تسمح باستعمال المايك.', { kind: 'warn' }); };
  rec.onend = () => input.classList.remove('listening');
  try { rec.start(); haptic('select'); } catch { /* */ }
}

function openRecur(f, today, done) {
  openSheet('التكرار', (body, close) => {
    let days = f.recur?.type === 'weekly' ? [...(f.recur.days || [])] : [];
    const pick = (r) => { f.recur = r; if (r && !f.date) f.date = today; close(); setTimeout(done, 240); };
    function render() {
      fill(body, [
        h('div', { class: 'act-list' },
          [['مرة وحدة', null], ['كل يوم', { type: 'daily' }], ['كل أسبوع بنفس اليوم', { type: 'weekly', days: [parseISO(f.date || today).getDay()] }], ['كل شهر بنفس التاريخ', { type: 'monthly', day: Number((f.date || today).slice(8)) }], ['كل سنة', { type: 'yearly' }]]
            .map(([l, r]) => h('button', { type: 'button', class: 'act-btn', onclick: () => pick(r) }, icon('repeat', 14), h('span', null, l)))),
        h('div', { class: 'sheet-section' }, 'أيام محددة بالأسبوع'),
        h('div', { class: 'chips' }, [6, 0, 1, 2, 3, 4, 5].map((d) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(days.includes(d)), onclick: () => { days = days.includes(d) ? days.filter((x) => x !== d) : [...days, d]; render(); } }, WEEKDAYS[d]))),
        days.length ? h('button', { type: 'button', class: 'btn block', onclick: () => pick({ type: 'weekly', days }) }, 'تمام') : null,
        h('div', { class: 'sheet-section' }, 'مع النوبات (البيت والشغل)'),
        h('div', { class: 'act-list' }, Object.entries(SHIFT_RULES).map(([k, l]) => h('button', { type: 'button', class: 'act-btn', onclick: () => pick({ type: 'shift', when: k }) }, icon(k.includes('Work') || k === 'workDays' ? 'briefcase' : 'house', 14), h('span', null, l)))),
        store.state.settings.shift?.enabled ? null : h('p', { class: 'field-hint', style: { marginTop: '8px' } }, 'فعّل النوبات من الروتين مشان تشتغل هالخيارات.'),
      ]);
    }
    render();
  });
}
