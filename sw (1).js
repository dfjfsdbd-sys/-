/* ================================================================
   Service Worker — المنظومة الإنتاجية
   ----------------------------------------------------------------
   الاستراتيجية:
   - index.html: الشبكة أولاً ثم الذاكرة. هكذا تصلك التحديثات فور رفعها،
     ويظل التطبيق يعمل كاملاً بلا إنترنت.
   - الأيقونات وملفات الخطوط الخارجية: الذاكرة أولاً مع تحديث صامت في الخلفية.
   - أي شيء آخر: الشبكة، ومع الفشل نعود للذاكرة.

   عند تعديل index.html ارفع الملف فقط — لا حاجة لتغيير رقم النسخة،
   لأن index.html يُجلب من الشبكة أولاً. ارفع الرقم فقط إن غيّرت هذا الملف
   أو الأيقونات، لتُمسح النسخ القديمة.
   ================================================================ */

const CACHE_VERSION = 'v1';
const CACHE_NAME = `montheoma-${CACHE_VERSION}`;

// ملفات الهيكل الأساسي التي تُخزَّن عند أول تشغيل
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png',
  './icon-32.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // addAll تفشل كلها إن فشل ملف واحد، لذا نضيف كل ملف على حدة
      .then(cache => Promise.all(
        SHELL.map(url => cache.add(url).catch(() => null))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

function isHtml(request) {
  return request.mode === 'navigate' ||
         (request.headers.get('accept') || '').includes('text/html');
}

function isStatic(url) {
  return /\.(png|jpg|jpeg|svg|ico|webp|woff2?|ttf|css)$/i.test(url.pathname) ||
         url.hostname.includes('fonts.gstatic.com') ||
         url.hostname.includes('fonts.googleapis.com') ||
         url.hostname.includes('cdnjs.cloudflare.com');
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 1) صفحة التطبيق: الشبكة أولاً حتى تصل التحديثات فوراً
  if (isHtml(request)) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(c => c.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // 2) الأيقونات والخطوط: الذاكرة أولاً مع تحديث صامت
  if (isStatic(url)) {
    event.respondWith(
      caches.match(request).then(cached => {
        const network = fetch(request)
          .then(response => {
            if (response && (response.ok || response.type === 'opaque')) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then(c => c.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // 3) الباقي: الشبكة ثم الذاكرة عند الفشل
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// يسمح للصفحة بطلب تفعيل نسخة جديدة فوراً
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
