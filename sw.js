/* ================================================================
   Service Worker — منظومتي (النسخة 2)
   ----------------------------------------------------------------
   - صفحة التطبيق (index.html): الشبكة أولاً، وبلا نت من الذاكرة.
   - ملفات التطبيق (css/js/الأيقونات): من الذاكرة فوراً. بتنخزّن كلها
     عند التثبيت، فالتطبيق بيشتغل كامل بلا نت من أول مرة.
   - الخطوط وصور يوتيوب المصغّرة: من الذاكرة، وبتنخزّن أول ما تنطلب.
   - طلبات جوجل درايف، القرآن، الأطعمة، يوتيوب: للشبكة مباشرة.

   ★ كل ما تعدّل أي ملف بالتطبيق: غيّر رقم VERSION تحت وارفع sw.js معه.
     التطبيق بيطلعلك «في نسخة جديدة — حدّث».
   ================================================================ */

const VERSION = '2.5.2';
const CACHE = `manzumati-${VERSION}`;
const RUNTIME = 'manzumati-runtime';

const SHELL = [
  './', './index.html', './manifest.json',
  './icon-32.png', './icon-180.png', './icon-192.png', './icon-512.png', './maskable-192.png', './maskable-512.png',
  './css/app.css',
  './js/app.js', './js/store.js', './js/db.js', './js/ui.js', './js/icons.js', './js/dates.js', './js/prayer.js',
  './js/shifts.js', './js/rewards.js', './js/tasks.js', './js/parse.js', './js/legacy.js', './js/worship.js',
  './js/habits.js', './js/commit.js', './js/notify.js', './js/library.js', './js/youtube.js', './js/sport.js', './js/drive.js',
  './js/events.js', './js/libitems.js', './js/routine.js', './js/sleep.js',
  './js/data/adhkar.js', './js/data/quran-meta.js', './js/data/foods.js',
  './js/views/components.js', './js/views/capture.js', './js/views/today.js', './js/views/worship.js',
  './js/views/habits.js', './js/views/daysheet.js', './js/views/plan.js', './js/views/goals.js',
  './js/views/study.js', './js/views/focus.js', './js/views/books.js', './js/views/series.js',
  './js/views/tracks.js', './js/views/progress.js', './js/views/commit.js', './js/views/rewards.js',
  './js/views/sport.js', './js/views/settings.js', './js/views/taskopen.js', './js/views/khatma.js', './js/views/muhasaba.js', './js/views/morning.js', './js/views/donesheets.js',
  './js/views/eventform.js', './js/views/review.js', './js/views/routine.js', './js/views/sleepview.js',
  './js/views/insight.js', './js/views/exams.js', './share.html', './js/hifz.js', './js/views/hifz.js', './js/alarm.js', './js/views/bedside.js',
  './js/projects.js', './js/views/projects.js', './js/fasting.js', './js/views/fasting.js', './js/data/duas.js', './js/views/duas.js',
  './js/suggest.js', './js/views/ytshare.js', './js/qaudio.js', './js/badges.js', './js/views/badges.js', './js/views/lock.js',
  './js/care.js', './js/views/care.js',
];
const FONTS_CSS = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=Amiri:wght@400;700&family=Amiri+Quran&display=swap';
const FA_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // كل ملف لحاله: فشل ملف واحد ما بيوقّف التثبيت
    await Promise.all(SHELL.map((u) => cache.add(new Request(u, { cache: 'reload' })).catch(() => null)));
    const rt = await caches.open(RUNTIME);
    await Promise.all([FONTS_CSS, FA_CSS].map((u) => fetch(u).then((r) => r.ok && rt.put(u, r)).catch(() => null)));
    // أول تثبيت، أو الانتقال من النسخة الأولى (montheoma): منشتغل فوراً.
    // التحديثات العادية بتستنى زر «حدّث» من التطبيق
    const fromV1 = (await caches.keys()).some((k) => k.startsWith('montheoma-'));
    if (!self.registration.active || fromV1) self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    // صوت القرآن المحفوظ للحفظ بيضل بين التحديثات
    await Promise.all(keys.filter((k) => k !== CACHE && k !== RUNTIME && k !== 'quran-audio').map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

const isHtml = (req) => req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
const BYPASS = /(googleapis\.com\/(drive|upload|oauth)|accounts\.google\.com|alquran\.cloud|islamic\.network|everyayah\.com|openfoodfacts|youtube\.com|youtube-nocookie\.com|piped|invidious|googlevideo)/;
const RUNTIME_CACHE = /(fonts\.googleapis\.com|fonts\.gstatic\.com|i\.ytimg\.com|cdnjs\.cloudflare\.com)/;

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (BYPASS.test(url.href) || url.pathname.endsWith('/__backup.json')) return;

  // 1) صفحة التطبيق: الشبكة أولاً. الصفحات التانية (share.html…) بتنخزّن باسمها مش مكان index.html
  if (url.origin === location.origin && isHtml(req)) {
    const isApp = url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(isApp ? './index.html' : url.pathname, copy)); }
        return res;
      } catch {
        if (!isApp) { const own = await caches.match(url.pathname, { ignoreSearch: true }); if (own) return own; }
        return (await caches.match('./index.html', { ignoreSearch: true }))
          || (await caches.match('./', { ignoreSearch: true }))
          || new Response('<!doctype html><meta charset="utf-8"><body style="background:#0E1320;color:#E8ECF6;font-family:sans-serif;display:grid;place-items:center;height:100vh;margin:0;text-align:center" dir="rtl">افتح التطبيق مرة والنت شغّال، وبعدها بيشتغل بلا نت.</body>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }

  // 2) ملفات التطبيق: من الذاكرة، وإذا مو موجودة من الشبكة ومنخزّنها
  if (url.origin === location.origin) {
    event.respondWith((async () => {
      const cached = await caches.match(req, { ignoreSearch: true });
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      } catch {
        return new Response('', { status: 504 });
      }
    })());
    return;
  }

  // 3) الخطوط والصور المصغّرة: من الذاكرة، ومنخزّنها أول مرة
  if (RUNTIME_CACHE.test(url.hostname)) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(RUNTIME).then((c) => c.put(req, copy)); }
        return res;
      } catch {
        return cached || new Response('', { status: 504 });
      }
    })());
  }
});

// الضغط على إشعار: منفتح نافذة التطبيق الموجودة بدل تبويب جديد
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || './#/today';
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) { if ('focus' in c) { c.navigate?.(target).catch?.(() => {}); return c.focus(); } }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  })());
});
