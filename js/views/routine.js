// روتيني حسب النوبة: قائمة لأيام البيت وقائمة لأيام الشغل. بتعملها مرة وحدة،
// والتطبيق بيحطّ بنودها لحالها بالأيام الجاية حسب نوبتك.
import { h, icon, fill, openSheet, toast, haptic, openTimePicker, stepper } from '../ui.js';
import { store } from '../store.js';
import { logicalToday, PERIODS, PERIOD_SKY, PERIOD_SHORT, periodsFor } from '../prayer.js';
import { addDays, WEEKDAYS, WEEK_SHORT, WEEK_START, parseISO, time12, fromMin } from '../dates.js';
import { TAGS } from '../tasks.js';
import { tintHex } from '../icons.js';
import { SHIFT_NAMES } from '../shifts.js';
import { libItems, unitsFor, itemProgress } from '../libitems.js';
import {
  ROUTINE_TYPES, AUTO_SUBJECT, HORIZON, shiftsEnabled, kindOn, routineItems, itemLabel, newRoutineItem,
  saveRoutineItem, deleteRoutineItem, restoreRoutineItem, copyRoutine, routineTasksOn,
} from '../routine.js';
import { secTitle } from './components.js';

let tab = null;
export const routineTab = () => (shiftsEnabled() ? tab || 'home' : 'home');
const KIND_IC = { home: 'house', work: 'briefcase' };
const daysText = (days) => (!days?.length || days.length === 7 ? 'كل يوم' : [...days].sort((a, b) => ((a - WEEK_START + 7) % 7) - ((b - WEEK_START + 7) % 7)).map((d) => WEEKDAYS[d]).join('، '));
const isUnitType = (t) => ['study', 'self', 'series'].includes(t);

function itemColor(it) {
  if (it.type === 'study' && it.itemId === AUTO_SUBJECT) return tintHex(TAGS.study.tint);
  const li = libItems(it.type).find((x) => x.id === it.itemId);
  return li?.color ? tintHex(li.color) : tintHex((TAGS[it.type] || TAGS.general).tint);
}
function itemSub(it) {
  const bits = [];
  if (isUnitType(it.type) || (it.type === 'book' && unitsFor('book', it.itemId))) bits.push('بتاخد التالية لحالها');
  else bits.push(TAGS[it.type]?.name || 'عامة');
  if (it.type === 'self' || it.type === 'series') { const se = store.state.series.find((x) => x.id === it.itemId); if (se) bits.push(se.mode === 'notes' || (!se.mode && se.kind === 'self') ? 'مع تدوين' : 'سماع'); }
  bits.push(daysText(it.days));
  if (it.estimate) bits.push(it.estimate >= 60 ? `${+(it.estimate / 60).toFixed(1)} س` : `${it.estimate} د`);
  return bits.join(' · ');
}

export function renderRoutine(ctx) {
  const today = ctx.today;
  const tomorrow = addDays(today, 1);
  const shifts = shiftsEnabled();
  if (!shifts) tab = 'home';
  else if (!tab) tab = kindOn(tomorrow);
  const list = [...routineItems(tab)].sort((a, b) => PERIODS.indexOf(a.period) - PERIODS.indexOf(b.period));
  const other = tab === 'home' ? 'work' : 'home';
  const tk = kindOn(tomorrow);
  const tmr = routineTasksOn(tomorrow);
  const week = Array.from({ length: HORIZON }, (_, i) => addDays(today, i + 1));
  return h('div', { class: 'rt-page' },
    h('p', { class: 'rt-intro' }, shifts
      ? 'بتعمل القائمتين مرة وحدة. التطبيق بيحطّ البنود لحالها بأيامك حسب نوبتك — أسبوع لقدّام — وبنود المكتبة بتاخد «التالية» لحالها.'
      : 'بتعمل القائمة مرة وحدة، والتطبيق بيحطّ بنودها لحالها بأيامك — أسبوع لقدّام — وبنود المكتبة بتاخد «التالية» لحالها.'),
    shifts ? h('div', { class: 'rt-tabs' }, ['home', 'work'].map((k) => h('button', {
      type: 'button', class: `${k === 'home' ? 'h' : 'w'}${tab === k ? ' on' : ''}`, onclick: () => { tab = k; haptic('select'); ctx.refresh(); },
    }, icon(KIND_IC[k], 14), k === 'home' ? 'أيام البيت' : 'أيام الشغل', h('small', { class: 'num' }, String(routineItems(k).length))))) : null,
    list.length ? h('div', { class: 'rt-list' }, list.map((it) => {
      const c = itemColor(it);
      const tg = TAGS[it.type] || TAGS.general;
      return h('button', { type: 'button', class: `rti${it.off ? ' off' : ''}`, style: { '--c': c }, onclick: () => openRoutineItem(tab, it.id) },
        h('span', { class: 'ic' }, icon(tg.icon, 16)),
        h('span', { class: 'in' }, h('b', null, itemLabel(it)), h('small', null, itemSub(it))),
        h('span', { class: 'when', style: { '--sk': PERIOD_SKY[it.period] || 'var(--ink3)' } }, it.time ? time12(it.time) : PERIOD_SHORT[it.period] || 'بأي وقت'));
    })) : h('div', { class: 'rt-empty' }, icon(KIND_IC[tab], 22),
      h('b', null, shifts ? `ما في بنود لـ${tab === 'home' ? 'أيام البيت' : 'أيام الشغل'} لسّا` : 'ما عملت روتينك لسّا'),
      h('small', null, tab === 'work' ? 'بأيام الشغل خلّيه أخف: ورد صغير ومحاضرة وحدة مثلاً.' : 'مثلاً: محاضرتين بالصباح، 20 صفحة بعد العصر، حلقة فقه نفس بعد المغرب.')),
    h('div', { class: 'rt-adds' },
      h('button', { type: 'button', class: 'addl', onclick: () => openRoutineItem(tab, null) }, icon('plus', 13), shifts ? `بند ${tab === 'home' ? 'للبيت' : 'للشغل'}` : 'بند جديد'),
      shifts && !list.length && routineItems(other).length ? h('button', { type: 'button', class: 'addl ghost', onclick: () => { const n = copyRoutine(other, tab); toast(`انسخت ${routineItems(tab).length} بنود${n ? ` · انضافت ${n} مهام` : ''} — عدّلها على كيفك`); } }, icon('copy', 13), `انسخ روتين ${tab === 'home' ? 'الشغل' : 'البيت'} كبداية`) : null),

    secTitle(`بكرة (${WEEKDAYS[parseISO(tomorrow).getDay()]}${shifts ? ` — ${SHIFT_NAMES[tk]}` : ''}) رح ينضاف`, { ic: 'calendar-day' }),
    tmr.length ? h('div', { class: 'rt-prev' }, tmr.map((t) => {
      const tg = TAGS[t.tag] || TAGS.general;
      return h('div', { class: 'rt-pv', style: { '--c': tintHex(tg.tint) } }, icon(tg.icon, 12), h('span', null, t.title), h('small', null, t.time ? time12(t.time) : PERIOD_SHORT[t.period] || ''));
    })) : h('div', { class: 'rt-prev empty' }, routineItems(tk).length ? 'ولا شي — يا خلصت وحدات المكتبة، يا البنود مش لهاليوم.' : `ما في بنود لـ${tk === 'home' ? 'أيام البيت' : 'أيام الشغل'}.`),
    h('div', { class: 'rt-week' }, week.map((d) => {
      const k = kindOn(d);
      const n = routineTasksOn(d).length;
      return h('span', { class: `rw ${shifts ? k : ''}` }, h('small', null, WEEK_SHORT[parseISO(d).getDay()]), h('b', { class: 'num' }, String(parseISO(d).getDate())), h('em', null, n ? `${n}` : '—'));
    })),
    h('p', { class: 'rt-foot' }, 'المهمة اللي بتحذفها من يومها ما بترجع. وأي تعديل بالروتين بيمشي من بكرة.'));
}

/* ---------- نافذة البند ---------- */
export function openRoutineItem(kind, id = null) {
  const today = logicalToday();
  const ex = id ? routineItems(kind).find((x) => x.id === id) : null;
  const f = ex ? JSON.parse(JSON.stringify(ex)) : newRoutineItem(kind);
  let fromToday = false;
  openSheet(null, (body, close) => {
    function setType(t) {
      if (f.type === t) return;
      f.type = t; f.itemId = t === 'study' ? AUTO_SUBJECT : null; f.title = '';
      f.estimate = { study: 60, book: 30, self: 45, series: 45, sport: 30, general: 30, break: 15 }[t] || 30;
      haptic('select'); render();
    }
    function render() {
      const p = periodsFor(today);
      const big = ['study', 'book', 'self', 'series'].includes(f.type);
      const items = f.type === 'study' ? [{ id: AUTO_SUBJECT, name: 'الأقرب للامتحان', icon: 'bolt' }, ...libItems('study')] : libItems(f.type);
      const pagesBook = f.type === 'book' && f.itemId && !unitsFor('book', f.itemId);
      const unitBook = f.type === 'book' && f.itemId && unitsFor('book', f.itemId);
      const word = f.type === 'study' ? 'محاضرة' : f.type === 'book' ? 'درس' : 'حلقة';
      fill(body, [
        h('div', { class: 'am-title' },
          h('h3', null, icon(ex ? 'pen' : 'plus', 14), ex ? 'تعديل بند الروتين' : `بند ${kind === 'home' ? 'لأيام البيت' : 'لأيام الشغل'}`,
            h('button', { type: 'button', class: 'am-x', 'aria-label': 'إغلاق', onclick: () => close() }, icon('close', 16))),
          h('small', null, 'بينضاف لحاله بكل يوم بيناسبه')),
        h('div', { class: 'f-row' }, h('label', { class: 'f-label' }, 'النوع'),
          h('div', { class: 'ty-grid' }, ROUTINE_TYPES.map((k) => {
            const tg = TAGS[k];
            return h('button', { type: 'button', class: `ty${f.type === k ? ' on' : ''}`, style: { '--c': tintHex(tg.tint) }, onclick: () => setType(k) },
              h('span', { class: 'ty-ic' }, icon(tg.icon, 20)), h('span', { class: 'ty-nm' }, tg.name));
          }))),
        f.type === 'general' || f.type === 'break' ? null : h('div', { class: 'f-row' },
          h('label', { class: 'f-label' }, { study: 'المادة', book: 'الكتاب', self: 'السلسلة', series: 'السلسلة', sport: 'نوع التمرين' }[f.type]),
          !items.length ? h('p', { class: 'pick-empty' }, 'ما في شي بهالقسم بالمكتبة لسّا. أضفه من المكتبة أول.')
            : big ? h('div', { class: 'it-row' }, items.map((it) => {
              const pr = it.id === AUTO_SUBJECT ? null : itemProgress(f.type, it.id);
              const c = it.color ? tintHex(it.color) : tintHex(TAGS[f.type].tint);
              return h('button', { type: 'button', class: `it-card${f.itemId === it.id ? ' on' : ''}`, style: { '--c': c }, onclick: () => { f.itemId = it.id; haptic('select'); render(); } },
                h('span', { class: 'it-im' }, it.image ? h('img', { src: it.image, alt: '', loading: 'lazy' }) : icon(it.icon, 26)),
                h('b', null, it.name), it.id === AUTO_SUBJECT ? h('small', null, 'بتتغيّر لحالها') : pr ? h('small', null, `${Math.round(pr.pct * 100)}% · ${pr.n}`) : null);
            })) : h('div', { class: 'pick-pool' }, items.map((it) => h('button', {
              type: 'button', class: `chip-choice${f.itemId === it.id ? ' selected' : ''}`, style: { '--tc': tintHex(TAGS[f.type].tint) }, onclick: () => { f.itemId = f.itemId === it.id ? null : it.id; render(); },
            }, icon(it.icon, 16), h('span', null, it.name))))),
        (isUnitType(f.type) || unitBook) && f.itemId ? h('div', { class: 'f-row' }, h('label', { class: 'f-label' }, `كم ${word} باليوم؟`),
          h('div', { class: 'rt-count' }, [1, 2, 3].map((n) => h('button', { type: 'button', class: (f.count || 1) === n ? 'on' : '', onclick: () => { f.count = n; render(); } }, n === 1 ? `${word} وحدة` : n === 2 ? (f.type === 'study' ? 'محاضرتين' : f.type === 'book' ? 'درسين' : 'حلقتين') : `3 ${f.type === 'study' ? 'محاضرات' : f.type === 'book' ? 'دروس' : 'حلقات'}`))),
          h('small', { class: 'f-hint' }, 'كل يوم بتنحط التالية اللي ما خلصتها وما إلها مهمة.')) : null,
        pagesBook ? h('div', { class: 'f-row' }, h('label', { class: 'f-label' }, 'كم صفحة باليوم؟'),
          h('div', { class: 'row' }, h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, 'الورد')), stepper(f.pages || 20, (v) => { f.pages = v; }, { min: 2, max: 200, step: 2, suffix: ' ص' }))) : null,
        f.type === 'general' || f.type === 'break' || f.type === 'sport' ? h('div', { class: 'f-row' }, h('label', { class: 'f-label' }, f.type === 'sport' ? 'الاسم (اختياري)' : 'الاسم'),
          h('input', { type: 'text', value: f.title || '', placeholder: { general: 'مثلاً: ترتيب الغرفة', break: 'استراحة', sport: 'مثلاً: مشي نص ساعة' }[f.type], oninput: (e) => { f.title = e.target.value; } })) : null,
        h('div', { class: 'f-row' }, h('label', { class: 'f-label' }, 'بأي فترة؟'),
          h('div', { class: 'pr-line' }, PERIODS.map((k) => h('button', {
            type: 'button', class: `pr-seg${f.period === k && !f.time ? ' on' : ''}`, style: { '--sk': PERIOD_SKY[k] },
            onclick: () => { f.period = k; f.time = null; haptic('select'); render(); },
          }, h('b', null, PERIOD_SHORT[k]), h('small', null, time12(fromMin(p[k].from)).replace(' ص', '').replace(' م', ''))))),
          h('div', { class: 'when-ex' },
            h('button', { type: 'button', class: `chip-x${f.time ? ' on' : ''}`, onclick: () => openTimePicker({ value: f.time, onPick: (v) => { f.time = v || null; render(); } }) }, icon('clock', 12), f.time ? `الساعة ${time12(f.time)}` : 'ساعة محددة'),
            f.time ? h('button', { type: 'button', class: 'chip-x', onclick: () => { f.time = null; render(); } }, icon('close', 10), 'بلا ساعة') : null)),
        h('div', { class: 'f-row' }, h('label', { class: 'f-label' }, 'بأي أيام؟'),
          h('div', { class: 'rt-days' },
            h('button', { type: 'button', class: !f.days?.length ? 'on all' : 'all', onclick: () => { f.days = []; render(); } }, 'كل يوم'),
            Array.from({ length: 7 }, (_, i) => (WEEK_START + i) % 7).map((wd) => h('button', {
              type: 'button', class: f.days?.includes(wd) ? 'on' : '',
              onclick: () => { const s = new Set(f.days || []); if (s.has(wd)) s.delete(wd); else s.add(wd); f.days = s.size === 7 ? [] : [...s]; haptic('select'); render(); },
            }, WEEK_SHORT[wd])))),
        h('div', { class: 'f-row' }, h('label', { class: 'f-label' }, 'المدة المتوقعة'),
          h('div', { class: 'dur-box' },
            h('button', { type: 'button', class: 'dur-pm', 'aria-label': 'أقل', onclick: () => { f.estimate = Math.max(0, (f.estimate || 0) - 15); render(); } }, icon('minus', 13)),
            h('span', { class: 'dur-v num' }, f.estimate ? (f.estimate >= 60 ? [String(+(f.estimate / 60).toFixed(2)).replace(/\.?0+$/, ''), h('small', null, ' ساعة')] : [String(f.estimate), h('small', null, ' دقيقة')]) : h('small', null, 'بلا')),
            h('button', { type: 'button', class: 'dur-pm', 'aria-label': 'أكتر', onclick: () => { f.estimate = Math.min(600, (f.estimate || 0) + 15); render(); } }, icon('plus', 13)),
            h('span', { class: 'dur-pre' }, [[15, '15د'], [30, '30د'], [60, '1س'], [120, '2س']].map(([m, l]) => h('button', { type: 'button', class: f.estimate === m ? 'on' : '', onclick: () => { f.estimate = m; render(); } }, l))))),
        ex ? h('button', { type: 'button', class: `act-btn${f.off ? ' is-on' : ''}`, onclick: () => { f.off = !f.off; render(); } },
          icon('pause', 14), h('span', null, 'وقّفه مؤقتاً', h('small', null, f.off ? 'موقّف — ما رح ينضاف' : 'شغّال')), h('i', { class: 'mini-switch' }))
          : h('button', { type: 'button', class: `act-btn${fromToday ? ' is-on' : ''}`, onclick: () => { fromToday = !fromToday; render(); } },
            icon('bolt', 14), h('span', null, 'بلّش من اليوم', h('small', null, fromToday ? `بينضاف اليوم كمان إذا ${kindOn(today) === kind || !shiftsEnabled() ? 'بيناسبه' : 'كان يومك من نفس النوبة'}` : 'من بكرة')), h('i', { class: 'mini-switch' })),
        h('div', { class: 'am-sticky' },
          h('button', { type: 'button', class: 'btn', style: { flex: 2 }, onclick: save }, icon('check', 15), ex ? 'احفظ' : 'أضف للروتين'),
          ex ? h('button', { type: 'button', class: 'btn danger', style: { flex: 1 }, onclick: () => {
            const cp = deleteRoutineItem(kind, ex.id); close();
            toast('انحذف البند (ومهامه الجاية)', { action: 'تراجع', onAction: () => restoreRoutineItem(cp) });
          } }, icon('trash', 14), 'حذف') : h('button', { type: 'button', class: 'btn secondary', style: { flex: 1 }, onclick: () => close() }, 'إلغاء')),
      ]);
    }
    function save() {
      if (!['general', 'break'].includes(f.type) && f.type !== 'sport' && !f.itemId) { toast('اختار من المكتبة أول.', { kind: 'warn' }); return; }
      if (f.type === 'general' && !(f.title || '').trim()) { toast('اكتب اسم البند.', { kind: 'warn' }); return; }
      if (!f.period && !f.time) f.period = 'morning';
      if (!ex && fromToday) f.since = today;
      const n = saveRoutineItem(kind, f);
      haptic('success');
      close();
      toast(ex ? `انحفظ — بيمشي من بكرة${n ? ` · ${n} مهام` : ''}` : `انضاف للروتين${n ? ` · ${n} مهام بالأسبوع الجاي` : ''}`);
    }
    render();
  }, { cls: 'task-form' });
}
