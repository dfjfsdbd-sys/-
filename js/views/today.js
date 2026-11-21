// اليوم: مدار اليوم بالصلوات، الالتزامات، الأذكار والورد، والمهام حسب الفترة
import { h, icon, badge, ring, toast, haptic, fill } from '../ui.js';
import { store } from '../store.js';
import { logicalToday, periodsFor, adhanFor, currentPeriod, nextPrayer, nowMinOfLogical, PERIODS, PERIOD_NAMES, PERIOD_SHORT, PERIOD_SKY, PRAYERS, PRAYER_NAMES, hasLocation } from '../prayer.js';
import { tasksOn, overdue, inbox, deadlines, isDoneOn, sortTasks, addTask, periodOf } from '../tasks.js';
import { parseTask, describeParse } from '../parse.js';
import { longDate, hijriDate, dayLabel, addDays, daysBetween, durText, time12, toMin, shortDate, tasksText } from '../dates.js';
import { shiftSummary, SHIFT_NAMES } from '../shifts.js';
import { prayerOn, PRAYER_STATUS, adhkarDone, adhkarSettings, allAdhkarLists, quranStats } from '../worship.js';
import { activeHabits, habitDueOn, habitScore, habitOk, scoreLabel, habitStreak } from '../habits.js';
import { commitActive, liveVerdict, commitStats } from '../commit.js';
import { levelOf, totalPoints, pointsOn } from '../rewards.js';
import { taskRow, secTitle } from './components.js';
import { openCapture, openTaskSheet } from './capture.js';
import { openPrayerSheet, openAdhkar, openQuranLog } from './worship.js';
import { openHabitLog } from './habits.js';
import { openDaySheet } from './daysheet.js';
import { openChecklistRun } from './plan.js';
import { examsBetween, openExam } from './study.js';
import { tintHex } from '../icons.js';

let inboxOpen = false;

export function renderToday(ctx) {
  const today = logicalToday();
  const root = h('div', { class: 'today' });
  root.append(header(ctx, today), dayBand(today), quickBar(today));
  const banners = bannersFor(today);
  if (banners.length) root.append(...banners);
  const c = commitCard(ctx, today);
  if (c) root.append(c);
  root.append(worshipStrip(ctx, today));
  root.append(...taskSections(today));
  root.append(upcoming(today));
  return root;
}

function header(ctx, today) {
  const sh = shiftSummary(today);
  const lv = levelOf(totalPoints());
  return h('header', { class: 'td-head' },
    h('div', { class: 'td-date' },
      h('h1', null, longDate(today)),
      h('p', null, hijriDate(today, { day: 'numeric', month: 'long', year: 'numeric' }),
        sh ? h('span', { class: `shift-chip ${sh.kind}` }, icon(sh.kind === 'home' ? 'house' : 'briefcase', 13), `${SHIFT_NAMES[sh.kind]} ${sh.dayNo}/${sh.length}`) : null)),
    h('div', { class: 'head-actions' },
      h('button', { type: 'button', class: 'lvl-chip', onclick: () => ctx.go('progress'), 'aria-label': 'إنجازي' },
        ring(lv.pct, 34, { stroke: 3, color: 'var(--gold)', label: String(lv.level) }),
        h('span', null, h('b', null, `${pointsOn(today)}+`), h('small', null, 'اليوم'))),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'الإعدادات', onclick: () => ctx.open('settings') }, icon('settings', 20))));
}

// مدار اليوم: شريط ملوّن بالفترات حسب أوقات الصلاة، وعليه موقعك الآن
function dayBand(today) {
  const p = periodsFor(today);
  const a = adhanFor(today);
  const start = toMin(a.fajr), end = p.isha.to;
  const span = end - start;
  const now = nowMinOfLogical();
  const cur = currentPeriod();
  const np = nextPrayer();
  const seg = (k) => {
    const from = k === 'fajr' ? start : (k === 'morning' ? toMin(a.sunrise) : toMin(a[k]));
    const to = p[k].to;
    return h('i', { style: { flex: `${Math.max(1, to - from)}`, background: PERIOD_SKY[k] }, class: k === cur.key ? 'on' : '' });
  };
  const nowPct = Math.max(0, Math.min(1, (now - start) / span));
  const prayers = h('div', { class: 'pr-row' }, PRAYERS.map((k) => {
    const st = prayerOn(today, k);
    const isNext = np.key === k;
    return h('button', {
      type: 'button', class: `pr-dot${st ? ` st-${st}` : ''}${isNext ? ' next' : ''}`, style: { '--sky': PERIOD_SKY[k === 'fajr' ? 'fajr' : k] },
      onclick: () => openPrayerSheet(today, k), 'aria-label': `صلاة ${PRAYER_NAMES[k]}`,
    }, h('span', { class: 'pr-ic' }, st && st !== 'missed' ? icon('check', 14, { stroke: 2.6 }) : st === 'missed' ? icon('close', 13, { stroke: 2.4 }) : icon('mosque', 14)),
    h('b', null, PRAYER_NAMES[k]), h('small', null, time12(a[k])));
  }));
  return h('section', { class: 'band-card', style: { '--sky': PERIOD_SKY[cur.key] } },
    h('div', { class: 'band-top' },
      h('div', null,
        h('small', null, cur.inPrayer ? `وقت صلاة ${PRAYER_NAMES[cur.inPrayer]}` : 'إنت هلق'),
        h('strong', null, PERIOD_NAMES[cur.key])),
      h('div', { class: 'band-next' },
        h('small', null, `${PRAYER_NAMES[np.key]} بعد`),
        h('strong', { class: 'num' }, np.inMin >= 60 ? `${Math.floor(np.inMin / 60)}:${String(np.inMin % 60).padStart(2, '0')}` : `${np.inMin} د`))),
    h('div', { class: 'band' }, PERIODS.map(seg), h('span', { class: 'band-now', style: { insetInlineStart: `${(nowPct * 100).toFixed(1)}%` } })),
    prayers,
    a.approx ? h('p', { class: 'band-note' }, icon('pin', 13), 'الأوقات تقريبية — اسمح بتحديد موقعك من الإعدادات') : null);
}

// سطر الإضافة: بتكتب وبتشوف شو فهم التطبيق، وEnter بيضيف
function quickBar(today) {
  const input = h('input', { type: 'text', class: 'quick-input', placeholder: 'شو عندك؟ «بكرة 10 الصبح تحليل دم»', 'aria-label': 'أضف مهمة' });
  const hint = h('div', { class: 'quick-hint' });
  const add = h('button', { type: 'button', class: 'quick-send', 'aria-label': 'أضف', hidden: true }, icon('plus', 22, { stroke: 2.4 }));
  const draw = () => {
    const v = input.value.trim();
    add.hidden = !v;
    if (!v) { fill(hint, []); return; }
    const p = parseTask(v, today);
    const bits = describeParse(p, today);
    fill(hint, [h('span', { class: 'qh-title' }, p.title || '…'), ...bits.map((b) => h('span', { class: 'pill accent' }, icon(b.ic, 11), b.t)), !bits.length ? h('span', { class: 'pill' }, 'اليوم') : null]);
  };
  const save = () => {
    const v = input.value.trim();
    if (!v) { openCapture(); return; }
    const p = parseTask(v, today);
    if (!p.title) return;
    const date = p.date || (p.due ? null : (p.recur ? today : today));
    const t = addTask({ title: p.title, date: p.due && !p.date ? null : date, time: p.time, period: p.period, due: p.due, recur: p.recur, priority: p.priority, tag: p.tag || 'general', remind: p.remind });
    haptic('success');
    input.value = ''; draw();
    toast(`انضافت — ${p.recur ? 'متكرّرة' : t.date ? dayLabel(t.date, today) : `قبل ${shortDate(p.due)}`}`, { action: 'تراجع', onAction: () => store.update((s) => { s.tasks = s.tasks.filter((x) => x.id !== t.id); }) });
  };
  input.addEventListener('input', draw);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } });
  add.addEventListener('click', save);
  return h('div', { class: 'quick-wrap' },
    h('div', { class: 'quick' },
      h('button', { type: 'button', class: 'quick-more', 'aria-label': 'تفاصيل', onclick: () => openCapture({ title: input.value }) }, icon('sliders', 18)),
      input, add),
    hint);
}

function bannersFor(today) {
  const out = [];
  const sh = shiftSummary(today);
  // قبل نوبة الشغل: قائمة التجهيز
  if (sh && sh.kind === 'home' && sh.daysLeft != null && sh.daysLeft <= 1) {
    const lists = (store.state.checklists || []).filter((c) => c.trigger !== 'none');
    out.push(h('button', { type: 'button', class: 'banner warn tap', onclick: () => openChecklistRun(lists[0]?.id, today) },
      h('span', { class: 'banner-ic' }, icon('briefcase', 22)),
      h('p', null, h('b', null, sh.daysLeft === 0 ? 'اليوم آخر يوم بالبيت' : 'بكرة أول يوم بالشغل'), h('br'), lists.length ? `جهّز: ${lists[0].items.slice(0, 3).map((i) => i.text).join('، ')}${lists[0].items.length > 3 ? '…' : ''}` : 'جهّز قائمة الأغراض اللي بتاخدها معك'),
      icon('chevL', 18)));
  }
  // امتحان أو مذاكرة خلال أسبوع
  for (const e of examsBetween(today, addDays(today, 7)).slice(0, 2)) {
    const n = daysBetween(today, e.date);
    out.push(h('button', { type: 'button', class: 'banner tap', onclick: () => openExam(e.id) },
      h('span', { class: 'banner-ic' }, icon('grad', 22)),
      h('p', null, h('b', null, `${e.kindLabel} ${e.subjectName} ${n === 0 ? 'اليوم' : n === 1 ? 'بكرة' : `بعد ${n} أيام`}`), h('br'), `${e.lectures} محاضرة — جاهزيتك ${Math.round(e.ready * 100)}%`),
      icon('chevL', 18)));
  }
  const dl = deadlines(today, 3).filter((t) => !t.date || t.date > today);
  if (dl.length) {
    out.push(h('div', { class: 'banner gold' }, h('span', { class: 'banner-ic' }, icon('flag', 20)),
      h('p', null, dl.length === 1 ? `«${dl[0].title}» آخر موعدها ${dayLabel(dl[0].due, today)}` : `${tasksText(dl.length)} موعدها النهائي خلال 3 أيام`)));
  }
  return out;
}

// الالتزامات: شروط التعهّد إن كان فعّالاً، وإلا عادات اليوم
function commitCard(ctx, today) {
  if (commitActive()) {
    const lv = liveVerdict(today);
    const st = commitStats(today);
    if (!lv.items.length) return null;
    const pct = Math.round(lv.pct * 100);
    return h('section', { class: `commit-card${lv.v === 'done' ? ' done' : ''}` },
      h('button', { type: 'button', class: 'cc-head', onclick: () => ctx.go('progress') },
        ring(lv.pct, 46, { stroke: 4, color: lv.v === 'done' ? 'var(--good)' : 'var(--accent)', label: `${pct}%` }),
        h('div', null,
          h('small', null, store.state.commitment.reward || 'التعهّد'),
          h('strong', null, `اليوم ${st.dayNumber} من ${st.totalDays}`),
          h('span', null, lv.v === 'done' ? 'يومك مكتمل، الله يتقبّل' : `${lv.items.filter((x) => !x.ok).length} باقيين`)),
        icon('chevL', 18)),
      h('div', { class: 'cc-items' }, lv.items.map((x) => reqChip(ctx, today, x))));
  }
  const due = activeHabits().filter((hb) => habitDueOn(hb, today));
  if (!due.length) return null;
  return h('section', { class: 'commit-card' },
    h('div', { class: 'cc-title' }, icon('leaf', 16), 'عاداتي اليوم'),
    h('div', { class: 'cc-items' }, due.map((hb) => reqChip(ctx, today, { id: hb.id, kind: 'habit', name: hb.name, icon: hb.icon, ok: habitOk(today, hb.id), score: habitScore(today, hb.id) ?? 0 }))));
}
function reqChip(ctx, today, x) {
  const partial = !x.ok && x.score > 0;
  const onclick = () => {
    if (x.kind === 'habit') openHabitLog(today, x.id);
    else if (x.kind === 'adhkar') openAdhkar(x.id.slice(7), today);
    else if (x.kind === 'quran') openQuranLog(today);
    else if (x.kind === 'prayers') openDaySheet(today);
  };
  const sub = x.kind === 'prayers' ? x.detail : x.kind === 'habit' && x.score > 0 ? `${Math.round(x.score * 100)}% ${scoreLabel(x.score)}` : x.ok ? 'تمّ' : x.imp === 'secondary' ? 'ثانوي' : '';
  return h('button', { type: 'button', class: `req${x.ok ? ' ok' : ''}${partial ? ' part' : ''}`, onclick },
    h('span', { class: 'req-ic' }, x.ok ? icon('check', 15, { stroke: 2.6 }) : icon(x.icon || 'circle', 15)),
    h('span', { class: 'req-txt' }, h('b', null, x.name), sub ? h('small', null, sub) : null));
}

// الأذكار والورد: بطاقات صغيرة حسب الوقت
function worshipStrip(ctx, today) {
  const cur = currentPeriod().key;
  const lists = allAdhkarLists().filter((l) => adhkarSettings(l.id).enabled);
  const order = { morning: ['fajr', 'morning'], evening: ['asr', 'maghrib'], sleep: ['isha'] };
  const qs = quranStats(today);
  const tiles = lists.map((l) => {
    const done = adhkarDone(today, l.id);
    const now = order[l.id]?.includes(cur);
    return h('button', { type: 'button', class: `w-tile${done ? ' done' : ''}${now && !done ? ' now' : ''}`, onclick: () => openAdhkar(l.id, today) },
      badge(done ? 'check' : (l.icon || 'beads'), done ? 'mint' : (l.tint || 'dawn'), 34, done ? null : l.image),
      h('span', null, h('b', null, l.short || l.name), h('small', null, done ? 'تمّت' : now ? 'وقتها هلق' : `${l.items.length} ذكر`)));
  });
  tiles.push(h('button', { type: 'button', class: `w-tile${qs.todayPages >= qs.daily ? ' done' : ''}`, onclick: () => openQuranLog(today) },
    badge('quran', qs.todayPages >= qs.daily ? 'mint' : 'sky', 34),
    h('span', null, h('b', null, 'الورد'), h('small', { class: 'num' }, `${qs.todayPages}/${qs.daily} صفحة`))));
  return h('div', { class: 'w-strip scroller' }, tiles);
}

function taskSections(today) {
  const out = [];
  const all = tasksOn(today);
  const od = overdue(today);
  const cur = currentPeriod().key;
  const curIdx = PERIODS.indexOf(cur);
  const open = (t) => openTaskSheet(t.id, t.recur ? today : (t.date || today));
  if (od.length) {
    out.push(secTitle('متأخرة', { ic: 'alert', count: od.length }));
    out.push(h('div', { class: 'group trows' }, sortTasks(od, today).map((t) => taskRow(t, today, { onOpen: open, showDate: true, today }))));
  }
  const byPeriod = Object.fromEntries(PERIODS.map((k) => [k, []]));
  const any = [];
  for (const t of all) { const k = periodOf(t, today); if (k) byPeriod[k].push(t); else any.push(t); }
  const total = all.length, done = all.filter((t) => isDoneOn(t, today)).length;
  out.push(secTitle('مهام اليوم', { ic: 'list', count: total ? `${done}/${total}` : null, action: h('button', { type: 'button', class: 'link-btn', onclick: () => openDaySheet(today) }, 'كل اليوم') }));
  if (!total) {
    out.push(h('div', { class: 'group' }, h('div', { class: 'empty small' }, h('p', null, 'ما في مهام اليوم. اكتب أي شي فوق وبيترتّب لحاله.'))));
  }
  PERIODS.forEach((k, i) => {
    const list = byPeriod[k];
    if (!list.length) return;
    const past = i < curIdx;
    const pending = list.filter((t) => !isDoneOn(t, today)).length;
    out.push(h('section', { class: `p-sec${k === cur ? ' now' : ''}${past ? ' past' : ''}`, style: { '--sky': PERIOD_SKY[k] } },
      h('div', { class: 'p-head' }, h('i'), h('b', null, PERIOD_NAMES[k]), k === cur ? h('span', { class: 'pill tint', style: { '--tint': PERIOD_SKY[k] } }, 'هلق') : past && pending ? h('span', { class: 'pill warn' }, `فات وقتها · ${pending}`) : null),
      h('div', { class: 'trows' }, sortTasks(list, today).map((t) => taskRow(t, today, { onOpen: open, today })))));
  });
  if (any.length) {
    out.push(h('section', { class: 'p-sec any' }, h('div', { class: 'p-head' }, h('i'), h('b', null, 'بأي وقت اليوم')),
      h('div', { class: 'trows' }, sortTasks(any, today).map((t) => taskRow(t, today, { onOpen: open, today })))));
  }
  const ib = inbox();
  if (ib.length) {
    out.push(h('button', { type: 'button', class: 'inbox-btn', onclick: (e) => { inboxOpen = !inboxOpen; e.currentTarget.parentElement && store.update(() => {}, { silent: false }); } },
      icon('inbox', 18), h('span', null, 'صندوق الوارد (بلا موعد)'), h('b', null, String(ib.length)), icon(inboxOpen ? 'chevU' : 'chevD', 16)));
    if (inboxOpen) out.push(h('div', { class: 'group trows' }, sortTasks(ib, today).map((t) => taskRow(t, today, { onOpen: open, today }))));
  }
  return out;
}

// الأيام الجاية: لمحة سريعة
function upcoming(today) {
  const days = [1, 2, 3].map((n) => addDays(today, n));
  const items = days.map((d) => ({ d, list: tasksOn(d).filter((t) => !isDoneOn(t, d)) })).filter((x) => x.list.length);
  const dl = deadlines(today, 30).filter((t) => daysBetween(today, t.due) > 3).slice(0, 3);
  if (!items.length && !dl.length) return h('div');
  return h('div', null,
    secTitle('جاي', { ic: 'calendar' }),
    h('div', { class: 'group rows' },
      items.map(({ d, list }) => h('button', { type: 'button', class: 'row', onclick: () => openDaySheet(d) },
        h('span', { class: 'row-ic' }, icon('calendar', 18)),
        h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, dayLabel(d, today)), h('span', { class: 'row-sub' }, list.slice(0, 3).map((t) => t.title).join('، ') + (list.length > 3 ? '…' : ''))),
        h('span', { class: 'pill' }, String(list.length)))),
      dl.map((t) => h('button', { type: 'button', class: 'row', onclick: () => openTaskSheet(t.id) },
        h('span', { class: 'row-ic gold' }, icon('flag', 18)),
        h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, t.title), h('span', { class: 'row-sub' }, `قبل ${shortDate(t.due)} — بعد ${daysBetween(today, t.due)} يوم`))))));
}
