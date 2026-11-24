// العناية (بتطلع بس إذا اختارت «بنت» بملفها): روتين البشرة صبح وليل، الحمام بالأسبوع،
// الجلسات (متل الليزر) بأرقامها ومواعيدها، المواعيد الدورية (تنظيف، إزالة شعر…)، ورفّ المنتجات.
import { store, uid } from './store.js';
import { logicalToday } from './prayer.js';
import { addDays, daysBetween, weekday, weekStartOf } from './dates.js';
import { award } from './rewards.js';

export const isFemale = () => (store.state.settings.gender || store.state.sport?.profile?.sex) === 'female';
const S = (name, note = '', icon = 'droplet') => ({ id: uid('cs'), name, note, icon, days: [] });
function defaults() {
  return {
    am: [S('غسول', 'غسول لطيف', 'pump-soap'), S('سيروم', '', 'droplet'), S('مرطب', 'مرطب نهاري', 'jar'), S('واقي شمس', 'قبل الطلعة بربع ساعة', 'umbrella')],
    pm: [S('غسول', '', 'pump-soap'), S('مرطب ليلي', '', 'jar')],
    log: {}, products: [], baths: { perWeek: 4, log: {} }, sessions: [], recurring: [],
  };
}
export const care = () => store.state.care || null;
export function ensureCare() { if (!store.state.care) store.update((s) => { s.care = defaults(); }); return store.state.care; }
function withCare(fn, silent = false) { store.update((s) => { s.care = s.care || defaults(); fn(s.care); }, { silent }); }

/* ---------- الروتين ---------- */
export const stepsFor = (slot, day) => (care()?.[slot] || []).filter((x) => !x.days?.length || x.days.includes(weekday(day)));
export const doneSteps = (slot, day) => care()?.log?.[day]?.[slot] || [];
export function toggleStep(slot, day, id) {
  let on = false;
  withCare((c) => {
    c.log[day] = c.log[day] || { am: [], pm: [] };
    const set = new Set(c.log[day][slot] || []);
    if (set.has(id)) set.delete(id); else { set.add(id); on = true; }
    c.log[day][slot] = [...set];
  });
  const all = stepsFor(slot, day);
  if (on && all.length && all.every((x) => doneSteps(slot, day).includes(x.id))) award(`care:${day}:${slot}`, 3, slot === 'am' ? 'روتين الصبح' : 'روتين الليل', day);
  return on;
}
export function routineState(slot, day) { const all = stepsFor(slot, day); const d = doneSteps(slot, day); return { total: all.length, done: all.filter((x) => d.includes(x.id)).length }; }
export function saveStep(slot, step) { withCare((c) => { const i = c[slot].findIndex((x) => x.id === step.id); if (i >= 0) c[slot][i] = { ...c[slot][i], ...step }; else c[slot].push({ id: uid('cs'), days: [], icon: 'droplet', ...step }); }); }
export function deleteStep(slot, id) { withCare((c) => { c[slot] = c[slot].filter((x) => x.id !== id); }); }

/* ---------- الحمام ---------- */
export function bathsThisWeek(today = logicalToday()) {
  const ws = weekStartOf(today);
  return Object.keys(care()?.baths?.log || {}).filter((d) => d >= ws && d <= today).length;
}
export const lastBath = () => Object.keys(care()?.baths?.log || {}).sort().pop() || null;
export function toggleBath(day) { withCare((c) => { c.baths.log = c.baths.log || {}; if (c.baths.log[day]) delete c.baths.log[day]; else c.baths.log[day] = true; }); }
export function setBathTarget(n) { withCare((c) => { c.baths.perWeek = n; }); }

/* ---------- الجلسات (ليزر…) ---------- */
export function saveSession(x) { withCare((c) => { const i = c.sessions.findIndex((y) => y.id === x.id); if (i >= 0) c.sessions[i] = { ...c.sessions[i], ...x }; else c.sessions.push({ id: uid('se'), done: [], every: 28, total: 8, next: null, ...x }); }); }
export function deleteSession(id) { withCare((c) => { c.sessions = c.sessions.filter((x) => x.id !== id); }); }
export function sessionDone(id, day) {
  withCare((c) => { const x = c.sessions.find((y) => y.id === id); if (!x) return; x.done = [...(x.done || []), day]; x.next = x.done.length < x.total ? addDays(day, x.every || 28) : null; });
}
export function undoSession(id) { withCare((c) => { const x = c.sessions.find((y) => y.id === id); if (!x || !x.done?.length) return; const last = x.done.pop(); x.next = last; }); }

/* ---------- المواعيد الدورية ---------- */
export function saveRecurring(x) { withCare((c) => { const i = c.recurring.findIndex((y) => y.id === x.id); if (i >= 0) c.recurring[i] = { ...c.recurring[i], ...x }; else c.recurring.push({ id: uid('cr'), every: 30, last: null, ...x }); }); }
export function deleteRecurring(id) { withCare((c) => { c.recurring = c.recurring.filter((x) => x.id !== id); }); }
export function recurringDone(id, day) { withCare((c) => { const x = c.recurring.find((y) => y.id === id); if (x) x.last = day; }); }
export const recurringNext = (x) => (x.last ? addDays(x.last, x.every || 30) : null);

/* ---------- المنتجات ---------- */
export function saveProduct(x) { withCare((c) => { const i = c.products.findIndex((y) => y.id === x.id); if (i >= 0) c.products[i] = { ...c.products[i], ...x }; else c.products.push({ id: uid('cp'), when: 'both', ...x }); }); }
export function deleteProduct(id) { withCare((c) => { c.products = c.products.filter((x) => x.id !== id); }); }

// شو مستحق اليوم (لصفحة اليوم)
export function careDue(day = logicalToday()) {
  const c = care();
  if (!c || !isFemale()) return [];
  const out = [];
  for (const slot of ['am', 'pm']) { const st = routineState(slot, day); if (st.total) out.push({ kind: 'care', slot, ...st }); }
  for (const x of c.sessions || []) if (x.next && x.next <= day && (x.done || []).length < x.total) out.push({ kind: 'care-session', x });
  for (const x of c.recurring || []) { const n = recurringNext(x); if (n && n <= day) out.push({ kind: 'care-rec', x }); }
  return out;
}
export { daysBetween };
