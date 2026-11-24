// لوح الصبح: أول فتحة بعد الفجر، إذا في مهام من الأيام الماضية ما خلصت بيسألك شو تعمل فيها،
// وبيذكّرك بشو قلت مبارح إنك بدك تصلّح. مرة وحدة باليوم.
import { h, icon, fill, openSheet, toast, haptic, sheetOpen } from '../ui.js';
import { store } from '../store.js';
import { logicalToday } from '../prayer.js';
import { addDays, dayLabel, WEEKDAYS, parseISO } from '../dates.js';
import { overdue, tasksOn, updateTask, deleteTask, restoreTask, TAGS } from '../tasks.js';
import { tintHex } from '../icons.js';
import { muhasabaOf } from './muhasaba.js';
import { PERIOD_NAMES, periodsFor } from '../prayer.js';
import { toMin } from '../dates.js';
import { wakeLog, setWake, clearWake, wakeStreak } from '../sleep.js';

const KEY = 'manz:morning';
// أول مهمة باليوم حسب المحطات والوقت
function firstOf(list, today) {
  const p = periodsFor(today);
  const key = (t) => (t.time ? toMin(t.time) : t.period ? p[t.period]?.from ?? 9999 : 9999);
  return [...list].sort((a, b) => key(a) - key(b))[0];
}

export function maybeMorningPrompt() {
  const today = logicalToday();
  try { if (localStorage.getItem(KEY) === today) return; } catch { return; }
  const od = overdue(today);
  const fix = muhasabaOf(addDays(today, -1))?.fix;
  if (!od.length && !fix && wakeLog(today)) { try { localStorage.setItem(KEY, today); } catch { /* */ } return; }
  if (sheetOpen()) return;
  try { localStorage.setItem(KEY, today); } catch { /* */ }
  openMorning(today, od, fix);
}

function openMorning(today, od, fix) {
  const choice = Object.fromEntries(od.map((t) => [t.id, 'today']));
  const askWake = !wakeLog(today);
  openSheet(null, (body, close) => {
    function render() {
      const todayList = tasksOn(today);
      const wl = wakeLog(today);
      const streak = wakeStreak(today);
      fill(body, [
        h('div', { class: 'mo-hero' },
          h('span', { class: 'mo-sun' }, icon('sunrise', 24)),
          h('div', null, h('h3', null, 'صباح الخير، يا رب يومك مبارك'),
            h('p', null, od.length ? `عندك ${od.length} ${od.length === 1 ? 'مهمة' : 'مهام'} من قبل ما خلصوا` : 'يوم جديد'))),
        askWake ? h('div', { class: `mo-wake${wl ? (wl.fajr ? ' ok' : ' no') : ''}` },
          h('span', { class: 'mw-ic' }, icon('cloud-sun', 15)),
          h('span', { class: 'mw-t' }, h('b', null, 'صحيت عالفجر؟'),
            h('small', null, wl ? (wl.fajr ? (streak > 1 ? `ما شاء الله — ${streak} أيام ورا بعض` : 'الحمد لله، انسجلت') : 'ولا يهمك، الليلة نام بكّير شوي') : 'بيتسجّل بسجل نومك — وإذا ضغطت غلط اضغط عليه مرة تانية')),
          // الضغط على الجواب المختار مرة تانية بيلغيه (إذا ضغطت غلط)
          h('button', { type: 'button', class: `mo-opt${wl?.fajr === true ? ' on' : ''}`, onclick: () => { if (wl?.fajr === true) clearWake(today); else { setWake(today, true); haptic('success'); } render(); } }, 'إي'),
          h('button', { type: 'button', class: `mo-opt${wl?.fajr === false ? ' on' : ''}`, onclick: () => { if (wl?.fajr === false) clearWake(today); else { setWake(today, false); haptic('select'); } render(); } }, 'لا')) : null,
        fix ? h('div', { class: 'mo-fix' }, icon('arrow-trend-up', 14), h('span', null, h('b', null, 'قلت مبارح بدك تصلّح: '), fix)) : null,
        od.length ? h('div', { class: 'mo-list' }, od.map((t) => {
          const tag = TAGS[t.tag] || TAGS.general;
          const opt = (v, label) => h('button', { type: 'button', class: `mo-opt${choice[t.id] === v ? ' on' : ''}${v === 'del' ? ' del' : ''}`, onclick: () => { choice[t.id] = v; haptic('select'); render(); } }, label);
          return h('div', { class: 'mo-od', style: { '--c': tintHex(tag.tint) } },
            h('div', { class: 'mo-in' }, h('b', null, t.title), h('small', null, `كانت ${dayLabel(t.date, today)}${t.period ? ` · ${PERIOD_NAMES[t.period]}` : ''}`)),
            h('div', { class: 'mo-opts' }, opt('today', 'لليوم'), opt('tomorrow', 'بكرة'), opt('del', icon('trash', 12))));
        })) : null,
        od.length > 1 ? h('div', { class: 'mo-bulk' },
          h('button', { type: 'button', class: 'btn secondary small', onclick: () => { od.forEach((t) => { choice[t.id] = 'today'; }); render(); } }, icon('angles-down', 13), 'كلهم لليوم'),
          h('button', { type: 'button', class: 'btn secondary small', onclick: () => { od.forEach((t) => { choice[t.id] = 'spread'; }); apply(); } }, icon('shuffle', 13), 'وزّعهم عالأسبوع')) : null,
        h('div', { class: 'mo-today' }, todayList.length
          ? ['واليوم عندك ', h('b', null, todayList.length === 1 ? 'مهمة وحدة' : todayList.length === 2 ? 'مهمتين' : `${todayList.length} مهام`), '، أولها ', h('b', null, firstOf(todayList, today).title), '.']
          : 'واليوم لسّا فاضي — حطّله شي من زر الإضافة، أو اعمل روتينك مرة وحدة من «الروتين».'),
        h('button', { type: 'button', class: 'btn block', onclick: apply }, 'تمام، يلّا'),
      ]);
    }
    function apply() {
      const removed = [];
      // التوزيع: كل مهمة لأقل يوم فيه مهام خلال الأسبوع
      const load = Object.fromEntries(Array.from({ length: 7 }, (_, i) => addDays(today, i)).map((d) => [d, tasksOn(d).length]));
      for (const t of od) {
        const c = choice[t.id];
        if (c === 'today') updateTask(t.id, { date: today });
        else if (c === 'tomorrow') updateTask(t.id, { date: addDays(today, 1) });
        else if (c === 'del') { const cp = deleteTask(t.id); if (cp) removed.push(cp); }
        else if (c === 'spread') {
          const d = Object.entries(load).sort((a, b) => a[1] - b[1])[0][0];
          load[d] += 1;
          updateTask(t.id, { date: d });
        }
      }
      haptic('success');
      close();
      if (removed.length) toast(`انحذفت ${removed.length}`, { action: 'تراجع', onAction: () => removed.forEach(restoreTask) });
      else if (od.length) toast('ترتّبت مهامك');
    }
    render();
  }, { cls: 'mo-sheet' });
}
export { WEEKDAYS, parseISO };
