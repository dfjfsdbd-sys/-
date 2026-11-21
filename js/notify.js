// التذكيرات: إشعار من التطبيق وهو مفتوح أو بالخلفية القريبة، ولأي مهمة بساعة: «أضف لتقويم جوجل» (تذكير مضمون حتى والتطبيق مسكّر)
import { store } from './store.js';
import { toast } from './ui.js';
import { logicalToday, adhanFor, PRAYER_NAMES } from './prayer.js';
import { tasksOn, isDoneOn } from './tasks.js';
import { addDays, parseISO, toMin } from './dates.js';

const pad = (n) => String(n).padStart(2, '0');
function stamp(dayIso, hhmm, plusMin = 0) {
  const d = parseISO(dayIso);
  const [h, m] = hhmm.split(':').map(Number);
  d.setHours(h, m + plusMin, 0, 0);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}
export function googleCalendarUrl(t, day) {
  const date = t.date || day;
  const start = stamp(date, t.time);
  const end = stamp(date, t.time, Math.max(15, t.estimate || 30));
  const p = new URLSearchParams({ action: 'TEMPLATE', text: t.title, dates: `${start}/${end}`, details: t.notes || 'من تطبيق منظومتي' });
  if (t.recur?.type === 'daily') p.set('recur', 'RRULE:FREQ=DAILY');
  if (t.recur?.type === 'weekly' && t.recur.days?.length) p.set('recur', `RRULE:FREQ=WEEKLY;BYDAY=${t.recur.days.map((d) => ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][d]).join(',')}`);
  if (t.recur?.type === 'monthly') p.set('recur', 'RRULE:FREQ=MONTHLY');
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export const notifySupported = () => 'Notification' in window;
export async function askPermission() {
  if (!notifySupported()) return false;
  if (Notification.permission === 'granted') return true;
  const r = await Notification.requestPermission();
  return r === 'granted';
}
async function show(title, body, tag) {
  try {
    if (notifySupported() && Notification.permission === 'granted') {
      const reg = await navigator.serviceWorker?.getRegistration?.();
      if (reg) { reg.showNotification(title, { body, tag, icon: 'icon-192.png', badge: 'icon-192.png', dir: 'rtl', lang: 'ar' }); return; }
      new Notification(title, { body, tag, dir: 'rtl' });
      return;
    }
  } catch { /* */ }
  if (document.visibilityState === 'visible') toast(`${title}${body ? ` — ${body}` : ''}`, { kind: 'gold', duration: 7000 });
}

const fired = new Set();
let timer = 0;
// كل دقيقة: شو مستحق خلال الدقيقة الجاية؟
function tick() {
  const s = store.state.settings.notify || {};
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const cal = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const day = logicalToday(now);
  if (s.tasks !== false) {
    for (const d of new Set([day, cal])) {
      for (const t of tasksOn(d)) {
        if (t.remind == null || !t.time || isDoneOn(t, d)) continue;
        let at = toMin(t.time) - (t.remind || 0);
        let atDay = d;
        while (at < 0) { at += 1440; atDay = addDays(atDay, -1); }
        const key = `t:${t.id}:${d}`;
        if (atDay === cal && Math.abs(at - nowMin) <= 1 && !fired.has(key)) { fired.add(key); show(t.title, t.remind ? `بعد ${t.remind >= 60 ? `${t.remind / 60} ساعة` : `${t.remind} دقيقة`}` : 'هلق وقتها', key); }
      }
    }
  }
  if (s.prayers) {
    const a = adhanFor(cal);
    for (const k of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) {
      const key = `p:${cal}:${k}`;
      if (a[k] && toMin(a[k]) === nowMin && !fired.has(key)) { fired.add(key); show(`أذان ${PRAYER_NAMES[k]}`, 'حيّ على الصلاة', key); }
    }
  }
}
export function startReminders() {
  clearInterval(timer);
  timer = setInterval(tick, 30000);
  tick();
}
