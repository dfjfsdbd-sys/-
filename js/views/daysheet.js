// ورقة اليوم: كل شي بيخص يوم معيّن (ماضي أو جاي) بمكان واحد، وكله قابل للتعديل
import { h, icon, badge, ring, fill, openSheet, toast, haptic } from '../ui.js';
import { store } from '../store.js';
import { logicalToday, PRAYERS, PRAYER_NAMES, PERIOD_SKY } from '../prayer.js';
import { tasksOn, isDoneOn, sortTasks, dayTaskStats } from '../tasks.js';
import { longDate, hijriDate, dayLabel, addDays, pagesText } from '../dates.js';
import { prayerOn, PRAYER_STATUS, allAdhkarLists, adhkarDone, setAdhkarDone, adhkarSettings, pagesReadOn } from '../worship.js';
import { activeHabits, habitScore, habitOk, scoreLabel, passThreshold } from '../habits.js';
import { dayDetail, inCommitment, setExplicit, invalidateDay, verdictPct } from '../commit.js';
import { shiftOn, SHIFT_NAMES } from '../shifts.js';
import { pointsOn } from '../rewards.js';
import { taskRow } from './components.js';
import { openTaskSheet, openCapture } from './capture.js';
import { openPrayerSheet, openQuranLog, openAdhkar } from './worship.js';
import { openHabitLog } from './habits.js';

export function openDaySheet(day) {
  const today = logicalToday();
  let unsub = null;
  openSheet(dayLabel(day, today), (body, close) => {
    unsub = store.subscribe(() => { if (document.body.contains(body)) render(); });
    function render() {
      const sh = shiftOn(day);
      const det = dayDetail(day);
      const st = dayTaskStats(day, today);
      const list = sortTasks(tasksOn(day), day);
      const past = day < today;
      const pct = det ? verdictPct(det) : null;
      fill(body, [
        h('div', { class: 'ds-head' },
          h('div', null,
            h('strong', null, longDate(day)),
            h('small', null, hijriDate(day), sh ? ` — ${SHIFT_NAMES[sh.kind]} (اليوم ${sh.dayNo} من ${sh.length})` : '')),
          h('div', { class: 'ds-pts' }, h('b', { class: 'num' }, `${pointsOn(day)}`), h('small', null, 'نقطة'))),
        // الصلوات
        h('div', { class: 'ds-prayers' }, PRAYERS.map((k) => {
          const s = prayerOn(day, k);
          return h('button', { type: 'button', class: `ds-pr ${s || ''}`, style: { '--sky': PERIOD_SKY[k] }, onclick: () => openPrayerSheet(day, k) },
            h('span', null, s && s !== 'missed' ? icon('check', 14, { stroke: 2.6 }) : s === 'missed' ? icon('close', 13) : ''),
            h('small', null, PRAYER_NAMES[k]));
        })),
        // التعهّد
        det ? h('div', { class: 'sheet-section' }, `التعهّد — ${det.v === 'done' ? 'يوم مكتمل' : det.v === 'pending' ? 'جاري' : 'ما كمل'} (${Math.round((pct || 0) * 100)}%)`) : null,
        det ? h('div', { class: 'rows sheet-rows' }, det.items.map((x) => h('div', { class: 'row' },
          h('button', {
            type: 'button', class: `tcheck${x.ok ? ' on' : ''}`, 'aria-label': x.ok ? 'ما تحقق' : 'تحقق',
            onclick: () => {
              if (x.kind === 'habit') { openHabitLog(day, x.id); return; }
              if (x.kind === 'adhkar') { setAdhkarDone(day, x.id.slice(7), !x.ok); if (past) invalidateDay(day); return; }
              if (x.kind === 'quran') { openQuranLog(day); return; }
              setExplicit(day, x.id, !x.ok);
            },
          }, icon('check', 15, { stroke: 2.6 })),
          h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, x.name),
            h('span', { class: 'row-sub' }, x.detail || (x.kind === 'habit' && x.score ? `${Math.round(x.score * 100)}% ${scoreLabel(x.score)}` : x.imp === 'secondary' ? 'ثانوي' : 'أساسي'))),
          x.kind === 'prayers' ? null : h('button', { type: 'button', class: 'icon-btn ghost small', 'aria-label': 'فتح', onclick: () => { if (x.kind === 'habit') openHabitLog(day, x.id); else if (x.kind === 'adhkar') openAdhkar(x.id.slice(7), day); else if (x.kind === 'quran') openQuranLog(day); } }, icon('chevL', 16))))) : null,
        // العادات (خارج التعهّد)
        habitsBlock(day, det),
        // الأذكار والقرآن
        h('div', { class: 'sheet-section' }, 'الأذكار والورد'),
        h('div', { class: 'chips' },
          allAdhkarLists().filter((l) => adhkarSettings(l.id).enabled || adhkarDone(day, l.id)).map((l) => h('button', {
            type: 'button', class: 'chip', 'aria-pressed': String(adhkarDone(day, l.id)), onclick: () => { setAdhkarDone(day, l.id, !adhkarDone(day, l.id)); if (past) invalidateDay(day); haptic('select'); },
          }, adhkarDone(day, l.id) ? icon('check', 14) : null, l.short || l.name)),
          h('button', { type: 'button', class: 'chip', 'aria-pressed': String(pagesReadOn(day) > 0), onclick: () => openQuranLog(day) }, icon('quran', 14), pagesReadOn(day) ? `قرآن ${pagesText(pagesReadOn(day))}` : 'قرآن')),
        // المهام
        h('div', { class: 'sheet-section' }, `المهام${st.total ? ` — ${st.done} من ${st.total}` : ''}`),
        list.length ? h('div', { class: 'rows sheet-rows trows' }, list.map((t) => taskRow(t, day, { onOpen: (x) => openTaskSheet(x.id, day), today }))) : h('p', { class: 'muted', style: { padding: '0 4px 8px' } }, past ? 'ما كان في مهام بهاليوم.' : 'ما في مهام لهاليوم بعد.'),
        h('button', { type: 'button', class: 'btn secondary block', onclick: () => openCapture({ date: day }) }, icon('plus', 18), `أضف مهمة لـ ${dayLabel(day, today)}`),
        h('label', { class: 'field', style: { marginTop: '14px' } }, h('span', { class: 'field-label' }, 'ملاحظة اليوم'),
          h('textarea', { rows: 2, placeholder: 'شو صار اليوم؟ شو تعلّمت؟', onchange: (e) => store.update((s) => { s.dayNotes[day] = e.target.value; }, { silent: true }) }, store.state.dayNotes?.[day] || '')),
      ]);
    }
    render();
  }, { tall: true, onClose: () => unsub?.() });
}

function habitsBlock(day, det) {
  const inReq = new Set((det?.items || []).map((x) => x.id));
  const list = activeHabits().filter((hb) => !inReq.has(hb.id));
  if (!list.length) return null;
  return [
    h('div', { class: 'sheet-section' }, 'العادات'),
    h('div', { class: 'rows sheet-rows' }, list.map((hb) => {
      const s = habitScore(day, hb.id);
      return h('button', { type: 'button', class: 'row', onclick: () => openHabitLog(day, hb.id) },
        h('span', { class: `tcheck${habitOk(day, hb.id) ? ' on' : ''}` }, icon('check', 15, { stroke: 2.6 })),
        h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, hb.name), h('span', { class: 'row-sub' }, s == null ? 'ما انقيّمت' : `${Math.round(s * 100)}% ${scoreLabel(s)}`)),
        icon('chevL', 16));
    })),
  ];
}
