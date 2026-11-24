// العبادات: الصلوات، شاشة الأذكار بالعدّاد، ورد القرآن والمصحف، والحفظ
import { h, icon, badge, ring, bar, fill, openSheet, toast, haptic, chips, toggleRow, openPicker, confirmSheet, segmented } from '../ui.js';
import { store, uid } from '../store.js';
import { kvGet, kvSet } from '../db.js';
import { logicalToday, adhanFor, PRAYERS, PRAYER_NAMES, PERIOD_SKY } from '../prayer.js';
import { prayerOn, setPrayer, PRAYER_STATUS, prayersDone, prayerSunnah, toggleSunnah, adhkarList, allAdhkarLists, adhkarDone, setAdhkarDone, adhkarSettings, loadAdhkarSession, saveAdhkarSession, quranStats, quranPage, readQuranTo, addQuranPages, undoQuranDay, pagesReadOn, quranStreak, hifzDue } from '../worship.js';
import { SURAHS, TOTAL_PAGES, juzOfPage, surahOfPage, juzStart, pageLabel } from '../data/quran-meta.js';
import { addDays, dayLabel, shortDate, time12, daysText, pagesText, WEEK_SHORT, parseISO } from '../dates.js';
import { secTitle } from './components.js';
import { award, POINTS } from '../rewards.js';
import { invalidateDay } from '../commit.js';
import { hifzToday, hifzStats } from '../hifz.js';
import { SUNNAH_SLOTS, sunnahOn, toggleSunnahSlot, rakaatOn, fastInfo, upcomingFasts, qada, qadaPrayersTotal } from '../fasting.js';
import { openCounter } from './duas.js';

const ADHKAR_ID_ORDER = ['morning', 'evening', 'prayer', 'sleep', 'wake'];

/* ---------- الصفحة ---------- */
export function renderWorship(ctx) {
  const today = ctx.today;
  const root = h('div');
  // الصلوات
  const done = prayersDone(today);
  root.append(secTitle('الصلوات', { ic: 'mosque', count: `${done}/5` }));
  root.append(h('div', { class: 'group rows' }, PRAYERS.map((k) => prayerRow(today, k))));
  root.append(prayerWeek(today));
  // الصيام والقضاء والسنن
  const fi = fastInfo(today);
  const nx = upcomingFasts(addDays(today, 1), 1)[0];
  const qn = qadaPrayersTotal() + (qada().fasts || 0);
  root.append(h('button', { type: 'button', class: 'group fs-link', onclick: () => ctx.open('tracks/fasting') },
    badge('moon', 'mint', 44),
    h('span', { class: 'row-main' },
      h('span', { class: 'row-title' }, 'الصيام والقضاء والسنن'),
      h('span', { class: 'row-sub' }, [fi.reasons.length ? `اليوم: ${fi.reasons.map((r) => r.name).join('، ')}` : nx ? `الجاي: ${nx.reasons[0].name} ${dayLabel(nx.d, today)}` : null, `السنن ${rakaatOn(today)}/12`, qn ? `قضاء ${qn}` : null].filter(Boolean).join(' · '))),
    icon('chevL', 18)));
  // الأذكار
  root.append(secTitle('الأذكار', { ic: 'beads', action: h('span', { class: 'sec-acts' },
    h('button', { type: 'button', class: 'link-btn', onclick: () => openCounter() }, icon('beads', 14), 'العدّاد'),
    h('button', { type: 'button', class: 'link-btn', onclick: () => ctx.open('tracks/duas') }, icon('hands-praying', 14), 'الأدعية')) }));
  root.append(h('div', { class: 'group rows' }, allAdhkarLists().map((l) => {
    const st = adhkarSettings(l.id);
    const d = adhkarDone(today, l.id);
    return h('div', { class: 'row' },
      h('button', { type: 'button', class: 'row-tap', onclick: () => openAdhkar(l.id, today) },
        badge(d ? 'check' : (l.icon || 'beads'), d ? 'mint' : (l.tint || 'dawn'), 40, d ? null : l.image),
        h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, l.name),
          h('span', { class: 'row-sub' }, d ? 'تمّت اليوم' : `${l.items.length} ذكر${st.core ? ' — من التعهّد' : st.enabled ? ' — بصفحة اليوم' : ''}`))),
      h('button', { type: 'button', class: 'icon-btn ghost', 'aria-label': 'إعدادات', onclick: () => openAdhkarSettings(l) }, icon('sliders', 18)));
  })));
  // القرآن
  const qs = quranStats(today);
  const s = surahOfPage(qs.page);
  root.append(secTitle('القرآن الكريم', { ic: 'quran', action: h('button', { type: 'button', class: 'link-btn', onclick: () => ctx.open('tracks/quran') }, 'التفاصيل', icon('chevL', 14)) }));
  root.append(h('div', { class: 'group quran-card' },
    h('div', { class: 'qc-top' },
      ring(qs.pct, 64, { stroke: 5, color: 'var(--good)', label: `${Math.round(qs.pct * 100)}%` }),
      h('div', { class: 'qc-info' },
        h('small', null, `الختمة ${qs.khatmas + 1}`),
        h('strong', null, `سورة ${s.name}`),
        h('span', null, `الصفحة ${qs.page} — الجزء ${juzOfPage(qs.page)}`)),
      h('div', { class: 'qc-today' }, h('b', { class: 'num' }, `${qs.todayPages}/${qs.daily}`), h('small', null, 'اليوم'))),
    bar(Math.min(1, qs.todayPages / qs.daily), { cls: qs.todayPages >= qs.daily ? 'good' : '' }),
    h('div', { class: 'two', style: { marginTop: '12px' } },
      h('button', { type: 'button', class: 'btn secondary', onclick: () => openQuranLog(today) }, icon('plus', 18), 'سجّل قراءة'),
      h('button', { type: 'button', class: 'btn', onclick: () => openReader(qs.page, today) }, icon('bookOpen', 18), 'افتح المصحف'))));
  // الحفظ: شاشته لحالها (الجديد، المراجعة القريبة والبعيدة، وخريطة الأجزاء)
  const ht = hifzToday(today);
  const hs = hifzStats(today);
  root.append(secTitle('الحفظ', { ic: 'brain' }),
    h('button', { type: 'button', class: 'group hz-link', onclick: () => ctx.open('tracks/hifz') },
      badge('brain', 'mint', 44),
      h('span', { class: 'row-main' },
        h('span', { class: 'row-title' }, ht ? (ht.done ? 'حفظ اليوم خلص' : `اليوم: ${[ht.portion && !ht.log.new ? 'جديد' : null, (ht.near.length && !ht.log.near) || (ht.far.length && !ht.log.far) ? 'مراجعة' : null].filter(Boolean).join(' + ') || 'مراجعة'}`) : 'اعمل خطة حفظ'),
        h('span', { class: 'row-sub' }, hs.pages ? `${+hs.juzCount.toFixed(1)} جزء محفوظ · ${hs.pages} صفحة` : 'كل يوم جديد بمقدارك، ومراجعة قريبة وبعيدة')),
      icon('chevL', 18)));
  return root;
}

function prayerRow(day, k) {
  const st = prayerOn(day, k);
  const a = adhanFor(day);
  return h('button', { type: 'button', class: 'row', onclick: () => openPrayerSheet(day, k) },
    h('span', { class: 'pr-sq', style: { '--sky': PERIOD_SKY[k] } }, icon('mosque', 18)),
    h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, `صلاة ${PRAYER_NAMES[k]}`), h('span', { class: 'row-sub' }, time12(a[k]))),
    st ? h('span', { class: `pill ${st === 'missed' ? 'bad' : st === 'late' ? 'warn' : 'good'}` }, (PRAYER_STATUS[st] || PRAYER_STATUS.ontime).label) : h('span', { class: 'pill' }, 'سجّل'));
}

function prayerWeek(today) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  return h('div', { class: 'group pw-grid' },
    h('div', { class: 'pw-row head' }, h('span'), days.map((d) => h('span', null, WEEK_SHORT[parseISO(d).getDay()]))),
    PRAYERS.map((k) => h('div', { class: 'pw-row' }, h('span', null, PRAYER_NAMES[k]),
      days.map((d) => { const st = prayerOn(d, k); return h('button', { type: 'button', class: `pw-cell ${st || ''}`, onclick: () => openPrayerSheet(d, k), 'aria-label': `${PRAYER_NAMES[k]} ${d}` }); }))));
}

export function openPrayerSheet(day, key) {
  const a = adhanFor(day);
  openSheet(`صلاة ${PRAYER_NAMES[key]}`, (body, close) => {
    const st = prayerOn(day, key);
    const pick = (v) => { setPrayer(day, key, v); if (day < logicalToday()) invalidateDay(day); haptic(v === 'missed' ? 'warn' : 'success'); close(); if (v && v !== 'missed') toast(`تقبّل الله — ${PRAYER_STATUS[v].label}`); };
    fill(body, [
      h('p', { class: 'hint' }, `${dayLabel(day, logicalToday())} — الأذان ${time12(a[key])}`),
      h('div', { class: 'status-grid' }, Object.entries(PRAYER_STATUS).map(([k, v]) => h('button', {
        type: 'button', class: `status-btn ${k}`, 'aria-pressed': String(st === k), onclick: () => pick(k),
      }, icon(k === 'missed' ? 'close' : k === 'late' ? 'clock' : k === 'jamaah' ? 'people' : 'check', 22), v.label))),
      SUNNAH_SLOTS.some((sl) => sl.prayer === key) ? h('div', { class: 'ps-sn' }, h('span', null, 'السنّة الراتبة'),
        h('div', { class: 'chips' }, SUNNAH_SLOTS.filter((sl) => sl.prayer === key).map((sl) => h('button', { type: 'button', class: 'chip small', 'aria-pressed': String(Boolean(sunnahOn(day)[sl.k])), onclick: (e) => { const on = toggleSunnahSlot(day, sl.k); e.currentTarget.setAttribute('aria-pressed', String(on)); haptic('select'); } }, `${sl.name} · ${sl.rak}`)))) : null,
      st ? h('button', { type: 'button', class: 'btn danger block', onclick: () => pick(null) }, 'امسح التسجيل') : null,
    ]);
  });
}

/* ---------- شاشة الأذكار ---------- */
export function openAdhkar(id, day = logicalToday()) {
  const list = adhkarList(id);
  if (!list) return;
  const counts = loadAdhkarSession(day, id);
  let idx = list.items.findIndex((x) => (counts[x.id] || 0) < x.count);
  if (idx < 0) idx = 0;
  openSheet(null, (body, close) => {
    function finished() { return list.items.every((x) => (counts[x.id] || 0) >= x.count); }
    function render() {
      const item = list.items[idx];
      const c = counts[item.id] || 0;
      const totalReps = list.items.reduce((a, x) => a + x.count, 0);
      const doneReps = list.items.reduce((a, x) => a + Math.min(x.count, counts[x.id] || 0), 0);
      const allDone = finished();
      fill(body, [
        h('div', { class: 'az-head' },
          h('button', { type: 'button', class: 'icon-btn ghost', 'aria-label': 'إغلاق', onclick: () => close() }, icon('close', 22)),
          h('div', null, h('b', null, list.name), h('small', null, `${idx + 1} من ${list.items.length}`)),
          h('button', { type: 'button', class: 'icon-btn ghost', 'aria-label': 'تعديل', onclick: () => { close(); setTimeout(() => openAdhkarSettings(list), 250); } }, icon('sliders', 20))),
        bar(doneReps / totalReps, { cls: allDone ? 'good' : '' }),
        allDone ? doneView() : h('div', { class: 'az-card', role: 'button', tabindex: '0', onclick: () => tap(), onkeydown: (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); tap(); } } },
          item.title ? h('div', { class: 'az-title' }, item.title) : null,
          item.pre ? h('p', { class: 'az-pre' }, item.pre) : null,
          h('p', { class: item.quran ? 'az-text quran' : 'az-text' }, ...String(item.text).split('\n').flatMap((ln, i) => (i ? [h('br'), ln] : [ln]))),
          item.src ? h('p', { class: 'az-src' }, item.src) : null),
        allDone ? null : h('div', { class: 'az-foot' },
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'السابق', disabled: idx === 0 ? true : null, onclick: () => { if (idx > 0) { idx -= 1; render(); } } }, icon('chevR', 22)),
          h('button', { type: 'button', class: `az-count${c >= item.count ? ' full' : ''}`, onclick: () => tap() },
            ring(c / item.count, 96, { stroke: 6, color: c >= item.count ? 'var(--good)' : 'var(--accent)' }),
            h('span', null, h('b', { class: 'num' }, String(Math.max(0, item.count - c))), h('small', null, item.count > 1 ? 'باقي' : 'مرة'))),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'التالي', onclick: () => next() }, icon('chevL', 22))),
        allDone ? null : h('p', { class: 'az-hint' }, 'اضغط على النص أو الدائرة للعدّ'),
      ]);
    }
    function doneView() {
      return h('div', { class: 'az-done' },
        badge('check', 'mint', 72),
        h('h3', null, 'تقبّل الله'),
        h('p', null, `أنهيت ${list.name}`),
        h('button', { type: 'button', class: 'btn block', onclick: () => close() }, 'تمّ'),
        h('button', { type: 'button', class: 'btn secondary block', onclick: () => { for (const k of Object.keys(counts)) delete counts[k]; idx = 0; saveAdhkarSession(day, id, counts); render(); } }, 'من الأول'));
    }
    function tap() {
      const item = list.items[idx];
      counts[item.id] = (counts[item.id] || 0) + 1;
      saveAdhkarSession(day, id, counts);
      if (counts[item.id] >= item.count) {
        haptic('select');
        if (finished()) { complete(); return; }
        setTimeout(() => next(), 260);
      } else haptic('tap');
      render();
    }
    function next() {
      const n = list.items.findIndex((x, i) => i > idx && (counts[x.id] || 0) < x.count);
      if (n >= 0) idx = n; else if (idx < list.items.length - 1) idx += 1;
      render();
    }
    function complete() {
      if (!adhkarDone(day, id)) { setAdhkarDone(day, id, true); if (day < logicalToday()) invalidateDay(day); }
      haptic('success');
      render();
    }
    render();
  }, { full: true, cls: 'az-sheet' });
}

function openAdhkarSettings(l) {
  openSheet(l.name, (body) => {
    function render() {
      const st = adhkarSettings(l.id);
      const set = (patch) => { store.update((s) => { s.adhkar.lists = s.adhkar.lists || {}; s.adhkar.lists[l.id] = { ...(s.adhkar.lists[l.id] || {}), ...patch }; }); render(); };
      fill(body, [
        h('div', { class: 'rows sheet-rows' },
          toggleRow({ title: 'بصفحة اليوم', sub: 'بطاقة صغيرة بتذكّرك بوقتها', checked: st.enabled, onChange: (v) => set({ enabled: v }) }),
          toggleRow({ title: 'من شروط التعهّد', sub: 'اليوم ما بيكمل إلا فيها (إذا أساسية)', checked: st.core, onChange: (v) => set({ core: v, enabled: v || st.enabled }) })),
        st.core ? h('div', { class: 'seg' }, ['essential', 'secondary'].map((v) => h('button', { type: 'button', 'aria-pressed': String((st.level || 'essential') === v), onclick: () => set({ level: v }) }, v === 'essential' ? 'أساسية' : 'ثانوية'))) : null,
        h('div', { class: 'sheet-section' }, 'الأذكار وعدد مرات كل واحد'),
        h('div', { class: 'rows sheet-rows' }, (adhkarList(l.id)?.items || []).map((x) => h('div', { class: 'row' },
          h('span', { class: 'row-main' }, h('span', { class: 'row-title az-mini' }, x.title || x.text.slice(0, 60))),
          h('span', { class: 'pill' }, `×${x.count}`)))),
      ]);
    }
    render();
  });
}

function openTasbeeh() {
  let target = 33;
  openSheet('المسبحة', (body) => {
    function render() {
      const n = store.state.adhkar.tasbeeh || 0;
      fill(body, [
        h('div', { class: 'chips', style: { justifyContent: 'center', marginBottom: '12px' } }, [33, 100, 1000].map((t) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(target === t), onclick: () => { target = t; render(); } }, `${t}`))),
        h('button', { type: 'button', class: 'tasbeeh', onclick: () => { store.update((s) => { s.adhkar.tasbeeh = (s.adhkar.tasbeeh || 0) + 1; }, { silent: true }); haptic((n + 1) % target === 0 ? 'success' : 'tap'); render(); } },
          ring((n % target) / target, 200, { stroke: 8, color: 'var(--accent)' }),
          h('span', null, h('b', { class: 'num' }, String(n)), h('small', null, `الدورة ${Math.floor(n / target) + 1}`))),
        h('button', { type: 'button', class: 'btn secondary block', onclick: () => { store.update((s) => { s.adhkar.tasbeeh = 0; }); render(); } }, 'صفّر'),
      ]);
    }
    render();
  });
}

/* ---------- القرآن ---------- */
export function openQuranLog(day = logicalToday()) {
  openSheet('ورد القرآن', (body, close) => {
    function render() {
      const qs = quranStats(day === logicalToday() ? day : logicalToday());
      const page = quranPage();
      const s = surahOfPage(page);
      const today = pagesReadOn(day);
      const toInput = h('input', { type: 'number', inputmode: 'numeric', min: page, max: TOTAL_PAGES, placeholder: `مثلاً ${Math.min(TOTAL_PAGES, page + 9)}` });
      const add = (n) => {
        const r = addQuranPages(day, n);
        if (day < logicalToday()) invalidateDay(day);
        haptic('success');
        if (r === -1) toast('مبارك! ختمت القرآن الكريم', { kind: 'gold', duration: 6000 }); else toast(`سجّلنا ${pagesText(n)}`);
        render();
      };
      fill(body, [
        h('div', { class: 'ql-now' },
          h('small', null, 'وصلت لـ'),
          h('strong', null, `سورة ${s.name}`),
          h('span', null, `الصفحة ${page} — الجزء ${juzOfPage(page)}`)),
        h('p', { class: 'hint' }, `${dayLabel(day, logicalToday())}: قرأت ${pagesText(today) === 'صفحة' ? 'صفحة' : today ? pagesText(today) : 'ولا صفحة'} — الهدف ${qs.daily}`),
        h('div', { class: 'ql-btns' }, [1, 2, 5, 10, 20].map((n) => h('button', { type: 'button', class: 'chip', onclick: () => add(n) }, `+${n}`))),
        h('div', { class: 'ql-to' },
          h('label', { class: 'field', style: { flex: 1, margin: 0 } }, h('span', { class: 'field-label' }, 'أو وصلت للصفحة'), toInput),
          h('button', { type: 'button', class: 'btn', onclick: () => { const v = Number(toInput.value); if (!v || v < page) { toast('اكتب رقم صفحة بعد مكانك الحالي.', { kind: 'warn' }); return; } const n = v - page + 1; readQuranTo(day, Math.min(TOTAL_PAGES, v)); if (day < logicalToday()) invalidateDay(day); haptic('success'); toast(`سجّلنا ${pagesText(n)}`); render(); } }, 'سجّل')),
        h('button', { type: 'button', class: 'btn secondary block', onclick: () => { close(); setTimeout(() => openReader(page, day), 250); } }, icon('bookOpen', 18), 'اقرأ من المصحف هون'),
        today ? h('button', { type: 'button', class: 'btn danger block', onclick: () => { undoQuranDay(day); render(); } }, 'امسح قراءة هاليوم') : null,
      ]);
    }
    render();
  });
}

export function renderQuran(ctx) {
  const today = ctx.today;
  const qs = quranStats(today);
  const streak = quranStreak(today);
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const max = Math.max(qs.daily, ...days.map((d) => pagesReadOn(d)));
  return h('div', null,
    h('div', { class: 'group quran-card', style: { marginTop: '8px' } },
      h('div', { class: 'qc-top' },
        ring(qs.pct, 76, { stroke: 6, color: 'var(--good)', label: `${Math.round(qs.pct * 100)}%` }),
        h('div', { class: 'qc-info' },
          h('small', null, `الختمة رقم ${qs.khatmas + 1}`),
          h('strong', null, pageLabel(qs.page)),
          h('span', null, `باقي ${pagesText(qs.left)}`))),
      h('div', { class: 'duo' },
        h('div', null, h('small', null, 'معدّلك'), h('b', { class: 'num' }, `${qs.avg.toFixed(1)} ص/يوم`), h('span', null, qs.eta ? `بتختم تقريباً ${shortDate(qs.eta)}` : 'سجّل قراءتك لنحسب')),
        h('div', null, h('small', null, 'إذا قرأت يومياً'), h('b', { class: 'num' }, `${qs.daily} صفحات`), h('span', null, `بتختم بعد ${daysText(qs.daysToGoal)}`))),
      h('div', { class: 'mini-chart' }, days.map((d) => h('i', { style: { height: `${Math.max(4, (pagesReadOn(d) / max) * 100)}%` }, class: pagesReadOn(d) >= qs.daily ? 'good' : pagesReadOn(d) ? '' : 'nil', title: `${d}: ${pagesReadOn(d)}` }))),
      h('p', { class: 'muted', style: { marginTop: '8px' } }, streak ? `${daysText(streak)} ورا بعض وإنت قارئ` : 'ابدأ اليوم سلسلة قراءة'),
      h('div', { class: 'two', style: { marginTop: '12px' } },
        h('button', { type: 'button', class: 'btn secondary', onclick: () => openQuranLog(today) }, icon('plus', 18), 'سجّل'),
        h('button', { type: 'button', class: 'btn', onclick: () => openReader(qs.page, today) }, icon('bookOpen', 18), 'المصحف'))),
    secTitle('الورد اليومي', { ic: 'target' }),
    h('div', { class: 'group rows' },
      h('div', { class: 'row' }, h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, 'عدد الصفحات باليوم'), h('span', { class: 'row-sub' }, 'الختمة كل 30 يوم = 20 صفحة')),
        h('div', { class: 'stepper' },
          h('button', { type: 'button', class: 'icon-btn small', onclick: () => store.update((s) => { s.settings.quranDaily = Math.max(1, (s.settings.quranDaily || 10) - 1); }) }, icon('minus', 16)),
          h('b', { class: 'stepper-val' }, String(qs.daily)),
          h('button', { type: 'button', class: 'icon-btn small', onclick: () => store.update((s) => { s.settings.quranDaily = Math.min(60, (s.settings.quranDaily || 10) + 1); }) }, icon('plus', 16)))),
      toggleRow({ title: 'الورد من شروط التعهّد', sub: 'اليوم ما بيكمل إلا لما تقرأ وردك', checked: Boolean(store.state.quran.core), onChange: (v) => store.update((s) => { s.quran.core = v; }) }),
      h('button', { type: 'button', class: 'row', onclick: () => openPicker({ title: 'ابدأ من سورة', value: surahOfPage(qs.page).n, options: SURAHS.map((x) => ({ value: x.n, label: `${x.n}. ${x.name}`, sub: `صفحة ${x.page}` })), onPick: (n) => store.update((s) => { s.quran.page = SURAHS[n - 1].page; }) }) },
        h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, 'غيّر مكانك بالمصحف'), h('span', { class: 'row-sub' }, 'إذا كنت قارئ لمكان معيّن قبل التطبيق')), icon('chevL', 18))),
    secTitle('الختمات', { ic: 'medal', count: qs.khatmas }),
    h('div', { class: 'group rows' }, (store.state.quran.khatmas || []).length ? [...store.state.quran.khatmas].reverse().map((k) => h('div', { class: 'row' }, badge('medal', 'gold', 36), h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, `الختمة ${k.n}`), h('span', { class: 'row-sub' }, k.end ? `ختمتها ${shortDate(k.end)}` : 'من قبل التطبيق')))) : h('div', { class: 'empty small' }, h('p', null, 'أول ختمة بتنسجل هون لحالها لما توصل للصفحة 604.'))));
}
export function quranActions() { return null; }

// المصحف: نص الصفحة من موقع alquran.cloud (ويتخزّن على الجهاز بعد أول فتح)
export async function fetchPage(n) {
  const cached = await kvGet(`qp:${n}`);
  if (cached) return cached;
  const r = await fetch(`https://api.alquran.cloud/v1/page/${n}/quran-uthmani`);
  if (!r.ok) throw new Error('net');
  const j = await r.json();
  const ayahs = (j.data?.ayahs || []).map((a) => ({ t: String(a.text || '').replace(/﻿/g, ''), n: a.numberInSurah, s: a.surah?.number, sn: a.surah?.name }));
  kvSet(`qp:${n}`, ayahs);
  return ayahs;
}
export function openReader(startPage = quranPage(), day = logicalToday()) {
  let page = startPage;
  const startedAt = quranPage();
  openSheet(null, (body, close) => {
    const text = h('div', { class: 'mushaf' });
    async function load() {
      fill(text, [h('p', { class: 'muted', style: { textAlign: 'center', padding: '40px 0' } }, 'عم نجيب الصفحة…')]);
      try {
        const ayahs = await fetchPage(page);
        const parts = [];
        let lastS = null;
        for (const a of ayahs) {
          if (a.s !== lastS && a.n === 1) {
            parts.push(h('div', { class: 'm-surah' }, a.sn || `سورة ${SURAHS[a.s - 1]?.name}`));
            let t = a.t;
            // أول آية بكل سورة (غير الفاتحة والتوبة) جاية ومعها البسملة: منفصلها بسطر لحالها
            if (a.s !== 1 && a.s !== 9 && /^بِسْمِ/.test(t.normalize('NFC'))) {
              const w = t.trim().split(/\s+/);
              parts.push(h('div', { class: 'm-basmala' }, w.slice(0, 4).join(' ')));
              t = w.slice(4).join(' ');
            }
            parts.push(h('span', null, `${t} `), h('span', { class: 'm-num' }, `﴿${a.n.toLocaleString('ar-EG')}﴾ `));
          } else parts.push(h('span', null, `${a.t} `), h('span', { class: 'm-num' }, `﴿${a.n.toLocaleString('ar-EG')}﴾ `));
          lastS = a.s;
        }
        fill(text, [h('p', { class: 'm-text' }, parts)]);
      } catch {
        fill(text, [h('div', { class: 'empty' }, icon('wifiOff', 30), h('p', null, 'الصفحة بدها نت أول مرة. بعدين بتنفتح بدون نت.'))]);
      }
    }
    function render() {
      fill(body, [
        h('div', { class: 'az-head' },
          h('button', { type: 'button', class: 'icon-btn ghost', 'aria-label': 'إغلاق', onclick: () => close() }, icon('close', 22)),
          h('div', null, h('b', null, `سورة ${surahOfPage(page).name}`), h('small', null, `صفحة ${page} — الجزء ${juzOfPage(page)}`)),
          h('span', { style: { width: '42px' } })),
        text,
        h('div', { class: 'm-foot' },
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'الصفحة السابقة', onclick: () => { if (page > 1) { page -= 1; render(); } } }, icon('chevR', 22)),
          h('button', { type: 'button', class: 'btn good', onclick: () => {
            if (page < quranPage()) { toast('هالصفحة مسجّلة من قبل.'); return; }
            const n = page - quranPage() + 1;
            const r = readQuranTo(day, page);
            if (day < logicalToday()) invalidateDay(day);
            haptic('success');
            toast(r === -1 ? 'مبارك! ختمت القرآن الكريم' : `سجّلنا ${pagesText(n)} — وصلت لصفحة ${page}`, { kind: r === -1 ? 'gold' : 'ok' });
            if (page < TOTAL_PAGES) { page += 1; render(); }
          } }, icon('check', 18), 'قرأتها'),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'الصفحة التالية', onclick: () => { if (page < TOTAL_PAGES) { page += 1; render(); } } }, icon('chevL', 22))),
      ]);
      load();
      body.scrollTop = 0;
    }
    render();
  }, { full: true, cls: 'reader-sheet' });
}

/* ---------- الحفظ ---------- */
function openHifzAdd() {
  openSheet('شو بدك تحفظ؟', (body, close) => {
    let mode = 'surah';
    let surah = 78, from = 582, to = 604, name = '';
    function render() {
      fill(body, [
        h('div', { class: 'seg' }, [['surah', 'سورة'], ['juz', 'جزء'], ['pages', 'صفحات']].map(([v, l]) => h('button', { type: 'button', 'aria-pressed': String(mode === v), onclick: () => { mode = v; render(); } }, l))),
        mode === 'surah' ? h('button', { type: 'button', class: 'select-btn', onclick: () => openPicker({ title: 'السورة', value: surah, options: SURAHS.map((x) => ({ value: x.n, label: `${x.n}. ${x.name}`, sub: `${x.ayahs} آية` })), onPick: (v) => { surah = v; render(); } }) }, icon('quran', 18), h('span', { class: 'sb-val' }, `سورة ${SURAHS[surah - 1].name}`), icon('chevD', 18))
          : mode === 'juz' ? h('div', { class: 'chips' }, Array.from({ length: 30 }, (_, i) => 30 - i).map((j) => h('button', { type: 'button', class: 'chip small', 'aria-pressed': String(from === juzStart(j)), onclick: () => { from = juzStart(j); to = j === 30 ? 604 : juzStart(j + 1) - 1; name = `الجزء ${j}`; render(); } }, String(j))))
            : h('div', { class: 'two' },
              h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'من صفحة'), h('input', { type: 'number', value: from, onchange: (e) => { from = Number(e.target.value); } })),
              h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'لصفحة'), h('input', { type: 'number', value: to, onchange: (e) => { to = Number(e.target.value); } }))),
        h('button', { type: 'button', class: 'btn block', onclick: save }, 'أضف'),
      ]);
    }
    function save() {
      let item;
      if (mode === 'surah') {
        const s = SURAHS[surah - 1];
        const per = s.ayahs <= 20 ? s.ayahs : 10;
        const units = [];
        for (let a = 1; a <= s.ayahs; a += per) units.push({ id: uid('hu'), title: `الآيات ${a}–${Math.min(s.ayahs, a + per - 1)}`, mastery: 0, reviews: 0 });
        item = { id: uid('hz'), name: `سورة ${s.name}`, kind: 'surah', surah, units, color: 'gold' };
      } else {
        const a = Math.max(1, Math.min(from, to)), b = Math.min(TOTAL_PAGES, Math.max(from, to));
        item = { id: uid('hz'), name: mode === 'juz' && name ? name : `الصفحات ${a}–${b}`, kind: 'pages', units: Array.from({ length: b - a + 1 }, (_, i) => ({ id: uid('hu'), title: `صفحة ${a + i}`, page: a + i, mastery: 0, reviews: 0 })), color: 'gold' };
      }
      store.update((s) => { s.quran.hifz.push(item); });
      close();
      toast(`انضاف «${item.name}» للحفظ`);
    }
    render();
  });
}
function openHifz(id, today) {
  openSheet('الحفظ', (body, close, { setTitle }) => {
    function render() {
      const x = (store.state.quran.hifz || []).find((y) => y.id === id);
      if (!x) { close(); return; }
      setTitle(x.name);
      const set = (uid_, patch) => store.update((s) => { const it = s.quran.hifz.find((y) => y.id === id); const u = it.units.find((z) => z.id === uid_); Object.assign(u, patch); });
      fill(body, [
        h('p', { class: 'hint' }, 'لكل مقطع: احفظ ← ثبّت ← راجع. المحفوظ بيرجع للمراجعة بفترات بتطول (يوم، يومين، 4، 8…).'),
        h('div', { class: 'rows sheet-rows' }, x.units.map((u) => {
          const st = u.mastery >= 100 ? 'محفوظ' : u.mastery >= 50 ? 'قيد التثبيت' : 'جديد';
          return h('div', { class: 'row' },
            h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, u.title), h('span', { class: 'row-sub' }, `${st}${u.lastReview ? ` — آخر مراجعة ${dayLabel(u.lastReview, today)}` : ''}`)),
            u.mastery < 100
              ? h('button', { type: 'button', class: 'btn small secondary', onclick: () => { const m = u.mastery >= 50 ? 100 : 50; set(u.id, { mastery: m, lastReview: today, reviews: m >= 100 ? 1 : 0 }); award(`hifz:${u.id}:${m}`, POINTS.unit, 'حفظ', today); store.update((s) => { s.unitLog.push({ d: today, item: id, unit: u.id, w: 0.5 }); }); render(); } }, u.mastery >= 50 ? 'ثبّتّه' : 'حفظته')
              : h('button', { type: 'button', class: 'btn small ghost', onclick: () => { set(u.id, { lastReview: today, reviews: (u.reviews || 0) + 1 }); award(`hifzr:${u.id}:${today}`, 2, 'مراجعة', today); render(); } }, 'راجعته'));
        })),
        h('button', { type: 'button', class: 'btn danger block', onclick: async () => { if (await confirmSheet('حذف', `حذف «${x.name}» من الحفظ؟`, 'احذف')) { store.update((s) => { s.quran.hifz = s.quran.hifz.filter((y) => y.id !== id); }); close(); } } }, 'حذف'),
      ]);
    }
    render();
  });
}
