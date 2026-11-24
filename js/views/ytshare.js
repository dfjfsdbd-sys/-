// المشاركة من يوتيوب: بعد تثبيت التطبيق بيطلع بقائمة «مشاركة» تبع يوتيوب (Web Share Target).
// بتشارك فيديو أو قائمة تشغيل، والتطبيق بيسألك وين تحطه.
import { h, icon, fill, openSheet, toast, haptic } from '../ui.js';
import { store, uid } from '../store.js';
import { logicalToday } from '../prayer.js';
import { addDays } from '../dates.js';
import { addTask } from '../tasks.js';
import { tintHex } from '../icons.js';
import { videoIdFrom, playlistIdFrom, thumbOf } from '../youtube.js';
import { openSeriesEdit } from './series.js';

// منقرا الرابط اللي وصل (بيجي بالـ url أو بالنص) وبعدين بننظّف العنوان
export function handleShareTarget() {
  const q = new URLSearchParams(location.search);
  const raw = [q.get('url'), q.get('text'), q.get('title')].filter(Boolean).join(' ');
  if (!raw) return false;
  history.replaceState(null, '', `${location.pathname}#/today`);
  const url = (raw.match(/https?:\/\/\S+/) || [])[0] || '';
  const vid = videoIdFrom(url);
  const list = playlistIdFrom(url);
  const title = (q.get('title') || '').trim() || (q.get('text') || '').replace(url, '').trim();
  setTimeout(() => openYtShare({ url, vid, list, title }), 800);
  return true;
}

async function oembed(url) {
  try {
    const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

export function openYtShare({ url, vid, list, title }) {
  const today = logicalToday();
  const series = store.state.series || [];
  let how = list ? 'playlist' : vid && series.length ? 'ep' : 'later';
  let sid = series[0]?.id || null;
  let info = { title: title || '', author: '' };
  openSheet(null, (body, close) => {
    function render() {
      const opts = [];
      if (vid) opts.push(['ep', 'clapperboard', '#e06a9e', 'حلقة بسلسلة عندك', series.length ? 'اختار السلسلة تحت' : 'ما عندك سلاسل لسّا']);
      if (list) opts.push(['playlist', 'list', '#a682e8', 'سلسلة جديدة من قائمة التشغيل', 'كل الحلقات بأسمائها وصورها']);
      opts.push(['later', 'clock', '#8a8a99', 'مهمة «شوفه بعدين»', 'بتطلع ببكرة بعد العصر']);
      fill(body, [
        h('div', { class: 'am-title' }, h('h3', null, icon('youtube', 15), 'وصلك من يوتيوب', h('button', { type: 'button', class: 'am-x', 'aria-label': 'إغلاق', onclick: () => close() }, icon('close', 16))), h('small', null, 'وين بدك تحطه؟')),
        h('div', { class: 'yt-card' },
          vid ? h('span', { class: 'yt-th' }, h('img', { src: thumbOf(vid), alt: '', loading: 'lazy' }), h('i', null, icon('play', 16))) : h('span', { class: 'yt-th none' }, icon('youtube', 28)),
          h('div', { class: 'yt-in' }, h('b', null, info.title || (list && !vid ? 'قائمة تشغيل' : 'فيديو')), h('small', null, [info.author, list ? 'من قائمة تشغيل' : null].filter(Boolean).join(' · ') || url.replace(/^https?:\/\//, '').slice(0, 40)))),
        h('div', { class: 'sh-opts' }, opts.map(([k, ic, c, t, s]) => h('button', { type: 'button', class: `sh-o${how === k ? ' on' : ''}`, style: { '--c': c }, disabled: k === 'ep' && !series.length ? true : null, onclick: () => { how = k; render(); } },
          h('span', { class: 'sh-ic' }, icon(ic, 15)), h('span', null, h('b', null, t), h('small', null, s)), how === k ? icon('circle-check', 16) : null))),
        how === 'ep' && series.length ? h('div', { class: 'f-row', style: { marginTop: '12px' } }, h('label', { class: 'f-label' }, 'بأي سلسلة؟'),
          h('div', { class: 'chips' }, series.map((x) => h('button', { type: 'button', class: 'chip small', 'aria-pressed': String(sid === x.id), style: { '--tint': tintHex(x.color || 'rose') }, onclick: () => { sid = x.id; render(); } }, x.name)))) : null,
        h('div', { class: 'am-sticky' }, h('button', { type: 'button', class: 'btn', style: { flex: 1 }, onclick: save }, icon('check', 15), 'حطه')),
      ]);
    }
    function save() {
      const name = info.title || 'فيديو من يوتيوب';
      if (how === 'ep' && sid) {
        let n = 0;
        store.update((s) => {
          const se = s.series.find((x) => x.id === sid);
          if (!se) return;
          if (se.episodes.some((e) => e.videoId === vid)) { n = -1; return; }
          se.episodes.push({ id: uid('ep'), title: name, videoId: vid, image: null, duration: 0, progress: 0, position: 0, done: false, mastery: 0, notes: '' });
          n = se.episodes.length;
        });
        haptic('success'); close();
        toast(n < 0 ? 'هالفيديو موجود أصلاً بالسلسلة' : `انضاف كحلقة ${n}`);
      } else if (how === 'playlist') {
        close();
        setTimeout(() => openSeriesEdit(null, { kind: 'sharia', url: `https://www.youtube.com/playlist?list=${list}` }), 250);
      } else {
        addTask({ title: `شوف: ${name}`, date: addDays(today, 1), period: 'asr', tag: 'general', notes: url, estimate: 20 });
        haptic('success'); close(); toast('انضافت لبكرة بعد العصر');
      }
    }
    render();
    if (vid || list) oembed(vid ? `https://www.youtube.com/watch?v=${vid}` : `https://www.youtube.com/playlist?list=${list}`).then((r) => { if (r) { info = { title: r.title || info.title, author: r.author_name || '' }; render(); } });
  }, { cls: 'task-form' });
}
