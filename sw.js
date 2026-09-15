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

const CACHE_VERSION = 'v4';
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

// موارد خارجية نخزّنها مسبقاً ليعمل التطبيق بلا إنترنت من أول مرة
const EXTERNAL = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // addAll تفشل كلها إن فشل ملف واحد، لذا نضيف كل ملف على حدة
      .then(cache => Promise.all(
        SHELL.map(url => cache.add(url).catch(() => null)).concat(
          EXTERNAL.map(url =>
            fetch(url, { mode: 'no-cors' })
              .then(r => cache.put(url, r))
              .catch(() => null)
          )
        )
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

// نداءات جوجل لا تُخزَّن ولا تمرّ عبر الكاش إطلاقاً
function isGoogleApi(url) {
  return url.hostname.includes('googleapis.com') ||
         url.hostname.includes('accounts.google.com') ||
         url.hostname.includes('gstatic.com') && url.pathname.includes('gsi');
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

  // المصادقة والمزامنة تمرّ مباشرة للشبكة
  if (isGoogleApi(url)) return;

  // 1) صفحة التطبيق: الشبكة أولاً حتى تصل التحديثات فوراً،
  //    ومع انقطاع الشبكة نعود للنسخة المخزّنة فلا تظهر صفحة "لا يوجد اتصال".
  //    ignoreSearch مهم: رابط التشغيل قد يحمل معاملات إضافية (?source=pwa)
  //    فلا يطابق المفتاح المخزّن بدونها.
  if (isHtml(request)) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(c => c.put('./index.html', copy));
          }
          return response;
        })
        .catch(() =>
          caches.match('./index.html', { ignoreSearch: true })
            .then(r => r || caches.match(request, { ignoreSearch: true }))
            .then(r => r || caches.match('./', { ignoreSearch: true }))
            .then(r => r || new Response(
              '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8">' +
              '<body style="background:#0b0b0f;color:#f2f2f7;font-family:sans-serif;' +
              'display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center">' +
              '<div>النسخة المخزّنة غير جاهزة بعد.<br>افتح التطبيق مرة واحدة والإنترنت متصل.</div></body></html>',
              { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            ))
        )
    );
    return;
  }

  // 2) الأيقونات والخطوط: الذاكرة أولاً مع تحديث صامت
  if (isStatic(url)) {
    event.respondWith(
      caches.match(request, { ignoreSearch: false }).then(cached => {
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

/* ----------------------------------------------------------------
   النقر على الإشعار: نركّز نافذة التطبيق المفتوحة إن وُجدت،
   ولا نفتح تبويباً جديداً في كل مرة.
   ---------------------------------------------------------------- */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./index.html');
    })
  );
});
