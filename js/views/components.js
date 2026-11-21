// عناصر مشتركة بين الصفحات: صف المهمة، عنوان القسم، نقاط الصلوات
import { h, icon, badge, haptic, toast, swipeable } from '../ui.js';
import { store } from '../store.js';
import { isDoneOn, setDone, moveTask, RECUR_LABEL, TAGS, deleteTask, restoreTask } from '../tasks.js';
import { time12, dayLabel, addDays, shortDate, daysBetween } from '../dates.js';
import { PERIOD_SHORT, PERIOD_SKY } from '../prayer.js';
import { tintHex } from '../icons.js';

export function secTitle(text, { ic, count, action } = {}) {
  return h('div', { class: 'sec-title' },
    h('h2', null, ic ? icon(ic, 17) : null, text, count != null ? h('span', { class: 'count' }, String(count)) : null),
    action || null);
}

// صف مهمة: دائرة الإنجاز، العنوان، تفاصيل صغيرة. السحب يمين = تمّت، يسار = لبكرة
export function taskRow(t, day, { onOpen, showDate = false, today = day, compact = false } = {}) {
  const done = isDoneOn(t, day);
  const tag = TAGS[t.tag] || TAGS.general;
  const meta = [];
  if (t.time) meta.push(h('span', { class: 'tm-time' }, icon('clock', 12), time12(t.time)));
  else if (t.period && showDate === false && compact) meta.push(h('span', null, PERIOD_SHORT[t.period]));
  if (showDate && t.date) meta.push(h('span', { class: t.date < today && !done ? 'bad' : '' }, icon('calendar', 12), dayLabel(t.date, today)));
  if (t.due && !done) {
    const n = daysBetween(today, t.due);
    meta.push(h('span', { class: n <= 2 ? 'warn' : '' }, icon('flag', 12), n === 0 ? 'آخر يوم اليوم' : n > 0 ? `قبل ${shortDate(t.due)}` : 'فات موعدها'));
  }
  if (t.recur) meta.push(h('span', null, icon('repeat', 12), RECUR_LABEL(t.recur)));
  if (t.checklist?.length) meta.push(h('span', null, icon('list', 12), `${t.checklist.filter((c) => c.done).length}/${t.checklist.length}`));
  if (t.notes) meta.push(h('span', null, icon('note', 12)));
  if (t.remind != null && t.time) meta.push(h('span', null, icon('bell', 12)));
  const check = h('button', {
    type: 'button', class: `tcheck${done ? ' on' : ''}`, 'aria-label': done ? 'رجّعها مو منجزة' : 'تمّت',
    style: { '--tint': tintHex(tag.tint) },
    onclick: (e) => { e.stopPropagation(); toggleTask(t, day, row); },
  }, icon('check', 16, { stroke: 2.6 }));
  const row = h('div', {
    class: `trow${done ? ' done' : ''}${t.priority ? ' important' : ''}`, role: 'button', tabindex: '0',
    onclick: () => onOpen?.(t),
    onkeydown: (e) => { if (e.key === 'Enter') onOpen?.(t); },
  },
  check,
  h('div', { class: 'trow-main' },
    h('div', { class: 'trow-title' }, t.priority ? icon('star', 13, { fill: 'currentColor' }) : null, h('span', null, t.title)),
    meta.length ? h('div', { class: 'trow-meta' }, meta) : null),
  t.link?.image ? badge('book', 'slate', 34, t.link.image) : null);
  if (!done) {
    swipeable(row, {
      onRight: () => toggleTask(t, day, row),
      onLeft: t.recur ? null : () => {
        const to = addDays(day < today ? today : day, 1);
        moveTask(t.id, to);
        toast(`انتقلت لـ ${dayLabel(to, today)}`, { action: 'تراجع', onAction: () => moveTask(t.id, t.date) });
      },
    });
  }
  return row;
}

export function toggleTask(t, day, rowEl) {
  const was = isDoneOn(t, day);
  if (!was) {
    haptic('done');
    rowEl?.classList.add('just-done');
    setTimeout(() => {
      setDone(t.id, day, true);
      toast(`تمّت: ${t.title}`, { action: 'تراجع', onAction: () => setDone(t.id, day, false) });
    }, rowEl ? 260 : 0);
  } else {
    setDone(t.id, day, false);
  }
}

export function confirmDelete(t) {
  const copy = deleteTask(t.id);
  if (copy) toast('انحذفت المهمة', { action: 'تراجع', onAction: () => restoreTask(copy) });
}

export function periodDot(key) {
  return h('i', { class: 'pdot', style: { background: PERIOD_SKY[key] } });
}

export function statTile({ ic, tint, label, value, sub, onClick }) {
  return h(onClick ? 'button' : 'div', { class: 'stat-tile', type: onClick ? 'button' : null, onclick: onClick || null },
    badge(ic, tint, 34),
    h('div', null, h('small', null, label), h('b', null, value), sub ? h('span', null, sub) : null));
}

export const tasksState = () => store.state.tasks;
