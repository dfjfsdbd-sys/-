// نقل البيانات من النسخة الأولى (المنظومة الإنتاجية) — من ذاكرة المتصفح نفسها أو من ملف نسخة احتياطية
import { defaultState, uid } from './store.js';

const LOCAL_KEYS = {
  routineDatabase: 'routineDB', fixedSleepDatabase: 'sleepFixedDB', storedDailyTasks: 'dailyTasksDB', hierarchicalGoalsDatabase: 'hGoalsDB',
  subjectsDatabase: 'subjectsDB', booksDatabase: 'booksDB', seriesDatabase: 'seriesDB', newSeriesDatabase: 'newSeriesDB',
  worshipDatabase: 'worshipDB', stationTimesDB: 'stationTimesDB', periodTasksDB: 'periodTasksDB', historyDB: 'historyDB',
  sportsDatabase: 'sportsDB', behaviorDatabase: 'behaviorDB', commitmentDB: 'commitmentDB', commitLogDB: 'commitLogDB',
  scheduledTasksDB: 'scheduledTasksDB', prayerSettings: 'prayerSettings',
};

export function readLegacyLocal() {
  const out = {};
  let found = 0;
  for (const [k, lk] of Object.entries(LOCAL_KEYS)) {
    try {
      const raw = localStorage.getItem(lk);
      if (raw != null) { out[k] = JSON.parse(raw); found += 1; }
    } catch { /* */ }
  }
  // لازم يكون في شي حقيقي (مهام أو مكتبة) مش بس إعدادات
  const real = (out.storedDailyTasks?.length || 0) + (out.subjectsDatabase?.length || 0) + (out.booksDatabase?.length || 0)
    + (out.seriesDatabase?.length || 0) + (out.behaviorDatabase?.length || 0) + Object.keys(out.historyDB || {}).length;
  return found && real ? out : null;
}
export const isLegacyBackup = (p) => Boolean(p && (p.app === 'montheoma' || p.storedDailyTasks || p.subjectsDatabase) && !p.data);

const hex = (c) => (typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c) ? c : null);
const LEGACY_TINT = { 'var(--cat-series)': 'violet', 'var(--cat-break)': 'mint', 'var(--cat-sport)': 'gold', 'var(--cat-study)': 'sky', 'var(--cat-work)': 'amber' };
const color = (c, fb) => hex(c) || LEGACY_TINT[c] || fb;
const pctOf = (u) => Math.max(0, Math.min(100, Number(u.masteryPercent) || (u.completed ? 100 : 0)));

function unitFrom(u, extra = {}) {
  return {
    id: u.id || uid('u'), title: u.name || u.title || '', image: u.iconImage || null,
    mastery: pctOf(u), times: Number(u.timesCompleted) || (pctOf(u) >= 100 ? 1 : 0),
    spent: Number(u.totalSecondsSpent) || 0, estimate: Math.round((Number(u.expectedSeconds) || 0) / 60), done: pctOf(u) >= 100, ...extra,
  };
}
function coreFrom(it) {
  if (!it.isCore) return { core: false };
  const r = it.recurrence || { type: 'daily' };
  return { core: true, level: it.coreLevel === 'secondary' ? 'secondary' : 'essential', rhythm: r.type === 'quota' ? { type: 'quota', perWeek: r.perWeek || 3 } : r.type === 'weekly' ? { type: 'weekly', times: r.times || 3 } : { type: 'daily' } };
}

export function fromLegacy(src) {
  const s = defaultState();
  s.settings.migratedFromV1 = true;
  s.settings.onboarded = true;

  // الصلاة والفترات
  const ps = src.prayerSettings || {};
  Object.assign(s.settings.prayer, {
    method: ps.method || 'mwl', asrMadhab: ps.asrMadhab || 'standard',
    lat: ps.lat ?? null, lng: ps.lng ?? null, duration: ps.prayerDuration || 30,
    tuning: ps.tuning || 0, tune: ps.tune || {}, lastLocCheck: ps.lastLocCheck || null,
  });
  for (const [k, v] of Object.entries(src.stationTimesDB || {})) {
    if (v && v.mode === 'offset' && Number(v.startOffset)) s.settings.periodOffsets[k] = Number(v.startOffset);
  }
  if (src.fixedSleepDatabase) s.settings.sleep = src.fixedSleepDatabase;

  // المواد والمحاضرات
  s.subjects = (src.subjectsDatabase || []).map((x) => ({
    id: x.id, name: x.name, color: color(x.color, 'sky'), image: x.iconImage || null, icon: x.iconName || 'grad',
    lectures: (x.lectures || []).map((u) => unitFrom(u)), ...coreFrom(x),
  }));

  // الكتب
  s.books = (src.booksDatabase || []).map((b) => {
    const mode = b.mode === 'reading' ? 'pages' : b.mode === 'memorize' ? 'memorize' : 'lessons';
    return {
      id: b.id, name: b.name, color: color(b.color, 'coral'), image: b.iconImage || null, icon: b.iconName || 'book', mode,
      unitWord: b.unitType || (mode === 'memorize' ? 'صفحة' : 'درس'),
      totalPages: Number(b.totalPages) || 0, pagesRead: Number(b.pagesReadCount) || 0, readLog: [],
      units: (mode === 'lessons' ? (b.lessons || []) : mode === 'memorize' ? (b.pages || []) : []).map((u) => unitFrom(u)),
      ...coreFrom(b),
    };
  });

  // السلاسل (فقه النفس والسلاسل الأخرى)
  const series = (list, kind) => (list || []).map((x) => ({
    id: x.id, name: x.name, kind, color: color(x.color, 'violet'), image: x.iconImage || null, icon: x.iconName || 'video',
    unitWord: x.unitType || 'حلقة', source: null,
    episodes: (x.episodes || []).map((e) => ({ id: e.id, title: e.name || '', image: e.iconImage || null, videoId: null, duration: 0, progress: pctOf(e) / 100, position: 0, done: pctOf(e) >= 100, mastery: pctOf(e), notes: '' })),
    ...coreFrom(x),
  }));
  s.series = [...series(src.seriesDatabase, 'self'), ...series(src.newSeriesDatabase, 'other')];

  // العبادات: القرآن، الحفظ، الأذكار
  const adhkarMap = {};
  for (const w of src.worshipDatabase || []) {
    if (w.type === 'reading' && (w.isDefaultQuran || /قرآن|القرآن/.test(w.name))) {
      s.quran.page = Math.min(604, Math.max(1, (Number(w.pagesReadCount) || 0) + 1));
      if (w.khatmaCount) s.quran.khatmas = Array.from({ length: w.khatmaCount }, (_, i) => ({ id: uid('kh'), n: i + 1, done: true, end: null }));
      if (w.lastAssignedToPage) s.quran.legacyAssigned = w.lastAssignedToPage;
    } else if (w.type === 'memorize') {
      s.quran.hifz.push({ id: w.id, name: w.name, kind: 'pages', units: (w.pages || []).map((u) => unitFrom(u)), color: color(w.color, 'gold') });
    } else if (w.type === 'simple') {
      const key = /صباح/.test(w.name) ? 'morning' : /مساء|المسا/.test(w.name) ? 'evening' : /نوم/.test(w.name) ? 'sleep' : null;
      if (key) {
        adhkarMap[w.id] = `adhkar:${key}`;
        s.adhkar.lists = s.adhkar.lists || {};
        s.adhkar.lists[key] = { ...(s.adhkar.lists[key] || {}), image: w.iconImage || null, ...coreFrom(w) };
      } else {
        s.habits.push({ id: w.id, name: w.name, kind: 'build', icon: 'beads', color: color(w.color, 'mint'), note: '', ...coreFrom(w), group: 'worship' });
      }
    } else if (w.type === 'reading') {
      s.books.push({ id: w.id, name: w.name, color: color(w.color, 'mint'), image: w.iconImage || null, icon: 'book', mode: 'pages', totalPages: Number(w.totalPages) || 0, pagesRead: Number(w.pagesReadCount) || 0, readLog: [], units: [], unitWord: 'صفحة', ...coreFrom(w) });
    }
  }

  // العادات والسلوك
  for (const b of src.behaviorDatabase || []) {
    s.habits.push({
      id: b.id, name: b.name, kind: b.kind === 'abstain' ? 'abstain' : 'build', note: b.note || '', icon: b.kind === 'abstain' ? 'shield' : 'leaf',
      color: color(b.color, 'violet'), measured: Boolean(b.measured), unit: b.unit || '', limit: Number(b.limit) || 0, direction: b.direction || 'atMost',
      ...coreFrom(b), group: 'behavior',
    });
  }
  // الرياضة: الوزن والسعرات صاروا بقسم الرياضة، والتمارين عادة
  for (const x of src.sportsDatabase || []) {
    if (x.kind === 'track') { s.sport.profile.targetWeight = Number(x.target) || null; s.sport.profile.startWeight = Number(x.startValue) || null; }
    else if (x.kind === 'number') { s.sport.profile.kcalTarget = Number(x.target) || null; }
    else s.habits.push({ id: x.id, name: x.name, kind: 'build', icon: 'dumbbell', color: 'gold', note: '', ...coreFrom(x), group: 'sport' });
  }

  // الصلوات: سجلّ كل صلاة
  for (const t of src.storedDailyTasks || []) {
    if (!t.isPrayerAnchor || !t.station) continue;
    for (const [day, v] of Object.entries(t.doneLog || {})) {
      if (!v) continue;
      s.prayers.log[day] = s.prayers.log[day] || {};
      s.prayers.log[day][t.station] = v === 'sunnah' ? 'sunnah' : 'ontime';
    }
  }

  // المهام العادية (مش الصلوات ولا الالتزامات اليومية المولّدة)
  for (const t of src.storedDailyTasks || []) {
    if (t.isPrayerAnchor || t.isCoreTask) continue;
    const date = t.targetDate || null;
    s.tasks.push({
      id: t.id || uid('t'), title: t.title || 'مهمة', notes: t.notes || '', date: t.status === 'parking' ? null : date, time: null,
      period: t.station || null, due: null, recur: null, recurEnd: null, done: t.status === 'done', doneAt: t.status === 'done' ? Date.now() : null,
      doneDay: t.status === 'done' ? date : null, log: {}, skip: {}, checklist: [], remind: null, priority: 0,
      tag: t.category === 'study' ? 'study' : t.category === 'god' ? 'worship' : 'general',
      link: t.linkedUnitId ? { unitId: t.linkedUnitId, itemId: t.libParentId || t.subjectId || t.bookId || null } : null,
      estimate: Math.round((t.expectedSeconds || 0) / 60), spent: t.totalSecondsSpent || 0, goalId: null, createdAt: Date.now(),
    });
  }
  for (const x of src.scheduledTasksDB || []) {
    s.tasks.push({ id: x.id || uid('t'), title: x.title, notes: '', date: x.date || null, time: null, period: null, due: null, recur: null, recurEnd: null, done: false, doneAt: null, log: {}, skip: {}, checklist: [], remind: null, priority: 0, tag: 'general', link: null, estimate: 0, spent: 0, goalId: null, createdAt: Date.now() });
  }

  // التعهّد وسجلّه: مفاتيح الأذكار القديمة صارت adhkar:morning…
  if (src.commitmentDB && typeof src.commitmentDB === 'object') {
    s.commitment = { ...src.commitmentDB };
    delete s.commitment.weeks;
    s.commitment.reqImportance = src.commitmentDB.reqImportance || {};
  }
  const mapKey = (k) => adhkarMap[k] || k;
  for (const [day, e] of Object.entries(src.commitLogDB || {})) {
    const checks = {};
    for (const [k, v] of Object.entries(e.checks || {})) checks[mapKey(k)] = v;
    const scores = {};
    for (const [k, v] of Object.entries(e.scores || {})) scores[mapKey(k)] = v;
    s.commitLog[day] = { checks, values: e.values || {}, scores };
    if (e.verdict) s.commitLog[day].verdict = { ...e.verdict, items: (e.verdict.items || []).map((it) => ({ ...it, id: mapKey(it.id) })) };
    // نفس المعلومة بسجلّ العادات والأذكار الجديد
    for (const [k, v] of Object.entries(checks)) {
      if (k.startsWith('adhkar:')) {
        if (v) { s.adhkar.log[day] = s.adhkar.log[day] || {}; s.adhkar.log[day][k.slice(7)] = { done: true, at: 0 }; }
      } else if (k !== '__prayers' && s.habits.some((h) => h.id === k)) {
        s.habitLog[day] = s.habitLog[day] || {};
        s.habitLog[day][k] = { done: Boolean(v), score: typeof scores[k] === 'number' ? scores[k] : null };
      }
    }
    if (checks.__prayers) {
      s.prayers.log[day] = s.prayers.log[day] || {};
      for (const p of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) if (!s.prayers.log[day][p]) s.prayers.log[day][p] = 'ontime';
    }
  }
  // الأذكار المنجزة من مهام اليوم القديمة
  for (const t of src.storedDailyTasks || []) {
    if (!t.isCoreTask || t.status !== 'done' || !t.targetDate) continue;
    const k = adhkarMap[t.coreSourceId || t.worshipId];
    if (k) { s.adhkar.log[t.targetDate] = s.adhkar.log[t.targetDate] || {}; s.adhkar.log[t.targetDate][k.slice(7)] = { done: true, at: 0 }; }
    else if (t.behaviorId && s.habits.some((h) => h.id === t.behaviorId)) {
      s.habitLog[t.targetDate] = s.habitLog[t.targetDate] || {};
      s.habitLog[t.targetDate][t.behaviorId] = { done: true, score: t.score ?? null };
    }
  }
  // سجلّ الأيام القديم يبقى للمنحنيات
  s.legacyHistory = {};
  for (const [day, r] of Object.entries(src.historyDB || {})) s.legacyHistory[day] = { total: r.total || 0, done: r.done || 0, focus: r.focusSeconds || 0 };
  return s;
}
