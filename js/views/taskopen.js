// شو بيصير لما تضغط على مهمة: كل نوع بيفتح شاشته (استوديو التركيز، الأذكار، الحلقة، الكتاب…)
import { toast, haptic } from '../ui.js';
import { store } from '../store.js';
import { TAGS, setDone, isDoneOn, updateTask, taskById } from '../tasks.js';
import { logicalToday } from '../prayer.js';
import { studyUnit, masteryLabel } from '../library.js';
import { tintHex } from '../icons.js';
import { openFocus } from './focus.js';
import { openTaskForm } from './capture.js';
import { confirmDelete } from './components.js';
import { openEpisode } from './series.js';
import { openAdhkar, openReader } from './worship.js';
import { openHabitLog } from './habits.js';
import { openReadLogAfter } from './books.js';
import { openSimpleDone, openReadingDone, openWorkoutDone } from './donesheets.js';

const MASTERY_OPTS = [
  { label: 'درستها أول مرة', sub: 'الإتقان 50%', value: 50, icon: 'bookOpen' },
  { label: 'راجعتها', sub: 'الإتقان 75%', value: 75, icon: 'repeat' },
  { label: 'ثبّتها وصرت متقن', sub: 'الإتقان 100%', value: 100, icon: 'star' },
];

export function openTask(t, day = logicalToday()) {
  const k = t.link?.kind;
  const done = isDoneOn(t, day);
  const s = store.state;
  // الأنواع اللي إلها شاشتها الخاصة
  if (k === 'adhkar') { openAdhkar(t.link.itemId, day); return; }
  if (k === 'quran') { openReader(undefined, day); return; }
  if (k === 'habit') { openHabitLog(day, t.link.itemId); return; }
  if (k === 'episode') { openEpisode(t.link.itemId, t.link.unitId, { taskId: t.id, day }); return; }
  // قراءة كتاب بالصفحات ← عدّاد صفحات، وتمرين ← رقم
  if (k === 'book' && !done) { openReadingDone(t, day); return; }
  if (k === 'workout' && !done) { openWorkoutDone(t, day); return; }
  // المهام العادية (اتصل، جيب، روح…) ما بدها مؤقت: لوح صغير، والمؤقت اختياري منه
  if (!['lecture', 'lesson'].includes(k) && !t.forceFocus) {
    openSimpleDone(t, day, { onEdit: () => openTaskForm(t.id, { day }), onFocus: () => openTask({ ...t, forceFocus: true }, day) });
    return;
  }

  const tag = TAGS[t.tag] || TAGS.general;
  let color = tag.tint, image = t.link?.image || null, mastery = null, onFinish, finishOptions = null, mode = 'pomo';
  const base = {
    notes: t.notes || '',
    onNotes: (v) => store.update((st) => { const x = st.tasks.find((y) => y.id === t.id); if (x) x.notes = v; }, { silent: true }),
    shots: t.shots || [],
    onShots: (arr) => store.update((st) => { const x = st.tasks.find((y) => y.id === t.id); if (x) x.shots = [...arr]; }, { silent: true }),
    spent: t.spent || 0,
    onClose: (sec) => { if (sec > 0) store.update((st) => { const x = st.tasks.find((y) => y.id === t.id); if (x) x.spent = (x.spent || 0) + sec; }, { silent: true }); },
    onEdit: () => openTaskForm(t.id, { day }),
    onDelete: () => confirmDelete(taskById(t.id) || t),
  };
  const markDone = () => { if (!isDoneOn(taskById(t.id) || t, day)) { setDone(t.id, day, true); haptic('done'); toast(`تمّت: ${t.title}`, { action: 'تراجع', onAction: () => setDone(t.id, day, false) }); } };

  if (k === 'lecture') {
    const sj = s.subjects.find((x) => x.id === t.link.itemId);
    const l = sj?.lectures.find((x) => x.id === t.link.unitId);
    if (sj) { color = sj.color || color; image = l?.image || sj.image || image; }
    if (l) mastery = `${sj.name} — الإتقان الحالي: ${masteryLabel(l.mastery || 0)}`;
    finishOptions = l ? MASTERY_OPTS : null;
    onFinish = (sec, v) => {
      if (l) studyUnit('subject', sj.id, l.id, { mastery: v == null ? (l.mastery || 0) : Math.max(v, l.mastery || 0), seconds: sec, day });
      markDone();
    };
  } else if (k === 'lesson') {
    const b = s.books.find((x) => x.id === t.link.itemId);
    const u = b?.units?.find((x) => x.id === t.link.unitId);
    if (b) { color = b.color || color; image = u?.image || b.image || image; }
    if (u) mastery = `${b.name} — ${masteryLabel(u.mastery || 0)}`;
    finishOptions = u ? MASTERY_OPTS : null;
    onFinish = (sec, v) => { if (u) studyUnit('book', b.id, u.id, { mastery: v == null ? (u.mastery || 0) : Math.max(v, u.mastery || 0), seconds: sec, day }); markDone(); };
  } else if (k === 'book') {
    const b = s.books.find((x) => x.id === t.link.itemId);
    if (b) { color = b.color || color; image = b.image || image; mastery = `وصلت للصفحة ${b.pagesRead || 0}${b.totalPages ? ` من ${b.totalPages}` : ''}`; }
    mode = 'read';
    onFinish = (sec) => { markDone(); if (b) setTimeout(() => openReadLogAfter(b.id, day, sec), 320); };
  } else {
    onFinish = () => markDone();
  }
  if (done) {
    // المهمة منجزة: نفس الشاشة، والزر الرئيسي بيرجّعها
    onFinish = () => { setDone(t.id, day, false); toast('رجعت مو منجزة'); };
    finishOptions = null;
  }
  openFocus({
    ...base, title: t.title, cat: tag.name, color: tintHex(color), image, masteryLine: mastery,
    mode, readMinutes: t.estimate || 20, finishOptions, onFinish, finishTitle: 'شو عملت بالمحاضرة؟',
    doneLabel: done ? 'تراجع عن الإنجاز' : 'تم الإنجاز', ref: t.link || { kind: 'task', id: t.id },
  });
}

// للمهام المرتبطة بالمكتبة: هل الوحدة اتعلّمت؟ (لعرض حالة صغيرة على البطاقة)
export function linkedUnit(t) {
  const s = store.state, k = t.link?.kind;
  if (k === 'lecture') return s.subjects.find((x) => x.id === t.link.itemId)?.lectures.find((x) => x.id === t.link.unitId) || null;
  if (k === 'lesson') return s.books.find((x) => x.id === t.link.itemId)?.units?.find((x) => x.id === t.link.unitId) || null;
  if (k === 'episode') return s.series.find((x) => x.id === t.link.itemId)?.episodes.find((x) => x.id === t.link.unitId) || null;
  return null;
}
export function linkedItem(t) {
  const s = store.state, k = t.link?.kind;
  if (k === 'lecture' || k === 'subject') return s.subjects.find((x) => x.id === t.link.itemId) || null;
  if (k === 'lesson' || k === 'book') return s.books.find((x) => x.id === t.link.itemId) || null;
  if (k === 'episode') return s.series.find((x) => x.id === t.link.itemId) || null;
  if (k === 'project') return (s.projects || []).find((x) => x.id === t.link.itemId) || null;
  return null;
}
export { updateTask };
