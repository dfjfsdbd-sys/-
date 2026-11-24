// صفحة المهام: فوق «مدار اليوم» (إنت هلّق، الصلاة الجاية، الصلوات الخمس، مقياس البركة)،
// وبعدها كل مهام اليوم بمحطاتها مرتّبة بالوقت — ومهام التعهّد جوّاتها بعلامة.
// تحت: ملخّص التعهّد، المنجز، صندوق التراكم، وبكرة.
import { h, icon, toast, haptic, fill, swipeable } from '../ui.js';
import { store } from '../store.js';
import { logicalToday, periodsFor, adhanFor, currentPeriod, nextPrayer, nowMinOfLogical, PERIODS, PRAYERS, PRAYER_NAMES, PERIOD_SKY, hasLocation } from '../prayer.js';
import { tasksOn, overdue, inbox, deadlines, isDoneOn, setDone, moveTask, periodOf, TAGS, RECUR_LABEL, addTask } from '../tasks.js';
import { WEEKDAYS, MONTHS, hijriDate, dayLabel, addDays, daysBetween, time12, fromMin, toMin, shortDate, parseISO, WEEK_START, weekStartOf, daysText, inDaysText, minutesText, tasksText } from '../dates.js';
import { shiftSummary } from '../shifts.js';
import { prayerOn, setPrayer, PRAYER_STATUS, adhkarDone, setAdhkarDone, adhkarSettings, allAdhkarLists, wirdToday } from '../worship.js';
import { activeHabits, habitDueOn, habitScore, habitOk, scoreLabel } from '../habits.js';
import { commitActive, liveVerdict, commitStats, dayVerdict } from '../commit.js';
import { levelOf, totalPoints, pointsOn } from '../rewards.js';
import { tintHex } from '../icons.js';
import { openCapture, openTaskForm, STATION_NAMES } from './capture.js';
import { openTask, linkedUnit, linkedItem } from './taskopen.js';
import { openPrayerSheet, openAdhkar } from './worship.js';
import { openHabitLog } from './habits.js';
import { openChecklistRun } from './plan.js';
import { examsBetween, openExam } from './study.js';
import { openKhatma } from './khatma.js';
import { openMuhasaba, muhasabaDone } from './muhasaba.js';
import { EVENT_KINDS, eventsOn } from '../events.js';
import { openWeekReview, reviewDone } from './review.js';
import { openEventForm } from './eventform.js';
import { freeIn, sleepTimes } from '../sleep.js';
import { hifzToday, pagesLabel } from '../hifz.js';
import { fastInfo, fastedOn, setFasted } from '../fasting.js';
import { duasFor } from './duas.js';
import { suggestionsFor, fillPlan } from '../suggest.js';
import { careDue } from '../care.js';
import { openCareRoutine } from './care.js';

let doneOpen = false;
let tomorrowOpen = false;
const ADHKAR_STATION = { morning: 'fajr', wake: 'fajr', evening: 'asr', sleep: 'isha', prayer: 'dhuhr' };
const TIP_KEY = 'manz:tipSwipe';
const tipSeen = () => { try { return localStorage.getItem(TIP_KEY) === '1'; } catch { return true; } };

export function renderToday(ctx) {
  const today = logicalToday();
  const items = collect(today);
  const root = h('div', { class: 'tdv' });
  root.append(head(ctx, today), orbit(today, items));
  root.append(...alerts(today));
  root.append(stations(today, items));
  const cs = commitSummary(ctx, today);
  if (cs) root.append(cs);
  root.append(doneSection(today, items), backlog(today), tomorrow(today));
  return root;
}

/* ---------- عناصر اليوم ---------- */
function coreOfItem(it) { return it?.core ? (it.level === 'secondary' ? 'sec' : 'ess') : null; }
function collect(today) {
  const out = [];
  for (const t of tasksOn(today)) out.push({ kind: 'task', t, station: periodOf(t, today), done: isDoneOn(t, today), time: t.time, core: commitActive() ? coreOfItem(linkedItem(t)) : null });
  for (const l of allAdhkarLists()) {
    const cfg = adhkarSettings(l.id);
    if (!cfg.enabled) continue;
    out.push({ kind: 'adhkar', list: l, cfg, station: cfg.period || ADHKAR_STATION[l.id] || 'morning', done: adhkarDone(today, l.id), core: commitActive() && cfg.core ? (cfg.level === 'secondary' ? 'sec' : 'ess') : null });
  }
  const w = wirdToday(today);
  if (store.state.quran.plan || store.state.quran.core || (store.state.settings.quranDaily || 0) > 0) {
    out.push({ kind: 'quran', w, station: store.state.quran.period || 'fajr', done: w.done, core: commitActive() && store.state.quran.core ? 'ess' : null });
  }
  // العناية (للبنات): روتين الصبح والليل، والجلسات والمواعيد الدورية المستحقة
  for (const c of careDue(today)) {
    if (c.kind === 'care') out.push({ ...c, station: c.slot === 'am' ? 'morning' : 'isha', done: c.done >= c.total });
    else out.push({ ...c, station: c.kind === 'care-session' ? 'morning' : 'asr', done: false });
  }
  // الصيام: إذا اليوم سنّة (أو رمضان)
  const fi = fastInfo(today);
  if (fi.reasons.length) out.push({ kind: 'fast', fi, station: 'fajr', done: fastedOn(today) });
  // الحفظ: الجديد والمراجعة بمحطة الفجر (إذا في خطة)
  const hz = hifzToday(today);
  if (hz && (hz.portion || hz.log.new || hz.near.length || hz.far.length)) out.push({ kind: 'hifz', hz, station: store.state.quran.hifzPlan?.period || 'fajr', done: hz.done });
  for (const hb of activeHabits()) {
    if (!habitDueOn(hb, today)) continue;
    out.push({ kind: 'habit', hb, station: hb.period || 'isha', done: habitOk(today, hb.id), score: habitScore(today, hb.id), core: commitActive() && hb.core ? (hb.level === 'secondary' ? 'sec' : 'ess') : null });
  }
  if (!store.state.settings.muhasabaOff) out.push({ kind: 'muhasaba', station: 'isha', done: muhasabaDone(today), time: '23:50' });
  // آخر يوم بالأسبوع: مراجعة الأسبوع ببعد العصر
  if (parseISO(today).getDay() === (WEEK_START + 6) % 7) out.push({ kind: 'review', station: 'asr', done: reviewDone(weekStartOf(today)) });
  return out;
}
// مقياس البركة: المهام + الصلوات
function dayScore(today, items) {
  const pr = PRAYERS.filter((k) => { const s = prayerOn(today, k); return s && s !== 'missed'; }).length;
  return { done: items.filter((x) => x.done).length + pr, total: items.length + 5 };
}

/* ---------- الرأس ---------- */
function head(ctx, today) {
  const d = parseISO(today);
  const sh = shiftSummary(today);
  const lv = levelOf(totalPoints());
  let shiftChip = null;
  if (sh) {
    const left = sh.daysLeft;
    shiftChip = h('span', { class: `dh-shift ${sh.kind}` }, icon(sh.kind === 'home' ? 'house' : 'briefcase', 11),
      sh.kind === 'work' ? (left != null ? `بالشغل · باقي ${daysText(left)}` : 'بالشغل') : (left != null ? (left <= 1 ? (left === 0 ? 'آخر يوم بالبيت' : 'بكرة الشغل') : `بالبيت · الشغل ${inDaysText(left)}`) : 'بالبيت'));
  }
  return h('header', { class: 'dh' },
    h('div', null,
      h('h1', null, `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`),
      h('p', null, hijriDate(today, { day: 'numeric', month: 'long', year: 'numeric' }), shiftChip)),
    h('button', { type: 'button', class: 'dh-lvl', onclick: () => ctx.go('progress'), 'aria-label': 'الإنجاز' },
      h('b', { style: { '--p': Math.round(lv.pct * 100) } }, String(lv.level)),
      h('span', null, h('strong', null, `+${pointsOn(today)}`), 'اليوم')));
}

/* ---------- مدار اليوم ---------- */
function orbit(today, items) {
  const p = periodsFor(today);
  const a = adhanFor(today);
  const start = toMin(a.fajr), end = p.isha.to;
  const now = nowMinOfLogical();
  const cur = currentPeriod();
  const np = nextPrayer();
  const segs = PERIODS.map((k) => {
    const from = k === 'fajr' ? start : (k === 'morning' ? toMin(a.sunrise) : toMin(a[k]));
    return h('i', { class: k === cur.key ? 'on' : '', style: { flex: `${Math.max(1, p[k].to - from)}`, background: PERIOD_SKY[k] } });
  });
  const nowPct = Math.max(0, Math.min(1, (now - start) / (end - start)));
  const sc = dayScore(today, items);
  const pct = sc.total ? Math.round((sc.done / sc.total) * 100) : 0;
  return h('section', { class: 'orbit', style: { '--sky': PERIOD_SKY[cur.key] } },
    h('div', { class: 'orbit-top' },
      h('div', null, h('small', null, cur.inPrayer ? `وقت صلاة ${PRAYER_NAMES[cur.inPrayer]}` : 'إنت هلّق'), h('strong', null, STATION_NAMES[cur.key])),
      h('div', { class: 'orbit-nx' }, h('small', null, `${PRAYER_NAMES[np.key]} بعد`), h('strong', { class: 'num' }, np.inMin >= 60 ? `${Math.floor(np.inMin / 60)}:${String(np.inMin % 60).padStart(2, '0')}` : `${np.inMin} د`))),
    h('div', { class: 'orbit-strip' }, segs, h('span', { class: 'orbit-now', style: { insetInlineStart: `${(nowPct * 100).toFixed(1)}%` } })),
    h('div', { class: 'orbit-prs' }, PRAYERS.map((k) => {
      const st = prayerOn(today, k);
      const ok = st && st !== 'missed';
      return h('button', { type: 'button', class: `opr${ok ? ' ok' : ''}${st === 'missed' ? ' miss' : ''}${np.key === k && !ok ? ' next' : ''}`, onclick: () => openPrayerSheet(today, k), 'aria-label': `صلاة ${PRAYER_NAMES[k]}` },
        h('span', { class: 'opr-ic' }, icon(ok ? 'check' : st === 'missed' ? 'close' : 'mosque', 15)),
        h('b', null, PRAYER_NAMES[k]), h('small', null, ok && st !== 'ontime' ? PRAYER_STATUS[st]?.short : time12(a[k])));
    })),
    h('div', { class: 'orbit-prog' }, h('span', null, 'مقياس البركة ', h('b', null, `${sc.done} من ${sc.total}`)), h('div', { class: 'bar' }, h('i', { style: { width: `${pct}%` } })), h('b', { class: 'num' }, `${pct}%`)));
}

/* ---------- تنبيهات خفيفة ---------- */
function alerts(today) {
  const out = [];
  const row = (c, k, t, s, onClick) => h('button', { type: 'button', class: 'al-row', style: { '--c': c }, onclick: onClick }, h('span', { class: 'al-k' }, k), h('span', { class: 'al-t' }, t), s ? h('span', { class: 'al-s' }, s) : null, icon('chevL', 11));
  for (const e of examsBetween(today, addDays(today, 7)).slice(0, 2)) {
    const n = daysBetween(today, e.date);
    out.push(row('var(--c-study)', e.kindLabel, `${e.subjectName} — ${e.lectures} محاضرة · جاهزيتك ${Math.round(e.ready * 100)}%`, inDaysText(n), () => openExam(e.id)));
  }
  // الأحداث (مواعيد، مناسبات، سفر) اليوم وبكرة
  for (const [d, when] of [[today, 'اليوم'], [addDays(today, 1), 'بكرة']]) {
    for (const e of eventsOn(d).filter((x) => x.source === 'event' && (x.first || !x.span))) {
      const k = EVENT_KINDS[e.kind] || EVENT_KINDS.other;
      out.push(row(k.color, k.name, e.title, `${when}${e.time ? ` ${time12(e.time)}` : ''}`, () => openEventForm(e.id)));
    }
  }
  const sh = shiftSummary(today);
  if (sh && sh.kind === 'home' && sh.daysLeft != null && sh.daysLeft <= 1) {
    const lists = (store.state.checklists || []).filter((c) => c.trigger !== 'none');
    out.push(row('var(--warn)', 'الشغل', sh.daysLeft === 0 ? 'اليوم آخر يوم بالبيت — جهّز أغراضك' : 'بكرة آخر يوم بالبيت — جهّز أغراضك', null, () => openChecklistRun(lists[0]?.id, today)));
  }
  const dl = deadlines(today, 3).filter((t) => !t.date || t.date > today);
  if (dl.length) out.push(row('var(--gold)', 'موعد', dl.length === 1 ? dl[0].title : `${dl.length} مهام موعدها النهائي قريب`, dl.length === 1 ? (dl[0].due === today ? 'اليوم' : `قبل ${shortDate(dl[0].due)}`) : 'خلال 3 أيام', () => openTaskForm(dl[0].id)));
  // أوقات الدعاء: بين الأذان والإقامة، وآخر ساعة يوم الجمعة
  const cp = currentPeriod();
  const goDuas = () => { location.hash = '#/tracks/duas'; };
  if (cp.inPrayer && duasFor('adhan').length) out.push(row('var(--c-god)', 'دعاء', 'بين الأذان والإقامة — وقت يُستجاب فيه', `${duasFor('adhan').length} أدعية`, goDuas));
  else if (parseISO(today).getDay() === 5) {
    const now = nowMinOfLogical();
    const mg = toMin(adhanFor(today).maghrib);
    if (now >= mg - 60 && now < mg) out.push(row('var(--c-god)', 'دعاء', 'آخر ساعة يوم الجمعة — ادعُ بحاجتك', duasFor('friday').length ? `${duasFor('friday').length} أدعية` : null, goDuas));
  }
  if (!hasLocation()) out.push(h('div', { class: 'loc-note' }, icon('pin', 11), 'أوقات الصلاة تقريبية — اسمح بتحديد الموقع من الروتين'));
  return out.length ? [h('div', { class: 'al-wrap' }, out)] : [];
}

/* ---------- المحطات ---------- */
function stations(today, items) {
  const p = periodsFor(today);
  const cur = currentPeriod().key;
  const curIdx = PERIODS.indexOf(cur);
  const a = adhanFor(today);
  const pending = items.filter((x) => !x.done).length;
  const wrap = h('div', { class: 'stw' },
    h('div', { class: 'section-title' }, h('span', null, icon('listCheck', 12), 'مهام اليوم'), h('i', { class: 'st-line' }), h('span', { class: 'sec-count' }, pending ? `${pending} باقية` : 'خلصوا')));
  if (!tipSeen()) {
    const tip = h('div', { class: 'tip-card' }, icon('hand-pointer', 14),
      h('span', null, h('b', null, 'اسحب المهمة يسار'), ' لتخلص، ', h('b', null, 'يمين'), ' لبكرة، و', h('b', null, 'اضغط مطوّل'), ' لتعدّل.'),
      h('button', { type: 'button', class: 'tip-x', 'aria-label': 'فهمت', onclick: () => { try { localStorage.setItem(TIP_KEY, '1'); } catch { /* */ } tip.remove(); } }, icon('close', 12)));
    wrap.append(tip);
  }
  if (commitActive() && items.some((x) => x.core)) {
    wrap.append(h('div', { class: 'cm-legend' }, h('span', { class: 'cm ess' }, icon('seedling', 10), 'تعهّد'), 'شرط أساسي', h('span', { class: 'cm' }, icon('seedling', 10), 'تعهّد'), 'شرط ثانوي'));
  }
  let suggShown = false;
  PERIODS.forEach((k, i) => {
    const list = sortItems(items.filter((x) => x.station === k && !x.done));
    const past = i < curIdx, now = k === cur;
    const late = past ? list.length : 0;
    const est = list.reduce((s, x) => s + (x.kind === 'task' ? (x.t.estimate || 0) : 0), 0);
    // الفراغ الحقيقي: الفترة ناقص النوم والقيلولة والشغل، وناقص المهام المحطوطة فيها
    const free = (freeIn(today, k, { from: now ? nowMinOfLogical() : null }) - est) / 60;
    const prayerKey = k === 'morning' ? null : k;
    let prChip = null;
    if (prayerKey) {
      const st = prayerOn(today, prayerKey);
      const ok = st && st !== 'missed';
      prChip = h('button', { type: 'button', class: `st-pr${ok ? ' ok' : ''}${st === 'missed' ? ' miss' : ''}${!st && (now || past) ? ' due' : ''}`, onclick: () => openPrayerSheet(today, prayerKey) },
        icon(ok ? 'check' : st === 'missed' ? 'close' : 'mosque', 11), PRAYER_NAMES[prayerKey]);
    }
    const badges = [];
    if (now) badges.push(h('span', { class: 'now-badge' }, 'الآن'));
    if (late) badges.push(h('span', { class: 'late-badge' }, `فات وقتها · ${late}`));
    if (!past && list.length && free >= 0.5) badges.push(h('span', { class: 'free-badge' }, `فراغ ${free >= 10 ? Math.round(free) : free.toFixed(1)} س`));
    if (k === 'isha' && !past) { const sl = sleepTimes(today); badges.push(h('button', { type: 'button', class: 'bed-badge', onclick: () => { location.hash = '#/settings/sleep'; } }, icon('moon', 10), `النوم ${time12(fromMin(sl.bed))}`)); }
    const block = h('section', { class: `st3${now ? ' now' : ''}${past ? ' past' : ''}${late ? ' late' : ''}${list.length ? '' : ' empty'}`, style: { '--sk': PERIOD_SKY[k] } },
      h('div', { class: 'st3-h' },
        h('span', { class: 'st3-dot' }), h('span', { class: 'st3-nm' }, STATION_NAMES[k]), prChip, ...badges,
        h('button', { type: 'button', class: 'st3-tm', onclick: () => openCapture({ date: today, period: k }), 'aria-label': `أضف مهمة ${STATION_NAMES[k]}` }, `${time12(fromMin(p[k].from))} — ${time12(fromMin(p[k].to))}`)),
      list.length ? h('div', { class: 'st3-list' }, list.map((x) => card(x, today))) : null);
    // اقتراحات للفراغ: بأول فترة جاية فيها نص ساعة فاضية أو أكتر
    if (!suggShown && !past && free >= 0.5 && !suggDismissed(today, k)) {
      const box = suggBox(today, k, Math.round(free * 60), block);
      if (box) { block.classList.remove('empty'); block.append(box); suggShown = true; }
    }
    wrap.append(block);
  });
  const any = sortItems(items.filter((x) => !x.station && !x.done));
  if (any.length) wrap.append(h('section', { class: 'st3' }, h('div', { class: 'st3-h' }, h('span', { class: 'st3-dot', style: { background: 'var(--ink3)' } }), h('span', { class: 'st3-nm' }, 'بأي وقت اليوم')), h('div', { class: 'st3-list' }, any.map((x) => card(x, today)))));
  return wrap;
}
/* ---------- اقتراحات الفراغ ---------- */
const SUGG_KEY = 'manz:suggOff';
function suggDismissed(today, k) { try { return localStorage.getItem(SUGG_KEY) === `${today}:${k}`; } catch { return false; } }
function suggBox(today, k, freeMin, block) {
  const list = suggestionsFor(today).filter((x) => x.est <= freeMin + 15).slice(0, 4);
  if (!list.length) return null;
  const plan = fillPlan(list, freeMin);
  const sum = plan.reduce((a, x) => a + x.est, 0);
  const freeTxt = freeMin < 60 ? minutesText(freeMin) : freeMin < 75 ? 'ساعة' : freeMin < 105 ? 'ساعة ونص' : freeMin < 135 ? 'ساعتين' : `${+(freeMin / 60).toFixed(1)} ساعة`;
  const apply = (x, quiet = false) => {
    if (x.task) { addTask({ ...x.task, date: today, period: k }); if (!quiet) toast(`انضافت: ${x.title}`); }
    else if (x.go === 'khatma') openKhatma(today);
    else if (x.go) location.hash = x.go;
  };
  const box = h('div', { class: 'sg-box' },
    h('div', { class: 'sg-t' }, icon('lightbulb', 12), h('span', null, `عندك ${freeTxt} فاضية — شو رأيك؟`),
      h('button', { type: 'button', class: 'sg-x', 'aria-label': 'سكّر', onclick: () => { try { localStorage.setItem(SUGG_KEY, `${today}:${k}`); } catch { /* */ } box.remove(); if (!block.querySelector('.st3-list')) block.classList.add('empty'); } }, icon('close', 11))),
    list.map((x) => h('div', { class: 'sg-it', style: { '--c': x.c } },
      h('span', { class: 'sg-ic' }, icon(x.ic, 13)),
      h('span', { class: 'sg-in' }, h('b', null, x.title, x.why ? h('em', null, x.why) : null), h('small', null, x.sub)),
      h('button', { type: 'button', class: 'sg-add', 'aria-label': x.task ? 'حطها هلّق' : 'افتح', onclick: () => apply(x) }, icon(x.task ? 'plus' : 'chevL', 12)))),
    plan.length >= 2 ? h('button', { type: 'button', class: 'btn block sg-fill', onclick: () => { plan.forEach((x) => apply(x, true)); toast(`عبّينا الفراغ: ${tasksText(plan.length)} · ${minutesText(sum)}`); } }, icon('wand', 13), `عبّيلي الفراغ (${minutesText(sum)})`) : null);
  return box;
}
function sortItems(list) {
  const tm = (x) => (x.time ? toMin(x.time) : x.kind === 'muhasaba' ? 99998 : 99990);
  return [...list].sort((a, b) => tm(a) - tm(b) || ((b.t?.priority || 0) - (a.t?.priority || 0)) || ((a.t?.createdAt || 0) - (b.t?.createdAt || 0)));
}

/* ---------- البطاقة ---------- */
function colorOf(x) {
  if (x.kind === 'adhkar' || x.kind === 'quran' || x.kind === 'hifz' || x.kind === 'fast') return 'var(--c-god)';
  if (x.kind === 'care' || x.kind === 'care-session' || x.kind === 'care-rec') return '#E9839F';
  if (x.kind === 'muhasaba') return '#6F86D9';
  if (x.kind === 'review') return '#4cb8d4';
  if (x.kind === 'habit') return tintHex(x.hb.color || 'sage');
  const it = linkedItem(x.t);
  if (it?.color) return tintHex(it.color);
  return tintHex((TAGS[x.t.tag] || TAGS.general).tint);
}
function titleOf(x) {
  if (x.kind === 'adhkar') return x.list.name;
  if (x.kind === 'quran') return x.w.plan ? 'ورد الختمة' : 'ورد القرآن';
  if (x.kind === 'hifz') return 'الحفظ';
  if (x.kind === 'care') return x.slot === 'am' ? 'روتين الصبح' : 'روتين الليل';
  if (x.kind === 'care-session') return `${x.x.name} — الجلسة ${(x.x.done || []).length + 1}`;
  if (x.kind === 'care-rec') return x.x.name;
  if (x.kind === 'fast') return `صيام ${x.fi.reasons.map((r) => r.name).join(' و')}`;
  if (x.kind === 'habit') return x.hb.name;
  if (x.kind === 'muhasaba') return 'محاسبة النفس';
  if (x.kind === 'review') return 'مراجعة الأسبوع';
  return x.t.title;
}
function openItem(x, today) {
  if (x.kind === 'adhkar') openAdhkar(x.list.id, today);
  else if (x.kind === 'quran') openKhatma(today);
  else if (x.kind === 'hifz') { location.hash = '#/tracks/hifz'; }
  else if (x.kind === 'care') openCareRoutine(x.slot, today);
  else if (x.kind === 'care-session' || x.kind === 'care-rec') { location.hash = '#/tracks/care'; }
  else if (x.kind === 'fast') { const v = !fastedOn(today); setFasted(today, v); if (v) toast('تقبّل الله صيامك'); }
  else if (x.kind === 'habit') openHabitLog(today, x.hb.id);
  else if (x.kind === 'muhasaba') openMuhasaba(today);
  else if (x.kind === 'review') openWeekReview(weekStartOf(today));
  else openTask(x.t, today);
}
function complete(x, today) {
  haptic('done');
  if (x.kind === 'adhkar') { setAdhkarDone(today, x.list.id, true); toast(`تمّت: ${x.list.name}`, { action: 'تراجع', onAction: () => setAdhkarDone(today, x.list.id, false) }); }
  else if (x.kind === 'task') { setDone(x.t.id, today, true); toast(`تمّت: ${x.t.title}`, { action: 'تراجع', onAction: () => setDone(x.t.id, today, false) }); }
  else openItem(x, today);
}
function uncomplete(x, today) {
  if (x.kind === 'adhkar') setAdhkarDone(today, x.list.id, false);
  else if (x.kind === 'task') setDone(x.t.id, today, false);
  else openItem(x, today);
}

function card(x, today, { backlogMode = false } = {}) {
  const c = colorOf(x);
  const meta = [];
  const sep = () => h('i', { class: 'task-meta-sep' });
  const tag = (name) => h('span', { class: 'task-tag' }, name);
  let avatar = null;
  if (x.kind === 'adhkar') {
    avatar = h('span', { class: 'task-avatar' }, x.list.image ? h('img', { src: x.list.image, alt: '', loading: 'lazy' }) : icon('hands', 26));
    meta.push(tag('عبادات'), sep(), h('span', { class: 'task-meta-num' }, `${x.list.items.length} ذكر`));
  } else if (x.kind === 'quran') {
    avatar = h('span', { class: 'task-avatar' }, icon('quran', 26));
    meta.push(tag('عبادات'), sep(), h('span', { class: 'task-meta-num' }, `ص ${x.w.from} ← ${x.w.to}`), sep(), h('span', { class: 'task-meta-num' }, `قرأت ${x.w.read} من ${x.w.target}`));
  } else if (x.kind === 'care' || x.kind === 'care-session' || x.kind === 'care-rec') {
    avatar = h('span', { class: 'task-avatar' }, icon(x.kind === 'care' ? (x.slot === 'am' ? 'sun' : 'moon') : x.kind === 'care-session' ? 'wand-magic-sparkles' : 'calendar-check', 22));
    meta.push(tag('عناية'), sep(), h('span', null, x.kind === 'care' ? `${x.done} من ${x.total} خطوات` : x.kind === 'care-session' ? `من ${x.x.total}` : 'موعدها اليوم'));
  } else if (x.kind === 'fast') {
    avatar = h('span', { class: 'task-avatar' }, icon('moon', 24));
    meta.push(tag('صيام'), sep(), h('span', null, x.done ? 'تقبّل الله' : 'اضغط لتعلّم إنك صايم'));
  } else if (x.kind === 'hifz') {
    avatar = h('span', { class: 'task-avatar' }, icon('brain', 24));
    const z = x.hz;
    const bits = [];
    if (z.log.new) bits.push('الجديد خلص');
    else if (z.portion) bits.push(`جديد ${pagesLabel(z.portion.pages).range}${z.portion.of > 1 ? ` (${z.portion.label})` : ''}`);
    if (z.near.length) bits.push(z.log.near ? 'القريبة خلصت' : `مراجعة ${z.near.length} ص`);
    if (z.far.length && !z.log.far) bits.push('ودور قديم');
    meta.push(tag('حفظ'), sep(), h('span', { class: 'task-meta-num' }, bits.join(' · ')));
  } else if (x.kind === 'habit') {
    avatar = h('span', { class: 'task-avatar' }, icon(x.hb.icon || 'compass', 26));
    meta.push(tag('سلوك'), sep(), h('span', null, x.score != null && x.score > 0 ? `${Math.round(x.score * 100)}% ${scoreLabel(x.score)}` : 'قيّم يومك'));
  } else if (x.kind === 'muhasaba') {
    avatar = h('span', { class: 'task-avatar' }, icon('feather', 24));
    meta.push(tag('قبل النوم'), sep(), h('span', null, 'دقيقتين'));
  } else if (x.kind === 'review') {
    avatar = h('span', { class: 'task-avatar' }, icon('calendar-check', 24));
    meta.push(tag('آخر الأسبوع'), sep(), h('span', null, '4 خطوات قصيرة'));
  } else {
    const t = x.t;
    const tg = TAGS[t.tag] || TAGS.general;
    const it = linkedItem(t);
    const img = t.link?.image || it?.image;
    if (img) avatar = h('span', { class: 'task-avatar' }, h('img', { src: img, alt: '', loading: 'lazy' }));
    else if (t.link || (t.tag && t.tag !== 'general')) avatar = h('span', { class: 'task-avatar' }, icon(it?.icon || tg.icon, 26));
    meta.push(tag(t.link?.kind === 'project' && it ? it.name : tg.name));
    if (backlogMode && t.date) meta.push(sep(), h('span', { class: 'bad-txt' }, `من ${dayLabel(t.date, today)}`));
    if (t.time) meta.push(sep(), h('span', { class: 'task-meta-num' }, icon('clock', 12), time12(t.time)));
    if (t.estimate) meta.push(sep(), h('span', { class: 'task-meta-num' }, t.estimate >= 60 ? `${+(t.estimate / 60).toFixed(1)} س` : `${t.estimate} د`));
    const u = linkedUnit(t);
    if (u && t.link?.kind === 'episode' && u.progress > 0 && !u.done) meta.push(sep(), h('span', null, `حضرت ${Math.round(u.progress * 100)}%`));
    if (t.recur) meta.push(sep(), h('span', null, icon('repeat', 11), RECUR_LABEL(t.recur)));
    else if (t.fromRoutine) meta.push(sep(), h('span', { class: 'rt-mark' }, icon('repeat', 10), 'روتين'));
    if (t.due && !x.done) { const n = daysBetween(today, t.due); meta.push(sep(), h('span', { class: n <= 2 ? 'warn-txt' : '' }, icon('flag', 11), n <= 0 ? 'آخر موعد اليوم' : `قبل ${shortDate(t.due)}`)); }
    if (t.checklist?.length) meta.push(sep(), h('span', null, icon('list', 11), `${t.checklist.filter((cc) => cc.done).length}/${t.checklist.length}`));
  }
  const chips = [];
  if (x.core) chips.push(h('span', { class: `cm${x.core === 'ess' ? ' ess' : ''}` }, icon('seedling', 10), 'تعهّد'));
  if (x.kind === 'task' && x.t.priority) chips.push(h('span', { class: 'core-badge' }, 'أساسية'));
  const check = h('button', {
    type: 'button', class: `tc-check${x.done ? ' on' : ''}`, 'aria-label': x.done ? 'رجّعها' : 'تمّت',
    onclick: (e) => { e.stopPropagation(); if (x.done) uncomplete(x, today); else if (x.kind === 'task' || x.kind === 'adhkar') { el.classList.add('just-done'); setTimeout(() => complete(x, today), 220); } else openItem(x, today); },
  }, icon('check', 18));
  const el = h('div', {
    class: `task-card${x.done ? ' is-done' : ''}${x.kind === 'muhasaba' ? ' is-night' : ''}`, role: 'button', tabindex: '0',
    style: { '--task-accent': c, '--card-tint': `color-mix(in srgb, ${c} 10%, transparent)` },
  }, avatar,
  h('div', { class: 'task-info' }, h('div', { class: 'task-title' }, h('span', null, titleOf(x)), ...chips), h('div', { class: 'task-meta-preview' }, meta)),
  check);
  let lp = 0, moved = false;
  el.addEventListener('pointerdown', (e) => {
    moved = false; const x0 = e.clientX, y0 = e.clientY;
    const mv = (ev) => { if (Math.abs(ev.clientX - x0) > 8 || Math.abs(ev.clientY - y0) > 8) { moved = true; clearTimeout(lp); } };
    el.addEventListener('pointermove', mv);
    lp = setTimeout(() => { if (!moved && x.kind === 'task') { el.dataset.lp = '1'; haptic('select'); openTaskForm(x.t.id, { day: today }); } }, 560);
    const up = () => { clearTimeout(lp); el.removeEventListener('pointermove', mv); };
    el.addEventListener('pointerup', up, { once: true });
    el.addEventListener('pointercancel', up, { once: true });
  });
  el.addEventListener('click', (e) => { if (el.dataset.lp) { delete el.dataset.lp; return; } if (e.target.closest('.tc-check')) return; openItem(x, today); });
  if (!x.done) {
    swipeable(el, {
      onLeft: () => complete(x, today),
      onRight: x.kind === 'task' && !x.t.recur ? () => { const from = x.t.date; moveTask(x.t.id, addDays(today, 1)); toast('انتقلت لبكرة', { action: 'تراجع', onAction: () => moveTask(x.t.id, from) }); } : null,
    });
  }
  return el;
}

/* ---------- ملخّص التعهّد ---------- */
function commitSummary(ctx, today) {
  if (!commitActive()) return null;
  const st = commitStats(today), lv = liveVerdict(today);
  const ok = lv.items.filter((x) => x.ok).length;
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const pct = Math.round((st.dayNumber / Math.max(1, st.totalDays)) * 100);
  return h('div', null,
    h('div', { class: 'section-title' }, h('span', null, icon('seedling', 12), 'التعهّد'), h('i', { class: 'st-line' })),
    h('button', { type: 'button', class: 'cs-card', onclick: () => ctx.go('progress/commit') },
      h('span', { class: 'cs-ring', style: { '--p': pct } }, h('b', null, String(st.dayNumber))),
      h('span', { class: 'cs-main' },
        h('b', null, `${store.state.commitment.reward || 'التعهّد'} — اليوم ${st.dayNumber} من ${st.totalDays}`),
        h('small', null, `${ok} من ${lv.items.length} شروط اليوم · نسبة اليوم ${Math.round(lv.pct * 100)}%`),
        h('span', { class: 'cs-chain' }, days.map((d) => {
          const v = d === today ? 'today' : dayVerdict(d);
          return h('i', { class: v === 'done' ? 'y' : v === 'broken' ? 'n' : v === 'today' ? (lv.v === 'done' ? 'y' : 't') : 'f' }, v === 'done' || (v === 'today' && lv.v === 'done') ? icon('check', 10) : v === 'broken' ? icon('close', 10) : v === 'today' ? '؟' : '');
        }))),
      icon('chevL', 13)));
}

/* ---------- المنجز ---------- */
function doneSection(today, items) {
  const done = items.filter((x) => x.done);
  const wrap = h('div', null, h('div', { class: 'section-title' }, h('span', null, icon('checkCircle', 12), 'المنجز اليوم'), h('i', { class: 'st-line' }), h('span', { class: 'sec-count' }, String(done.length))));
  if (!done.length) { wrap.append(h('div', { class: 'drop-pane' }, h('p', { class: 'empty-zone-hint' }, 'لم يكتمل شيء بعد — اسحب مهمة يساراً لتعليمها منجزة'))); return wrap; }
  const pane = h('div', { class: 'drop-pane' });
  const draw = () => fill(pane, [
    h('button', { type: 'button', class: 'done-summary', onclick: () => { doneOpen = !doneOpen; draw(); } },
      h('span', { class: 'ds-check' }, icon('check', 12)),
      h('span', { class: 'ds-txt' }, `أنجزت ${done.length} — ${done.slice(0, 2).map(titleOf).join('، ')}${done.length > 2 ? '…' : ''}`),
      h('span', { class: 'ds-more' }, doneOpen ? 'إخفاء' : 'عرض')),
    doneOpen ? h('div', { class: 'st3-list done-list' }, done.map((x) => card(x, today))) : null]);
  draw();
  wrap.append(pane);
  return wrap;
}

/* ---------- صندوق التراكم ---------- */
function backlog(today) {
  const od = overdue(today);
  const list = [...od, ...inbox()];
  const wrap = h('div', null, h('div', { class: 'section-title' }, h('span', null, icon('inbox', 12), 'صندوق التراكم'), h('i', { class: 'st-line' }), h('span', { class: `sec-count${od.length ? ' warn' : ''}` }, String(list.length))));
  if (!list.length) { wrap.append(h('div', { class: 'drop-pane' }, h('p', { class: 'empty-zone-hint' }, 'الصندوق فارغ — لا مهام متعثّرة'))); return wrap; }
  wrap.append(h('div', { class: 'st3-list' }, list.map((t) => card({ kind: 'task', t, done: false, time: t.time }, today, { backlogMode: true }))));
  return wrap;
}

/* ---------- بكرة ---------- */
function tomorrow(today) {
  const d = addDays(today, 1);
  const list = tasksOn(d).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
  const wrap = h('div', { class: 'tm-wrap' }, h('div', { class: 'section-title' }, h('span', null, icon('calendar', 12), 'بكرة'), h('i', { class: 'st-line' })));
  const box = h('div');
  const draw = () => fill(box, [
    h('button', { type: 'button', class: 'tm-row', onclick: () => { tomorrowOpen = !tomorrowOpen; draw(); } },
      icon('calendar', 14), h('b', null, `${WEEKDAYS[parseISO(d).getDay()]}: ${list.length ? `${list.length} مهام` : 'فاضي'}`),
      h('span', { class: 'muted' }, list.length ? `أول شغلة: ${list[0].title}` : 'خطط ليومك'), icon(tomorrowOpen ? 'chevU' : 'chevD', 12)),
    tomorrowOpen ? h('div', { class: 'tm-peek' },
      list.map((t) => h('button', { type: 'button', style: { '--c': tintHex((TAGS[t.tag] || TAGS.general).tint) }, onclick: () => openTaskForm(t.id, { day: d }) }, h('i', { class: 'd' }), t.title, h('small', null, t.time ? time12(t.time) : t.period ? STATION_NAMES[t.period] : ''))),
      h('button', { type: 'button', class: 'tm-add', onclick: () => openCapture({ date: d }) }, icon('plus', 12), 'أضف لبكرة')) : null]);
  draw();
  wrap.append(box);
  return wrap;
}
