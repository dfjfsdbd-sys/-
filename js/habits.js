// العادات والسلوك: امتناع (ترك إدمان الهاتف) أو بناء (غض البصر، تمارين)، بتقييم يومي بالنسبة
import { store, uid } from './store.js';
import { award, revoke, POINTS } from './rewards.js';
import { addDays, weekStartOf, weekDates } from './dates.js';

export const HABIT_KINDS = { abstain: 'امتناع (أترك شي)', build: 'بناء عادة', measure: 'رقم يومي (ساعات، أكواب…)' };
// درجات التقييم: الوصف يتبع حدّ النجاح
export const SCORE_STEPS = [1, 0.85, 0.7, 0.6, 0.5, 0];

export function passThreshold() {
  const v = Number(store.state.commitment?.passThreshold ?? store.state.settings.passThreshold);
  return v > 0 && v <= 1 ? v : 0.6;
}
export function scoreLabel(s) {
  const th = passThreshold();
  if (s >= 1) return 'ممتاز';
  if (s >= 0.85 && s >= th) return 'جيد جداً';
  if (s >= 0.7 && s >= th) return 'جيد';
  if (s >= th) return 'مقبول';
  return s > 0 ? 'دون الحدّ' : 'ما التزمت';
}

export const activeHabits = () => store.state.habits.filter((h) => !h.archived);
export const habitById = (id) => store.state.habits.find((h) => h.id === id);

export function habitEntry(day, id) { return store.state.habitLog?.[day]?.[id] || null; }
// درجة اليوم 0..1 (null = ما انسجل)
export function habitScore(day, id) {
  const e = habitEntry(day, id);
  if (!e) return null;
  if (typeof e.score === 'number') return e.score;
  if (typeof e.value === 'number') {
    const h = habitById(id);
    if (h?.limit) return h.direction === 'atLeast' ? Math.min(1, e.value / h.limit) : (e.value <= h.limit ? 1 : Math.max(0, 1 - (e.value - h.limit) / h.limit));
  }
  return e.done ? 1 : 0;
}
export const habitOk = (day, id) => { const s = habitScore(day, id); return s != null && s >= passThreshold(); };

export function logHabit(day, id, entry) {
  store.update((s) => {
    s.habitLog[day] = s.habitLog[day] || {};
    if (entry == null) delete s.habitLog[day][id];
    else s.habitLog[day][id] = { ...entry, at: Date.now() };
  });
  const k = `habit:${day}:${id}`;
  revoke(k);
  if (entry && habitOk(day, id)) award(k, POINTS.habit, habitById(id)?.name || 'عادة', day);
}

export function addHabit(fields) {
  const h = { id: uid('hb'), name: '', kind: 'build', note: '', icon: 'leaf', color: 'mint', core: false, level: 'essential', rhythm: { type: 'daily' }, group: 'behavior', createdAt: Date.now(), ...fields };
  store.update((s) => { s.habits.push(h); });
  return h;
}

// هل العادة مطلوبة هاليوم؟ (اليومية دائماً، والأسبوعية لحد ما يكمل العدد)
export function habitDueOn(h, day) {
  if (h.archived) return false;
  const r = h.rhythm || { type: 'daily' };
  if (r.type !== 'weekly') return true;
  const done = weekDates(weekStartOf(day)).filter((d) => d < day && habitOk(d, h.id)).length;
  return done < (r.times || 3) || Boolean(habitEntry(day, h.id));
}

export function habitStreak(id, today) {
  let n = 0;
  let d = habitOk(today, id) ? today : addDays(today, -1);
  for (let i = 0; i < 1000; i++) { if (habitOk(d, id)) { n += 1; d = addDays(d, -1); } else break; }
  return n;
}
export function habitDaysOk(id, from, to) {
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) if (habitOk(d, id)) n += 1;
  return n;
}
