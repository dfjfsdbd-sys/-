// قفل التطبيق: رمز من 4 أرقام (أو البصمة إذا الجوال بيدعم)، بيقفل لحاله لما تطلع من التطبيق.
// هاد قفل من الفضول — مش تشفير للبيانات.
import { h, icon, fill, openSheet, toast, haptic } from '../ui.js';
import { store } from '../store.js';

export const lockCfg = () => ({ on: false, after: 60, bio: null, ...(store.state.settings.lock || {}) });
const setLock = (patch) => store.update((s) => { s.settings.lock = { ...lockCfg(), ...patch }; });
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function hashPin(pin, salt) {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  return b64(await crypto.subtle.digest('SHA-256', data));
}
export async function bioAvailable() {
  try { return Boolean(window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch { return false; }
}

/* ---------- شاشة القفل ---------- */
let overlay = null, hiddenAt = 0;
function showLock() {
  const c = lockCfg();
  if (!c.on || overlay) return;
  let pin = '';
  overlay = h('div', { class: 'lk', role: 'dialog', 'aria-label': 'التطبيق مقفول' });
  document.body.append(overlay);
  async function bio() {
    try {
      await navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(16)), allowCredentials: [{ type: 'public-key', id: unb64(c.bio) }], userVerification: 'required', timeout: 60000 } });
      unlock();
    } catch { /* المستخدم لغى */ }
  }
  async function press(k) {
    haptic('select');
    if (k === 'del') pin = pin.slice(0, -1);
    else if (k === 'bio') { bio(); return; }
    else if (pin.length < 4) pin += k;
    draw();
    if (pin.length === 4) {
      if (await hashPin(pin, c.salt) === c.hash) unlock();
      else { overlay.classList.add('shake'); try { navigator.vibrate?.(200); } catch { /* */ } setTimeout(() => { overlay?.classList.remove('shake'); pin = ''; draw(); }, 450); }
    }
  }
  function draw() {
    fill(overlay, [h('div', { class: 'lk-in' },
      h('span', { class: 'lk-logo' }, icon('seedling', 26)),
      h('b', null, 'المنظومة مقفولة'),
      h('small', null, 'دخّل رمزك'),
      h('div', { class: 'lk-dots' }, [0, 1, 2, 3].map((i) => h('i', { class: i < pin.length ? 'on' : '' }))),
      h('div', { class: 'lk-pad' }, ['1', '2', '3', '4', '5', '6', '7', '8', '9', c.bio ? 'bio' : '', '0', 'del'].map((k) => (k ? h('button', { type: 'button', class: k === 'bio' || k === 'del' ? 'g' : '', 'aria-label': k === 'bio' ? 'البصمة' : k === 'del' ? 'امسح' : k, onclick: () => press(k) }, k === 'bio' ? icon('fingerprint', 20) : k === 'del' ? icon('delete-left', 18) : k) : h('span')))),
      h('button', { type: 'button', class: 'lk-forgot', onclick: () => toast('إذا نسيت الرمز: امسح بيانات التطبيق من إعدادات المتصفح، وبعدين رجّع نسختك من جوجل درايف أو من ملف النسخة.', { duration: 9000 }) }, 'نسيت الرمز؟'))]);
  }
  draw();
  if (c.bio) setTimeout(bio, 300);
}
function unlock() {
  haptic('success');
  overlay?.remove(); overlay = null;
}
export function initLock() {
  if (lockCfg().on) showLock();
  document.addEventListener('visibilitychange', () => {
    const c = lockCfg();
    if (!c.on) return;
    if (document.visibilityState === 'hidden') hiddenAt = Date.now();
    else if (hiddenAt && Date.now() - hiddenAt >= (c.after || 0) * 1000) showLock();
  });
}

/* ---------- الإعداد ---------- */
export function openPinSetup(onDone) {
  let first = null, pin = '';
  openSheet('رمز القفل', (body, close) => {
    async function press(k) {
      haptic('select');
      if (k === 'del') pin = pin.slice(0, -1); else if (pin.length < 4) pin += k;
      draw();
      if (pin.length < 4) return;
      if (!first) { first = pin; pin = ''; setTimeout(draw, 150); return; }
      if (pin !== first) { toast('الرمزين مش متل بعض — جرّب من جديد', { kind: 'warn' }); first = null; pin = ''; draw(); return; }
      const salt = b64(crypto.getRandomValues(new Uint8Array(12)));
      setLock({ on: true, salt, hash: await hashPin(pin, salt) });
      close(); toast('انقفل التطبيق بالرمز'); onDone?.();
    }
    function draw() {
      fill(body, [h('div', { class: 'lk-in setup' },
        h('small', null, first ? 'رجاع اكتبه مرة تانية' : 'اختار رمز من 4 أرقام'),
        h('div', { class: 'lk-dots' }, [0, 1, 2, 3].map((i) => h('i', { class: i < pin.length ? 'on' : '' }))),
        h('div', { class: 'lk-pad' }, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k) => (k ? h('button', { type: 'button', class: k === 'del' ? 'g' : '', onclick: () => press(k) }, k === 'del' ? icon('delete-left', 18) : k) : h('span')))))]);
    }
    draw();
  });
}
export async function enableBio() {
  try {
    const cred = await navigator.credentials.create({ publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(16)),
      rp: { name: 'المنظومة الإنتاجية' },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'manzuma', displayName: 'أنا' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000,
    } });
    setLock({ bio: b64(cred.rawId) });
    toast('صار فيك تفتح بالبصمة');
    return true;
  } catch { toast('ما زبطت البصمة على هالجهاز.', { kind: 'warn' }); return false; }
}
export function disableLock() { setLock({ on: false, hash: null, salt: null, bio: null }); }
export function setLockAfter(sec) { setLock({ after: sec }); }
export function disableBio() { setLock({ bio: null }); }
