// السلاسل والدروس: فقه النفس، الدروس الشرعية، وأي سلسلة يوتيوب — جلب الحلقات من الرابط وتشغيلها مع تتبّع المشاهدة
import { h, icon, badge, bar, ring, fill, openSheet, toast, haptic, chips, confirmSheet, pickImage, lowResCheck, empty, openActions } from '../ui.js';
import { store, uid } from '../store.js';
import { logicalToday } from '../prayer.js';
import { durText, clockText, dayLabel } from '../dates.js';
import { fetchPlaylist, playlistIdFrom, videoIdFrom, thumbOf, mountPlayer } from '../youtube.js';
import { studyUnit, addUnits } from '../library.js';
import { addTask, taskById, isDoneOn, setDone } from '../tasks.js';
import { secTitle } from './components.js';
import { TINT_KEYS, tintHex } from '../icons.js';

export const SERIES_KINDS = { self: 'فقه النفس', sharia: 'دروس شرعية', study: 'دراسة', sport: 'رياضة', other: 'أخرى' };
export const seriesById = (id) => store.state.series.find((x) => x.id === id);
// سلسلة الكتاب (kind: 'book') بتطلع جوّا صفحة كتابها، مش بقوائم السلاسل
export const isBookSeries = (s) => s?.kind === 'book';
export const epProgress = (e) => (e.done ? 1 : Math.max(e.progress || 0, (e.mastery || 0) / 100));
export const seriesProgress = (s) => { const e = s.episodes || []; return e.length ? e.reduce((a, x) => a + epProgress(x), 0) / e.length : 0; };
export const nextEp = (s) => (s.episodes || []).find((e) => !e.done && !e.listenOnly);
// طريقة المتابعة: «مع تدوين» (فقه النفس افتراضياً) أو «سماع فقط»
export const seriesMode = (s) => s?.mode || (s?.kind === 'self' ? 'notes' : 'listen');
let unnotedOnly = false;

export function renderSeriesList(ctx) {
  const list = store.state.series.filter((s) => !isBookSeries(s));
  if (!list.length) return h('div', null, empty('youtube', 'أضف سلسلة (مثلاً فقه النفس) وحط رابط قائمة التشغيل من يوتيوب، وبتنضاف كل الحلقات بأسمائها وصورها.', h('button', { type: 'button', class: 'btn', onclick: () => openSeriesEdit(null) }, icon('plus', 18), 'سلسلة جديدة')));
  const groups = {};
  for (const s of list) (groups[s.kind || 'other'] = groups[s.kind || 'other'] || []).push(s);
  return h('div', null, Object.entries(groups).map(([k, items]) => [
    secTitle(SERIES_KINDS[k] || k, { count: items.length }),
    h('div', { class: 'group rows' }, items.map((s) => {
      const p = seriesProgress(s);
      const n = nextEp(s);
      const done = (s.episodes || []).filter((e) => e.done).length;
      return h('button', { type: 'button', class: 'row', onclick: () => ctx.open(`tracks/series/${s.id}`) },
        badge(s.icon || 'video', s.color || 'violet', 48, s.image || (n?.image) || thumbOf(n?.videoId)),
        h('span', { class: 'row-main' },
          h('span', { class: 'row-title' }, s.name, s.source?.playlistId ? h('span', { class: 'yt-tag' }, icon('youtube', 13)) : null),
          h('span', { class: 'row-sub' }, `${done} من ${(s.episodes || []).length} ${s.unitWord || 'حلقة'}${n ? ` — التالية: ${n.title}` : ''}`),
          bar(p, { cls: 'thin' })),
        h('span', { class: 'num dim', style: { fontSize: '13px' } }, `${Math.round(p * 100)}%`));
    })),
  ]));
}
export function seriesListActions() { return h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'سلسلة جديدة', onclick: () => openSeriesEdit(null) }, icon('plus', 20)); }

export function renderSeries(ctx) {
  const s = seriesById(ctx.params.id);
  if (!s) return h('div', { class: 'empty' }, 'السلسلة مش موجودة');
  const p = seriesProgress(s);
  const n = nextEp(s);
  const watched = (s.episodes || []).reduce((a, e) => a + (e.watched || 0), 0);
  const root = h('div', null,
    h('div', { class: 'item-hero', style: { '--tint': tintHex(s.color) } },
      badge(s.icon || 'video', s.color, 64, s.image || thumbOf(s.episodes?.[0]?.videoId)),
      h('div', null, h('strong', null, s.name), h('small', null, `${(s.episodes || []).filter((e) => e.done).length} من ${(s.episodes || []).length} — ${Math.round(p * 100)}%${watched ? ` — ${durText(watched / 60)} مشاهدة` : ''}`), bar(p))),
    n ? h('button', { type: 'button', class: 'next-ep', onclick: () => openEpisode(s.id, n.id) },
      h('span', { class: 'ne-thumb' }, (n.image || n.videoId) ? h('img', { src: n.image || thumbOf(n.videoId), alt: '', loading: 'lazy' }) : icon('video', 28), h('i', null, icon('play', 22))),
      h('span', { class: 'ne-info' }, h('small', null, n.progress > 0.02 ? `كمّل من ${clockText(n.position || 0)}` : 'الحلقة الجاية'), h('b', null, n.title), n.progress > 0 ? bar(n.progress, { cls: 'thin' }) : null)) : null,
    !s.source?.playlistId ? h('button', { type: 'button', class: 'banner tap', onclick: () => openImport(s.id) }, h('span', { class: 'banner-ic' }, icon('youtube', 22)), h('p', null, h('b', null, 'اربطها بيوتيوب'), h('br'), 'حط رابط قائمة التشغيل وبتنجاب أسماء الحلقات وصورها'), icon('chevL', 18)) : null,
    secTitle(`الحلقات (${(s.episodes || []).length})`, { ic: 'list', action: seriesMode(s) === 'notes' && (s.episodes || []).some((e) => e.listenOnly) ? h('button', { type: 'button', class: `chip small${unnotedOnly ? '' : ''}`, 'aria-pressed': String(unnotedOnly), onclick: () => { unnotedOnly = !unnotedOnly; ctx.refresh(); } }, icon('headphones', 12), 'اللي ما دوّنتها') : null }),
    h('div', { class: 'group rows ep-list' }, (s.episodes || []).map((e, i) => (unnotedOnly && seriesMode(s) === 'notes' && !e.listenOnly ? null : epRow(s, e, i)))));
  root.dataset.title = s.name;
  return root;
}
// دروس كتاب مربوط بسلسلة يوتيوب: «التالي» وقائمة الدروس بصورها وتقدّمها (نفس عرض السلسلة)
export function episodesBlock(s, word = 'الدروس') {
  const n = nextEp(s);
  return [
    n ? h('button', { type: 'button', class: 'next-ep', onclick: () => openEpisode(s.id, n.id) },
      h('span', { class: 'ne-thumb' }, (n.image || n.videoId) ? h('img', { src: n.image || thumbOf(n.videoId), alt: '', loading: 'lazy' }) : icon('video', 28), h('i', null, icon('play', 22))),
      h('span', { class: 'ne-info' }, h('small', null, n.progress > 0.02 ? `كمّل من ${clockText(n.position || 0)}` : 'الدرس الجاي'), h('b', null, n.title), n.progress > 0 ? bar(n.progress, { cls: 'thin' }) : null)) : null,
    secTitle(`${word} (${(s.episodes || []).length})`, { ic: 'youtube' }),
    h('div', { class: 'group rows ep-list' }, (s.episodes || []).map((e, i) => epRow(s, e, i))),
  ];
}
export function seriesActions(ctx) {
  return h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'خيارات', onclick: () => openActions('السلسلة', [
    { icon: 'edit', label: 'تعديل السلسلة', run: () => openSeriesEdit(ctx.params.id) },
    { icon: 'youtube', label: 'جلب/تحديث الحلقات من يوتيوب', run: () => openImport(ctx.params.id) },
    { icon: 'plus', label: 'أضف حلقات يدوياً', run: () => openAddEps(ctx.params.id) },
  ]) }, icon('more', 20));
}

function epRow(s, e, i) {
  const pr = epProgress(e);
  return h('button', { type: 'button', class: `row ep-row${e.done ? ' done' : ''}`, onclick: () => openEpisode(s.id, e.id) },
    (e.image || e.videoId) ? h('span', { class: 'ep-thumb' }, h('img', { src: e.image || thumbOf(e.videoId), alt: '', loading: 'lazy' }), pr > 0 && !e.done ? h('i', { style: { width: `${pr * 100}%` } }) : null) : h('span', { class: 'lect-num num' }, String(i + 1)),
    h('span', { class: 'row-main' }, h('span', { class: 'row-title wrap' }, e.title || `${s.unitWord || 'حلقة'} ${i + 1}`),
      h('span', { class: 'row-sub' },
        e.noted ? h('span', { class: 'ep-tag noted' }, icon('pen-nib', 10), `مدوّنة${e.shots?.length ? ` · ${e.shots.length} صور` : ''}`)
          : e.listenOnly ? h('span', { class: 'ep-tag unnoted' }, icon('headphones', 10), `بدون تدوين · ${e.mastery || 0}%`)
            : e.done ? 'تابعتها' : pr > 0 ? `حضرت ${Math.round(pr * 100)}%` : e.duration ? durText(e.duration / 60) : '')),
    e.done ? h('span', { class: 'ep-ok' }, icon('check', 16, { stroke: 2.6 })) : e.listenOnly ? h('span', { class: 'ep-ok half' }, icon('headphones', 13)) : null);
}

// «خلّصتها»: بسلسلة التدوين منسأل إذا دوّنت؛ بالسماع فقط بتنحسب مباشرة
function finishEpisode(sid, eid, { day, taskId, after } = {}) {
  const s = seriesById(sid);
  const e = s?.episodes.find((x) => x.id === eid);
  if (!e) return;
  const markTask = () => { if (taskId && taskById(taskId) && !isDoneOn(taskById(taskId), day)) setDone(taskId, day, true); };
  const setEp = (patch) => store.update((st) => { Object.assign(st.series.find((y) => y.id === sid).episodes.find((z) => z.id === eid), patch); });
  if (seriesMode(s) === 'listen') {
    studyUnit('series', sid, eid, { mastery: 100, day }); markTask(); haptic('success'); toast('تمّت الحلقة'); after?.(); return;
  }
  openSheet('كيف تابعت الحلقة؟', (body, close) => {
    fill(body, [
      h('p', { class: 'hint' }, `${s.name} — ${e.title || 'الحلقة'}`),
      h('div', { class: 'act-list' },
        h('button', { type: 'button', class: 'act-btn ep-way noted', onclick: () => { close(); setTimeout(() => openNotes(sid, eid, { day, onSave: () => { setEp({ noted: true, listenOnly: false }); studyUnit('series', sid, eid, { mastery: 100, day }); markTask(); haptic('success'); toast('تمّت الحلقة مع التدوين'); after?.(); } }), 240); } },
          h('span', { class: 'ew-ic' }, icon('pen-nib', 16)), h('span', null, 'تمّت مع تدوين الملاحظات', h('small', null, 'بتنحسب 100%، وبتكتب أو بتصوّر الفوائد')), icon('chevL', 12)),
        h('button', { type: 'button', class: 'act-btn ep-way unnoted', onclick: () => { close(); setTimeout(() => askPct(), 240); } },
          h('span', { class: 'ew-ic' }, icon('headphones', 16)), h('span', null, 'تمّت بدون تدوين', h('small', null, 'بتختار قدّيش بتعتبرها منجزة، وبتنعلّم «بدون تدوين»')), icon('chevL', 12))),
    ]);
  });
  function askPct() {
    openSheet('قدّيش بتعتبرها منجزة؟', (body, close) => {
      fill(body, [
        h('p', { class: 'hint' }, 'بتنعلّم «بدون تدوين» — فيك ترجع تدوّنها بعدين وتكمّل للـ100%.'),
        h('div', { class: 'pct-grid' }, [100, 75, 50, 25].map((v) => h('button', { type: 'button', class: `pct-b${v < 60 ? ' lo' : ''}`, onclick: () => {
          setEp({ listenOnly: v < 100, noted: false });
          studyUnit('series', sid, eid, { mastery: v, day });
          if (v < 100) setEp({ done: false, listenOnly: true });
          markTask(); haptic('success'); toast(`انسجّلت ${v}% — بدون تدوين`); close(); after?.();
        } }, h('b', null, `${v}%`)))),
      ]);
    });
  }
}

// صندوق الفوائد مع صور الدفتر
function openNotes(sid, eid, { onSave, onDone } = {}) {
  const s = seriesById(sid);
  const e = s?.episodes.find((x) => x.id === eid);
  if (!e) return;
  let shots = [...(e.shots || [])];
  let text = e.notes || '';
  openSheet('الفوائد والملاحظات', (body, close) => {
    function render() {
      fill(body, [
        h('p', { class: 'hint' }, `${s.name} — ${e.title || 'الحلقة'}`),
        h('textarea', { rows: 5, placeholder: 'اكتب الفوائد، أو صوّر صفحات الدفتر تحت', oninput: (ev) => { text = ev.target.value; } }, text),
        h('div', { class: 'f-label', style: { margin: '14px 0 8px' } }, 'صور الدفتر'),
        h('div', { class: 'shots-row' },
          shots.map((src, i) => h('span', { class: 'shot' }, h('img', { src, alt: '' }), h('button', { type: 'button', 'aria-label': 'احذف', onclick: () => { shots.splice(i, 1); render(); } }, icon('close', 10)))),
          h('button', { type: 'button', class: 'shot add', 'aria-label': 'صوّر', onclick: async () => { const src = await pickImage({ size: 1280, square: false }); if (src) { shots.push(src); render(); } } }, icon('camera', 18))),
        h('button', { type: 'button', class: 'btn block', onclick: () => {
          store.update((st) => { Object.assign(st.series.find((y) => y.id === sid).episodes.find((z) => z.id === eid), { notes: text.trim(), shots }); });
          close(); onSave?.();
          if (!onSave) toast('انحفظت الفوائد');
          onDone?.();
        } }, icon('check', 15), onSave ? 'احفظ — تمّت 100%' : 'احفظ'),
      ]);
    }
    render();
  });
}

// شاشة الحلقة: تشغيل من يوتيوب جوّا التطبيق، والتقدّم بيتسجّل لحاله
export function openEpisode(sid, eid, { taskId = null, day = null } = {}) {
  const today = day || logicalToday();
  let ctl = null;
  openSheet(null, (body, close) => {
    function render() {
      const s = seriesById(sid);
      const e = s?.episodes.find((x) => x.id === eid);
      if (!e) { close(); return; }
      const idx = s.episodes.indexOf(e);
      const mode = seriesMode(s);
      const holder = h('div', { class: 'yt-holder' });
      function setEp(patch) { store.update((st) => { Object.assign(st.series.find((y) => y.id === sid).episodes.find((z) => z.id === eid), patch); }, { silent: true }); }
      const tid = taskId && taskById(taskId)?.link?.unitId === eid ? taskId : null;
      fill(body, [
        h('div', { class: 'az-head' },
          h('button', { type: 'button', class: 'icon-btn ghost', 'aria-label': 'إغلاق', onclick: () => close() }, icon('close', 22)),
          h('div', null, h('b', null, s.name), h('small', null, `${s.unitWord || 'حلقة'} ${idx + 1} من ${s.episodes.length}`)),
          h('span', { class: `ep-mode ${mode}` }, icon(mode === 'notes' ? 'pen-nib' : 'headphones', 11), mode === 'notes' ? 'مع تدوين' : 'سماع')),
        holder,
        h('h3', { class: 'ep-title' }, e.title || `${s.unitWord || 'حلقة'} ${idx + 1}`),
        h('div', { class: 'ep-prog' }, bar(epProgress(e), { cls: e.done ? 'good' : '' }), h('span', { class: 'num' },
          e.noted ? 'مدوّنة · تمّت' : e.listenOnly ? `بدون تدوين · ${e.mastery || 0}%` : e.done ? 'تابعتها كاملة' : `حضرت ${Math.round(epProgress(e) * 100)}%`)),
        h('div', { class: 'two ep-actions' },
          e.done
            ? h('button', { type: 'button', class: 'btn secondary', onclick: () => { setEp({ done: false, noted: false, listenOnly: false, mastery: Math.round((e.progress || 0) * 100) }); render(); } }, icon('undo', 16), 'رجّعها مو مكتملة')
            : h('button', { type: 'button', class: 'btn good', onclick: () => finishEpisode(sid, eid, { day: today, taskId: tid, after: render }) }, icon('check', 18), e.listenOnly ? 'دوّنتها هلّق' : 'خلّصتها'),
          h('button', { type: 'button', class: 'btn secondary', onclick: () => { addTask({ title: `${s.name}: ${e.title || `حلقة ${idx + 1}`}`, date: logicalToday(), tag: s.kind === 'self' ? 'self' : 'series', link: { kind: 'episode', itemId: sid, unitId: eid, image: e.image || thumbOf(e.videoId) } }); toast('انضافت لمهام اليوم'); } }, icon('plus', 18), 'لمهام اليوم')),
        h('button', { type: 'button', class: 'ep-notes-card', onclick: () => openNotes(sid, eid, { onDone: render }) },
          h('span', { class: 'f-label' }, icon('pen-nib', 11), ' الفوائد والملاحظات'),
          e.notes ? h('p', null, e.notes) : h('p', { class: 'dim' }, mode === 'notes' ? 'اكتب الفوائد أو صوّر صفحات الدفتر' : 'شو استفدت من الحلقة؟'),
          e.shots?.length ? h('span', { class: 'shots-row mini' }, e.shots.slice(0, 4).map((src) => h('img', { src, alt: '' }))) : null,
          h('span', { class: 'ep-notes-act' }, icon('camera', 13), e.shots?.length ? `${e.shots.length} صور` : 'صوّر الدفتر')),
        h('div', { class: 'two ep-nav' },
          h('button', { type: 'button', class: 'btn secondary small', disabled: idx === 0 ? true : null, onclick: () => { ctl?.destroy(); ctl = null; eid = s.episodes[idx - 1].id; render(); } }, icon('chevR', 16), 'السابقة'),
          h('button', { type: 'button', class: 'btn secondary small', disabled: idx >= s.episodes.length - 1 ? true : null, onclick: () => { ctl?.destroy(); ctl = null; eid = s.episodes[idx + 1].id; render(); } }, 'التالية', icon('chevL', 16))),
      ]);
      if (e.videoId) {
        const mount = h('div');
        holder.append(mount);
        mountPlayer(mount, e.videoId, {
          start: e.done ? 0 : (e.position || 0),
          onProgress: (cur, dur) => {
            if (!dur) return;
            const st = seriesById(sid)?.episodes.find((x) => x.id === eid);
            if (!st) return;
            const pr = Math.min(1, cur / dur);
            const add = Math.max(0, cur - (st.position || 0));
            setEp({ position: cur, duration: Math.round(dur), progress: Math.max(st.progress || 0, pr), watched: (st.watched || 0) + (add < 30 ? add : 0) });
            // 90% = خلّصتها، و50% بتنحسب نص حلقة
            // بالسماع فقط بتنحسب لحالها عند 90%. بالتدوين منذكّرك تضغط «خلّصتها» وتقلّنا إذا دوّنت
            if (pr >= 0.9 && !st.done && !st.listenOnly && !st._asked) {
              if (seriesMode(seriesById(sid)) === 'listen') { studyUnit('series', sid, eid, { mastery: 100, day: today }); toast('تمّت الحلقة', { kind: 'gold' }); }
              else { setEp({ _asked: true }); toast('خلصت الحلقة؟ اضغط «خلّصتها» وقلّنا إذا دوّنت', { kind: 'gold', duration: 6000 }); }
            } else if (pr >= 0.5 && (st.mastery || 0) < 50) studyUnit('series', sid, eid, { mastery: 50, day: today });
          },
        }).then((c) => { ctl = c; }).catch(() => { fill(holder, [h('a', { class: 'btn secondary block', href: `https://www.youtube.com/watch?v=${e.videoId}`, target: '_blank', rel: 'noopener' }, icon('external', 18), 'افتح على يوتيوب (ما في نت للمشغّل)')]); });
      } else {
        holder.append(h('div', { class: 'yt-empty' }, icon('video', 30), h('p', null, 'هالحلقة ما إلها رابط. اربط السلسلة بقائمة يوتيوب أو تابعها من مكانها وعلّمها لما تخلص.')));
      }
    }
    render();
  }, { full: true, cls: 'az-sheet', onClose: () => ctl?.destroy() });
}

function openImport(sid) {
  openSheet('جلب الحلقات من يوتيوب', (body, close) => {
    const s = sid ? seriesById(sid) : null;
    const input = h('input', { type: 'url', placeholder: 'https://www.youtube.com/playlist?list=…', value: s?.source?.url || '', 'data-autofocus': true, dir: 'ltr' });
    const status = h('p', { class: 'hint' }, 'افتح قائمة التشغيل على يوتيوب ← مشاركة ← نسخ الرابط، والصقه هون.');
    const btn = h('button', { type: 'button', class: 'btn block', onclick: run }, icon('download', 18), 'جيب الحلقات');
    async function run() {
      const url = input.value.trim();
      if (!playlistIdFrom(url)) { status.textContent = 'هالرابط مو رابط قائمة تشغيل (لازم يكون فيه list=).'; status.className = 'form-error'; return; }
      btn.disabled = true; status.className = 'hint'; status.textContent = 'عم نجيب القائمة…';
      try {
        const r = await fetchPlaylist(url, (n) => { status.textContent = `جبنا ${n} حلقة لهلق…`; });
        mergePlaylist(sid, r, url);
        haptic('success');
        close();
        toast(`انضافت ${r.items.length} حلقة بأسمائها وصورها`);
      } catch (e) {
        btn.disabled = false;
        status.className = 'form-error';
        status.textContent = 'ما قدرنا نجيب القائمة. جرّب بعد شوي، أو حط مفتاح يوتيوب من الروتين (أضمن)، أو أضف الحلقات يدوياً.';
      }
    }
    fill(body, [input, status, btn]);
  });
}

// دمج الحلقات بالسلسلة: الحلقة رقم i بتاخد اسم وصورة الفيديو رقم i وبيضل تقدّمك فيها
export function mergePlaylist(sid, r, url) {
  store.update((st) => {
    let s = st.series.find((x) => x.id === sid);
    if (!s) { s = { id: uid('se'), name: r.title || 'سلسلة', kind: 'self', color: 'violet', icon: 'video', image: null, unitWord: 'حلقة', episodes: [] }; st.series.push(s); }
    s.source = { type: 'youtube', playlistId: r.id, url };
    if (!s.name || s.name === 'سلسلة') s.name = r.title || s.name;
    r.items.forEach((it, i) => {
      const ex = s.episodes[i];
      if (ex) Object.assign(ex, { title: it.title, videoId: it.videoId, duration: it.duration || ex.duration || 0 });
      else s.episodes.push({ id: uid('ep'), title: it.title, videoId: it.videoId, image: null, duration: it.duration || 0, progress: 0, position: 0, done: false, mastery: 0, notes: '' });
    });
  });
}

function openAddEps(sid) {
  openSheet('أضف حلقات', (body, close) => {
    let count = 10, names = '';
    fill(body, [
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'العدد'), h('input', { type: 'number', value: count, oninput: (e) => { count = Number(e.target.value) || 0; } })),
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'أو الأسماء/الروابط (كل وحدة بسطر)'), h('textarea', { rows: 4, oninput: (e) => { names = e.target.value; } })),
      h('button', { type: 'button', class: 'btn block', onclick: () => {
        const list = names.split('\n').map((x) => x.trim()).filter(Boolean);
        if (list.length) store.update((st) => { const s = st.series.find((y) => y.id === sid); for (const n of list) { const vid = videoIdFrom(n); s.episodes.push({ id: uid('ep'), title: vid ? `حلقة ${s.episodes.length + 1}` : n, videoId: vid, image: null, progress: 0, position: 0, done: false, mastery: 0, notes: '' }); } });
        else addUnits('series', sid, Math.min(500, count), seriesById(sid)?.unitWord || 'حلقة');
        close();
      } }, 'أضف'),
    ]);
  });
}

export function openSeriesEdit(id, preset = {}) {
  const ex = id ? seriesById(id) : null;
  const d = ex ? { name: ex.name, kind: ex.kind || 'self', color: ex.color || 'violet', image: ex.image, unitWord: ex.unitWord || 'حلقة', core: ex.core, level: ex.level, rhythm: ex.rhythm, mode: seriesMode(ex) } : { name: preset.name || '', kind: preset.kind || 'self', color: preset.kind && preset.kind !== 'self' ? 'rose' : 'violet', image: null, unitWord: 'حلقة', url: preset.url || '', mode: (preset.kind || 'self') === 'self' ? 'notes' : 'listen' };
  openSheet(ex ? 'تعديل السلسلة' : 'سلسلة جديدة', (body, close) => {
    function render() {
      fill(body, [
        ex ? null : h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'رابط قائمة التشغيل على يوتيوب (اختياري)'), h('input', { type: 'url', dir: 'ltr', value: d.url || '', placeholder: 'https://www.youtube.com/playlist?list=…', oninput: (e) => { d.url = e.target.value; } })),
        h('div', { class: 'lect-head' },
          h('button', { type: 'button', class: 'lect-img', onclick: async () => { const img = await pickImage(); if (img) { d.image = img; render(); } } }, d.image ? h('img', { src: d.image, alt: '', onload: lowResCheck }) : [icon('image', 26), h('small', null, 'صورة')]),
          h('label', { class: 'field', style: { flex: 1, margin: 0 } }, h('span', { class: 'field-label' }, 'الاسم'), h('input', { type: 'text', value: d.name, placeholder: ex ? '' : 'بيتعبّى من يوتيوب لحاله', oninput: (e) => { d.name = e.target.value; } }))),
        isBookSeries(ex) ? null : h('div', { class: 'field', style: { marginTop: '12px' } }, h('span', { class: 'field-label' }, 'النوع'), chips(Object.entries(SERIES_KINDS).map(([v, l]) => ({ value: v, label: l })), d.kind, (v) => { d.kind = v; render(); })),
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'طريقة المتابعة'),
          h('div', { class: 'seg' },
            h('button', { type: 'button', 'aria-pressed': String(d.mode === 'notes'), onclick: () => { d.mode = 'notes'; render(); } }, icon('pen-nib', 13), 'مع تدوين'),
            h('button', { type: 'button', 'aria-pressed': String(d.mode === 'listen'), onclick: () => { d.mode = 'listen'; render(); } }, icon('headphones', 13), 'سماع فقط')),
          h('span', { class: 'field-hint' }, d.mode === 'notes' ? 'لما تخلص الحلقة بيسألك إذا دوّنت، ومعك صندوق فوائد وتصوير الدفتر.' : 'لما تخلص الحلقة بتنحسب مباشرة بدون أسئلة.')),
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'اللون'), h('div', { class: 'tint-row' }, TINT_KEYS.map((k) => h('button', { type: 'button', class: 'tint-dot', 'aria-pressed': String(d.color === k), style: { '--tint': tintHex(k) }, onclick: () => { d.color = k; render(); } })))),
        h('button', { type: 'button', class: 'btn block', onclick: save }, ex ? 'احفظ' : 'أضف السلسلة'),
        ex ? h('button', { type: 'button', class: 'btn danger block', onclick: async () => { if (await confirmSheet('حذف السلسلة', `حذف «${ex.name}» وكل حلقاتها؟`, 'احذف')) { store.update((st) => { st.series = st.series.filter((y) => y.id !== id); }); close(); history.back(); } } }, 'حذف السلسلة') : null,
      ]);
    }
    async function save() {
      if (ex) { store.update((st) => { Object.assign(st.series.find((y) => y.id === id), { ...d, name: d.name.trim() || ex.name }); }); close(); return; }
      if (d.url && playlistIdFrom(d.url)) {
        toast('عم نجيب الحلقات من يوتيوب…', { duration: 0 });
        try {
          const r = await fetchPlaylist(d.url);
          const nid = uid('se');
          store.update((st) => { st.series.push({ id: nid, name: d.name.trim() || r.title || 'سلسلة', kind: d.kind, mode: d.mode, color: d.color, icon: 'video', image: d.image, unitWord: d.unitWord, episodes: [] }); });
          mergePlaylist(nid, r, d.url);
          close();
          toast(`انضافت «${d.name.trim() || r.title}» بـ ${r.items.length} حلقة`);
          return;
        } catch { toast('ما قدرنا نجيب القائمة هلق — انضافت السلسلة، وفيك تجيب الحلقات بعدين من «جلب من يوتيوب».', { kind: 'warn', duration: 6000 }); }
      }
      if (!d.name.trim()) { toast('اكتب اسم السلسلة أو حط رابط يوتيوب.', { kind: 'warn' }); return; }
      store.update((st) => { st.series.push({ id: uid('se'), name: d.name.trim(), kind: d.kind, mode: d.mode, color: d.color, icon: 'video', image: d.image, unitWord: d.unitWord, episodes: [], source: d.url ? { type: 'youtube', url: d.url, playlistId: playlistIdFrom(d.url) } : null }); });
      close();
    }
    render();
  });
}
