// نافذة الحدث: نوعه، اسمه، يومه (والسفر من — لـ)، ساعته، وتذكير
import { h, icon, fill, openSheet, toast, haptic, openDatePicker, openTimePicker } from '../ui.js';
import { logicalToday } from '../prayer.js';
import { dayLabel, shortDate, WEEKDAYS, parseISO, time12, addDays } from '../dates.js';
import { EVENT_KINDS, addEvent, updateEvent, deleteEvent, restoreEvent, eventById } from '../events.js';

const dayName = (d) => `${WEEKDAYS[parseISO(d).getDay()]} ${shortDate(d)}`;

export function openEventForm(id = null, preset = {}) {
  const today = logicalToday();
  const ex = id ? eventById(id) : null;
  const f = ex ? { ...ex } : { kind: preset.kind || 'appt', title: '', date: preset.date || today, endDate: null, time: null, remind: 1440, notes: '' };
  openSheet(ex ? 'تعديل الحدث' : 'حدث جديد', (body, close) => {
    function render() {
      const k = EVENT_KINDS[f.kind] || EVENT_KINDS.other;
      fill(body, [
        h('div', { class: 'f-row' }, h('label', { class: 'f-label' }, 'نوع الحدث'),
          h('div', { class: 'ev-kinds' }, Object.entries(EVENT_KINDS).filter(([key]) => key !== 'exam').map(([key, v]) => h('button', {
            type: 'button', class: `ev-k${f.kind === key ? ' on' : ''}`, style: { '--c': v.color }, onclick: () => { f.kind = key; if (key !== 'trip') f.endDate = null; haptic('select'); render(); },
          }, icon(v.icon, 16), h('span', null, v.name))))),
        h('div', { class: 'f-row' }, h('label', { class: 'f-label' }, 'الاسم'),
          h('input', { type: 'text', value: f.title, 'data-autofocus': !ex ? true : null, placeholder: { appt: 'مثلاً: طبيب الأسنان', occasion: 'مثلاً: عرس ابن عمي', trip: 'مثلاً: سفر لحلب', other: 'شو الحدث؟' }[f.kind] || '', oninput: (e) => { f.title = e.target.value; } })),
        h('div', { class: 'f-row' }, h('label', { class: 'f-label' }, f.kind === 'trip' ? 'من — لـ' : 'متى؟'),
          h('div', { class: 'when-ex' },
            h('button', { type: 'button', class: 'chip-x on', onclick: () => openDatePicker({ value: f.date, today, onPick: (d) => { if (d) { f.date = d; if (f.endDate && f.endDate < d) f.endDate = null; render(); } } }) }, icon('calendar', 12), dayName(f.date)),
            f.kind === 'trip' ? h('button', { type: 'button', class: `chip-x${f.endDate ? ' on' : ''}`, onclick: () => openDatePicker({ value: f.endDate || addDays(f.date, 2), today: f.date, title: 'لأي يوم؟', onPick: (d) => { if (d && d >= f.date) { f.endDate = d; render(); } } }) }, icon('calendar', 12), f.endDate ? `لـ ${dayName(f.endDate)}` : 'لأي يوم؟') : null,
            f.kind !== 'trip' ? h('button', { type: 'button', class: `chip-x${f.time ? ' on' : ''}`, onclick: () => openTimePicker({ value: f.time, onPick: (v) => { f.time = v; render(); } }) }, icon('clock', 12), f.time ? time12(f.time) : 'الساعة (اختياري)') : null)),
        h('div', { class: 'f-row' }, h('label', { class: 'f-label' }, 'تذكير'),
          h('div', { class: 'chips' }, [[null, 'بلا'], [0, 'بنفس اليوم'], [1440, 'قبل بيوم'], [10080, 'قبل بأسبوع']].map(([v, l]) => h('button', { type: 'button', class: 'chip small', 'aria-pressed': String(f.remind === v), onclick: () => { f.remind = v; render(); } }, l)))),
        h('div', { class: 'f-row' }, h('label', { class: 'f-label' }, 'ملاحظات'), h('textarea', { rows: 2, placeholder: 'اختياري', oninput: (e) => { f.notes = e.target.value; } }, f.notes || '')),
        h('div', { class: 'am-sticky' },
          h('button', { type: 'button', class: 'btn', style: { flex: 2, background: k.color, color: '#0b0b0f' }, onclick: save }, icon('check', 15), ex ? 'احفظ' : `أضف ${dayLabel(f.date, today)}`),
          ex ? h('button', { type: 'button', class: 'btn danger', style: { flex: 1 }, onclick: () => { const cp = deleteEvent(ex.id); close(); toast('انحذف الحدث', { action: 'تراجع', onAction: () => restoreEvent(cp) }); } }, icon('trash', 14), 'حذف')
            : h('button', { type: 'button', class: 'btn secondary', style: { flex: 1 }, onclick: () => close() }, 'إلغاء')),
      ]);
    }
    function save() {
      const title = (f.title || '').trim() || (EVENT_KINDS[f.kind]?.name || 'حدث');
      const data = { kind: f.kind, title, date: f.date, endDate: f.kind === 'trip' ? f.endDate : null, time: f.kind === 'trip' ? null : f.time, remind: f.remind, notes: f.notes || '' };
      if (ex) updateEvent(ex.id, data); else addEvent(data);
      haptic('success'); toast(ex ? 'انحفظ الحدث' : `انضاف الحدث — ${dayLabel(f.date, today)}`); close();
    }
    render();
  }, { cls: 'task-form' });
}
