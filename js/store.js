// الحالة وحفظها على الجهاز
import { kvGet, kvSet } from './db.js';

export const APP_VERSION = '2.5.0';
export const DATA_VERSION = 1;
const KEY = 'state';

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function defaultState() {
  return {
    version: DATA_VERSION,
    createdAt: new Date().toISOString(),
    settings: {
      name: '',
      onboarded: false,
      lastBackupAt: null,
      migratedFromV1: false,
      prayer: { method: 'mwl', asrMadhab: 'standard', lat: null, lng: null, duration: 30, tuning: 0, tune: {}, lastLocCheck: null },
      // بداية كل فترة بعد أذانها (بالدقائق)، مثلاً الصباح بعد الشروق بساعتين
      periodOffsets: {},
      // النوبات: أيام بالبيت وأيام بالشغل بالتناوب
      shift: { enabled: false, start: null, pattern: [{ kind: 'home', days: 7 }, { kind: 'work', days: 7 }] },
      notify: { enabled: false, tasks: true, prayers: false, adhkar: true },
      passThreshold: 0.6,
      ytKey: '',
      quranDaily: 10,
      // الروتين الثابت: النوم بينحسب من الفجر، والقيلولة، ودوام الشغل بأيام الشغل
      sleep: { hours: 7, wakeBefore: 15, nap: { on: false, period: 'dhuhr', minutes: 40 }, work: { on: true, from: '07:00', to: '15:00' }, remind: true },
    },
    // المهام: كل مهمة إلها تاريخ (أو بلا تاريخ = صندوق الوارد)، والمتكرّرة إنجازها بسجلّ حسب اليوم
    tasks: [],
    goals: [],
    checklists: [],
    // المكتبة
    subjects: [],
    // المذاكرات والامتحانات: مادة، نوع، تاريخ، والمحاضرات الداخلة فيها
    exams: [],
    books: [],
    series: [],
    // العبادات
    quran: { page: 1, log: {}, khatmas: [], hifz: [], core: false },
    adhkar: { lists: {}, custom: [], edits: {}, log: {}, tasbeeh: 0 },
    // كل تقدّم بوحدة (محاضرة، حلقة، درس) بتاريخه — منه تنحسب الحصص الأسبوعية والمنحنيات
    unitLog: [],
    prayers: { log: {} },
    // العادات والتعهّد
    habits: [],
    habitLog: {},
    commitment: null,
    commitLog: {},
    // الرياضة
    sport: { profile: {}, weights: [], foodLog: {}, customFoods: [], workouts: [], programs: [], water: {} },
    // التحفيز
    rewards: { ledger: [], items: [], penalties: [], redeemed: [] },
    focusLog: [],
    dayNotes: {},
    muhasaba: {},
    events: [],
    reviews: {},
    projects: [],
    fasting: { monThu: false, white: true, special: true, log: {} },
    qada: { prayers: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }, fasts: 0, log: [] },
    sunnah: {},
    dhikr: { counts: {}, targets: {} },
    duas: { custom: [], favs: [] },
    badges: {},
    care: null,
    routines: { home: [], work: [] },
    routineApplied: {},
    sleepLog: {},
  };
}

function deepDefaults(base, d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return d === undefined ? base : d;
  const out = { ...base };
  for (const k of Object.keys(d)) {
    const bv = base[k];
    out[k] = (bv && typeof bv === 'object' && !Array.isArray(bv)) ? deepDefaults(bv, d[k]) : d[k];
  }
  return out;
}

export function migrate(d) {
  const base = defaultState();
  if (!d || typeof d !== 'object') return base;
  const out = deepDefaults(base, d);
  for (const k of ['tasks', 'goals', 'checklists', 'subjects', 'exams', 'books', 'series', 'habits', 'focusLog', 'unitLog', 'events', 'projects']) {
    if (!Array.isArray(out[k])) out[k] = [];
  }
  for (const k of ['home', 'work']) if (!Array.isArray(out.routines?.[k])) out.routines[k] = [];
  // العصر على قول الجمهور دايماً
  if (out.settings?.prayer) out.settings.prayer.asrMadhab = 'standard';
  out.version = DATA_VERSION;
  return out;
}

let state = defaultState();
let version = 0;
const subs = new Set();
let saveTimer = 0;
let persistAsked = false;
let ready = false;

async function persist() {
  const ok = await kvSet(KEY, state);
  if (!ok) window.dispatchEvent(new CustomEvent('store-error'));
  if (!persistAsked && navigator.storage?.persist) {
    persistAsked = true;
    navigator.storage.persist().catch(() => {});
  }
}
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 250);
}
function emit() { for (const fn of subs) fn(); }

// الحفظ قبل إغلاق الصفحة حتى لا يضيع آخر تعديل
window.addEventListener('pagehide', () => { if (ready) { clearTimeout(saveTimer); persist(); } });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && ready) { clearTimeout(saveTimer); persist(); } });

export const store = {
  get state() { return state; },
  get version() { return version; },
  async init() {
    const saved = await kvGet(KEY);
    state = saved ? migrate(saved) : defaultState();
    ready = true;
    return !saved;
  },
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  update(mutator, { silent = false } = {}) {
    const r = mutator(state);
    version += 1;
    scheduleSave();
    if (!silent) emit();
    return r;
  },
  replaceAll(next) { state = migrate(next); version += 1; persist(); emit(); },
  flush() { clearTimeout(saveTimer); return persist(); },
};

export function backupPayload() {
  return { app: 'manzumati', version: DATA_VERSION, appVersion: APP_VERSION, exportedAt: new Date().toISOString(), data: state };
}
export function isBackup(p) {
  return Boolean(p && p.app === 'manzumati' && p.data && Array.isArray(p.data.tasks));
}

// لقطة يومية على الجهاز (آخر 10) للرجوع عن أي خطأ
export async function dailySnapshot(day) {
  try {
    const list = (await kvGet('snapshots')) || [];
    if (list.some((s) => s.day === day)) return;
    list.unshift({ day, at: Date.now(), data: JSON.parse(JSON.stringify(state)) });
    await kvSet('snapshots', list.slice(0, 10));
  } catch { /* */ }
}
export async function listSnapshots() { return (await kvGet('snapshots')) || []; }
export async function saveManualSnapshot(label) {
  const list = (await kvGet('snapshots')) || [];
  list.unshift({ day: label, at: Date.now(), manual: true, data: JSON.parse(JSON.stringify(state)) });
  await kvSet('snapshots', list.slice(0, 12));
}
