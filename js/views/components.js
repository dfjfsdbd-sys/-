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
// نفس بطاقة صفحة المهام: شريط بلون النوع، الصورة إن وجدت، الوقت، ودائرة الإنجاز
export function taskRow(t, day, { onOpen, showDate = false, today = day } = {}) {
  const done = isDoneOn(t, day);
  const tag = TAGS[t.tag] || TAGS.general;
  const c = tintHex(tag.tint);
  const sep = () => h('i', { class: 'task-meta-sep' });
  const meta = [h('span', { class: 'task-tag' }, tag.name)];
  if (showDate && t.date) meta.push(sep(), h('span', { class: t.date < today && !done ? 'bad-txt' : '' }, dayLabel(t.date, today)));
  if (t.time) meta.push(sep(), h('span', { class: 'task-meta-num' }, icon('clock', 12), time12(t.time)));
  else if (t.period) meta.push(sep(), h('span', null, PERIOD_SHORT[t.period]));
  if (t.estimate && !t.time) meta.push(sep(), h('span', { class: 'task-meta-num' }, t.estimate >= 60 ? `${+(t.estimate / 60).toFixed(1)} س` : `${t.estimate} د`));
  if (t.due && !done) {
    const n = daysBetween(today, t.due);
    meta.push(sep(), h('span', { class: n <= 2 ? 'warn-txt' : '' }, icon('flag', 11), n === 0 ? 'آخر يوم اليوم' : n > 0 ? `قبل ${shortDate(t.due)}` : 'فات موعدها'));
  }
  if (t.recur) meta.push(sep(), h('span', null, icon('repeat', 11), RECUR_LABEL(t.recur)));
  if (t.checklist?.length) meta.push(sep(), h('span', null, icon('list', 11), `${t.checklist.filter((x) => x.done).length}/${t.checklist.length}`));
  const check = h('button', {
    type: 'button', class: `tc-check${done ? ' on' : ''}`, 'aria-label': done ? 'رجّعها مو منجزة' : 'تمّت',
    onclick: (e) => { e.stopPropagation(); toggleTask(t, day, row); },
  }, icon('check', 18));
  const row = h('div', {
    class: `task-card compact${done ? ' is-done' : ''}`, role: 'button', tabindex: '0',
    style: { '--task-accent': c, '--card-tint': `color-mix(in srgb, ${c} 10%, transparent)` },
    onclick: () => onOpen?.(t),
    onkeydown: (e) => { if (e.key === 'Enter') onOpen?.(t); },
  },
  t.link?.image ? h('span', { class: 'task-avatar' }, h('img', { src: t.link.image, alt: '', loading: 'lazy' })) : null,
  h('div', { class: 'task-info' },
    h('div', { class: 'task-title' }, h('span', null, t.title), t.priority ? h('span', { class: 'core-badge' }, 'أساسية') : null),
    h('div', { class: 'task-meta-preview' }, meta)),
  check);
  if (!done) {
    swipeable(row, {
      onLeft: () => toggleTask(t, day, row),
      onRight: t.recur ? null : () => {
        const to = addDays(day < today ? today : day, 1);
        const from = t.date;
        moveTask(t.id, to);
        toast(`انتقلت لـ ${dayLabel(to, today)}`, { action: 'تراجع', onAction: () => moveTask(t.id, from) });
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

// بطاقة عنصر بصورته (مادة، سلسلة، كتاب): غلاف فوق، الاسم، سطر صغير، وشريط
export function itemCard({ tint, ic, image, title, sub, pct, tag, tagCls = 'warn', onClick }) {
  const c = tintHex(tint);
  return h('button', { type: 'button', class: 'icard', style: { '--c': c }, onclick: onClick },
    h('span', { class: `ic-cov${image ? ' img' : ''}` },
      image ? h('img', { src: image, alt: '', loading: 'lazy' }) : icon(ic, 30),
      tag ? h('span', { class: `ic-tag ${tagCls}` }, tag) : null),
    h('span', { class: 'ic-bd' },
      h('b', null, title),
      sub ? h('small', null, sub) : null,
      pct != null ? h('span', { class: 'ic-bar' }, h('span', { class: 'ic-tr' }, h('i', { style: { width: `${Math.round(Math.min(1, pct) * 100)}%` } })), h('em', { class: 'num' }, `${Math.round(Math.min(1, pct) * 100)}%`)) : null));
}
