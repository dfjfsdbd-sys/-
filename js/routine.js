// الروتين حسب النوبة: قائمة لأيام البيت وقائمة لأيام الشغل.
// كل بند بفترته، والتطبيق بيحطّه لحاله كمهمة بالأيام الجاية (أسبوع لقدّام) حسب نوبة كل يوم.
// بنود المكتبة (مادة، سلسلة، كتاب بدروس) بتاخد «الوحدة التالية» لحالها وما بتتكرّر.
import { store, uid } from './store.js';
import { addDays, weekday } from './dates.js';
import { shiftOn } from './shifts.js';
import { logicalToday } from './prayer.js';
import { newTask } from './tasks.js';
import { unitsFor, plannedUnits, makeLink, autoTitle, itemName } from './libitems.js';

export const HORIZON = 7;
export const ROUTINE_TYPES = ['study', 'book', 'self', 'series', 'sport', 'general', 'break'];
export const AUTO_SUBJECT = 'auto';

export const shiftsEnabled = () => Boolean(store.state.settings.shift?.enabled);
export const kindOn = (d) => (shiftsEnabled() ? shiftOn(d)?.kind || 'home' : 'home');
export const routineItems = (kind) => store.state.routines?.[kind] || [];
export const hasRoutine = () => routineItems('home').length + routineItems('work').length > 0;

// هل البند بيطلع بهاليوم؟
export function itemOn(it, d) {
  if (it.off) return false;
  if (it.since && d < it.since) return false;
  if (it.days?.length && !it.days.includes(weekday(d))) return false;
  return true;
}

// «المادة الأقرب للامتحان»: أقرب امتحان جاي وماله محاضرات ناقصة، وإلا المادة اللي فيها أكتر ناقص
const pendingLecs = (sj, planned) => (sj.lectures || []).filter((u) => !u.done && (u.mastery || 0) < 100 && !planned?.has(u.id)).length;
export function autoSubject(d, planned = null) {
  const s = store.state;
  const subs = (s.subjects || []).filter((x) => !x.archived);
  const exams = (s.exams || []).filter((e) => e.subjectId && e.date >= d).sort((a, b) => a.date.localeCompare(b.date));
  for (const e of exams) { const sj = subs.find((x) => x.id === e.subjectId); if (sj && pendingLecs(sj, planned)) return sj.id; }
  return subs.map((x) => [x.id, pendingLecs(x, planned)]).filter(([, n]) => n).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

// الوحدة التالية الجديدة فقط (ما منكرّر وحدة إلها مهمة مخطّطة)
function nextFresh(units, planned) {
  const fresh = (u) => !u.done && !planned.has(u.id) && (u.mastery || 0) < 100;
  return units.find((u) => fresh(u) && !(u.mastery > 0)) || units.find(fresh) || null;
}

// اسم البند كما بيبين بالقائمة
export function itemLabel(it) {
  const n = Math.max(1, it.count || 1);
  if (it.type === 'general' || it.type === 'break') return it.title || (it.type === 'break' ? 'استراحة' : 'مهمة');
  if (it.type === 'sport') return it.title || itemName('sport', it.itemId) || 'تمرين';
  if (it.type === 'study' && it.itemId === AUTO_SUBJECT) return `${n === 1 ? 'محاضرة' : n === 2 ? 'محاضرتين' : `${n} محاضرات`} من المادة الأقرب للامتحان`;
  const name = itemName(it.type, it.itemId) || 'محذوف من المكتبة';
  if (it.type === 'book' && !unitsFor('book', it.itemId)) return `${name} — ${it.pages || 20} صفحة`;
  const w = it.type === 'study' ? ['محاضرة', 'محاضرتين', 'محاضرات'] : it.type === 'book' ? ['درس', 'درسين', 'دروس'] : ['حلقة', 'حلقتين', 'حلقات'];
  return `${name} — ${n === 1 ? w[0] : n === 2 ? w[1] : `${n} ${w[2]}`}`;
}

// مهام بند بيوم معيّن
function buildTasks(it, d, kind, planned) {
  const s = store.state;
  const base = { date: d, period: it.period || null, time: it.time || null, tag: it.type, estimate: it.estimate || 0, fromRoutine: { rid: it.id, kind } };
  if (it.type === 'general' || it.type === 'break') return [newTask({ ...base, title: itemLabel(it) })];
  if (it.type === 'sport') return [newTask({ ...base, title: itemLabel(it), link: makeLink('sport', it.itemId) })];
  // «الأقرب للامتحان»: كل محاضرة من المادة الأقرب اللي إلها محاضرات ما انحجزت
  if (it.type === 'study' && it.itemId === AUTO_SUBJECT) {
    const out = [];
    for (let i = 0; i < Math.max(1, it.count || 1); i++) {
      const sid = autoSubject(d, planned);
      const u = sid ? nextFresh(unitsFor('study', sid), planned) : null;
      if (!u) break;
      planned.add(u.id);
      out.push(newTask({ ...base, title: autoTitle('study', sid, u.id), link: makeLink('study', sid, u.id) }));
    }
    return out;
  }
  const itemId = it.itemId;
  if (!itemId) return [];
  const units = unitsFor(it.type, itemId);
  if (it.type === 'book' && !units) {
    const b = s.books.find((x) => x.id === itemId);
    if (!b || (b.totalPages && (b.pagesRead || 0) >= b.totalPages)) return [];
    return [newTask({ ...base, title: `${b.name}: ${it.pages || 20} صفحة`, link: makeLink('book', itemId), pages: it.pages || 20 })];
  }
  if (!units?.length) return [];
  const out = [];
  for (let i = 0; i < Math.max(1, it.count || 1); i++) {
    const u = nextFresh(units, planned);
    if (!u) break;
    planned.add(u.id);
    out.push(newTask({ ...base, title: autoTitle(it.type, itemId, u.id), link: makeLink(it.type, itemId, u.id) }));
  }
  return out;
}

const shiftSig = () => JSON.stringify(store.state.settings.shift || {});

// منشيل المهام اللي الروتين حطّها (وما انعملت) من يوم معيّن ولقدّام
// rid: بند واحد، أو مجموعة بنود (Set)، أو null = الكل
function clearFutureIn(s, rid, fromDay) {
  const hit = (id) => !rid || (rid instanceof Set ? rid.has(id) : id === rid);
  s.tasks = s.tasks.filter((t) => !(t.fromRoutine && hit(t.fromRoutine.rid) && !t.recur && !t.done && t.date && t.date >= fromDay));
  for (const d of Object.keys(s.routineApplied || {})) {
    if (d < fromDay) continue;
    s.routineApplied[d] = s.routineApplied[d].filter((x) => !hit(x));
  }
}
// البنود اللي بتسحب من نفس المصدر (نفس السلسلة/الكتاب، أو كل بنود الدراسة) — منعيد توزيعها سوا مشان يضل الترتيب بالتاريخ
function relatedIds(s, item) {
  const out = new Set([item.id]);
  for (const k of ['home', 'work']) {
    for (const x of s.routines[k]) {
      if (x.type === 'study' && item.type === 'study') out.add(x.id);
      else if (x.itemId && x.type === item.type && x.itemId === item.itemId) out.add(x.id);
    }
  }
  return out;
}

// منحطّ الروتين بالأيام الجاية. بترجع عدد المهام اللي انضافت.
export function applyRoutines(today = logicalToday()) {
  const s = store.state;
  if (!s.routineApplied) s.routineApplied = {};
  const sigChanged = hasRoutine() && s.routines.sig !== shiftSig();
  const pending = [];
  for (let i = 0; i <= HORIZON; i++) {
    const d = addDays(today, i);
    const done = sigChanged && i > 0 ? [] : (s.routineApplied[d] || []);
    const kind = kindOn(d);
    for (const it of routineItems(kind)) if (itemOn(it, d) && !done.includes(it.id)) pending.push([it, d, kind]);
  }
  const stale = Object.keys(s.routineApplied).filter((d) => d < addDays(today, -14));
  if (!pending.length && !sigChanged && !stale.length) return 0;
  return store.update((st) => {
    for (const d of stale) delete st.routineApplied[d];
    if (sigChanged) { clearFutureIn(st, null, addDays(today, 1)); st.routines.sig = shiftSig(); }
    const planned = plannedUnits(st.tasks);
    let n = 0;
    for (const [it, d, kind] of pending) {
      const list = buildTasks(it, d, kind, planned);
      st.tasks.push(...list);
      n += list.length;
      // بند مكتبة ما لقى وحدات: ما منعلّمه، مشان لو ضفت محاضرات بعدين ينضاف
      if (list.length || ['general', 'break', 'sport'].includes(it.type)) st.routineApplied[d] = [...(st.routineApplied[d] || []), it.id];
    }
    return n;
  }, { silent: !pending.length && !sigChanged });
}

/* ---------- التعديل ---------- */
export function newRoutineItem(kind, fields = {}) {
  return { id: uid('rt'), type: 'study', itemId: null, title: '', count: 1, pages: 20, period: 'morning', time: null, days: [], estimate: 45, since: addDays(logicalToday(), 1), ...fields };
}
export function saveRoutineItem(kind, item) {
  const tomorrow = addDays(logicalToday(), 1);
  store.update((s) => {
    const list = s.routines[kind];
    const i = list.findIndex((x) => x.id === item.id);
    if (i >= 0) list[i] = { ...item }; else list.push({ ...item, since: item.since || tomorrow });
    clearFutureIn(s, relatedIds(s, item), tomorrow);
    s.routines.sig = shiftSig();
  }, { silent: true });
  return applyRoutines();
}
export function deleteRoutineItem(kind, id) {
  const tomorrow = addDays(logicalToday(), 1);
  let copy = null;
  store.update((s) => {
    const list = s.routines[kind];
    const i = list.findIndex((x) => x.id === id);
    if (i < 0) return;
    copy = { kind, item: list[i], index: i };
    const rel = relatedIds(s, list[i]);
    list.splice(i, 1);
    clearFutureIn(s, rel, tomorrow);
  });
  applyRoutines();
  return copy;
}
export function restoreRoutineItem(copy) {
  if (!copy) return;
  store.update((s) => { s.routines[copy.kind].splice(copy.index, 0, copy.item); clearFutureIn(s, relatedIds(s, copy.item), addDays(logicalToday(), 1)); }, { silent: true });
  applyRoutines();
}
export function moveRoutineItem(kind, id, dir) {
  store.update((s) => {
    const list = s.routines[kind];
    const i = list.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
  });
}
// نسخ قائمة البيت لقائمة الشغل (كبداية) — البنود بتنسخ بمعرّفات جديدة
export function copyRoutine(from, to) {
  store.update((s) => {
    const rel = new Set();
    for (const it of s.routines[from]) { const n = { ...it, id: uid('rt'), since: addDays(logicalToday(), 1) }; s.routines[to].push(n); relatedIds(s, n).forEach((x) => rel.add(x)); }
    clearFutureIn(s, rel, addDays(logicalToday(), 1));
  }, { silent: true });
  return applyRoutines();
}

// شو حطّ الروتين بيوم معيّن
export const routineTasksOn = (d) => store.state.tasks.filter((t) => t.fromRoutine && t.date === d);
