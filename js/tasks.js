// المهام: إضافة، إنجاز وتراجع، تكرار، ومن يظهر بأي يوم
import { store, uid } from './store.js';
import { addDays, daysBetween, parseISO, weekday } from './dates.js';
import { matchesShiftRule } from './shifts.js';
import { award, revoke, POINTS } from './rewards.js';
import { PERIODS, periodOfTime } from './prayer.js';

// أنواع المهام (نفس ألوان وأيقونات النسخة الأولى)
export const TAGS = {
  general: { name: 'عامة', icon: 'pen', tint: 'slate' },
  study: { name: 'دراسة', icon: 'grad', tint: 'sky' },
  book: { name: 'كتب', icon: 'book', tint: 'brown' },
  worship: { name: 'عبادات', icon: 'mosque', tint: 'mint' },
  self: { name: 'فقه النفس', icon: 'spa', tint: 'violet' },
  series: { name: 'سلاسل', icon: 'clapper', tint: 'rose' },
  sport: { name: 'رياضة', icon: 'dumbbell', tint: 'coral' },
  behavior: { name: 'سلوك', icon: 'compass', tint: 'sage' },
  break: { name: 'استراحة', icon: 'mug', tint: 'sage' },
  work: { name: 'شغل', icon: 'briefcase', tint: 'amber' },
  errand: { name: 'مشاوير وأغراض', icon: 'bag', tint: 'amber' },
  health: { name: 'صحة', icon: 'pill', tint: 'rose' },
  family: { name: 'أهل وبيت', icon: 'house', tint: 'blue' },
  marriage: { name: 'تجهيز الزواج', icon: 'ring', tint: 'dawn' },
};
// الأنواع اللي بتطلع بشاشة الإضافة، بنفس ترتيب النسخة الأولى
export const TYPE_ORDER = ['general', 'study', 'book', 'worship', 'self', 'series', 'sport', 'behavior', 'break'];

export function newTask(fields = {}) {
  return {
    id: uid('t'), title: '', notes: '', date: null, time: null, period: null, due: null,
    recur: null, recurEnd: null, done: false, doneAt: null, log: {}, skip: {},
    checklist: [], remind: null, priority: 0, tag: 'general', link: null,
    estimate: 0, spent: 0, goalId: null, createdAt: Date.now(),
    ...fields,
  };
}

export function addTask(fields) {
  const t = newTask(fields);
  store.update((s) => { s.tasks.push(t); });
  return t;
}
export function updateTask(id, patch) {
  store.update((s) => { const t = s.tasks.find((x) => x.id === id); if (t) Object.assign(t, typeof patch === 'function' ? patch(t) || {} : patch); });
}
export function deleteTask(id) {
  const t = store.state.tasks.find((x) => x.id === id);
  if (!t) return null;
  const copy = JSON.parse(JSON.stringify(t));
  store.update((s) => { s.tasks = s.tasks.filter((x) => x.id !== id); });
  revokeAll(id);
  return copy;
}
export function restoreTask(copy) { store.update((s) => { s.tasks.push(copy); }); }
const taskById = (id) => store.state.tasks.find((x) => x.id === id);
export { taskById };

function revokeAll(id) {
  for (const e of [...store.state.rewards.ledger]) if (e.k.startsWith(`task:${id}`)) revoke(e.k);
}

/* ---------- التكرار ---------- */
export const RECUR_LABEL = (r) => {
  if (!r) return '';
  switch (r.type) {
    case 'daily': return 'كل يوم';
    case 'weekly': return (r.days?.length === 7 || !r.days?.length) ? 'كل يوم' : `كل ${r.days.map((d) => ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'][d]).join('، ')}`;
    case 'monthly': return `كل شهر يوم ${r.day}`;
    case 'every': return `كل ${r.n} أيام`;
    case 'shift': return ({ lastHome: 'قبل كل نوبة شغل', firstWork: 'أول يوم بكل نوبة شغل', lastWork: 'آخر يوم بالشغل', firstHome: 'أول يوم بالبيت', homeDays: 'أيام البيت', workDays: 'أيام الشغل' })[r.when] || 'مع النوبات';
    case 'yearly': return 'كل سنة';
    default: return 'متكرّرة';
  }
};

export function occursOn(t, day) {
  if (!t.recur) return t.date === day;
  const start = t.date || (t.createdAt ? null : null);
  if (start && day < start) return false;
  if (t.recurEnd && day > t.recurEnd) return false;
  if (t.skip?.[day]) return false;
  const r = t.recur;
  switch (r.type) {
    case 'daily': return true;
    case 'weekly': return !r.days?.length || r.days.includes(weekday(day));
    case 'monthly': return parseISO(day).getDate() === Number(r.day);
    case 'every': return start ? daysBetween(start, day) % Math.max(1, r.n) === 0 : true;
    case 'shift': return matchesShiftRule(day, r.when);
    case 'yearly': return start ? day.slice(5) === start.slice(5) : false;
    default: return false;
  }
}

export function isDoneOn(t, day) {
  if (t.recur) return Boolean(t.log?.[day]?.done);
  return Boolean(t.done);
}

// المهام اللي بتخص يوم: موعدها فيه، أو المتكررة المستحقة
export function tasksOn(day) {
  return store.state.tasks.filter((t) => occursOn(t, day));
}
// المتأخرة: لها تاريخ قبل اليوم وما انعملت (غير المتكرّرة)
export function overdue(today) {
  return store.state.tasks.filter((t) => !t.recur && !t.done && t.date && t.date < today);
}
export function inbox() {
  return store.state.tasks.filter((t) => !t.recur && !t.done && !t.date);
}
// مواعيد نهائية قادمة: «لازم قبل 7 الشهر»
export function deadlines(today, days = 45) {
  return store.state.tasks
    .filter((t) => !t.done && t.due && t.due >= today && daysBetween(today, t.due) <= days)
    .sort((a, b) => a.due.localeCompare(b.due));
}

// فترة المهمة: المحددة، أو المستنتجة من ساعتها (8 المسا ← بعد العشاء)
export function periodOf(t, day) {
  if (t.time) return periodOfTime(t.time, day || t.date || new Date().toISOString().slice(0, 10));
  if (t.period && PERIODS.includes(t.period)) return t.period;
  return null;
}

/* ---------- الإنجاز ---------- */
export function setDone(id, day, done = true, { score = null } = {}) {
  const t = taskById(id);
  if (!t) return;
  const key = `task:${id}${t.recur ? `:${day}` : ''}`;
  store.update((s) => {
    const x = s.tasks.find((y) => y.id === id);
    if (!x) return;
    if (x.recur) {
      x.log = x.log || {};
      if (done) x.log[day] = { done: true, at: Date.now(), score };
      else delete x.log[day];
    } else {
      x.done = done;
      x.doneAt = done ? Date.now() : null;
      x.doneDay = done ? day : null;
      if (done && x.checklist?.length) x.checklist.forEach((c) => { c.done = true; });
    }
    // مهمة خطوة بمشروع: الخطوة بتنعلّم معها
    if (x.link?.kind === 'project') {
      const st = (s.projects || []).find((p) => p.id === x.link.itemId)?.phases.flatMap((ph) => ph.steps).find((z) => z.id === x.link.unitId);
      if (st) { st.done = done; st.doneAt = done ? day : null; }
    }
  });
  if (done) award(key, t.priority ? POINTS.taskImportant : POINTS.task, t.title, day);
  else revoke(key);
}

// تأجيل لبكرة أو لتاريخ
export function moveTask(id, toDay) {
  updateTask(id, (t) => {
    if (t.recur) return {};
    return { date: toDay };
  });
}

export function toggleCheck(id, checkId) {
  store.update((s) => {
    const t = s.tasks.find((x) => x.id === id);
    const c = t?.checklist?.find((x) => x.id === checkId);
    if (c) c.done = !c.done;
  });
}

// إحصاء يوم: كم مهمة وكم انعمل (للمنحنيات والتقويم)
export function dayTaskStats(day, today) {
  let total = 0, done = 0;
  for (const t of store.state.tasks) {
    if (occursOn(t, day)) {
      total += 1;
      if (t.recur ? t.log?.[day]?.done : (t.done && (t.doneDay ? t.doneDay === day || day >= today : true))) done += 1;
    } else if (!t.recur && t.done && t.doneDay === day && t.date !== day) {
      // مهمة متأخرة انعملت بهاليوم: بتنحسب إله
      total += 1; done += 1;
    }
  }
  return { total, done };
}

export function sortTasks(list, day) {
  const rank = (t) => (isDoneOn(t, day) ? 1 : 0);
  return [...list].sort((a, b) => rank(a) - rank(b)
    || (b.priority || 0) - (a.priority || 0)
    || (a.time || '99').localeCompare(b.time || '99')
    || (a.createdAt || 0) - (b.createdAt || 0));
}

export const nextDay = (d) => addDays(d, 1);
