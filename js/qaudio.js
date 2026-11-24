// صوت القرآن للحفظ: آية آية بصوت قارئ بتختاره، كل آية بتنعاد كم مرة، والمقطع كله كم مرة،
// ووضع الترديد (بيسكت بعد كل آية قدّها لتعيدها). الصوت بينحفظ عالجهاز إذا بدك.
import { store } from './store.js';
import { SURAHS } from './data/quran-meta.js';

export const RECITERS = { husary_m: 'الحصري المعلّم (للحفظ)', husary: 'الحصري', minshawi: 'المنشاوي', alafasy: 'العفاسي' };
// من everyayah.com (بيسمح نحفظ الصوت عالجهاز)
const FOLDER = { husary_m: 'Husary_Muallim_128kbps', husary: 'Husary_128kbps', minshawi: 'Minshawy_Murattal_128kbps', alafasy: 'Alafasy_128kbps' };
const AUDIO_CACHE = 'quran-audio';
export const audioCfg = () => { const c = { reciter: 'husary_m', perAyah: 3, loops: 3, echo: true, speed: 1, ...(store.state.settings.qaudio || {}) }; if (!FOLDER[c.reciter]) c.reciter = 'husary_m'; return c; };
export function setAudioCfg(patch) { store.update((s) => { s.settings.qaudio = { ...audioCfg(), ...patch }; }, { silent: true }); }

// رقم الآية بالمصحف كله (من عدد آيات السور قبلها)
const STARTS = (() => { const out = [0]; for (const s of SURAHS) out.push(out[out.length - 1] + s.ayahs); return out; })();
export const globalAyah = (s, n) => STARTS[s - 1] + n;
const p3 = (n) => String(n).padStart(3, '0');
export const ayahUrl = (reciter, s, n) => `https://everyayah.com/data/${FOLDER[reciter] || FOLDER.husary_m}/${p3(s)}${p3(n)}.mp3`;

// مقطع اليوم من آيات الصفحة (نص، ربع…)
export function portionAyahs(ayahs, part = 1, of = 1) {
  if (of <= 1) return ayahs;
  const size = Math.ceil(ayahs.length / of);
  return ayahs.slice((part - 1) * size, part * size);
}

async function srcFor(url) {
  try {
    const c = await caches.open(AUDIO_CACHE);
    const hit = await c.match(url);
    if (hit) return URL.createObjectURL(await hit.blob());
  } catch { /* */ }
  return url;
}
export async function saveOffline(reciter, ayahs, onProgress) {
  const c = await caches.open(AUDIO_CACHE);
  let done = 0;
  for (const a of ayahs) {
    const url = ayahUrl(reciter, a.s, a.n);
    if (!(await c.match(url))) { const r = await fetch(url); if (!r.ok) throw new Error('net'); await c.put(url, r); }
    done += 1; onProgress?.(done, ayahs.length);
  }
}
export async function isSaved(reciter, ayahs) {
  try { const c = await caches.open(AUDIO_CACHE); for (const a of ayahs) if (!(await c.match(ayahUrl(reciter, a.s, a.n)))) return false; return true; } catch { return false; }
}

// المشغّل: بيرجع أدوات تحكّم، وبيخبّر بالتغييرات عبر onState
export function createPlayer(ayahs, onState) {
  const cfg = audioCfg();
  const audio = new Audio();
  let i = 0, rep = 1, loop = 1, playing = false, waitT = 0, objUrl = null;
  const state = () => ({ i, rep, loop, playing, cfg, total: ayahs.length });
  async function load() {
    if (objUrl) { URL.revokeObjectURL(objUrl); objUrl = null; }
    const src = await srcFor(ayahUrl(cfg.reciter, ayahs[i].s, ayahs[i].n));
    if (src.startsWith('blob:')) objUrl = src;
    audio.src = src;
    audio.playbackRate = cfg.speed || 1;
  }
  async function play() { playing = true; onState(state()); await load(); try { await audio.play(); } catch { playing = false; onState({ ...state(), error: true }); } }
  function next() {
    if (rep < cfg.perAyah) { rep += 1; }
    else { rep = 1; i += 1; if (i >= ayahs.length) { i = 0; loop += 1; if (loop > cfg.loops) { loop = cfg.loops; playing = false; onState({ ...state(), finished: true }); return; } } }
    play();
  }
  audio.addEventListener('ended', () => {
    if (!playing) return;
    if (cfg.echo) { const ms = Math.max(1500, (audio.duration || 3) * 1000 / (cfg.speed || 1)); onState({ ...state(), echo: true }); waitT = setTimeout(next, ms); } else next();
  });
  audio.addEventListener('error', () => { if (playing) { playing = false; onState({ ...state(), error: true }); } });
  return {
    play, state,
    pause() { playing = false; clearTimeout(waitT); audio.pause(); onState(state()); },
    toggle() { if (playing) this.pause(); else play(); },
    jump(d) { clearTimeout(waitT); i = Math.max(0, Math.min(ayahs.length - 1, i + d)); rep = 1; if (playing) play(); else onState(state()); },
    setCfg(patch) { Object.assign(cfg, patch); setAudioCfg(patch); audio.playbackRate = cfg.speed || 1; onState(state()); },
    destroy() { playing = false; clearTimeout(waitT); audio.pause(); audio.src = ''; if (objUrl) URL.revokeObjectURL(objUrl); },
  };
}
