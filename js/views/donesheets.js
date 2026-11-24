// شاشات إنجاز حسب نوع المهمة (مش كل شي بدّه مؤقت):
// مهمة عادية ← لوح صغير، قراءة كتاب ← عدّاد صفحات مع مؤقت اختياري، تمرين ← رقم (عدّات أو دقائق).
import { h, icon, fill, openSheet, toast, haptic, bar } from '../ui.js';
import { store } from '../store.js';
import { TAGS, setDone, isDoneOn, updateTask, moveTask, taskById, RECUR_LABEL } from '../tasks.js';
import { dayLabel, addDays, time12, shortDate } from '../dates.js';
import { PERIOD_NAMES } from '../prayer.js';
import { tintHex } from '../icons.js';
import { addWorkout, WORKOUT_TYPES } from '../sport.js';
import { logPages } from './books.js';
import { confirmDelete } from './components.js';

const avatar = (ic, c, img) => h('span', { class: 'ds-av', style: { '--c': c } }, img ? h('img', { src: img, alt: '' }) : icon(ic, 24));

/* ---------- مهمة عادية: تمّت / لبكرة / تعديل ---------- */
export function openSimpleDone(t, day, { onEdit, onFocus } = {}) {
  openSheet(null, (body, close) => {
    function render() {
      const x = taskById(t.id) || t;
      const tag = TAGS[x.tag] || TAGS.general;
      const c = tintHex(tag.tint);
      const done = isDoneOn(x, day);
      const when = [x.date ? dayLabel(x.date, day) : 'بلا موعد', x.time ? time12(x.time) : x.period ? PERIOD_NAMES[x.period] : null, tag.name].filter(Boolean).join(' · ');
      fill(body, [
        h('div', { class: 'ds-head' }, avatar(tag.icon, c, x.link?.image),
          h('div', null, h('h3', null, x.title), h('small', null, when), x.recur ? h('small', null, icon('repeat', 10), ' ', RECUR_LABEL(x.recur)) : null)),
        x.checklist?.length ? h('div', { class: 'ds-cl' }, x.checklist.map((cl) => h('button', { type: 'button', class: `ds-cli${cl.done ? ' on' : ''}`, onclick: () => { updateTask(x.id, (tt) => ({ checklist: tt.checklist.map((y) => (y.id === cl.id ? { ...y, done: !y.done } : y)) })); render(); } },
          h('i', null, cl.done ? icon('check', 11) : null), h('span', null, cl.text)))) : null,
        h('textarea', { class: 'ds-notes', rows: 2, placeholder: 'ملاحظات (اختياري)', onchange: (e) => updateTask(x.id, { notes: e.target.value }) }, x.notes || ''),
        h('button', { type: 'button', class: `ds-done${done ? ' undo' : ''}`, onclick: () => {
          setDone(x.id, day, !done); haptic(done ? 'tap' : 'done');
          if (!done) toast(`تمّت: ${x.title}`, { action: 'تراجع', onAction: () => setDone(x.id, day, false) });
          close();
        } }, icon(done ? 'undo' : 'check', 16), done ? 'تراجع عن الإنجاز' : 'تمّت'),
        h('div', { class: 'ds-row' },
          !done && !x.recur ? h('button', { type: 'button', class: 'btn secondary', onclick: () => { const from = x.date; moveTask(x.id, addDays(day, 1)); toast('انتقلت لبكرة', { action: 'تراجع', onAction: () => moveTask(x.id, from) }); close(); } }, icon('chevL', 13), 'لبكرة') : null,
          onEdit ? h('button', { type: 'button', class: 'btn secondary', onclick: () => { close(); setTimeout(onEdit, 240); } }, icon('pen', 13), 'تعديل') : null,
          h('button', { type: 'button', class: 'btn secondary ds-del', 'aria-label': 'حذف', onclick: () => { close(); setTimeout(() => confirmDelete(x), 240); } }, icon('trash', 14))),
        onFocus && !done ? h('button', { type: 'button', class: 'link-btn ds-focus', onclick: () => { close(); setTimeout(onFocus, 240); } }, icon('stopwatch', 12), 'بدّك مؤقت تركيز؟') : null,
      ]);
    }
    render();
  }, { cls: 'ds-sheet' });
}

/* ---------- قراءة كتاب: وصلت لأي صفحة، مع مؤقت اختياري ---------- */
export function openReadingDone(t, day) {
  const b = store.state.books.find((x) => x.id === t.link?.itemId);
  if (!b) { openSimpleDone(t, day); return; }
  const startAt = b.pagesRead || 0;
  const goal = t.pages || Math.max(5, Math.round((t.estimate || 30) / 1.5));
  let to = startAt;
  let sec = 0, timer = 0, last = 0, running = false;
  openSheet(null, (body, close) => {
    const c = tintHex(b.color || 'brown');
    const timeEl = h('b', { class: 'num' }, '00:00');
    const playBtn = h('button', { type: 'button', class: 'rd-play', 'aria-label': 'مؤقت', onclick: () => toggle() }, icon('play', 14));
    function tick() { const now = Date.now(); const dt = Math.floor((now - last) / 1000); if (dt < 1) return; last += dt * 1000; sec += dt; timeEl.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`; }
    function toggle() { running = !running; if (running) { last = Date.now(); timer = setInterval(tick, 300); } else clearInterval(timer); fill(playBtn, [icon(running ? 'pause' : 'play', 14)]); }
    const valEl = h('b', { class: 'num' });
    const progWrap = h('div');
    function draw() {
      const read = Math.max(0, to - startAt);
      valEl.textContent = String(to);
      fill(progWrap, [bar(Math.min(1, read / goal), { cls: 'big', color: c }), h('p', { class: 'rd-sub' }, `قرأت ${read} من ${goal} صفحة اليوم`)]);
    }
    const set = (v) => { to = Math.max(startAt, Math.min(b.totalPages || 9999, v)); haptic('select'); draw(); };
    fill(body, [
      h('div', { class: 'rd-wrap', style: { '--c': c } },
        h('div', { class: 'ds-head' }, avatar(b.icon || 'book', c, b.image), h('div', null, h('h3', null, b.name), h('small', null, `وصلت لصفحة ${startAt}${b.totalPages ? ` من ${b.totalPages}` : ''} · ورد اليوم ${goal} صفحة`))),
        h('div', { class: 'rd-counter' },
          h('button', { type: 'button', class: 'rd-pm', onclick: () => set(to - 1) }, icon('minus', 16)),
          h('div', { class: 'rd-val' }, valEl, h('small', null, 'وصلت لصفحة')),
          h('button', { type: 'button', class: 'rd-pm', onclick: () => set(to + 1) }, icon('plus', 16))),
        h('div', { class: 'rd-quick' }, [5, 10, 20].map((n) => h('button', { type: 'button', onclick: () => set(to + n) }, `+${n}`)), h('button', { type: 'button', onclick: () => set(startAt + goal) }, 'خلّصت الورد')),
        progWrap,
        h('div', { class: 'rd-timer' }, icon('stopwatch', 14), timeEl, playBtn, h('small', null, 'مؤقت اختياري')),
        h('button', { type: 'button', class: 'ds-done', style: { background: c }, onclick: () => {
          clearInterval(timer);
          const n = to > startAt ? logPages(b.id, day, to, sec) : 0;
          if (n > 0 || sec > 60) { setDone(t.id, day, true); haptic('success'); toast(n ? `سجّلنا ${n} صفحة` : 'انسجّلت الجلسة'); close(); }
          else toast('حرّك العدّاد للصفحة اللي وصلتلها.', { kind: 'warn' });
        } }, icon('check', 16), 'سجّل القراءة')),
    ]);
    draw();
  }, { cls: 'ds-sheet', onClose: () => clearInterval(timer) });
}

/* ---------- تمرين: عدّات أو دقائق ---------- */
export function openWorkoutDone(t, day) {
  const type = t.link?.itemId || 'home';
  const prevVal = Object.values(t.log || {}).map((x) => x?.score).filter((v) => typeof v === 'number').pop();
  let unit = t.unit || 'reps';
  let val = typeof prevVal === 'number' ? prevVal : (unit === 'min' ? 30 : 20);
  openSheet(null, (body, close) => {
    const c = tintHex('coral');
    function render() {
      const step = unit === 'min' ? 5 : 5;
      fill(body, [
        h('div', { class: 'ds-head' }, avatar(WORKOUT_TYPES[type]?.icon || 'dumbbell', c), h('div', null, h('h3', null, t.title), h('small', null, WORKOUT_TYPES[type]?.name || 'تمرين'))),
        h('div', { class: 'seg' },
          h('button', { type: 'button', 'aria-pressed': String(unit === 'reps'), onclick: () => { unit = 'reps'; render(); } }, 'عدّات'),
          h('button', { type: 'button', 'aria-pressed': String(unit === 'min'), onclick: () => { unit = 'min'; render(); } }, 'دقائق')),
        h('div', { class: 'rd-counter' },
          h('button', { type: 'button', class: 'rd-pm', onclick: () => { val = Math.max(0, val - step); render(); } }, icon('minus', 16)),
          h('div', { class: 'rd-val' }, h('b', { class: 'num' }, String(val)), h('small', null, unit === 'min' ? 'دقيقة' : 'عدّة')),
          h('button', { type: 'button', class: 'rd-pm', onclick: () => { val += step; render(); } }, icon('plus', 16))),
        typeof prevVal === 'number' ? h('p', { class: 'rd-sub', style: { textAlign: 'center' } }, `آخر مرة: ${prevVal}`) : null,
        h('button', { type: 'button', class: 'ds-done', style: { background: c }, onclick: () => {
          if (!val) { toast('حدد الرقم.', { kind: 'warn' }); return; }
          updateTask(t.id, { unit });
          setDone(t.id, day, true, { score: val });
          if (unit === 'min') addWorkout(day, { type, minutes: val, title: t.title });
          haptic('success'); toast(`انسجّل: ${val} ${unit === 'min' ? 'دقيقة' : 'عدّة'}`); close();
        } }, icon('check', 16), 'سجّل'),
      ]);
    }
    render();
  }, { cls: 'ds-sheet' });
}
export { shortDate };
