// اقتراحات للفراغ: من مكتبتك، مرتّبة حسب الأهم (المذاكرة القريبة، الحفظ، السلاسل، الكتب، التمرين، الورد)
import { store } from './store.js';
import { daysBetween, inDaysText, countText } from './dates.js';
import { tintHex } from './icons.js';
import { makeLink } from './libitems.js';
import { tasksOn } from './tasks.js';
import { hifzToday, pagesLabel } from './hifz.js';
import { plannedWorkout, workoutsOn } from './sport.js';
import { wirdToday } from './worship.js';

const EXAM_NAMES = { quiz: 'المذاكرة', final: 'الامتحان', practical: 'العملي', pop: 'الكويز', oral: 'الشفهي' };

export function suggestionsFor(day) {
  const s = store.state;
  const out = [];
  const planned = new Set(s.tasks.filter((t) => t.link?.unitId && !t.done && (!t.date || t.date >= day)).map((t) => t.link.unitId));
  const todayTasks = tasksOn(day);
  // 1. مذاكرات خلال 10 أيام: أول محاضرة مش جاهزة
  const exams = (s.exams || []).filter((e) => e.date >= day && daysBetween(day, e.date) <= 10).sort((a, b) => a.date.localeCompare(b.date));
  for (const e of exams) {
    const sj = s.subjects.find((x) => x.id === e.subjectId);
    const l = (sj?.lectures || []).find((x) => e.lectureIds?.includes(x.id) && (x.mastery || 0) < 75 && !planned.has(x.id));
    if (!l) continue;
    out.push({ key: `l:${l.id}`, c: tintHex(sj.color || 'sky'), ic: sj.icon || 'grad', title: `${sj.name}: ${l.title}`, sub: `محاضرة · ${l.estimate || 45} د`, why: `${EXAM_NAMES[e.kind] || 'الامتحان'} ${inDaysText(daysBetween(day, e.date))}`, est: l.estimate || 45, task: { title: `${sj.name}: ${l.title}`, tag: 'study', link: makeLink('study', sj.id, l.id), estimate: l.estimate || 45 } });
    planned.add(l.id);
  }
  // 2. الحفظ المستحق
  const hz = hifzToday(day);
  if (hz && !hz.done) {
    const pages = !hz.log.new && hz.portion ? hz.portion.pages : !hz.log.near && hz.near.length ? hz.near : hz.far;
    if (pages?.length) out.push({ key: 'hifz', c: '#35b791', ic: 'brain', title: !hz.log.new && hz.portion ? 'الحفظ الجديد' : 'مراجعة الحفظ', sub: `${pagesLabel(pages).names} · ${!hz.log.new && hz.portion ? 20 : 10} د`, est: !hz.log.new && hz.portion ? 20 : 10, go: '#/tracks/hifz' });
  }
  // 3. فقه النفس والسلاسل: الحلقة الجاية
  for (const x of (s.series || []).sort((a, b) => (a.kind === 'self' ? -1 : 0) - (b.kind === 'self' ? -1 : 0))) {
    const ep = (x.episodes || []).find((e) => !e.done && !e.listenOnly && !planned.has(e.id));
    if (!ep || out.filter((o) => o.kind === 'series').length >= 2) continue;
    const mins = ep.duration ? Math.max(10, Math.round(ep.duration / 60)) : 30;
    out.push({ key: `e:${ep.id}`, kind: 'series', c: tintHex(x.color || (x.kind === 'self' ? 'violet' : 'rose')), ic: x.kind === 'self' ? 'spa' : 'clapper', title: `${x.name}: ${ep.title}`, sub: `حلقة · ${mins} د`, est: mins, task: { title: `${x.name}: ${ep.title}`, tag: x.kind === 'self' ? 'self' : 'series', link: makeLink(x.kind === 'self' ? 'self' : 'series', x.id, ep.id), estimate: mins } });
  }
  // 4. كتاب بالصفحات
  const bk = (s.books || []).find((b) => b.mode === 'pages' && (!b.totalPages || (b.pagesRead || 0) < b.totalPages) && !todayTasks.some((t) => t.link?.itemId === b.id));
  if (bk) out.push({ key: `b:${bk.id}`, c: tintHex(bk.color || 'brown'), ic: 'book', title: `${bk.name}: 15 صفحة`, sub: 'قراءة · 20 د', est: 20, task: { title: `${bk.name}: 15 صفحة`, tag: 'book', link: makeLink('book', bk.id), pages: 15, estimate: 20 } });
  // 5. تمرين اليوم
  const pw = plannedWorkout(day);
  if (pw && !workoutsOn(day).length) out.push({ key: 'workout', c: '#e0705f', ic: 'dumbbell', title: `تمرين: ${pw.day.name}`, sub: `${countText(pw.day.exercises.length, ['تمرين', 'تمرينين', 'تمارين', 'تمرين'])} · 35 د`, est: 35, go: '#/tracks/sport' });
  // 6. الورد الباقي
  const w = wirdToday(day);
  if ((s.quran.plan || s.quran.core) && !w.done) { const left = Math.max(1, w.target - w.read); out.push({ key: 'wird', c: '#35b791', ic: 'quran', title: `ورد القرآن: ${left} صفحة`, sub: `ص ${w.from + w.read} ← ${w.to} · ${Math.round(left * 1.5)} د`, est: Math.round(left * 1.5), go: 'khatma' }); }
  return out;
}

// «عبّيلي الفراغ»: اللي بيوسع بالوقت من الاقتراحات اللي بتصير مهام
export function fillPlan(list, freeMin) {
  const out = [];
  let left = freeMin;
  for (const x of list) { if (!x.task) continue; if (x.est <= left) { out.push(x); left -= x.est; } }
  return out;
}
