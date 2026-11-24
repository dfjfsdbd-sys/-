// مصادر المكتبة لكل نوع مهمة: المواد، الكتب، السلاسل… ووحداتها، و«التالية» منها
// (بتستعملها نافذة الإضافة والروتين)
import { store } from './store.js';
import { TYPE_ORDER } from './tasks.js';
import { allAdhkarLists, adhkarSettings } from './worship.js';
import { activeHabits } from './habits.js';
import { WORKOUT_TYPES } from './sport.js';

export function libItems(type) {
  const s = store.state;
  if (type === 'study') return (s.subjects || []).filter((x) => !x.archived).map((x) => ({ id: x.id, name: x.name, image: x.image, color: x.color, icon: x.icon || 'grad' }));
  if (type === 'book') return (s.books || []).map((x) => ({ id: x.id, name: x.name, image: x.image, color: x.color, icon: x.icon || 'book' }));
  if (type === 'self') return (s.series || []).filter((x) => x.kind === 'self').map((x) => ({ id: x.id, name: x.name, image: x.image, color: x.color, icon: x.icon || 'spa' }));
  if (type === 'series') return (s.series || []).filter((x) => x.kind !== 'self').map((x) => ({ id: x.id, name: x.name, image: x.image, color: x.color, icon: x.icon || 'clapper' }));
  if (type === 'worship') {
    const out = allAdhkarLists().filter((l) => adhkarSettings(l.id).enabled).map((l) => ({ id: `adhkar:${l.id}`, name: l.name, image: l.image, icon: 'hands' }));
    out.push({ id: 'quran', name: 'ورد القرآن', icon: 'quran' });
    if ((s.quran?.hifz || []).length) out.push({ id: 'hifz', name: 'مراجعة الحفظ', icon: 'bookOpen' });
    return out;
  }
  if (type === 'behavior') return activeHabits().map((x) => ({ id: x.id, name: x.name, color: x.color, icon: x.icon || 'compass' }));
  if (type === 'sport') return Object.entries(WORKOUT_TYPES).map(([k, w]) => ({ id: k, name: w.name, icon: w.icon || 'dumbbell' }));
  return [];
}
export function unitsFor(type, itemId) {
  const s = store.state;
  if (type === 'study') return s.subjects.find((x) => x.id === itemId)?.lectures || [];
  if (type === 'book') { const b = s.books.find((x) => x.id === itemId); return b && b.mode !== 'pages' ? (b.units || []) : null; }
  if (type === 'self' || type === 'series') return s.series.find((x) => x.id === itemId)?.episodes || [];
  return null;
}
export const unitWord = (type, itemId) => (type === 'study' ? 'محاضرة' : type === 'book' ? (store.state.books.find((x) => x.id === itemId)?.unitWord || 'درس') : 'حلقة');
// الوحدات اللي إلها مهمة مخطّطة لسّا ما انعملت (منتخطّاها لما نقترح التالية)
export function plannedUnits(tasks = store.state.tasks) {
  return new Set(tasks.filter((t) => t.link?.unitId && !t.done && !t.recur).map((t) => t.link.unitId));
}
export function nextUnit(units, planned = plannedUnits()) {
  if (!units?.length) return null;
  const fresh = (u) => !u.done && !planned.has(u.id);
  return units.find((u) => fresh(u) && !(u.mastery > 0)) || units.find((u) => fresh(u) && (u.mastery || 0) < 100)
    || units.find((u) => !(u.mastery > 0) && !u.done) || units.find((u) => (u.mastery || 0) < 100 && !u.done) || null;
}
export function itemName(type, itemId) { return libItems(type).find((x) => x.id === itemId)?.name || ''; }
export function makeLink(type, itemId, unitId) {
  const s = store.state;
  if (!itemId) return null;
  if (type === 'study') { const sj = s.subjects.find((x) => x.id === itemId); const l = sj?.lectures.find((x) => x.id === unitId); return { kind: unitId ? 'lecture' : 'subject', itemId, unitId: unitId || null, image: l?.image || sj?.image || null }; }
  if (type === 'book') { const b = s.books.find((x) => x.id === itemId); const u = b?.units?.find((x) => x.id === unitId); return { kind: b?.mode === 'pages' ? 'book' : 'lesson', itemId, unitId: unitId || null, image: u?.image || b?.image || null }; }
  if (type === 'self' || type === 'series') { const se = s.series.find((x) => x.id === itemId); const e = se?.episodes.find((x) => x.id === unitId); return { kind: 'episode', itemId, unitId: unitId || null, image: e?.image || (e?.videoId ? `https://i.ytimg.com/vi/${e.videoId}/mqdefault.jpg` : null) || se?.image || null }; }
  if (type === 'worship') { if (itemId.startsWith('adhkar:')) return { kind: 'adhkar', itemId: itemId.slice(7), image: adhkarSettings(itemId.slice(7)).image || null }; return { kind: itemId, itemId }; }
  if (type === 'behavior') return { kind: 'habit', itemId };
  if (type === 'sport') return { kind: 'workout', itemId };
  return null;
}
export function autoTitle(type, itemId, unitId) {
  const name = itemName(type, itemId);
  if (!name) return '';
  const units = unitsFor(type, itemId);
  const u = units?.find((x) => x.id === unitId);
  if (type === 'book' && !units) return `${name}: قراءة`;
  return u ? `${name}: ${u.title}` : name;
}
// نوع المهمة من بياناتها (للتعديل)
export function typeOf(t) {
  if (t.link?.kind === 'episode') return store.state.series.find((x) => x.id === t.link.itemId)?.kind === 'self' ? 'self' : 'series';
  if (t.link?.kind === 'lecture' || t.link?.kind === 'subject') return 'study';
  if (t.link?.kind === 'lesson' || t.link?.kind === 'book') return 'book';
  if (['adhkar', 'quran', 'hifz'].includes(t.link?.kind)) return 'worship';
  if (t.link?.kind === 'habit') return 'behavior';
  if (t.link?.kind === 'workout') return 'sport';
  return TYPE_ORDER.includes(t.tag) ? t.tag : 'general';
}
export function itemProgress(type, itemId) {
  const s = store.state;
  const avg = (arr, fn) => (arr?.length ? arr.reduce((a, x) => a + fn(x), 0) / arr.length : 0);
  if (type === 'study') { const x = s.subjects.find((y) => y.id === itemId); return x ? { pct: avg(x.lectures, (u) => Math.min(100, u.mastery || 0) / 100), n: `${(x.lectures || []).length} محاضرة` } : null; }
  if (type === 'book') { const x = s.books.find((y) => y.id === itemId); if (!x) return null; return x.mode === 'pages' ? { pct: x.totalPages ? (x.pagesRead || 0) / x.totalPages : 0, n: `ص ${x.pagesRead || 0}` } : { pct: avg(x.units, (u) => Math.min(100, u.mastery || 0) / 100), n: `${(x.units || []).length} ${x.unitWord || 'درس'}` }; }
  if (type === 'self' || type === 'series') { const x = s.series.find((y) => y.id === itemId); return x ? { pct: avg(x.episodes, (e) => (e.done ? 1 : Math.max(e.progress || 0, (e.mastery || 0) / 100))), n: `${(x.episodes || []).length} حلقة` } : null; }
  return null;
}
