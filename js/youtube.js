// يوتيوب: جلب قائمة تشغيل كاملة (العناوين والصور) من رابطها، وتشغيل الحلقة جوّا التطبيق مع تتبّع قدّيش حضرت
import { store } from './store.js';

export function playlistIdFrom(url) {
  if (!url) return null;
  const m = String(url).match(/[?&]list=([A-Za-z0-9_-]{10,})/);
  if (m) return m[1];
  if (/^(PL|UU|OL|FL|LL|RD)[A-Za-z0-9_-]{10,}$/.test(url.trim())) return url.trim();
  return null;
}
export function videoIdFrom(url) {
  const m = String(url || '').match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : (/^[A-Za-z0-9_-]{11}$/.test(String(url).trim()) ? String(url).trim() : null);
}
export const thumbOf = (vid) => (vid ? `https://i.ytimg.com/vi/${vid}/mqdefault.jpg` : null);

async function getJSON(url, ms = 12000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(`http ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

// 1) واجهة يوتيوب الرسمية بمفتاح (أدق وأسرع)
async function viaApiKey(id, key, onProgress) {
  const meta = await getJSON(`https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${id}&key=${key}`);
  const title = meta.items?.[0]?.snippet?.title || '';
  const items = [];
  let token = '';
  for (let guard = 0; guard < 40; guard++) {
    const j = await getJSON(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${id}&key=${key}${token ? `&pageToken=${token}` : ''}`);
    for (const it of j.items || []) {
      const vid = it.contentDetails?.videoId || it.snippet?.resourceId?.videoId;
      if (!vid || it.snippet?.title === 'Private video' || it.snippet?.title === 'Deleted video') continue;
      items.push({ videoId: vid, title: it.snippet.title, duration: 0 });
    }
    onProgress?.(items.length);
    if (!j.nextPageToken) break;
    token = j.nextPageToken;
  }
  return { title, items };
}

// أول صفحة منطلبها من كل الخوادم سوا ومناخد أسرع واحد ردّ صح، وبعدين منكمّل معه
async function fastest(bases, path, ok) {
  return Promise.any(bases.map(async (base) => {
    const j = await getJSON(`${base}${path}`, 10000);
    if (!ok(j)) throw new Error('empty');
    return { base, j };
  }));
}

// 2) خوادم Piped العامة (بدون مفتاح)
const PIPED = ['https://api.piped.private.coffee', 'https://pipedapi.kavin.rocks', 'https://pipedapi.adminforge.de', 'https://pipedapi.leptons.xyz', 'https://pipedapi.reallyaweso.me', 'https://pipedapi.nosebs.ru', 'https://piped-api.privacy.com.de'];
async function viaPiped(id, onProgress) {
  const { base, j } = await fastest(PIPED, `/playlists/${id}`, (x) => x?.relatedStreams?.length);
  const items = [];
  const seen = new Set();
  const push = (arr) => { for (const s of arr || []) { const vid = videoIdFrom(s.url); if (vid && !seen.has(vid)) { seen.add(vid); items.push({ videoId: vid, title: s.title, duration: s.duration || 0 }); } } };
  push(j.relatedStreams);
  onProgress?.(items.length);
  let next = j.nextpage;
  for (let guard = 0; next && guard < 60; guard++) {
    const p = await getJSON(`${base}/nextpage/playlists/${id}?nextpage=${encodeURIComponent(next)}`);
    push(p.relatedStreams);
    next = p.nextpage;
    onProgress?.(items.length);
  }
  return { title: j.name || '', items };
}

// 3) خوادم Invidious العامة
const INVIDIOUS = ['https://inv.nadeko.net', 'https://invidious.nerdvpn.de', 'https://yewtu.be', 'https://invidious.privacyredirect.com', 'https://iv.ggtyler.dev', 'https://invidious.jing.rocks'];
async function viaInvidious(id, onProgress) {
  const { base, j } = await fastest(INVIDIOUS, `/api/v1/playlists/${id}?page=1`, (x) => x?.videos?.length);
  const items = [];
  const seen = new Set();
  const title = j.title || '';
  const push = (vids) => { let added = 0; for (const v of vids || []) if (v.videoId && !seen.has(v.videoId)) { seen.add(v.videoId); items.push({ videoId: v.videoId, title: v.title, duration: v.lengthSeconds || 0 }); added += 1; } return added; };
  push(j.videos);
  onProgress?.(items.length);
  for (let page = 2; page < 60; page++) {
    const p = await getJSON(`${base}/api/v1/playlists/${id}?page=${page}`);
    const added = push(p.videos);
    onProgress?.(items.length);
    if (!added) break;
  }
  return { title, items };
}

export async function fetchPlaylist(url, onProgress) {
  const id = playlistIdFrom(url);
  if (!id) throw new Error('bad-url');
  const key = store.state.settings.ytKey;
  if (key) {
    try { const r = await viaApiKey(id, key, onProgress); if (r.items.length) return { id, ...r }; } catch { /* منكمّل بالخوادم العامة */ }
  }
  // Piped و Invidious سوا: أول واحد بيجيب القائمة كاملة بيربح
  const ok = (r) => { if (!r.items.length) throw new Error('empty'); return r; };
  try {
    const r = await Promise.any([viaPiped(id, onProgress).then(ok), viaInvidious(id, onProgress).then(ok)]);
    return { id, ...r };
  } catch {
    throw new Error('failed');
  }
}

/* ---------- المشغّل ---------- */
let apiReady = null;
export function loadYT() {
  if (apiReady) return apiReady;
  apiReady = new Promise((resolve, reject) => {
    if (window.YT?.Player) { resolve(window.YT); return; }
    window.onYouTubeIframeAPIReady = () => resolve(window.YT);
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => { apiReady = null; reject(new Error('offline')); };
    document.head.append(s);
    setTimeout(() => { if (!window.YT?.Player) { apiReady = null; reject(new Error('timeout')); } }, 15000);
  });
  return apiReady;
}
// يشغّل الفيديو ويرجع كل 5 ثواني الموضع والمدة
export async function mountPlayer(el, videoId, { start = 0, onProgress, onEnd } = {}) {
  const YT = await loadYT();
  let timer = 0;
  const player = new YT.Player(el, {
    videoId, host: 'https://www.youtube-nocookie.com',
    playerVars: { start: Math.floor(start), rel: 0, modestbranding: 1, playsinline: 1, hl: 'ar' },
    events: {
      onStateChange: (e) => {
        clearInterval(timer);
        if (e.data === YT.PlayerState.PLAYING) timer = setInterval(() => { try { onProgress?.(player.getCurrentTime(), player.getDuration()); } catch { /* */ } }, 5000);
        if (e.data === YT.PlayerState.PAUSED) { try { onProgress?.(player.getCurrentTime(), player.getDuration()); } catch { /* */ } }
        if (e.data === YT.PlayerState.ENDED) { try { onProgress?.(player.getDuration(), player.getDuration()); } catch { /* */ } onEnd?.(); }
      },
    },
  });
  return { player, destroy: () => { clearInterval(timer); try { onProgress?.(player.getCurrentTime(), player.getDuration()); } catch { /* */ } try { player.destroy(); } catch { /* */ } } };
}
