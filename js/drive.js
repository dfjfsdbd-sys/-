// المزامنة مع Google Drive
// ملف واحد بدرايفك (manzumati-backup.json). صلاحية drive.file: التطبيق ما بيشوف إلا الملفات اللي هو عملها.
// لا سيرفر ولا وسيط: البيانات بتروح من جهازك لدرايفك مباشرة. كل شي هون اختياري وبيفشل بهدوء بلا نت.
import { store, backupPayload, isBackup, saveManualSnapshot } from './store.js';
import { isLegacyBackup, fromLegacy } from './legacy.js';

// نفس معرّف التطبيق تبع النسخة الأولى (مربوط بعنوان موقعك على GitHub Pages)
const CLIENT_ID = '311844278883-8evjhdp65mrugf1qqvvj5qshjeqbk6nm.apps.googleusercontent.com';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FILE = 'manzumati-backup.json';
const LEGACY_FILE = 'montheoma-backup.json';
const CFG_KEY = 'manz:drive';
const TOK_KEY = 'manz:driveTok';
const AUTO_GAP = 10 * 60 * 1000;       // أقل فاصل بين رفعين تلقائيين
const DAILY_GAP = 20 * 3600 * 1000;    // النسخة اليومية

const listeners = new Set();
export const onDriveChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => { for (const fn of listeners) { try { fn(); } catch { /* */ } } };

function readCfg() {
  try {
    const c = JSON.parse(localStorage.getItem(CFG_KEY) || 'null');
    if (c) return c;
    // ننقل حالة الربط من النسخة الأولى: ما بتحتاج تختار حسابك من جديد
    const old = JSON.parse(localStorage.getItem('driveCfg') || 'null');
    if (old?.connected) return { connected: true, email: old.email || '', auto: old.auto !== false, lastSync: null, lastLocalChange: Date.now(), fromV1: true };
  } catch { /* */ }
  return { connected: false, email: '', auto: true, lastSync: null, lastLocalChange: null };
}
let cfg = readCfg();
const saveCfg = () => { try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch { /* */ } emit(); };
export const driveCfg = () => ({ ...cfg, busy: Boolean(running) });

/* ---------- رمز الوصول ---------- */
let token = null, tokenExp = 0, client = null, gisReady = false, waiters = [];
(function restoreToken() {
  for (const k of [TOK_KEY, 'driveTok']) {
    try {
      const o = JSON.parse(localStorage.getItem(k) || 'null');
      if (o?.t && Date.now() < o.e - 60000) { token = o.t; tokenExp = o.e; return; }
    } catch { /* */ }
  }
})();
const tokenValid = () => Boolean(token) && Date.now() < tokenExp - 60000;
function cacheToken(t, sec) {
  token = t; tokenExp = Date.now() + (sec || 3600) * 1000;
  try { localStorage.setItem(TOK_KEY, JSON.stringify({ t: token, e: tokenExp })); } catch { /* */ }
}
function clearToken() { token = null; tokenExp = 0; try { localStorage.removeItem(TOK_KEY); localStorage.removeItem('driveTok'); } catch { /* */ } }

function loadGIS() {
  return new Promise((res, rej) => {
    if (gisReady && window.google?.accounts) return res();
    let sc = document.getElementById('gis-script');
    if (!sc) {
      sc = document.createElement('script');
      sc.id = 'gis-script'; sc.src = 'https://accounts.google.com/gsi/client'; sc.async = true;
      document.head.appendChild(sc);
    }
    const t0 = Date.now();
    const iv = setInterval(() => {
      if (window.google?.accounts) { clearInterval(iv); gisReady = true; res(); }
      else if (Date.now() - t0 > 12000) { clearInterval(iv); rej(new Error('offline')); }
    }, 150);
    sc.onerror = () => { clearInterval(iv); sc.remove(); rej(new Error('offline')); };
  });
}
function settle(err) { const ws = waiters; waiters = []; ws.forEach((w) => (err ? w.reject(err) : w.resolve(token))); }
// منحمّل عميل جوجل مسبقاً، حتى نافذة تسجيل الدخول تنفتح جوّا ضغطتك مباشرة (وإلا المتصفح بيحجبها)
export function prepareDrive() {
  if (client) return Promise.resolve();
  return loadGIS().then(() => {
    if (client) return;
    client = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID, scope: SCOPE,
      callback: (r) => { if (r?.access_token) { cacheToken(r.access_token, r.expires_in); settle(null); } else settle(new Error(r?.error || 'denied')); },
      error_callback: (e) => settle(new Error(e?.type || 'denied')),
    });
  });
}
function requestToken() {
  return new Promise((resolve, reject) => {
    if (!client) return reject(new Error('gis-not-ready'));
    waiters.push({ resolve, reject });
    const req = { prompt: '' };
    if (cfg.email) { req.login_hint = cfg.email; req.hint = cfg.email; }
    try { client.requestAccessToken(req); } catch (e) { settle(e); }
  });
}
// silent: بلا أي نافذة — إمّا رمز صالح محفوظ أو رفض
function getToken(silent) {
  if (tokenValid()) return Promise.resolve(token);
  if (silent) return Promise.reject(new Error('needs-signin'));
  return prepareDrive().then(requestToken);
}

async function dfetch(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: `Bearer ${token}` } });
  if (r.status === 401) { clearToken(); throw new Error('expired'); }
  if (!r.ok) throw new Error(`http-${r.status}`);
  return r;
}
async function findFile(name) {
  const q = encodeURIComponent(`name='${name}' and trashed=false`);
  const j = await (await dfetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&pageSize=5`)).json();
  return (j.files || [])[0] || null;
}
async function upload() {
  const file = await findFile(FILE);
  const meta = file ? {} : { name: FILE, description: 'نسخة احتياطية من منظومتي (المنظومة الإنتاجية)' };
  const b = `-------manz${Date.now()}`;
  const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(backupPayload())}\r\n--${b}--`;
  await dfetch(file ? `https://www.googleapis.com/upload/drive/v3/files/${file.id}?uploadType=multipart` : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: file ? 'PATCH' : 'POST', headers: { 'Content-Type': `multipart/related; boundary=${b}` }, body,
  });
}
async function rememberEmail() {
  try {
    const j = await (await dfetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)')).json();
    if (j?.user?.emailAddress) { cfg.email = j.user.emailAddress; saveCfg(); }
  } catch { /* */ }
}

/* ---------- العمليات ---------- */
const ERR = {
  'needs-signin': 'لازم تفوت على حسابك مرة تانية. اضغط «ارفع هلّق».',
  expired: 'انتهى الإذن. اضغط «ارفع هلّق» مرة تانية.',
  denied: 'انلغى تسجيل الدخول.', access_denied: 'انلغى تسجيل الدخول.', popup_closed: 'انسكّرت نافذة جوجل.',
  popup_failed_to_open: 'المتصفح منع نافذة جوجل. اسمح بالنوافذ المنبثقة وجرّب.',
  offline: 'ما قدرنا نوصل لجوجل. تأكد من النت.',
};
export const driveError = (e) => ERR[String(e?.message || e)] || 'ما زبطت المزامنة. جرّب بعدين.';

export async function connectDrive() {
  if (!navigator.onLine) throw new Error('offline');
  await prepareDrive();
  await requestToken();
  await rememberEmail();
  cfg.connected = true; saveCfg();
  // إذا في نسخة على درايف وجهازك فاضي، منرجّعلك ياها بدل ما نكتب فوقها
  const remote = await peekRemote().catch(() => null);
  if (remote && isEmptyLocal()) return { remote };
  await syncNow({ silent: false });
  return { remote: null };
}
export function disconnectDrive() {
  try { if (token && window.google?.accounts) google.accounts.oauth2.revoke(token, () => {}); } catch { /* */ }
  clearToken();
  cfg = { connected: false, email: '', auto: cfg.auto, lastSync: null, lastLocalChange: null };
  saveCfg();
}
export function setDriveAuto(on) { cfg.auto = Boolean(on); saveCfg(); }

let running = null;
export function syncNow({ silent = true } = {}) {
  if (!cfg.connected || !navigator.onLine) return Promise.resolve(false);
  if (running) return running;
  if (silent) {
    const changed = cfg.lastLocalChange && (!cfg.lastSync || cfg.lastLocalChange > cfg.lastSync);
    const recent = cfg.lastSync && Date.now() - cfg.lastSync < AUTO_GAP;
    if (!changed || recent) return Promise.resolve(false);
  }
  emit();
  running = getToken(silent)
    .then(upload)
    .then(() => { cfg.lastSync = Date.now(); if (cfg.fromV1) delete cfg.fromV1; saveCfg(); return true; })
    .catch((e) => { if (!silent) throw e; return false; })
    .finally(() => { running = null; emit(); });
  return running;
}

function isEmptyLocal() {
  const s = store.state;
  return !s.tasks.length && !s.subjects.length && !s.series.length && !s.habits.length;
}
// شو في على درايف: نسخة جديدة، أو نسخة النسخة الأولى
export async function peekRemote() {
  await getToken(false);
  let file = await findFile(FILE), legacy = false;
  if (!file) { file = await findFile(LEGACY_FILE); legacy = Boolean(file); }
  if (!file) return null;
  const p = await (await dfetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`)).json();
  let data = null;
  if (isBackup(p)) data = p.data;
  else if (isLegacyBackup(p)) data = fromLegacy(p);
  if (!data) return null;
  return {
    data, legacy, modified: file.modifiedTime,
    summary: `${data.tasks?.length || 0} مهمة · ${data.subjects?.length || 0} مادة · ${data.series?.length || 0} سلسلة`,
  };
}
export async function applyRemote(remote) {
  await saveManualSnapshot('قبل الاسترجاع من درايف');
  store.replaceAll(remote.data);
  cfg.lastSync = Date.now(); cfg.lastLocalChange = null; saveCfg();
}

// أي تعديل بالتطبيق: منسجّل إنو في تغيير، ومنرفع بصمت بعد دقيقة إذا الإذن لسّا صالح
let debounce = 0;
export function markChanged() {
  if (!cfg.connected || !cfg.auto) return;
  cfg.lastLocalChange = Date.now();
  try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch { /* */ }
  if (!tokenValid()) return;
  clearTimeout(debounce);
  debounce = setTimeout(() => syncNow({ silent: true }), 60000);
}
// عند فتح التطبيق: منحضّر عميل جوجل، ومنرفع إذا صار يوم من آخر نسخة والإذن صالح
export function armDrive() {
  if (!cfg.connected) return;
  if (navigator.onLine) prepareDrive().catch(() => {});
  const last = cfg.lastSync || 0;
  if (cfg.auto && tokenValid() && Date.now() - last > DAILY_GAP) syncNow({ silent: true });
}
// النسخة متأخرة؟ (للتذكير اللطيف بالإعدادات واليوم)
export function driveStale() {
  if (!cfg.connected) return false;
  const changed = cfg.lastLocalChange && (!cfg.lastSync || cfg.lastLocalChange > cfg.lastSync);
  return Boolean(changed) && (!cfg.lastSync || Date.now() - cfg.lastSync > 2 * 86400000);
}
