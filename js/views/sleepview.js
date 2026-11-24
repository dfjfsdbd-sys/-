// الروتين الثابت والنوم: ساعة الـ24 (النوم، القيلولة، الشغل، الصلوات) والفراغ الحقيقي بكل فترة
import { h, icon, haptic, toggleRow, stepper, openTimePicker, toast } from '../ui.js';
import { store } from '../store.js';
import { PERIODS, PERIOD_SKY, PERIOD_SHORT, periodsFor, nowMinOfLogical } from '../prayer.js';
import { addDays, time12, fromMin, WEEK_SHORT, parseISO } from '../dates.js';
import { sleepCfg, sleepTimes, busyBlocks, freeByStation, prayerBlocks, NAP_PERIODS, isWorkDay, wakeLog, setWake, cycleWake, wakeStreak, wakeTarget, bedSuggestions, lastBusyTonight, wakeOptions, midCycle } from '../sleep.js';
import { alarmCfg, setAlarm, setTone, clearTone, startRinging, stopRinging, LEVELS, isAndroid, phoneAlarmUrl } from '../alarm.js';
import { openBedside } from './bedside.js';
import { secTitle } from './components.js';

const COL = { sleep: '#6F86D9', nap: '#35b791', work: '#e0a04a', prayer: '#f1ede2' };
let view = null;
const hrs = (m) => { const v = m / 60; return v >= 10 ? String(Math.round(v)) : String(+v.toFixed(1)); };

// قوس على ساعة 24: الدقيقة 0 (نص الليل) فوق، وبيمشي مع عقارب الساعة
function arcPath(m1, m2, r, c = 120) {
  const ang = (m) => (m / 1440) * Math.PI * 2 - Math.PI / 2;
  const a1 = ang(m1), a2 = ang(m2);
  const large = m2 - m1 > 720 ? 1 : 0;
  const p = (a) => `${(c + r * Math.cos(a)).toFixed(2)} ${(c + r * Math.sin(a)).toFixed(2)}`;
  return `M ${p(a1)} A ${r} ${r} 0 ${large} 1 ${p(a2)}`;
}
// قطعة ممكن تقطع نص الليل ← قطعتين
function segs(from, to) {
  const len = Math.max(0, Math.min(1440, to - from));
  if (!len) return [];
  const a = ((from % 1440) + 1440) % 1440;
  return a + len <= 1440 ? [[a, a + len]] : [[a, 1440], [0, a + len - 1440]];
}
const NS = 'http://www.w3.org/2000/svg';
const sv = (tag, attrs = {}) => { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); return el; };

function clock24(day, kind, showNow) {
  const svg = sv('svg', { viewBox: '0 0 240 240', 'aria-hidden': 'true' });
  svg.append(sv('circle', { cx: 120, cy: 120, r: 98, fill: 'none', stroke: 'rgba(255,255,255,.06)', 'stroke-width': 22 }));
  const p = periodsFor(day);
  for (const k of PERIODS) for (const [a, b] of segs(p[k].from, p[k].to)) svg.append(sv('path', { d: arcPath(a, b, 80), fill: 'none', stroke: PERIOD_SKY[k], 'stroke-width': 5, opacity: 0.55, 'stroke-linecap': 'butt' }));
  for (const bl of busyBlocks(day, { kind })) for (const [a, b] of segs(bl.from, bl.to)) svg.append(sv('path', { d: arcPath(a, b, 98), fill: 'none', stroke: COL[bl.k], 'stroke-width': 22, opacity: bl.k === 'sleep' ? 0.85 : 0.7 }));
  for (const pr of prayerBlocks(day)) for (const [a, b] of segs(pr.from, pr.to)) svg.append(sv('path', { d: arcPath(a, b, 98), fill: 'none', stroke: COL.prayer, 'stroke-width': 22 }));
  [[0, '12ص'], [360, '6ص'], [720, '12م'], [1080, '6م']].forEach(([m, l]) => {
    const a = (m / 1440) * Math.PI * 2 - Math.PI / 2;
    const t = sv('text', { x: (120 + 64 * Math.cos(a)).toFixed(1), y: (120 + 64 * Math.sin(a) + 3.5).toFixed(1), 'text-anchor': 'middle', 'font-size': 9.5, fill: 'rgba(255,255,255,.38)' });
    t.textContent = l; svg.append(t);
  });
  if (showNow) {
    const now = nowMinOfLogical() % 1440;
    const a = (now / 1440) * 360;
    // «إنت هلّق»: علامة على طرف الحلقة (مش عقرب بالنص مشان ما يغطّي الرقم)
    const g = sv('g', { transform: `rotate(${a.toFixed(1)} 120 120)` });
    g.append(sv('line', { x1: 120, y1: 34, x2: 120, y2: 6, stroke: '#fff', 'stroke-width': 2.5, 'stroke-linecap': 'round' }));
    g.append(sv('circle', { cx: 120, cy: 6, r: 4, fill: '#fff' }));
    svg.append(g);
  }
  return svg;
}

/* ---------- دورات النوم ---------- */
function cyclesCard(ctx, today, c, st, setS) {
  const tgt = wakeTarget(today, c);
  const sug = bedSuggestions(today);
  const busy = lastBusyTonight(today);
  const mine = sug.find((x) => x.mine);
  const ok = sug.filter((x) => !x.early && !x.clash);
  const best = mine && !mine.clash && !mine.early ? mine : ok.sort((a, b) => b.n - a.n)[0];
  const now = nowMinOfLogical();
  const opts = wakeOptions(now).filter((x) => x.n >= 3);
  const mid = midCycle(now, tgt.wake);
  const pickTime = (mode) => openTimePicker({ value: c.wakeTime || '04:00', allowEmpty: false, title: mode === 'qiyam' ? 'قيام الليل الساعة' : 'بدّي أصحى الساعة', onPick: (v) => { if (v) setS((x) => { x.wakeMode = mode; x.wakeTime = v; }); } });
  const qiyamT = c.wakeMode === 'qiyam' ? c.wakeTime : '04:00';
  return h('div', { class: 'sl-cy' },
    h('div', { class: 'cy-h' }, icon('moon', 15), h('b', null, 'دورات النوم'), h('small', null, 'كل دورة ساعة ونص — والصحيان بآخرها بيخلّيك تفيق نشيط')),
    h('div', { class: 'cy-lbl' }, 'بدّي أصحى…'),
    h('div', { class: 'cy-modes' },
      h('button', { type: 'button', class: c.wakeMode === 'fajr' ? 'on' : '', onclick: () => setS((x) => { x.wakeMode = 'fajr'; }) }, 'قبل الفجر', h('b', { class: 'num' }, time12(fromMin(tgt.fajr - (Number(c.wakeBefore) || 0))).replace(' ص', ''))),
      h('button', { type: 'button', class: c.wakeMode === 'qiyam' ? 'on' : '', onclick: () => (c.wakeMode === 'qiyam' ? pickTime('qiyam') : setS((x) => { x.wakeMode = 'qiyam'; x.wakeTime = x.wakeTime || '04:00'; })) }, 'قيام الليل', h('b', { class: 'num' }, time12(qiyamT).replace(' ص', ''))),
      h('button', { type: 'button', class: c.wakeMode === 'custom' ? 'on' : '', onclick: () => pickTime('custom') }, 'ساعة تانية', c.wakeMode === 'custom' ? h('b', { class: 'num' }, time12(c.wakeTime)) : icon('clock', 13))),
    c.wakeMode !== 'fajr' ? h('p', { class: 'cy-tip' }, 'اضغط مرة تانية لتغيّر الساعة.') : null,
    h('div', { class: 'cy-lbl' }, `لازم تنام الساعة (لتصحى ${time12(fromMin(tgt.wake))}):`),
    h('div', { class: 'cy-sug' }, sug.map((x) => h('button', {
      type: 'button', class: `cy-s${x === best ? ' best' : ''}${x.early || x.clash ? ' bad' : ''}${x.mine ? ' mine' : ''}`,
      onclick: () => { setS((y) => { y.cycles = x.n; delete y.hours; }); haptic('select'); },
    },
    h('span', { class: 'cy-t num' }, time12(fromMin(x.bed))),
    h('span', { class: 'cy-bars' }, Array.from({ length: x.n }, () => h('i'))),
    h('small', null, `${x.n} دورات · ${+x.hours} س`, h('br'), x.early ? 'قبل العشاء — مش واقعي' : x.clash ? 'عندك مهام لهالوقت' : x === best ? (x.mine ? 'روتينك — الأنسب' : 'الأنسب الليلة') : x.mine ? 'روتينك' : '')))),
    mine && (mine.clash || mine.early) && best ? h('div', { class: 'cy-warn' }, icon('triangle-exclamation', 13),
      h('span', null, busy != null && mine.clash ? `عندك مهام لـ ${time12(fromMin(busy))} — فـ` : 'روتينك ما بيزبط الليلة — فـ', h('b', null, time12(fromMin(best.bed))), ` هو أقرب وقت مريح (${best.n} دورات).`, best.n < c.cycles ? ' ضيف قيلولة دورة كاملة 90 د بكرة لتعوّض.' : '')) : null,
    h('div', { class: 'cy-lbl' }, `العكس: إذا نمت هلّق (${time12(fromMin(now))})`),
    h('div', { class: 'chips' }, opts.map((x) => h('span', { class: `chip small${Math.abs(x.wake - tgt.wake) < 45 ? ' on' : ''}` }, `${time12(fromMin(x.wake))} · ${x.n} دورات`))),
    mid ? h('p', { class: 'cy-tip warn' }, `إذا نمت هلّق، صحيان ${time12(fromMin(tgt.wake))} بيجي بنص دورة — فيق ${time12(fromMin(mid.before))} أو ${time12(fromMin(mid.after))} أريح.`) : null);
}

/* ---------- المنبه القوي ---------- */
function alarmCard(ctx, st) {
  const a = alarmCfg();
  const wakeHH = fromMin(st.wake);
  const fileIn = h('input', { type: 'file', accept: 'audio/*', style: { display: 'none' }, onchange: async (e) => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 15 * 1024 * 1024) { toast('الملف كبير — اختار نغمة أصغر من 15 ميغا.', { kind: 'warn' }); return; } await setTone(f); toast('انحفظت النغمة'); } });
  let previewing = false;
  return [
    secTitle('المنبه القوي', { ic: 'bell' }),
    h('div', { class: 'al-note' }, icon('circle-info', 13), h('span', null, 'تطبيق الويب ما بيقدر يرنّ وهو مسكّر. فالأكيد: ', h('b', null, 'وضع السرير'), ' — بتكبس «نام» وبتترك التطبيق فاتح عالشاحن، الشاشة بتعتم، وعلى الوقت بيرنّ بنغمتك وما بيسكت إلا بحلّ المسائل.')),
    h('div', { class: 'group rows' },
      h('div', { class: 'row' }, h('span', { class: 'row-ic' }, icon('bell', 16)),
        h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, 'المنبه'), h('span', { class: 'row-sub' }, 'من دورات النوم — بيتغيّر لحاله')), h('b', { class: 'al-v num' }, time12(wakeHH))),
      h('div', { class: 'row' }, h('span', { class: 'row-ic' }, icon('music', 16)),
        h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, 'النغمة'), h('span', { class: 'row-sub' }, a.toneName || 'الافتراضية (رنّات قوية)')),
        h('div', { class: 'al-btns' },
          h('button', { type: 'button', class: 'btn small secondary', onclick: () => fileIn.click() }, icon('folder-open', 12), 'من جوالك'),
          h('button', { type: 'button', class: 'btn small secondary', 'aria-label': 'جرّب', onclick: async () => { if (previewing) return; previewing = true; await startRinging({ gradual: false, preview: true }); setTimeout(() => { stopRinging(); previewing = false; }, 3500); } }, icon('play', 12))),
        fileIn),
      a.toneName ? h('button', { type: 'button', class: 'row-note link-btn', onclick: () => clearTone() }, 'رجّع النغمة الافتراضية') : null,
      h('div', { class: 'row-block' }, h('span', { class: 'row-title' }, 'الإطفاء بحلّ مسائل'),
        h('div', { class: 'al-chips' },
          h('div', { class: 'chips' }, [1, 3, 5].map((n) => h('button', { type: 'button', class: 'chip small', 'aria-pressed': String(a.count === n), onclick: () => setAlarm({ count: n }) }, n === 1 ? 'مسألة' : `${n} مسائل`))),
          h('div', { class: 'chips' }, Object.entries(LEVELS).map(([k, l]) => h('button', { type: 'button', class: 'chip small', 'aria-pressed': String(a.level === k), onclick: () => setAlarm({ level: k }) }, l))))),
      toggleRow({ ic: 'volume-high', title: 'الصوت بيعلى تدريجياً', checked: a.gradual !== false, onChange: (v) => setAlarm({ gradual: v }) }),
      toggleRow({ ic: 'mobile-screen', title: 'اهتزاز', checked: a.vibrate !== false, onChange: (v) => setAlarm({ vibrate: v }) })),
    h('div', { class: 'al-acts' },
      h('button', { type: 'button', class: 'btn block al-bed', onclick: () => openBedside() }, icon('moon', 16), 'وضع السرير — نام هلّق'),
      h('button', { type: 'button', class: 'btn secondary block', onclick: () => {
        if (!isAndroid()) { toast('هالزر لأندرويد — اضبط منبّه جوالك يدوياً على ' + time12(wakeHH)); return; }
        location.href = phoneAlarmUrl(wakeHH, 'المنظومة: صحيان');
      } }, icon('mobile-screen', 14), `اضبط منبّه الجوال كمان على ${time12(wakeHH)}`)),
  ];
}

export function renderSleep(ctx) {
  const today = ctx.today;
  const c = sleepCfg();
  const shifts = Boolean(store.state.settings.shift?.enabled);
  const todayKind = isWorkDay(today) ? 'work' : 'home';
  if (!shifts) view = 'home'; else if (!view) view = todayKind;
  const showNow = !shifts || view === todayKind;
  const free = freeByStation(today, { kind: view });
  const total = Object.values(free).reduce((a, b) => a + b, 0);
  const st = sleepTimes(today);
  const setS = (fn) => store.update((s) => { s.settings.sleep = { ...sleepCfg(), ...(s.settings.sleep || {}) }; fn(s.settings.sleep); });
  const streak = wakeStreak(today);
  const days14 = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const wl = wakeLog(today);
  return h('div', { class: 'sl-page' },
    shifts ? h('div', { class: 'seg sl-seg' }, [['home', 'يوم بيت'], ['work', 'يوم شغل']].map(([k, l]) => h('button', {
      type: 'button', class: view === k ? 'on' : '', 'aria-pressed': String(view === k), onclick: () => { view = k; haptic('select'); ctx.refresh(); },
    }, l, k === todayKind ? h('small', null, ' · اليوم') : null))) : null,
    h('div', { class: 'clock24' }, clock24(today, view, showNow),
      h('div', { class: 'mid' }, h('span', null, h('b', { class: 'num' }, `${hrs(total)} س`), h('small', null, showNow ? 'فراغ اليوم' : 'فراغ يوم الشغل')))),
    h('div', { class: 'legend3' },
      h('span', null, h('i', { style: { background: COL.sleep } }), `نوم ${+c.hours} س`),
      c.nap.on ? h('span', null, h('i', { style: { background: COL.nap } }), 'قيلولة') : null,
      shifts && view === 'work' ? h('span', null, h('i', { style: { background: COL.work } }), 'شغل') : null,
      h('span', null, h('i', { style: { background: COL.prayer } }), 'صلوات'),
      h('span', null, h('i', { style: { background: 'linear-gradient(90deg,#8E8CF0,#F0C96A,#62C2D6,#F0A35E,#E9839F)' } }), 'الفترات')),

    cyclesCard(ctx, today, c, st, setS),

    secTitle('الروتين الثابت', { ic: 'sliders' }),
    h('div', { class: 'group rows' },
      h('div', { class: 'row' }, h('span', { class: 'row-ic' }, icon('moon', 16)),
        h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, 'بنام كم دورة؟'), h('span', { class: 'row-sub' }, `${+c.hours} ساعات — الليلة على ${time12(fromMin(st.bed))}`)),
        stepper(c.cycles, (v) => setS((x) => { x.cycles = v; delete x.hours; }), { min: 3, max: 6, step: 1 })),
      c.wakeMode === 'fajr' ? h('div', { class: 'row' }, h('span', { class: 'row-ic' }, icon('sunrise', 16)),
        h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, 'بصحى قبل الأذان بـ'), h('span', { class: 'row-sub' }, `يعني ${time12(fromMin(st.wake))} · الفجر ${time12(fromMin(st.fajr))}`)),
        stepper(+c.wakeBefore, (v) => setS((x) => { x.wakeBefore = v; }), { min: 0, max: 90, step: 5, suffix: ' د' })) : null,
      h('div', { class: 'row' }, h('span', { class: 'row-ic' }, icon('bed', 16)),
        h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, 'بغفى خلال'), h('span', { class: 'row-sub' }, 'منحسبها قبل أول دورة')),
        stepper(+c.fallAsleep, (v) => setS((x) => { x.fallAsleep = v; }), { min: 0, max: 40, step: 5, suffix: ' د' })),
      toggleRow({ ic: 'mug', title: 'قيلولة', sub: c.nap.on ? `${NAP_PERIODS[c.nap.period]} · ${c.nap.minutes >= 90 ? 'دورة كاملة 90 د' : `${c.nap.minutes} د`}` : 'يا قصيرة 20 د، يا دورة كاملة 90 د — مش بالنص', checked: c.nap.on, onChange: (v) => setS((x) => { x.nap = { ...x.nap, on: v }; }) }),
      c.nap.on ? h('div', { class: 'row-block sl-nap' },
        h('div', { class: 'chips' }, Object.entries(NAP_PERIODS).map(([k, l]) => h('button', { type: 'button', class: 'chip small', 'aria-pressed': String(c.nap.period === k), onclick: () => setS((x) => { x.nap = { ...x.nap, period: k }; }) }, l))),
        h('div', { class: 'chips' }, [[20, 'قصيرة 20 د'], [90, 'دورة 90 د']].map(([m, l]) => h('button', { type: 'button', class: 'chip small', 'aria-pressed': String(c.nap.minutes === m), onclick: () => setS((x) => { x.nap = { ...x.nap, minutes: m }; }) }, l)))) : null,
      shifts ? [
        toggleRow({ ic: 'briefcase', title: 'دوام الشغل', sub: 'بأيام الشغل بس — بينشال من الفراغ', checked: c.work.on !== false, onChange: (v) => setS((x) => { x.work = { ...x.work, on: v }; }) }),
        c.work.on !== false ? h('div', { class: 'row-block sl-work' },
          h('button', { type: 'button', class: 'chip-x on', onclick: () => openTimePicker({ value: c.work.from, allowEmpty: false, title: 'بيبلّش الدوام', onPick: (v) => { if (v) setS((x) => { x.work = { ...x.work, from: v }; }); } }) }, icon('clock', 12), `من ${time12(c.work.from)}`),
          h('button', { type: 'button', class: 'chip-x on', onclick: () => openTimePicker({ value: c.work.to, allowEmpty: false, title: 'بيخلص الدوام', onPick: (v) => { if (v) setS((x) => { x.work = { ...x.work, to: v }; }); } }) }, icon('clock', 12), `لـ ${time12(c.work.to)}`)) : null,
      ] : null,
      toggleRow({ ic: 'bell', title: 'ذكّرني بوقت النوم', sub: `«نام هلّق» على ${time12(fromMin(st.bed))}`, checked: c.remind !== false, onChange: (v) => setS((x) => { x.remind = v; }) })),

    alarmCard(ctx, st),

    secTitle(showNow ? 'الفراغ الحقيقي اليوم' : 'الفراغ بيوم الشغل', { ic: 'hourglass-half' }),
    h('div', { class: 'free' }, PERIODS.map((k) => h('div', { style: { '--sk': PERIOD_SKY[k] }, class: free[k] < 30 ? 'low' : '' }, h('b', { class: 'num' }, free[k] >= 30 ? `${hrs(free[k])} س` : `${Math.round(free[k])} د`), h('small', null, PERIOD_SHORT[k])))),
    h('p', { class: 'sl-note' }, 'الفراغ = طول الفترة ناقص النوم والقيلولة والشغل. وبصفحة اليوم بينقص منه كمان المهام اللي حاططها.'),

    secTitle('صحيت عالفجر؟', { ic: 'cloud-sun', count: streak ? `${streak} ورا بعض` : null }),
    !wl ? h('div', { class: 'sl-ask' },
      h('span', null, 'اليوم؟'),
      h('button', { type: 'button', class: 'btn small', onclick: () => { setWake(today, true); haptic('success'); } }, icon('check', 13), 'إي الحمد لله'),
      h('button', { type: 'button', class: 'btn small secondary', onclick: () => setWake(today, false) }, 'لا، فاتني')) : null,
    h('div', { class: 'sl-log' }, days14.map((d) => {
      const l = wakeLog(d);
      return h('button', { type: 'button', class: `sl-d${l ? (l.fajr ? ' ok' : ' no') : ''}${d === today ? ' td' : ''}`, title: d, 'aria-label': `${WEEK_SHORT[parseISO(d).getDay()]}: ${l ? (l.fajr ? 'صحيت' : 'ما صحيت') : 'بلا جواب'}`, onclick: () => { cycleWake(d); haptic('select'); } },
        h('small', null, WEEK_SHORT[parseISO(d).getDay()]), h('i', null, l ? icon(l.fajr ? 'check' : 'close', 10) : null));
    })),
    h('p', { class: 'sl-note' }, 'اضغط على أي يوم لتغيّره: صحيت ← ما صحيت ← بلا جواب (إذا ضغطت غلط). التطبيق بيسألك كل صبح.'));
}
