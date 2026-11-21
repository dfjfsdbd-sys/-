// صفحة التعهّد: البداية والإدارة، شروط اليوم (أساسي/ثانوي)، الحصص الأسبوعية، وتقويم الأيام
import { h, icon, badge, ring, bar, fill, openSheet, toast, haptic, chips, toggleRow, confirmSheet, segmented, openDatePicker } from '../ui.js';
import { store, uid } from '../store.js';
import { logicalToday } from '../prayer.js';
import { addDays, parseISO, WEEK_SHORT, WEEK_START, shortDate, dayLabel, daysText, monthLabel, iso, daysInMonth } from '../dates.js';
import { commitActive, commitStats, liveVerdict, dayVerdict, dayDetail, verdictPct, dailyRequirements, setImportance, startCommitment, QUOTA_POLICIES, PRAYERS_REQ, invalidateDay } from '../commit.js';
import { activeHabits, passThreshold } from '../habits.js';
import { allAdhkarLists, adhkarSettings } from '../worship.js';
import { secTitle } from './components.js';
import { openDaySheet } from './daysheet.js';
import { openHabitLog, openHabitEdit } from './habits.js';
import { openAdhkar, openQuranLog } from './worship.js';

export function renderCommit(ctx) {
  const today = ctx.today;
  const c = store.state.commitment;
  if (!commitActive()) {
    return h('div', null,
      h('div', { class: 'group', style: { marginTop: '8px' } }, h('div', { class: 'empty' },
        badge('shield', 'dawn', 64),
        h('h3', null, 'التعهّد'),
        h('p', null, 'فترة محددة (مثلاً 60 يوم) بتلتزم فيها بشروط يومية: الصلوات، الأذكار، الورد، وعادات بتتركها أو بتبنيها. كل يوم ما بيكمل بيزيد يوم على المدة، وكل يوم كامل إله مكافأة.'),
        h('button', { type: 'button', class: 'btn', onclick: () => openStart() }, icon('flag', 18), 'ابدأ تعهّد'))),
      (c?.archive || []).length ? [secTitle('تعهّدات سابقة', { ic: 'medal' }), h('div', { class: 'group rows' }, [...c.archive].reverse().map((a) => h('div', { class: 'row' }, badge('flag', 'gold', 36), h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, a.reward), h('span', { class: 'row-sub' }, `${shortDate(a.startDate)} — ${shortDate(a.endedAt)}`)))))] : null);
  }
  const st = commitStats(today);
  const lv = liveVerdict(today);
  const pct = Math.round(lv.pct * 100);
  const th = Math.round(passThreshold() * 100);
  const missEss = lv.items.filter((x) => x.imp === 'essential' && !x.ok);
  const cur = st.chain.current;
  const weekly = cur ? Object.entries(cur.items) : [];
  return h('div', null,
    h('div', { class: 'cm-big' },
      ring(st.pct, 120, { stroke: 9, color: 'var(--good)' }),
      h('div', { class: 'cmb-center' }, h('small', null, 'اليوم'), h('b', { class: 'num' }, String(st.dayNumber)), h('small', null, `من ${st.totalDays}`)),
      h('div', { class: 'cmb-info' },
        h('small', null, 'تتجهّز لـ'), h('strong', null, c.reward),
        h('span', null, st.completed ? 'أتممت المدة — بارك الله فيك' : `باقي ${daysText(st.remaining)} سليمة — حتى ${shortDate(st.endIso)}`))),
    h('div', { class: 'cmh-nums', style: { margin: '12px 16px 0' } },
      h('div', null, h('b', { class: 'num good' }, String(st.done + (st.todayDone ? 1 : 0))), h('small', null, 'مكتمل')),
      h('div', null, h('b', { class: 'num bad' }, String(st.broken)), h('small', null, 'ناقص')),
      h('div', null, h('b', { class: 'num' }, String(st.streak)), h('small', null, 'ورا بعض')),
      h('div', null, h('b', { class: 'num' }, String(st.best)), h('small', null, 'أطول سلسلة'))),
    st.weekPenalty || st.adjust ? h('p', { class: 'section-note' }, `انضاف على مدتك: ${st.broken ? `${st.broken} يوم ناقص` : ''}${st.weekPenalty ? ` — ${st.weekPenalty} من الحصص الأسبوعية` : ''}${st.adjust ? ` — ${st.adjust > 0 ? '+' : ''}${st.adjust} يدوي` : ''}`) : null,
    secTitle('شروط اليوم', { ic: 'bolt', count: `${lv.items.filter((x) => x.ok).length}/${lv.items.length}` }),
    h('div', { class: 'group' },
      h('div', { class: `day-score${lv.v === 'done' ? ' done' : ''}` },
        h('div', { class: 'ds-top' }, h('b', { class: 'num' }, `${pct}%`), h('span', { class: `pill ${lv.v === 'done' ? 'good' : pct >= th ? 'warn' : 'bad'}` }, lv.v === 'done' ? 'يوم مكتمل' : 'لسّا'), h('small', null, `الحدّ ${th}%`)),
        h('div', { class: 'ds-bar' }, h('i', { style: { width: `${pct}%` } }), h('em', { style: { insetInlineStart: `${th}%` } })),
        h('p', null, lv.v === 'done' ? 'اكتمل يومك، الله يتقبّل' : missEss.length ? (missEss.length <= 2 ? `ناقص: ${missEss.map((x) => x.name).join('، ')}` : `باقي ${missEss.length} شروط أساسية`) : `لازم توصل ${th}%`)),
      h('div', { class: 'rows' }, lv.items.map((x) => h('div', { class: 'row' },
        h('span', { class: `req-ic${x.ok ? ' ok' : x.score > 0 ? ' part' : ''}`, style: { width: '34px', height: '34px' } }, x.ok ? icon('check', 16, { stroke: 2.6 }) : icon(x.icon || 'circle', 16)),
        h('button', { type: 'button', class: 'row-tap', onclick: () => openReq(today, x) }, h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, x.name), h('span', { class: 'row-sub' }, x.detail || (x.score > 0 && x.score < 1 ? `${Math.round(x.score * 100)}%` : x.ok ? 'تمّ' : 'لسّا')))),
        h('button', { type: 'button', class: `imp-chip ${x.imp}`, onclick: () => { setImportance(x.id, x.imp === 'essential' ? 'secondary' : 'essential'); toast(x.imp === 'essential' ? 'صار ثانوي: بيرفع النسبة وما بيكسر اليوم لحاله' : 'صار أساسي: اليوم ما بيكمل بدونه'); } }, x.imp === 'essential' ? 'أساسي' : 'ثانوي')))),
      h('button', { type: 'button', class: 'add-req', onclick: () => openReqPicker() }, icon('plus', 16), 'أضف أو شيل شرط')),
    weekly.length ? [secTitle('حصص الأسبوع', { ic: 'calendar', count: `باقي ${daysText(cur.daysLeft)}` }),
      h('div', { class: 'group rows' }, weekly.map(([id, x]) => h('div', { class: 'row' },
        h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, x.name), bar(x.required ? x.got / x.required : 1, { cls: `thin ${x.got >= x.required ? 'good' : ''}` }), x.carried ? h('span', { class: 'row-sub warn' }, `منها ${x.carried} مترحّلة`) : null),
        h('span', { class: 'num', style: { fontSize: '14px' } }, `${x.got}/${x.required}`))))] : null,
    secTitle('أيام التعهّد', { ic: 'calCheck' }),
    commitCalendar(today, st),
    h('div', { class: 'section-actions' },
      h('button', { type: 'button', class: 'btn secondary', onclick: () => openManage() }, icon('sliders', 18), 'إدارة التعهّد')));
}
export function commitActions() {
  return commitActive() ? h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'إدارة', onclick: () => openManage() }, icon('sliders', 20)) : null;
}

function openReq(day, x) {
  if (x.kind === 'habit') openHabitLog(day, x.id);
  else if (x.kind === 'adhkar') openAdhkar(x.id.slice(7), day);
  else if (x.kind === 'quran') openQuranLog(day);
  else openDaySheet(day);
}

function commitCalendar(today, st) {
  const start = st.start;
  const end = addDays(start, st.totalDays - 1);
  const months = [];
  let m = start.slice(0, 7);
  while (m <= end.slice(0, 7) && months.length < 6) { months.push(m); const [y, mm] = m.split('-').map(Number); m = mm === 12 ? `${y + 1}-01` : `${y}-${String(mm + 1).padStart(2, '0')}`; }
  return h('div', { class: 'group cc-cal' }, months.map((mk) => {
    const [y, mo] = mk.split('-').map(Number);
    const first = new Date(y, mo - 1, 1);
    const off = (first.getDay() - WEEK_START + 7) % 7;
    const cells = [];
    for (let i = 0; i < off; i++) cells.push(h('span'));
    for (let d = 1; d <= daysInMonth(y, mo - 1); d++) {
      const ds = iso(new Date(y, mo - 1, d));
      const inRange = ds >= start && ds <= end;
      const v = inRange ? dayVerdict(ds) : null;
      cells.push(h('button', { type: 'button', class: `ccd${inRange ? '' : ' out'}${v ? ` v-${v}` : ''}${ds === today ? ' today' : ''}`, onclick: () => { if (inRange && ds <= today) openDaySheet(ds); } }, String(d)));
    }
    return h('div', { class: 'ccm' }, h('div', { class: 'ccm-label' }, monthLabel(mk)), h('div', { class: 'mc-grid mc-week' }, Array.from({ length: 7 }, (_, i) => h('span', null, WEEK_SHORT[(WEEK_START + i) % 7]))), h('div', { class: 'mc-grid' }, cells));
  }), h('div', { class: 'mc-legend' }, h('span', null, h('i', { class: 'lg-done' }), 'مكتمل'), h('span', null, h('i', { class: 'lg-broken' }), 'ناقص'), h('span', null, h('i', { class: 'lg-future' }), 'جاي')));
}

function openStart() {
  const d = { reward: '', days: 60, includePrayers: true };
  openSheet('تعهّد جديد', (body, close) => {
    function render() {
      fill(body, [
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'شو عم تتجهّز له؟'), h('input', { type: 'text', value: d.reward, placeholder: 'متل: الاستعداد للزواج', 'data-autofocus': true, oninput: (e) => { d.reward = e.target.value; } })),
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'المدة (أيام كاملة)'), chips([30, 40, 60, 90, 120].map((n) => ({ value: n, label: `${n} يوم` })), d.days, (v) => { d.days = v; render(); })),
        h('div', { class: 'rows sheet-rows' }, toggleRow({ title: 'الصلوات الخمس من الشروط', checked: d.includePrayers, onChange: (v) => { d.includePrayers = v; } })),
        h('p', { class: 'hint' }, 'بعد البداية بتختار الشروط: الأذكار، الورد، والعادات (أساسية أو ثانوية).'),
        h('button', { type: 'button', class: 'btn block', onclick: async () => {
          if (!d.reward.trim()) { toast('اكتب شو عم تتجهّز له.', { kind: 'warn' }); return; }
          if (commitActive() && !(await confirmSheet('تعهّد جديد', 'في تعهّد شغّال. بدك تنهيه وتبدأ جديد؟ السجلّ بيضل.', 'ابدأ الجديد', { danger: false }))) return;
          startCommitment({ reward: d.reward.trim(), days: d.days, includePrayers: d.includePrayers });
          close(); toast('بدأ التعهّد — الله يوفّقك'); setTimeout(() => openReqPicker(), 400);
        } }, 'ابدأ'),
      ]);
    }
    render();
  });
}

// اختيار الشروط: الأذكار، الورد، العادات
function openReqPicker() {
  openSheet('شروط التعهّد', (body) => {
    function render() {
      const s = store.state;
      fill(body, [
        h('p', { class: 'hint' }, 'اللي بتفعّله هون بيصير من شروط اليوم.'),
        h('div', { class: 'sheet-section' }, 'العبادات'),
        h('div', { class: 'rows sheet-rows' },
          toggleRow({ title: 'الصلوات الخمس', checked: s.commitment?.includePrayers !== false, onChange: (v) => { store.update((x) => { x.commitment.includePrayers = v; }); render(); } }),
          allAdhkarLists().map((l) => toggleRow({ title: l.name, checked: adhkarSettings(l.id).core, onChange: (v) => { store.update((x) => { x.adhkar.lists = x.adhkar.lists || {}; x.adhkar.lists[l.id] = { ...(x.adhkar.lists[l.id] || {}), core: v, enabled: v || adhkarSettings(l.id).enabled }; }); render(); } })),
          toggleRow({ title: `ورد القرآن (${s.settings.quranDaily || 10} صفحات)`, checked: Boolean(s.quran.core), onChange: (v) => { store.update((x) => { x.quran.core = v; }); render(); } })),
        h('div', { class: 'sheet-section' }, 'العادات والسلوك'),
        h('div', { class: 'rows sheet-rows' },
          activeHabits().map((hb) => toggleRow({ title: hb.name, sub: hb.rhythm?.type === 'weekly' ? `${hb.rhythm.times} مرات بالأسبوع` : 'كل يوم', checked: Boolean(hb.core), onChange: (v) => { store.update((x) => { x.habits.find((y) => y.id === hb.id).core = v; }); render(); } })),
          h('button', { type: 'button', class: 'row', onclick: () => openHabitEdit(null) }, icon('plus', 18), h('span', { class: 'row-main' }, 'عادة جديدة'))),
        h('div', { class: 'sheet-section' }, 'حصص أسبوعية من المكتبة'),
        h('div', { class: 'rows sheet-rows' }, [...s.subjects.map((x) => ['subject', x]), ...s.books.filter((b) => b.mode !== 'pages').map((x) => ['book', x]), ...s.series.map((x) => ['series', x])].map(([kind, it]) => h('div', { class: 'row' },
          h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, it.name), h('span', { class: 'row-sub' }, it.core ? `${it.rhythm?.perWeek || 3} بالأسبوع` : 'مو من التعهّد')),
          it.core ? h('div', { class: 'stepper' },
            h('button', { type: 'button', class: 'icon-btn small', onclick: () => { store.update((x) => { const y = (kind === 'subject' ? x.subjects : kind === 'book' ? x.books : x.series).find((z) => z.id === it.id); y.rhythm = { type: 'quota', perWeek: Math.max(0, (y.rhythm?.perWeek || 3) - 1) }; if (!y.rhythm.perWeek) y.core = false; }); render(); } }, icon('minus', 14)),
            h('b', { class: 'stepper-val', style: { minWidth: '28px', fontSize: '15px' } }, String(it.rhythm?.perWeek || 3)),
            h('button', { type: 'button', class: 'icon-btn small', onclick: () => { store.update((x) => { const y = (kind === 'subject' ? x.subjects : kind === 'book' ? x.books : x.series).find((z) => z.id === it.id); y.rhythm = { type: 'quota', perWeek: (y.rhythm?.perWeek || 3) + 1 }; }); render(); } }, icon('plus', 14)))
            : h('button', { type: 'button', class: 'btn small secondary', onclick: () => { store.update((x) => { const y = (kind === 'subject' ? x.subjects : kind === 'book' ? x.books : x.series).find((z) => z.id === it.id); y.core = true; y.rhythm = { type: 'quota', perWeek: 3 }; }); render(); } }, 'أضف')))),
      ]);
    }
    render();
  }, { tall: true });
}

function openManage() {
  openSheet('إدارة التعهّد', (body, close) => {
    function render() {
      const c = store.state.commitment;
      if (!c) { close(); return; }
      const set = (patch) => { store.update((s) => { Object.assign(s.commitment, patch); }); render(); };
      fill(body, [
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'تتجهّز لـ'), h('input', { type: 'text', value: c.reward, onchange: (e) => set({ reward: e.target.value.trim() || c.reward }) })),
        h('div', { class: 'two' },
          h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'المدة (أيام)'), h('input', { type: 'number', value: c.durationDays, onchange: (e) => set({ durationDays: Math.max(7, Number(e.target.value) || c.durationDays) }) })),
          h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'البداية'), h('button', { type: 'button', class: 'select-btn', onclick: () => openDatePicker({ value: c.startDate, today: logicalToday(), title: 'تاريخ البداية', onPick: (v) => { if (v && v <= logicalToday()) { store.update((s) => { s.commitment.startDate = v; s.commitment.weeks = {}; s.commitment.closed = {}; }); render(); } } }) }, icon('calendar', 16), h('span', { class: 'sb-val' }, shortDate(c.startDate))))),
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'حدّ نجاح اليوم (والتقييمات)'), chips([0.5, 0.6, 0.7, 0.8].map((v) => ({ value: v, label: `${v * 100}%` })), c.passThreshold || 0.6, (v) => set({ passThreshold: v }))),
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'إذا نقصت حصة أسبوعية'), h('div', { class: 'rows sheet-rows' }, Object.entries(QUOTA_POLICIES).map(([k, p]) => h('button', { type: 'button', class: 'row', 'aria-pressed': String((c.quotaPolicy || 'carry') === k), onclick: () => set({ quotaPolicy: k }) },
          h('span', { class: `radio${(c.quotaPolicy || 'carry') === k ? ' on' : ''}` }), h('span', { class: 'row-main' }, h('span', { class: 'row-title wrap' }, p.label), h('span', { class: 'row-sub wrap' }, p.hint)))))),
        h('div', { class: 'two' },
          h('button', { type: 'button', class: 'btn secondary', onclick: () => { set({ adjustments: [...(c.adjustments || []), { days: 1, at: logicalToday() }] }); toast('انضاف يوم على المدة'); } }, '+ يوم'),
          h('button', { type: 'button', class: 'btn secondary', onclick: () => { set({ adjustments: [...(c.adjustments || []), { days: -1, at: logicalToday() }] }); toast('انشال يوم من المدة'); } }, '− يوم')),
        h('button', { type: 'button', class: 'btn danger block', onclick: async () => { if (await confirmSheet('إعادة من الأول', 'بيبدأ العدّ من اليوم الأول (السجلّ بيضل).', 'أعد')) { store.update((s) => { s.commitment.startDate = logicalToday(); s.commitment.adjustments = []; s.commitment.weeks = {}; s.commitment.closed = {}; s.commitment.id = uid('c'); }); close(); } } }, 'أعد التعهّد من اليوم الأول'),
        h('button', { type: 'button', class: 'btn danger block', onclick: async () => { if (await confirmSheet('إنهاء التعهّد', 'بتوقف العدّ وبيتحفظ ملخّصه.', 'أنهِ')) { store.update((s) => { const a = s.commitment; a.archive = [...(a.archive || []), { reward: a.reward, startDate: a.startDate, endedAt: logicalToday(), durationDays: a.durationDays }]; a.active = false; }); close(); } } }, 'إنهاء التعهّد'),
      ]);
    }
    render();
  });
}
