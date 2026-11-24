// المشاريع: شي كبير إله موعد (تجهيز الزواج، التخرّج، سفر…) بمراحل وخطوات، وميزانية اختيارية.
// الخطوة بتصير مهمة بكبسة أو بتتوزّع على الأيام لحد الموعد، ولما تخلص المهمة بتنعلّم الخطوة.
import { store, uid } from './store.js';
import { addDays, daysBetween } from './dates.js';
import { logicalToday } from './prayer.js';
import { addTask, setDone, deleteTask } from './tasks.js';
import { shiftOn } from './shifts.js';

export const PROJECT_ICONS = ['ring', 'graduation-cap', 'kaaba', 'plane', 'house', 'briefcase', 'car', 'book', 'heart', 'star'];
export const PROJECT_COLORS = ['#e8c46a', '#4a9ee0', '#35b791', '#a682e8', '#e0705f', '#e06a9e', '#62c2d6', '#c08a4e'];
const S = (title, cost = null) => ({ id: uid('ps'), title, cost, done: false });
export const PROJECT_TEMPLATES = {
  marriage: { name: 'تجهيز الزواج', icon: 'ring', color: '#e8c46a', phases: () => [
    { id: uid('ph'), name: 'البيت', icon: 'house', steps: [S('اختيار البيت'), S('دهان وتصليحات'), S('غرفة النوم'), S('المطبخ والأدوات'), S('الصالون')] },
    { id: uid('ph'), name: 'الأوراق الرسمية', icon: 'file-signature', steps: [S('الفحص الطبي'), S('عقد الزواج'), S('تثبيت المعاملات')] },
    { id: uid('ph'), name: 'العرس', icon: 'champagne-glasses', steps: [S('حجز الصالة'), S('قائمة المعازيم'), S('البطاقات'), S('اللباس'), S('الضيافة')] },
  ] },
  travel: { name: 'سفر', icon: 'plane', color: '#62c2d6', phases: () => [
    { id: uid('ph'), name: 'الأوراق', icon: 'passport', steps: [S('جواز السفر'), S('الفيزا'), S('التأمين')] },
    { id: uid('ph'), name: 'الحجز', icon: 'ticket', steps: [S('تذكرة الطيارة'), S('السكن'), S('المواصلات')] },
    { id: uid('ph'), name: 'التجهيز', icon: 'suitcase', steps: [S('قائمة الأغراض'), S('تصريف العملة')] },
  ] },
  blank: { name: '', icon: 'star', color: '#a682e8', phases: () => [{ id: uid('ph'), name: 'المرحلة الأولى', icon: 'flag', steps: [] }] },
};

export const projects = () => store.state.projects || [];
export const projectById = (id) => projects().find((p) => p.id === id) || null;
export const stepsOf = (p) => (p?.phases || []).flatMap((ph) => ph.steps || []);

export function projectStats(p, today = logicalToday()) {
  const steps = stepsOf(p);
  const done = steps.filter((x) => x.done).length;
  const left = steps.length - done;
  const daysLeft = p.deadline ? daysBetween(today, p.deadline) : null;
  const weeks = daysLeft != null ? Math.max(1, Math.ceil(daysLeft / 7)) : null;
  const spent = steps.filter((x) => x.done && x.cost).reduce((a, x) => a + Number(x.cost), 0);
  const costTotal = steps.reduce((a, x) => a + (Number(x.cost) || 0), 0);
  return { total: steps.length, done, left, pct: steps.length ? done / steps.length : 0, daysLeft, perWeek: weeks && left ? Math.ceil(left / weeks) : 0, spent, costTotal };
}

export function addProject(tplKey, fields = {}) {
  const t = PROJECT_TEMPLATES[tplKey] || PROJECT_TEMPLATES.blank;
  const p = { id: uid('pj'), name: fields.name || t.name || 'مشروع', icon: fields.icon || t.icon, color: fields.color || t.color, deadline: fields.deadline || null, budget: fields.budget || null, phases: t.phases(), createdAt: Date.now() };
  store.update((s) => { s.projects = s.projects || []; s.projects.push(p); });
  return p;
}
export function updateProject(id, patch) {
  store.update((s) => { const p = s.projects.find((x) => x.id === id); if (p) Object.assign(p, patch); });
}
export function deleteProject(id) {
  const p = projectById(id);
  if (!p) return;
  for (const st of stepsOf(p)) if (st.taskId) { const t = store.state.tasks.find((x) => x.id === st.taskId); if (t && !t.done) deleteTask(t.id); }
  store.update((s) => { s.projects = s.projects.filter((x) => x.id !== id); });
}
function withProject(id, fn) { store.update((s) => { const p = s.projects.find((x) => x.id === id); if (p) fn(p); }); }
export function addPhase(pid, name, icon = 'flag') { withProject(pid, (p) => { p.phases.push({ id: uid('ph'), name, icon, steps: [] }); }); }
export function renamePhase(pid, phid, patch) { withProject(pid, (p) => { const ph = p.phases.find((x) => x.id === phid); if (ph) Object.assign(ph, patch); }); }
export function deletePhase(pid, phid) { withProject(pid, (p) => { p.phases = p.phases.filter((x) => x.id !== phid); }); }
export function saveStep(pid, phid, step) {
  withProject(pid, (p) => {
    const ph = p.phases.find((x) => x.id === phid);
    if (!ph) return;
    const i = ph.steps.findIndex((x) => x.id === step.id);
    if (i >= 0) ph.steps[i] = { ...ph.steps[i], ...step }; else ph.steps.push({ id: uid('ps'), done: false, ...step });
  });
}
export function deleteStep(pid, phid, sid) { withProject(pid, (p) => { const ph = p.phases.find((x) => x.id === phid); if (ph) ph.steps = ph.steps.filter((x) => x.id !== sid); }); }

// الخطوة ↔ مهمتها
export function stepTask(st) { return st?.taskId ? store.state.tasks.find((t) => t.id === st.taskId) || null : null; }
export function toggleStep(pid, sid, day = logicalToday()) {
  const st = stepsOf(projectById(pid)).find((x) => x.id === sid);
  if (!st) return;
  const t = stepTask(st);
  if (t) { setDone(t.id, t.date || day, !st.done); return; }
  withProject(pid, (p) => { const x = stepsOf(p).find((y) => y.id === sid); if (x) { x.done = !x.done; x.doneAt = x.done ? day : null; } });
}
export function stepToTask(pid, sid, date) {
  const p = projectById(pid);
  const st = stepsOf(p).find((x) => x.id === sid);
  if (!st || st.done) return null;
  const old = stepTask(st);
  if (old && !old.done) { store.update((s) => { const t = s.tasks.find((x) => x.id === old.id); if (t) t.date = date; }); return old; }
  const t = addTask({ title: `${p.name}: ${st.title}`, date, tag: 'general', link: { kind: 'project', itemId: pid, unitId: sid }, estimate: 30 });
  withProject(pid, (pp) => { const x = stepsOf(pp).find((y) => y.id === sid); if (x) x.taskId = t.id; });
  return t;
}
// وزّع الخطوات اللي ما إلها مهمة على الأيام لحد الموعد (أو 8 أسابيع)، بأيام البيت إذا في نوبات
export function distributeSteps(pid, today = logicalToday()) {
  const p = projectById(pid);
  const todo = stepsOf(p).filter((x) => !x.done && !(stepTask(x) && !stepTask(x).done));
  if (!todo.length) return 0;
  const end = p.deadline ? addDays(p.deadline, -2) : addDays(today, 56);
  const span = Math.max(1, daysBetween(today, end));
  let days = Array.from({ length: span }, (_, i) => addDays(today, i + 1));
  if (store.state.settings.shift?.enabled) { const home = days.filter((d) => shiftOn(d)?.kind !== 'work'); if (home.length >= Math.min(todo.length, 3)) days = home; }
  const gap = days.length / todo.length;
  todo.forEach((st, i) => stepToTask(pid, st.id, days[Math.min(days.length - 1, Math.floor(i * gap))]));
  return todo.length;
}
