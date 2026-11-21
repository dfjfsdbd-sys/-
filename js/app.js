// تشغيل التطبيق: التنقّل، الشريط السفلي، تبدّل اليوم، والعمل بلا نت
import { store, dailySnapshot } from './store.js';
import { h, icon, toast, haptic, sheetOpen } from './ui.js';
import { logicalToday, locate, hasLocation, currentPeriod, PERIOD_SKY } from './prayer.js';
import { closeDays } from './commit.js';
import { readLegacyLocal, fromLegacy } from './legacy.js';
import { openCapture } from './views/capture.js';
import { renderToday } from './views/today.js';
import { renderPlan, planActions } from './views/plan.js';
import { renderGoals, goalsActions } from './views/goals.js';
import { renderTracks } from './views/tracks.js';
import { renderWorship, renderQuran, quranActions } from './views/worship.js';
import { renderStudy, renderSubject, studyActions, subjectActions } from './views/study.js';
import { renderBooks, renderBook, booksActions, bookActions } from './views/books.js';
import { renderSeriesList, renderSeries, seriesListActions, seriesActions } from './views/series.js';
import { renderSport, sportActions } from './views/sport.js';
import { renderHabits, habitsActions } from './views/habits.js';
import { renderProgress } from './views/progress.js';
import { renderCommit, commitActions } from './views/commit.js';
import { renderRewards, rewardsActions } from './views/rewards.js';
import { renderSettings } from './views/settings.js';
import { startReminders } from './notify.js';
import { markChanged, armDrive, driveCfg, onDriveChange } from './drive.js';

const ROUTES = {
  today: { tab: 'today', render: renderToday },
  plan: { tab: 'plan', render: renderPlan, actions: planActions, head: false },
  'plan/goals': { tab: 'plan', parent: 'plan', title: 'الأهداف', render: renderGoals, actions: goalsActions },
  tracks: { tab: 'tracks', render: renderTracks },
  'tracks/worship': { tab: 'tracks', parent: 'tracks', title: 'العبادات', render: renderWorship },
  'tracks/quran': { tab: 'tracks', parent: 'tracks/worship', title: 'القرآن الكريم', render: renderQuran, actions: quranActions },
  'tracks/study': { tab: 'tracks', parent: 'tracks', title: 'الدراسة', render: renderStudy, actions: studyActions },
  'tracks/subject/:id': { tab: 'tracks', parent: 'tracks/study', title: 'المادة', render: renderSubject, actions: subjectActions },
  'tracks/books': { tab: 'tracks', parent: 'tracks', title: 'الكتب', render: renderBooks, actions: booksActions },
  'tracks/book/:id': { tab: 'tracks', parent: 'tracks/books', title: 'الكتاب', render: renderBook, actions: bookActions },
  'tracks/series': { tab: 'tracks', parent: 'tracks', title: 'السلاسل والدروس', render: renderSeriesList, actions: seriesListActions },
  'tracks/series/:id': { tab: 'tracks', parent: 'tracks/series', title: 'السلسلة', render: renderSeries, actions: seriesActions },
  'tracks/sport': { tab: 'tracks', parent: 'tracks', title: 'الرياضة والصحة', render: renderSport, actions: sportActions },
  'tracks/habits': { tab: 'tracks', parent: 'tracks', title: 'العادات والسلوك', render: renderHabits, actions: habitsActions },
  progress: { tab: 'progress', render: renderProgress },
  'progress/commit': { tab: 'progress', parent: 'progress', title: 'التعهّد', render: renderCommit, actions: commitActions },
  'progress/rewards': { tab: 'progress', parent: 'progress', title: 'المكافآت والعقوبات', render: renderRewards, actions: rewardsActions },
  settings: { tab: 'today', parent: 'today', title: 'الإعدادات', render: renderSettings },
};
const TABS = [
  { id: 'today', label: 'اليوم', icon: 'today' },
  { id: 'plan', label: 'الخطة', icon: 'calendar' },
  { id: 'add' },
  { id: 'tracks', label: 'مساراتي', icon: 'tracks' },
  { id: 'progress', label: 'إنجازي', icon: 'trophy' },
];

const viewEl = document.getElementById('view');
const tabsEl = document.getElementById('tabs');
const scrollMemory = new Map();
let routeStack = [];
let current = { key: 'today', path: 'today', params: {} };
let lastDay = null;

function match(path) {
  if (ROUTES[path]) return { key: path, path, params: {} };
  for (const key of Object.keys(ROUTES)) {
    if (!key.includes(':')) continue;
    const a = key.split('/'), b = path.split('/');
    if (a.length !== b.length) continue;
    const params = {};
    if (a.every((seg, i) => (seg.startsWith(':') ? ((params[seg.slice(1)] = decodeURIComponent(b[i])), true) : seg === b[i]))) return { key, path, params };
  }
  return null;
}
const parsePath = () => {
  const p = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('?')[0];
  return match(p) || match('today');
};

function go(path) {
  if (!match(path)) return;
  routeStack = [path];
  if (parsePath().path === path && location.hash) { navigate(match(path), 'tab-in'); return; }
  location.replace(`#/${path}`);
}
function open(path) { if (match(path)) location.hash = `#/${path}`; }
function back() {
  const parent = ROUTES[current.key]?.parent || 'today';
  if (routeStack.length > 1) history.back();
  else { routeStack = [parent]; location.replace(`#/${parent}`); }
}
export const nav = { go, open, back, refresh: () => render() };

window.addEventListener('hashchange', () => {
  const m = parsePath();
  let dir = 'tab-in';
  if (routeStack.length > 1 && routeStack[routeStack.length - 2] === m.path) { routeStack.pop(); dir = 'back'; }
  else if (routeStack[routeStack.length - 1] !== m.path) {
    if (ROUTES[m.key].parent) { routeStack.push(m.path); dir = 'fwd'; } else routeStack = [m.path];
  }
  navigate(m, dir);
});

function navigate(m, dir) {
  scrollMemory.set(current.path, window.scrollY);
  current = m;
  render({ dir, scroll: dir === 'back' ? (scrollMemory.get(m.path) || 0) : 0 });
}

function paintSky() {
  try { document.body.style.setProperty('--now', PERIOD_SKY[currentPeriod().key]); } catch { /* */ }
}

function render({ dir = null, scroll = null } = {}) {
  const y = window.scrollY;
  const route = ROUTES[current.key];
  const ctx = { ...nav, params: current.params, today: logicalToday() };
  let page;
  try {
    const content = route.render(ctx);
    if (route.parent) {
      const title = typeof route.title === 'function' ? route.title(ctx) : (ctx.title || route.title);
      page = h('div', { class: 'page' },
        h('header', { class: 'subhead' },
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'رجوع', onclick: () => { haptic('tap'); back(); } }, icon('chevR', 22)),
          h('h1', null, content?.dataset?.title || title),
          route.actions ? route.actions(ctx) : null),
        content);
    } else page = h('div', { class: 'page' }, content);
  } catch (err) {
    console.error(err);
    page = h('div', { class: 'page' }, h('div', { class: 'empty' }, h('p', null, 'صار خطأ بعرض هالصفحة.'), h('p', { class: 'muted' }, String(err?.message || err))));
  }
  if (dir) page.classList.add(dir);
  viewEl.replaceChildren(page);
  for (const b of tabsEl.querySelectorAll('.tab')) {
    if (b.dataset.id === route.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  }
  window.scrollTo(0, scroll ?? y);
  paintSky();
}

function buildTabs() {
  tabsEl.replaceChildren(...TABS.map((t) => {
    if (t.id === 'add') return h('button', { class: 'fab', type: 'button', 'aria-label': 'إضافة مهمة', onclick: () => { haptic('select'); openCapture(); } }, icon('plus', 28, { stroke: 2.4 }));
    return h('button', {
      class: 'tab', type: 'button', 'data-id': t.id,
      onclick: () => { haptic('tap'); if (current.key === t.id) window.scrollTo({ top: 0, behavior: 'smooth' }); else go(t.id); },
    }, icon(t.icon, 24), h('span', null, t.label));
  }));
}

// تبدّل اليوم (بعد صلاة الفجر): نغلق الأيام الماضية ونحفظ لقطة
function dayTick() {
  const d = logicalToday();
  if (d === lastDay) return;
  const first = lastDay === null;
  lastDay = d;
  try { closeDays(d); } catch (e) { console.warn(e); }
  dailySnapshot(d);
  if (!first) render();
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if (local && !location.search.includes('sw')) return;
  let asked = false;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const offer = (w) => toast('في نسخة جديدة من التطبيق.', { action: 'حدّث', duration: 0, onAction: () => { asked = true; store.flush(); w.postMessage('SKIP_WAITING'); } });
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
    });
  }).catch(() => {});
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // منعيد التحميل بس إذا إنت طلبت التحديث (مو عند أول تثبيت أو الانتقال من النسخة الأولى)
    if (!asked || reloading) return;
    reloading = true; location.reload();
  });
}

async function boot() {
  const fresh = await store.init();
  // أول فتح للنسخة الجديدة: ننقل بيانات النسخة الأولى من ذاكرة المتصفح تلقائياً
  if (fresh || !store.state.settings.migratedFromV1) {
    const legacy = readLegacyLocal();
    if (legacy && !store.state.tasks.length && !store.state.habits.length) {
      store.replaceAll(fromLegacy(legacy));
      setTimeout(() => toast('نقلنا بياناتك من النسخة القديمة. كل شي محفوظ.', { duration: 6000 }), 900);
    } else if (fresh && !legacy && !driveCfg().connected) {
      // جهاز جديد: يمكن عندك نسخة بدرايف
      setTimeout(() => toast('عندك نسخة على جوجل درايف؟', { action: 'رجّعها', duration: 9000, onAction: () => go('settings') }), 1500);
    }
  }
  if (!store.state.settings.appStartDay) store.update((s) => { s.settings.appStartDay = logicalToday(); }, { silent: true });
  store.subscribe(() => { render(); markChanged(); });
  window.addEventListener('store-error', () => toast('ما انحفظت البيانات. ممكن ذاكرة الجهاز ممتلئة.', { kind: 'warn' }));
  buildTabs();
  current = parsePath();
  routeStack = ROUTES[current.key].parent ? [ROUTES[current.key].parent, current.path] : [current.path];
  dayTick();
  render({ dir: 'tab-in', scroll: 0 });
  // اختصار «مهمة جديدة» من أيقونة التطبيق
  if (/[?&]add=1/.test(location.hash)) { history.replaceState(null, '', '#/today'); setTimeout(() => openCapture(), 350); }
  setInterval(() => { dayTick(); paintSky(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { dayTick(); render(); armDrive(); } });
  armDrive();
  onDriveChange(() => { if (current.key === 'settings' && !sheetOpen()) render(); });
  if (!hasLocation()) setTimeout(() => locate().then((r) => { if (r) render(); }), 1800);
  else if (store.state.settings.prayer.lastLocCheck !== logicalToday()) locate({ silent: true });
  startReminders();
  registerSW();
}
boot();
