// الكتب: قراءة بالصفحات (مع سرعتك وموعد الختم المتوقّع)، أو دراسة بالدروس، أو حفظ،
// أو دروس مع سلسلة يوتيوب: الكتاب بينربط بسلسلة (جديدة من رابط قائمة التشغيل أو وحدة عندك)،
// وكل درس إله فيديو بيشتغل جوّا التطبيق وتقدّمه بيتسجّل لحاله — متل فقه النفس.
import { h, icon, badge, bar, ring, fill, openSheet, toast, haptic, chips, confirmSheet, pickImage, lowResCheck, empty, openActions } from '../ui.js';
import { fetchPlaylist, playlistIdFrom } from '../youtube.js';
import { seriesById, seriesProgress, nextEp, episodesBlock, mergePlaylist, isBookSeries } from './series.js';
import { store, uid } from '../store.js';
import { logicalToday } from '../prayer.js';
import { addDays, dayLabel, shortDate, durText, pagesText, daysText } from '../dates.js';
import { studyUnit, unitsProgress, masteryLabel, addUnits, MASTERY_STEPS } from '../library.js';
import { addTask } from '../tasks.js';
import { award, POINTS } from '../rewards.js';
import { openFocus } from './focus.js';
import { secTitle } from './components.js';
import { TINT_KEYS, tintHex } from '../icons.js';

const MODES = { pages: 'قراءة بالصفحات', lessons: 'دراسة بالدروس', video: 'دروس مع سلسلة يوتيوب', memorize: 'حفظ' };
const bookById = (id) => store.state.books.find((x) => x.id === id);
// السلسلة المربوطة بالكتاب (إذا في)
export const bookSeries = (b) => (b?.seriesId ? seriesById(b.seriesId) || null : null);
export function bookProgress(b) {
  const s = bookSeries(b);
  if (s) return seriesProgress(s);
  if (b.mode === 'pages') return b.totalPages ? Math.min(1, (b.pagesRead || 0) / b.totalPages) : 0;
  return unitsProgress(b.units);
}
// سطر قصير عن مكانك بالكتاب (للمكتبة والقوائم)
export function bookSub(b) {
  const s = bookSeries(b);
  if (s) { const eps = s.episodes || []; const n = nextEp(s); return `${eps.filter((e) => e.done).length} من ${eps.length} ${b.unitWord || 'درس'}${n ? ` · التالي ${n.title}` : ''}`; }
  if (b.mode === 'pages') return `ص ${b.pagesRead || 0} من ${b.totalPages || '؟'}`;
  return `${(b.units || []).filter((u) => (u.mastery || 0) >= 100).length} من ${(b.units || []).length} ${b.unitWord || 'درس'}`;
}
const modeLabel = (b) => (bookSeries(b) ? MODES.video : MODES[b.mode] || '');
function pace(b, today) {
  let sum = 0;
  for (const r of b.readLog || []) if (r.d > addDays(today, -14)) sum += r.pages;
  const avg = sum / 14;
  const left = Math.max(0, (b.totalPages || 0) - (b.pagesRead || 0));
  return { avg, left, eta: avg > 0 ? addDays(today, Math.ceil(left / avg)) : null };
}

export function renderBooks(ctx) {
  const list = store.state.books;
  if (!list.length) return h('div', null, empty('book', 'أضف الكتاب اللي عم تقرأه أو تدرسه، وسجّل وين وصلت — التطبيق بيحسب سرعتك وأيمت بتخلص.', h('button', { type: 'button', class: 'btn', onclick: () => openBookEdit(null) }, icon('plus', 18), 'كتاب جديد')));
  const reading = list.filter((b) => bookProgress(b) < 1);
  const done = list.filter((b) => bookProgress(b) >= 1);
  const row = (b) => {
    const p = bookProgress(b);
    return h('button', { type: 'button', class: 'row', onclick: () => ctx.open(`tracks/book/${b.id}`) },
      badge(b.icon || 'book', b.color || 'coral', 48, b.image),
      h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, b.name), h('span', { class: 'row-sub' }, `${modeLabel(b)} — ${bookSub(b)}`), bar(p, { cls: 'thin' })),
      h('span', { class: 'num dim', style: { fontSize: '13px' } }, `${Math.round(p * 100)}%`));
  };
  return h('div', null,
    secTitle('عم أقرأ', { ic: 'bookOpen', count: reading.length }),
    reading.length ? h('div', { class: 'group rows' }, reading.map(row)) : h('div', { class: 'group' }, h('div', { class: 'empty small' }, h('p', null, 'كل كتبك خالصة. ما شاء الله!'))),
    done.length ? [secTitle('خلّصتها', { ic: 'medal', count: done.length }), h('div', { class: 'group rows' }, done.map(row))] : null);
}
export function booksActions() { return h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'كتاب جديد', onclick: () => openBookEdit(null) }, icon('plus', 20)); }

export function renderBook(ctx) {
  const b = bookById(ctx.params.id);
  if (!b) return h('div', { class: 'empty' }, 'الكتاب مش موجود');
  const today = ctx.today;
  const p = bookProgress(b);
  const s = bookSeries(b);
  const root = h('div', null,
    h('div', { class: 'item-hero', style: { '--tint': tintHex(b.color) } },
      badge(b.icon || 'book', b.color, 64, b.image),
      h('div', null, h('strong', null, b.name), h('small', null, s ? h('span', { class: 'yt-pill' }, icon('youtube', 11), 'سلسلة يوتيوب') : null, `${s ? ' ' : modeLabel(b)}${s ? bookSub(b) : ''}${b.author ? ` — ${b.author}` : ''}`), bar(p))));
  if (s) {
    // الكتاب مربوط بسلسلة: الدروس فيديوهات بصورها وتقدّمها
    root.append(...episodesBlock(s, b.unitWord === 'درس' || !b.unitWord ? 'الدروس' : b.unitWord));
  } else if (b.mode === 'pages') {
    const pc = pace(b, today);
    root.append(
      h('div', { class: 'duo', style: { margin: '12px 16px 0' } },
        h('div', null, h('small', null, 'وصلت لـ'), h('b', { class: 'num' }, `صفحة ${b.pagesRead || 0}`), h('span', null, `من ${b.totalPages || '؟'} — باقي ${pagesText(pc.left)}`)),
        h('div', null, h('small', null, 'سرعتك'), h('b', { class: 'num' }, `${pc.avg.toFixed(1)} ص/يوم`), h('span', null, pc.eta ? `بتخلص تقريباً ${shortDate(pc.eta)}` : 'سجّل قراءتك لنحسب'))),
      h('div', { class: 'two', style: { padding: '12px 16px 0' } },
        h('button', { type: 'button', class: 'btn secondary', onclick: () => openReadLog(b.id, today) }, icon('plus', 18), 'سجّل قراءة'),
        h('button', { type: 'button', class: 'btn', onclick: () => startReading(b, today) }, icon('timer', 18), 'جلسة قراءة')),
      secTitle('سجلّ القراءة', { ic: 'list' }),
      (b.readLog || []).length ? h('div', { class: 'group rows' }, [...b.readLog].reverse().slice(0, 20).map((r) => h('div', { class: 'row' },
        h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, `${r.from}–${r.to}`), h('span', { class: 'row-sub' }, `${dayLabel(r.d, today)}${r.sec ? ` — ${durText(r.sec / 60)}` : ''}`)), h('span', { class: 'pill' }, pagesText(r.pages))))) : h('div', { class: 'group' }, h('div', { class: 'empty small' }, h('p', null, 'كل ما تقرأ سجّل وين وصلت.'))));
  } else {
    root.append(
      h('button', { type: 'button', class: 'banner tap', style: { margin: '12px 16px 0' }, onclick: () => openLinkSeries(b.id) }, h('span', { class: 'banner-ic' }, icon('youtube', 22)), h('p', null, h('b', null, 'إله سلسلة على يوتيوب؟'), h('br'), 'اربطه برابط قائمة التشغيل، فكل درس بيصير إله فيديو وتقدّمك بيتسجّل لحاله'), icon('chevL', 18)),
      secTitle(`${b.unitWord || 'الدروس'} (${(b.units || []).length})`, { ic: 'list', action: h('button', { type: 'button', class: 'link-btn', onclick: () => openAddBookUnits(b.id) }, icon('plus', 16), 'أضف') }),
      (b.units || []).length ? h('div', { class: 'group rows' }, b.units.map((u, i) => h('div', { class: 'row lect-row' },
        h('button', { type: 'button', class: 'row-tap', onclick: () => openBookUnit(b.id, u.id) },
          u.image ? badge('book', b.color, 40, u.image) : h('span', { class: 'lect-num num' }, String(i + 1)),
          h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, u.title), h('span', { class: 'row-sub' }, masteryLabel(u.mastery || 0)), h('span', { class: 'mastery-dots' }, [50, 75, 100].map((v) => h('i', { class: (u.mastery || 0) >= v ? 'on' : '' }))))),
        h('button', { type: 'button', class: `btn small ${(u.mastery || 0) >= 100 ? 'secondary' : ''}`, onclick: () => startUnit(b, u, today) }, icon('play', 14), (u.mastery || 0) >= 100 ? 'راجع' : 'ابدأ')))) : h('div', { class: 'group' }, h('div', { class: 'empty small' }, h('button', { type: 'button', class: 'btn', onclick: () => openAddBookUnits(b.id) }, icon('plus', 18), 'أضف الدروس'))));
  }
  root.dataset.title = b.name;
  return root;
}
export function bookActions(ctx) {
  const b = bookById(ctx.params.id);
  const s = bookSeries(b);
  return h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'خيارات', onclick: () => openActions(b?.name || 'الكتاب', [
    { icon: 'edit', label: 'تعديل الكتاب', run: () => openBookEdit(ctx.params.id) },
    b?.mode !== 'pages' || s ? { icon: 'youtube', label: s ? 'غيّر سلسلة يوتيوب' : 'اربطه بسلسلة يوتيوب', run: () => openLinkSeries(ctx.params.id) } : null,
    s ? { icon: 'link-slash', label: 'فك الربط بالسلسلة', sub: 'بيرجع للدروس العادية', run: () => unlinkSeries(ctx.params.id) } : null,
  ]) }, icon('more', 20));
}

/* ---------- ربط الكتاب بسلسلة يوتيوب ---------- */
function unlinkSeries(bid) {
  const b = bookById(bid);
  const s = bookSeries(b);
  store.update((st) => {
    const x = st.books.find((y) => y.id === bid);
    // تقدّم الفيديوهات بيرجع للدروس بالترتيب
    if (s && (x.units || []).length) (s.episodes || []).forEach((e, i) => { const u = x.units[i]; if (u) { u.mastery = Math.max(u.mastery || 0, Math.round(Math.max(e.progress || 0, (e.mastery || 0) / 100, e.done ? 1 : 0) * 100)); u.done = u.mastery >= 100; } });
    delete x.seriesId;
    // سلسلة انعملت للكتاب بس: منشيلها
    if (s && isBookSeries(s)) st.series = st.series.filter((y) => y.id !== s.id);
  });
  toast('انفك الربط — رجعت الدروس العادية');
}
// سلسلة جديدة للكتاب من رابط: تقدّم الدروس القديمة بيروح للفيديوهات بنفس الترتيب
export async function linkBookToPlaylist(bid, url, mode = 'listen') {
  const b = bookById(bid);
  const r = await fetchPlaylist(url);
  const old = bookSeries(b);
  const sid = old && isBookSeries(old) ? old.id : uid('se');
  if (!old || !isBookSeries(old)) {
    store.update((st) => { st.series.push({ id: sid, name: b.name, kind: 'book', bookId: bid, mode, color: b.color || 'coral', icon: 'book', image: b.image || null, unitWord: b.unitWord || 'درس', episodes: [] }); });
  }
  mergePlaylist(sid, r, url);
  store.update((st) => {
    const x = st.books.find((y) => y.id === bid);
    const s = st.series.find((y) => y.id === sid);
    x.seriesId = sid;
    s.name = x.name;
    (x.units || []).forEach((u, i) => { const e = s.episodes[i]; if (e && (u.mastery || 0) > (e.mastery || 0)) { e.mastery = u.mastery; if (u.mastery >= 100) e.done = true; } });
  });
  return r.items.length;
}
function openLinkSeries(bid) {
  const b = bookById(bid);
  const current = bookSeries(b);
  const others = store.state.series.filter((s) => !isBookSeries(s));
  let mode = current ? (current.mode || 'listen') : 'listen';
  openSheet('سلسلة يوتيوب للكتاب', (body, close) => {
    const input = h('input', { type: 'url', dir: 'ltr', placeholder: 'https://www.youtube.com/playlist?list=…', value: current?.source?.url || '', 'data-autofocus': true });
    const status = h('p', { class: 'hint' }, `حط رابط قائمة التشغيل. كل فيديو بيصير ${b.unitWord || 'درس'}، وتقدّمك القديم بالدروس بيضل بنفس الترتيب.`);
    const btn = h('button', { type: 'button', class: 'btn block', onclick: run }, icon('download', 17), 'جيب الدروس واربطه');
    async function run() {
      const url = input.value.trim();
      if (!playlistIdFrom(url)) { status.textContent = 'هالرابط مو رابط قائمة تشغيل (لازم يكون فيه list=).'; status.className = 'form-error'; return; }
      btn.disabled = true; status.className = 'hint'; status.textContent = 'عم نجيب القائمة…';
      try {
        const n = await linkBookToPlaylist(bid, url, mode);
        haptic('success'); close();
        toast(`انربط الكتاب بـ ${n} فيديو`);
      } catch {
        btn.disabled = false; status.className = 'form-error';
        status.textContent = 'ما قدرنا نجيب القائمة. جرّب بعد شوي، أو حط مفتاح يوتيوب من الإعدادات (أضمن).';
      }
    }
    function draw() {
      fill(body, [
        input, status,
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'طريقة المتابعة'),
          h('div', { class: 'seg' },
            h('button', { type: 'button', 'aria-pressed': String(mode === 'listen'), onclick: () => { mode = 'listen'; draw(); } }, icon('headphones', 13), 'سماع فقط'),
            h('button', { type: 'button', 'aria-pressed': String(mode === 'notes'), onclick: () => { mode = 'notes'; draw(); } }, icon('pen-nib', 13), 'مع تدوين'))),
        btn,
        others.length ? [
          h('div', { class: 'sheet-section' }, 'أو اربطه بسلسلة عندك'),
          h('div', { class: 'group rows' }, others.map((s) => h('button', { type: 'button', class: 'row', onclick: () => {
            store.update((st) => { const x = st.books.find((y) => y.id === bid); const prev = x.seriesId && st.series.find((y) => y.id === x.seriesId); if (prev && isBookSeries(prev)) st.series = st.series.filter((y) => y.id !== prev.id); x.seriesId = s.id; });
            close(); toast(`انربط بـ «${s.name}»`);
          } }, icon('youtube', 16), h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, s.name), h('span', { class: 'row-sub' }, `${(s.episodes || []).length} حلقة`)), current?.id === s.id ? icon('check', 16) : icon('chevL', 14)))),
        ] : null,
      ]);
    }
    draw();
  });
}

export function logPages(bookId, day, to, sec = 0) {
  const b = bookById(bookId);
  const from = (b.pagesRead || 0) + 1;
  const pages = to - from + 1;
  if (pages <= 0) return 0;
  store.update((st) => {
    const x = st.books.find((y) => y.id === bookId);
    x.pagesRead = Math.min(x.totalPages || to, to);
    x.readLog = x.readLog || [];
    x.readLog.push({ d: day, from, to, pages, sec });
    st.unitLog.push({ d: day, item: bookId, unit: `p${to}`, kind: 'book', w: pages / 10 });
  });
  award(`book:${bookId}:${to}`, Math.min(30, pages), `قراءة ${b.name}`, day);
  return pages;
}

function openReadLog(bookId, day) {
  const b = bookById(bookId);
  openSheet('سجّل قراءة', (body, close) => {
    const at = b.pagesRead || 0;
    const input = h('input', { type: 'number', inputmode: 'numeric', placeholder: `مثلاً ${at + 10}`, 'data-autofocus': true });
    const go = (to) => { const n = logPages(bookId, day, to); if (!n) { toast('اكتب رقم صفحة بعد مكانك.', { kind: 'warn' }); return; } haptic('success'); toast(`سجّلنا ${pagesText(n)}`); close(); };
    fill(body, [
      h('p', { class: 'hint' }, `إنت بالصفحة ${at}. وين وصلت؟`),
      h('div', { class: 'ql-btns' }, [5, 10, 20, 30].map((n) => h('button', { type: 'button', class: 'chip', onclick: () => go(at + n) }, `+${n}`))),
      h('div', { class: 'ql-to' }, h('label', { class: 'field', style: { flex: 1, margin: 0 } }, h('span', { class: 'field-label' }, 'وصلت للصفحة'), input), h('button', { type: 'button', class: 'btn', onclick: () => go(Number(input.value)) }, 'سجّل')),
    ]);
  });
}

function startReading(b, day) {
  openFocus({
    title: b.name, sub: `من صفحة ${(b.pagesRead || 0) + 1}`, image: b.image, color: tintHex(b.color), mode: 'open',
    onFinish: (sec) => { if (sec >= 30) setTimeout(() => openReadLogAfter(b.id, day, sec), 300); },
  });
}
export function openReadLogAfter(bookId, day, sec) {
  const b = bookById(bookId);
  openSheet('وين وصلت؟', (body, close) => {
    const input = h('input', { type: 'number', inputmode: 'numeric', placeholder: `${(b.pagesRead || 0) + 10}`, 'data-autofocus': true });
    fill(body, [h('p', { class: 'hint' }, `قرأت ${durText(sec / 60)}. لأي صفحة وصلت؟`), input,
      h('button', { type: 'button', class: 'btn block', onclick: () => { const n = logPages(bookId, day, Number(input.value), sec); if (n) { toast(`سجّلنا ${pagesText(n)}`); close(); } } }, 'سجّل')]);
  });
}

function startUnit(b, u, day) {
  openFocus({
    title: u.title, sub: b.name, image: u.image || b.image, color: tintHex(b.color),
    finishOptions: [{ label: 'درسته أول مرة', value: 50 }, { label: 'راجعته', value: 75 }, { label: 'ثبّته', value: 100 }],
    onFinish: (sec, v) => { studyUnit('book', b.id, u.id, { mastery: v == null ? (u.mastery || 0) : Math.max(v, u.mastery || 0), seconds: sec, day }); },
  });
}
function openBookUnit(bid, uid_) {
  const today = logicalToday();
  openSheet('الدرس', (body, close, { setTitle }) => {
    function render() {
      const b = bookById(bid);
      const u = b?.units.find((x) => x.id === uid_);
      if (!u) { close(); return; }
      setTitle(u.title);
      const set = (patch) => { store.update((st) => { Object.assign(st.books.find((y) => y.id === bid).units.find((z) => z.id === uid_), patch); }); render(); };
      fill(body, [
        h('div', { class: 'lect-head' },
          h('button', { type: 'button', class: 'lect-img', onclick: async () => { const img = await pickImage(); if (img) set({ image: img }); } }, u.image ? h('img', { src: u.image, alt: '', onload: lowResCheck }) : [icon('image', 26), h('small', null, 'صورة')]),
          h('label', { class: 'field', style: { flex: 1, margin: 0 } }, h('span', { class: 'field-label' }, 'الاسم'), h('input', { type: 'text', value: u.title, onchange: (e) => set({ title: e.target.value.trim() || u.title }) }))),
        h('div', { class: 'mastery-grid', style: { marginTop: '12px' } }, MASTERY_STEPS.map((st) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String((u.mastery || 0) === st.v), onclick: () => { if (st.v > (u.mastery || 0)) studyUnit('book', bid, uid_, { mastery: st.v, day: today }); else set({ mastery: st.v, done: st.v >= 100 }); render(); } }, `${st.v}% ${st.label}`))),
        h('div', { class: 'two', style: { marginTop: '12px' } },
          h('button', { type: 'button', class: 'btn', onclick: () => { close(); setTimeout(() => startUnit(b, u, today), 250); } }, icon('play', 16), 'ابدأ'),
          h('button', { type: 'button', class: 'btn secondary', onclick: () => { addTask({ title: `${b.name}: ${u.title}`, date: today, tag: 'study', link: { kind: 'lesson', itemId: bid, unitId: uid_, image: u.image || b.image || null } }); toast('انضاف لمهام اليوم'); } }, icon('plus', 16), 'لمهام اليوم')),
        h('button', { type: 'button', class: 'btn danger block', onclick: () => { store.update((st) => { const x = st.books.find((y) => y.id === bid); x.units = x.units.filter((z) => z.id !== uid_); }); close(); } }, 'حذف'),
      ]);
    }
    render();
  });
}
function openAddBookUnits(bid) {
  const b = bookById(bid);
  openSheet(`أضف ${b.unitWord || 'دروس'}`, (body, close) => {
    let count = 10, names = '';
    fill(body, [
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'العدد'), h('input', { type: 'number', value: count, oninput: (e) => { count = Number(e.target.value) || 0; } })),
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'أو الأسماء (كل واحد بسطر)'), h('textarea', { rows: 4, oninput: (e) => { names = e.target.value; } })),
      h('button', { type: 'button', class: 'btn block', onclick: () => {
        const list = names.split('\n').map((x) => x.trim()).filter(Boolean);
        if (list.length) store.update((st) => { const x = st.books.find((y) => y.id === bid); for (const n of list) x.units.push({ id: uid('u'), title: n, image: null, mastery: 0, times: 0, spent: 0, estimate: 0, done: false }); });
        else addUnits('book', bid, Math.min(300, count), b.unitWord || 'درس');
        close();
      } }, 'أضف'),
    ]);
  });
}

export function openBookEdit(id) {
  const ex = id ? bookById(id) : null;
  const d = ex ? { name: ex.name, author: ex.author || '', mode: ex.mode, totalPages: ex.totalPages || 0, color: ex.color || 'coral', image: ex.image, unitWord: ex.unitWord || 'درس' } : { name: '', author: '', mode: 'pages', totalPages: 0, color: 'coral', image: null, unitWord: 'درس', count: 0 };
  openSheet(ex ? 'تعديل الكتاب' : 'كتاب جديد', (body, close) => {
    function render() {
      fill(body, [
        h('div', { class: 'lect-head' },
          h('button', { type: 'button', class: 'lect-img', onclick: async () => { const img = await pickImage(); if (img) { d.image = img; render(); } } }, d.image ? h('img', { src: d.image, alt: '', onload: lowResCheck }) : [icon('image', 26), h('small', null, 'غلاف')]),
          h('label', { class: 'field', style: { flex: 1, margin: 0 } }, h('span', { class: 'field-label' }, 'اسم الكتاب'), h('input', { type: 'text', value: d.name, 'data-autofocus': true, oninput: (e) => { d.name = e.target.value; } }))),
        h('label', { class: 'field', style: { marginTop: '12px' } }, h('span', { class: 'field-label' }, 'المؤلف (اختياري)'), h('input', { type: 'text', value: d.author, oninput: (e) => { d.author = e.target.value; } })),
        ex ? null : h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'كيف بتمشي فيه؟'), chips(Object.entries(MODES).map(([v, l]) => ({ value: v, label: l })), d.mode, (v) => { d.mode = v; render(); })),
        d.mode === 'pages' ? h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'عدد الصفحات'), h('input', { type: 'number', value: d.totalPages || '', oninput: (e) => { d.totalPages = Number(e.target.value) || 0; } }))
          : d.mode === 'video' && !ex ? h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'رابط قائمة التشغيل على يوتيوب'), h('input', { type: 'url', dir: 'ltr', value: d.url || '', placeholder: 'https://www.youtube.com/playlist?list=…', oninput: (e) => { d.url = e.target.value; } }),
            h('span', { class: 'field-hint' }, 'كل فيديو بيصير درس بصورته، وبيشتغل جوّا التطبيق متل فقه النفس. فيك كمان تربط سلسلة عندك من صفحة الكتاب بعدين.'))
          : ex ? null : h('div', { class: 'two' },
            h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'العدد'), h('input', { type: 'number', value: d.count || '', placeholder: '20', oninput: (e) => { d.count = Number(e.target.value) || 0; } })),
            h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'اسم الوحدة'), h('input', { type: 'text', value: d.unitWord, oninput: (e) => { d.unitWord = e.target.value; } }))),
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'اللون'), h('div', { class: 'tint-row' }, TINT_KEYS.map((k) => h('button', { type: 'button', class: 'tint-dot', 'aria-pressed': String(d.color === k), style: { '--tint': tintHex(k) }, onclick: () => { d.color = k; render(); } })))),
        h('button', { type: 'button', class: 'btn block', onclick: () => {
          if (!d.name.trim()) { toast('اكتب اسم الكتاب.', { kind: 'warn' }); return; }
          if (ex) store.update((st) => { const { count, ...rest } = d; Object.assign(st.books.find((y) => y.id === id), { ...rest, name: d.name.trim() }); });
          else {
            const video = d.mode === 'video';
            if (video && !playlistIdFrom(d.url || '')) { toast('حط رابط قائمة تشغيل (فيه list=)، أو اختار «دراسة بالدروس» واربطه بعدين.', { kind: 'warn', duration: 5000 }); return; }
            const nid = uid('bk');
            store.update((st) => { st.books.push({ id: nid, name: d.name.trim(), author: d.author, mode: video ? 'lessons' : d.mode, totalPages: d.totalPages, pagesRead: 0, readLog: [], units: [], color: d.color, image: d.image, icon: 'book', unitWord: d.mode === 'memorize' ? 'صفحة' : d.unitWord }); });
            if (d.mode !== 'pages' && !video && d.count) addUnits('book', nid, Math.min(300, d.count), d.mode === 'memorize' ? 'صفحة' : d.unitWord);
            if (video) {
              close();
              toast('عم نجيب الدروس من يوتيوب…', { duration: 0 });
              linkBookToPlaylist(nid, d.url.trim()).then((n) => toast(`انضاف «${d.name.trim()}» بـ ${n} درس`)).catch(() => toast('انضاف الكتاب، بس ما قدرنا نجيب القائمة هلّق — اربطه من صفحة الكتاب.', { kind: 'warn', duration: 6000 }));
              return;
            }
          }
          close();
        } }, ex ? 'احفظ' : 'أضف الكتاب'),
        ex ? h('button', { type: 'button', class: 'btn danger block', onclick: async () => { if (await confirmSheet('حذف الكتاب', `حذف «${ex.name}»؟`, 'احذف')) { store.update((st) => { st.books = st.books.filter((y) => y.id !== id); }); close(); history.back(); } } }, 'حذف الكتاب') : null,
      ]);
    }
    render();
  });
}
