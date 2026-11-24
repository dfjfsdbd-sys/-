// المنبه القوي (وضع السرير): التطبيق بيضل فاتح والشاشة شغّالة، وعلى الوقت بيرنّ بنغمة من جوالك
// وبيعلى تدريجياً، وما بيسكت إلا بحلّ مسائل. تطبيق الويب ما بيقدر يرنّ وهو مسكّر — فهاد الحل الأكيد،
// ومعه زر بيضبط منبّه الجوال نفسه كاحتياط (على أندرويد).
import { kvGet, kvSet, kvDel } from './db.js';
import { store } from './store.js';

export const ALARM_DEF = { count: 3, level: 'mid', gradual: true, vibrate: true, toneName: null };
export const LEVELS = { easy: 'سهل', mid: 'وسط', hard: 'صعب' };
export const alarmCfg = () => ({ ...ALARM_DEF, ...(store.state.settings.alarm || {}) });
export function setAlarm(patch) { store.update((s) => { s.settings.alarm = { ...alarmCfg(), ...patch }; }); }

/* ---------- النغمة ---------- */
export async function setTone(file) {
  await kvSet('alarmTone', { name: file.name, type: file.type, blob: file });
  setAlarm({ toneName: file.name });
}
export async function clearTone() { await kvDel('alarmTone'); setAlarm({ toneName: null }); }

/* ---------- المسائل ---------- */
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
export function mathProblem(level = 'mid') {
  if (level === 'easy') { const a = rnd(12, 49), b = rnd(11, 49); return { q: `${a} + ${b}`, a: a + b }; }
  if (level === 'hard') { const a = rnd(13, 29), b = rnd(6, 9), c = rnd(15, 60); return { q: `${a} × ${b} − ${c}`, a: a * b - c }; }
  const a = rnd(11, 39), b = rnd(3, 9), c = rnd(5, 40);
  return { q: `${a} × ${b} + ${c}`, a: a * b + c };
}

/* ---------- الرنين ---------- */
let audio = null, actx = null, beepTimer = 0, rampTimer = 0, vibTimer = 0, url = null;
function beepLoop(gainNode) {
  // نغمة افتراضية: ثلاث رنّات قوية كل ثانية ونص
  const play = () => {
    const t = actx.currentTime;
    for (let i = 0; i < 3; i++) {
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = 'square'; o.frequency.value = i === 2 ? 1046 : 880;
      g.gain.setValueAtTime(0.0001, t + i * 0.22);
      g.gain.exponentialRampToValueAtTime(0.9, t + i * 0.22 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.22 + 0.18);
      o.connect(g); g.connect(gainNode);
      o.start(t + i * 0.22); o.stop(t + i * 0.22 + 0.2);
    }
  };
  play();
  beepTimer = setInterval(play, 1500);
}
export async function startRinging({ gradual = true, vibrate = true, preview = false } = {}) {
  stopRinging();
  const tone = await kvGet('alarmTone').catch(() => null);
  let vol = gradual ? 0.12 : 1;
  if (tone?.blob) {
    url = URL.createObjectURL(tone.blob);
    audio = new Audio(url);
    audio.loop = true;
    audio.volume = vol;
    try { await audio.play(); } catch { audio = null; }
  }
  if (!audio) {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    const g = actx.createGain(); g.gain.value = vol; g.connect(actx.destination);
    try { await actx.resume(); } catch { /* */ }
    beepLoop(g);
    audio = { set volume(v) { g.gain.value = v; }, get volume() { return g.gain.value; }, pause() {} };
  }
  if (gradual) rampTimer = setInterval(() => { vol = Math.min(1, vol + 0.03); try { audio.volume = vol; } catch { /* */ } if (vol >= 1) clearInterval(rampTimer); }, 1000);
  if (vibrate && navigator.vibrate && !preview) { navigator.vibrate([600, 300, 600]); vibTimer = setInterval(() => navigator.vibrate([600, 300, 600]), 1800); }
}
export function stopRinging() {
  clearInterval(beepTimer); clearInterval(rampTimer); clearInterval(vibTimer);
  try { audio?.pause(); } catch { /* */ }
  try { actx?.close(); } catch { /* */ }
  try { navigator.vibrate?.(0); } catch { /* */ }
  if (url) { URL.revokeObjectURL(url); url = null; }
  audio = null; actx = null;
}

/* ---------- إبقاء الشاشة شغّالة ---------- */
let lock = null;
export async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator) { lock = await navigator.wakeLock.request('screen'); return true; }
    if (!on && lock) { await lock.release(); lock = null; }
  } catch { return false; }
  return Boolean(lock);
}

/* ---------- منبّه الجوال (أندرويد) ---------- */
export const isAndroid = () => /android/i.test(navigator.userAgent || '');
export function phoneAlarmUrl(hhmm, label = 'المنظومة') {
  const [hh, mm] = hhmm.split(':').map(Number);
  return `intent:#Intent;action=android.intent.action.SET_ALARM;i.android.intent.extra.alarm.HOUR=${hh};i.android.intent.extra.alarm.MINUTES=${mm};S.android.intent.extra.alarm.MESSAGE=${encodeURIComponent(label)};B.android.intent.extra.alarm.SKIP_UI=false;end`;
}
