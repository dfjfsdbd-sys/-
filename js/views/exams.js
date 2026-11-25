// المذاكرات والامتحانات: البطاقة، صفحة المذاكرة (غلاف بصورة المادة، المعلومات، المحاضرات بصورها وروابط PDF)،
// نافذة الإضافة، والمشاركة مع رفقاتك (رابط تفاعلي، صورة، أو ملف) — بلا جاهزيتك ولا تقدّمك.
import { h, icon, ring, bar, fill, openSheet, toast, haptic, openDatePicker, openTimePicker, confirmSheet, toggleRow } from '../ui.js';
import { store, uid } from '../store.js';
import { logicalToday } from '../prayer.js';
import { addDays, shortDate, daysBetween, parseISO, MONTHS, WEEKDAYS, time12, daysText, countText, inDaysText } from '../dates.js';
import { masteryLabel, unitsProgress } from '../library.js';
import { addTask } from '../tasks.js';
import { plannedUnits } from '../libitems.js';
import { tintHex } from '../icons.js';
import { openSubjectEdit } from './study.js';
import { driveHasToken, driveSignIn, prepareDrive, uploadPublicImage, driveFileAlive, uploadPdfToDrive } from '../drive.js';

export const EXAM_KINDS = { quiz: 'مذاكرة', final: 'امتحان نهائي', practical: 'امتحان عملي', pop: 'كويز', oral: 'شفهي', other: 'تقييم' };
const KIND_TILES = [['quiz', 'مذاكرة', 'clipboard-check'], ['final', 'نهائي', 'flag-checkered'], ['practical', 'عملي', 'flask'], ['pop', 'كويز', 'bolt'], ['oral', 'شفهي', 'comment']];
export const QTYPES = { mcq: { name: 'أتمتة', ic: 'list-ol' }, written: { name: 'كتابي', ic: 'pen' }, mixed: { name: 'مختلط', ic: 'shuffle' } };
const lecWord = (n) => countText(n, ['محاضرة وحدة', 'محاضرتين', 'محاضرات', 'محاضرة']);
const subjectById = (id) => store.state.subjects.find((x) => x.id === id);

export function examView(e) {
  const s = subjectById(e.subjectId);
  const lects = (s?.lectures || []).filter((l) => e.lectureIds?.includes(l.id));
  return { ...e, subject: s, subjectName: s?.name || 'مادة محذوفة', subjectColor: s?.color, kindLabel: EXAM_KINDS[e.kind] || 'امتحان', lectures: lects.length, ready: lects.length ? unitsProgress(lects) : 0, lectureList: lects };
}
export function examsBetween(from, to) {
  return (store.state.exams || []).filter((e) => e.date >= from && e.date <= to).map(examView).sort((a, b) => a.date.localeCompare(b.date));
}
// سطر نظام الأسئلة الصغير
function qsChips(e) {
  const q = QTYPES[e.qtype];
  const out = [];
  if (q) out.push(h('span', null, icon(q.ic, 9), `${q.name}${e.qcount ? ` · ${e.qcount}` : ''}`));
  if (e.duration) out.push(h('span', null, icon('clock', 9), `${e.duration} د`));
  return out.length ? h('div', { class: 'ex-qs' }, out) : null;
}

/* ---------- البطاقة (نفس الشكل اللي عجبك) ---------- */
export function examCard(e, today) {
  const d = parseISO(e.date);
  const n = daysBetween(today, e.date);
  const left = e.lectureList.filter((l) => (l.mastery || 0) < 75).length;
  return h('button', { type: 'button', class: `exam-card${n <= 3 ? ' soon' : ''}`, style: { '--tint': tintHex(e.subjectColor) }, onclick: () => openExam(e.id) },
    h('div', { class: 'ex-date' }, h('b', { class: 'num' }, String(d.getDate())), h('small', null, MONTHS[d.getMonth()]), h('span', null, WEEKDAYS[d.getDay()])),
    h('div', { class: 'ex-main' },
      h('div', { class: 'ex-title' }, h('span', { class: 'pill tint' }, e.kindLabel), h('b', null, e.subjectName)),
      h('small', null, [e.lectures ? lecWord(e.lectures) : null, e.time ? time12(e.time) : null, e.place || null].filter(Boolean).join(' — ') || 'ما حددت المحاضرات'),
      qsChips(e),
      h('div', { class: 'ex-ready' }, h('span', { class: 'ex-rbar' }, h('i', { class: e.ready >= 0.75 ? 'g' : e.ready >= 0.5 ? 'a' : 'r', style: { width: `${Math.round(e.ready * 100)}%` } })), h('span', null, `جاهزيتك ${Math.round(e.ready * 100)}%`))),
    // العدّ بالعربي الصح، وتحته شو باقي من المحاضرات
    h('div', { class: 'ex-count' },
      n >= 2 ? h('small', null, 'بعد') : null,
      h('b', { class: `num${n <= 2 ? ' word' : ''}` }, n === 0 ? 'اليوم' : n === 1 ? 'بكرة' : n === 2 ? 'يومين' : String(n)),
      n >= 3 ? h('small', null, n <= 10 ? 'أيام' : 'يوم') : null,
      left ? h('span', null, `باقي ${lecWord(left)}`) : null));
}

/* ---------- صفحة المذاكرة ---------- */
function thumb(l, i, c, s) {
  const src = l.image || null;
  return h('span', { class: `xl-th${src ? ' img' : ''}`, style: { '--c': c } }, src ? h('img', { src, alt: '', loading: 'lazy' }) : h('b', { class: 'num' }, String(i + 1)));
}
function openPdf(url) { try { window.open(url, '_blank', 'noopener'); } catch { /* */ } }
// PDF المحاضرة: يا بتختار الملف من هاتفك (بينرفع على درايفك وبينحط رابطه لحاله)، يا بتلصق رابط عندك
export function editPdf(sid, lid, after) {
  const l = subjectById(sid)?.lectures.find((x) => x.id === lid);
  if (!l) return;
  const s = subjectById(sid);
  if (navigator.onLine) prepareDrive().catch(() => {});
  openSheet('PDF المحاضرة', (body, close) => {
    const inp = h('input', { type: 'url', dir: 'ltr', value: l.pdf || '', placeholder: 'https://drive.google.com/…' });
    const savePdf = (v) => store.update((st) => { const x = st.subjects.find((y) => y.id === sid)?.lectures.find((z) => z.id === lid); if (x) x.pdf = v || null; });
    let busy = null; // نسبة الرفع
    const fileInp = h('input', { type: 'file', accept: 'application/pdf,.pdf', style: { display: 'none' }, onchange: async () => {
      const f = fileInp.files?.[0];
      fileInp.value = '';
      if (!f) return;
      if (!/pdf$/i.test(f.type || f.name)) { toast('اختار ملف PDF.', { kind: 'warn' }); return; }
      busy = 0; draw();
      try {
        const name = `${s?.name || 'مادة'} — ${l.title}.pdf`;
        const url = await uploadPdfToDrive(f, name, (p) => { busy = p; draw(); });
        savePdf(url);
        haptic('success'); close(); after?.();
        toast('انرفع الملف على درايفك وانحط رابطه — رفقاتك بيفتحوه من المشاركة');
      } catch (err) {
        console.warn(err);
        busy = null; draw();
        const why = { 'too-big': 'الملف أكبر من 5 ميغا — ارفعه على درايف وحط رابطه تحت', offline: 'ما في نت', expired: 'انتهى الإذن، جرّب كمان مرة', popup_closed: 'انسكّرت نافذة جوجل', access_denied: 'انلغى تسجيل الدخول' }[err?.message] || 'جرّب بعد شوي';
        toast(`ما انرفع الملف (${why}).`, { kind: 'warn', duration: 5000 });
      }
    } });
    function pickFromPhone() {
      if (!navigator.onLine) { toast('بدها نت لترفع الملف.', { kind: 'warn' }); return; }
      // أول مرة: منفتح حساب جوجل، وبعدها بتضغط مرة تانية لتختار الملف (المتصفح ما بيفتح نافذتين ورا بعض)
      if (!driveHasToken()) {
        driveSignIn().then(() => { try { fileInp.click(); } catch { /* */ } toast('تمام — اختار الملف'); draw(); })
          .catch(() => toast('لازم تختار حساب جوجل لنرفع الملف على درايفك.', { kind: 'warn' }));
        return;
      }
      fileInp.click();
    }
    function draw() {
      fill(body, [
        fileInp,
        h('p', { class: 'hint' }, `«${l.title}» — رفقاتك بيفتحوا الملف من صفحة المشاركة.`),
        busy != null
          ? h('div', { class: 'pdf-up' }, h('div', { class: 'pdf-up-t' }, icon('cloud-arrow-up', 14), `عم نرفع الملف على درايفك… ${Math.round(busy * 100)}%`), bar(busy, { cls: 'good' }))
          : h('button', { type: 'button', class: 'pdf-pick', onclick: pickFromPhone },
            h('span', { class: 'pp-ic' }, icon('file-pdf', 20)),
            h('span', null, h('b', null, l.pdf ? 'بدّل الملف من هاتفك' : 'اختار PDF من هاتفك'), h('small', null, driveHasToken() ? 'بينرفع على درايفك (مجلّد ملفات المحاضرات) وبينحط رابطه لحاله' : 'بينرفع على درايفك — أول مرة بتختار حساب جوجل')),
            icon('chevL', 13)),
        h('div', { class: 'sheet-section' }, 'أو عندك رابط جاهز'),
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'الرابط'), inp),
      h('div', { class: 'two' },
        h('button', { type: 'button', class: 'btn', onclick: () => {
          const v = inp.value.trim();
          if (v && !/^https?:\/\//i.test(v)) { toast('الرابط لازم يبلّش بـ https://', { kind: 'warn' }); return; }
          savePdf(v);
          close(); toast(v ? 'انحفظ الرابط' : 'انشال الرابط'); after?.();
        } }, icon('check', 15), 'احفظ الرابط'),
        l.pdf ? h('button', { type: 'button', class: 'btn danger', onclick: () => { savePdf(null); close(); after?.(); } }, 'شيله') : h('button', { type: 'button', class: 'btn secondary', onclick: () => close() }, 'إلغاء')),
        l.pdf ? h('button', { type: 'button', class: 'btn secondary block', style: { marginTop: '8px' }, onclick: () => openPdf(l.pdf) }, icon('file-pdf', 14), 'افتح الملف الحالي') : null,
      ]);
    }
    draw();
  });
}

export function openExam(id) {
  const today = logicalToday();
  openSheet(null, (body, close) => {
    function render() {
      const raw = (store.state.exams || []).find((x) => x.id === id);
      if (!raw) { close(); return; }
      const e = examView(raw);
      const s = e.subject;
      const c = tintHex(e.subjectColor || 'sky');
      const n = daysBetween(today, e.date);
      const notReady = e.lectureList.filter((l) => (l.mastery || 0) < 75);
      // اللي إلها مهمة بأيامك (لسّا ما انعملت) انوزّعت — ما منعيد نوزّعها
      const planned = plannedUnits();
      const unplanned = notReady.filter((l) => !planned.has(l.id));
      const perDay = n > 1 ? Math.ceil(notReady.length / (n - 1)) : notReady.length;
      const q = QTYPES[e.qtype];
      const d = parseISO(e.date);
      fill(body, [
        h('div', { class: `xm-cover${s?.image ? ' img' : ''}`, style: { '--c': c } },
          s?.image ? h('img', { src: s.image, alt: '' }) : h('span', { class: 'xm-cic' }, icon(s?.icon || 'grad', 46)),
          h('button', { type: 'button', class: 'xm-btn x', 'aria-label': 'إغلاق', onclick: () => close() }, icon('close', 15)),
          h('button', { type: 'button', class: 'xm-btn sh', 'aria-label': 'شارك', onclick: () => { close(); setTimeout(() => openShareExams([id]), 260); } }, icon('share-nodes', 14)),
          h('div', { class: 'xm-cap' }, h('span', { class: 'pill tint', style: { '--tint': '#cfe6ff' } }, e.kindLabel), h('b', null, e.subjectName),
            h('small', null, `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}${e.time ? ` · ${time12(e.time)}` : ''}`))),
        h('div', { class: 'xm-tiles' },
          h('div', null, icon(q?.ic || 'circle-question', 13), h('b', null, q?.name || 'الأسئلة'), h('small', null, e.qcount ? `${e.qcount} سؤال` : 'مش محدد')),
          h('div', null, icon('clock', 13), h('b', null, e.duration ? `${e.duration} د` : '—'), h('small', null, 'المدة')),
          h('div', null, icon('location-dot', 13), h('b', null, e.place || '—'), h('small', null, 'المكان')),
          h('div', null, icon('hourglass-half', 13), h('b', null, n < 0 ? 'مضى' : n === 0 ? 'اليوم' : n === 1 ? 'بكرة' : daysText(n)), h('small', null, n > 1 ? 'باقي' : ''))),
        n >= 0 && e.lectures ? h('div', { class: 'xm-ready' },
          ring(e.ready, 56, { stroke: 5, color: e.ready >= 0.75 ? 'var(--good)' : e.ready >= 0.5 ? '#f0b766' : 'var(--bad)', label: `${Math.round(e.ready * 100)}%` }),
          h('div', null, h('b', null, 'جاهزيتك'), h('small', null, notReady.length ? `باقي ${lecWord(notReady.length)}${n > 1 ? ` — إذا درست ${perDay} باليوم بتخلص قبلها بيوم` : ''}` : 'كل المحاضرات مراجَعة — الله يوفقك'))) : null,
        n > 0 && unplanned.length ? h('button', { type: 'button', class: 'btn block', style: { margin: '10px 0 0' }, onclick: () => { planExam(raw, unplanned, today); close(); } }, icon('wand', 15), unplanned.length < notReady.length ? `وزّع الباقي (${lecWord(unplanned.length)})` : 'وزّع الباقي على الأيام') : null,
        n > 0 && notReady.length && !unplanned.length ? h('p', { class: 'xm-planned' }, icon('circle-check', 13), 'المحاضرات الباقية كلها موزّعة على أيامك كمهام') : null,
        h('div', { class: 'xm-sec' }, icon('layer-group', 12), `المحاضرات الداخلة`, h('em', { class: 'num' }, String(e.lectures))),
        e.lectureList.length ? h('div', { class: 'xl-list' }, e.lectureList.map((l, i) => {
          const m = l.mastery || 0;
          const idx = (s?.lectures || []).findIndex((x) => x.id === l.id);
          return h('div', { class: 'xl-row' },
            thumb(l, idx >= 0 ? idx : i, c, s),
            h('div', { class: 'xl-in' }, h('b', null, l.title), h('small', null, masteryLabel(m))),
            h('span', { class: 'xl-dots' }, [50, 75, 100].map((v) => h('i', { class: m >= v ? 'on' : '' }))),
            l.pdf ? h('button', { type: 'button', class: 'xl-pdf', 'aria-label': 'افتح PDF', onclick: () => openPdf(l.pdf) }, icon('file-pdf', 13))
              : h('button', { type: 'button', class: 'xl-pdf add', 'aria-label': 'أضف رابط PDF', onclick: () => editPdf(s.id, l.id, render) }, icon('link', 11)));
        })) : h('p', { class: 'muted', style: { margin: '4px 2px' } }, 'ما حددت محاضرات — اضغط عدّل.'),
        e.notes ? h('div', { class: 'xm-memo' }, icon('note-sticky', 12), e.notes) : null,
        e.date < today || e.grade != null ? h('div', { class: 'two', style: { marginTop: '12px' } },
          h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'العلامة'), h('input', { type: 'number', value: e.grade ?? '', onchange: (ev) => store.update((st) => { st.exams.find((x) => x.id === id).grade = ev.target.value === '' ? null : Number(ev.target.value); }) })),
          h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'من'), h('input', { type: 'number', value: e.outOf ?? 100, onchange: (ev) => store.update((st) => { st.exams.find((x) => x.id === id).outOf = Number(ev.target.value) || 100; }) }))) : null,
        h('div', { class: 'xm-acts' },
          h('button', { type: 'button', class: 'btn secondary', onclick: () => { close(); setTimeout(() => openExamEdit(id), 260); } }, icon('pen', 13), 'عدّل'),
          h('button', { type: 'button', class: 'btn secondary', onclick: () => { close(); setTimeout(() => openShareExams([id]), 260); } }, icon('share-nodes', 13), 'شارك هي بس'),
          h('button', { type: 'button', class: 'btn danger icon-only', 'aria-label': 'حذف', onclick: async () => { if (await confirmSheet('حذف', 'حذف هالمذاكرة؟', 'احذف')) { store.update((st) => { st.exams = st.exams.filter((x) => x.id !== id); }); close(); } } }, icon('trash', 14))),
      ]);
    }
    render();
  }, { cls: 'xm-sheet' });
}

// توزيع المحاضرات الباقية على الأيام قبل الامتحان (آخر يوم للمراجعة العامة)
export function planExam(e, lects, today) {
  const n = daysBetween(today, e.date);
  const days = Math.max(1, n - 1);
  const per = Math.ceil(lects.length / days);
  let i = 0;
  const s = subjectById(e.subjectId);
  for (let d = 0; d < days && i < lects.length; d++) {
    const date = addDays(today, d);
    for (let k = 0; k < per && i < lects.length; k++, i++) {
      const l = lects[i];
      addTask({ title: `${s?.name}: ${l.title}`, date, tag: 'study', link: { kind: 'lecture', itemId: e.subjectId, unitId: l.id, image: l.image || s?.image || null }, period: null });
    }
  }
  const reviewTitle = `مراجعة عامة: ${s?.name} (${EXAM_KINDS[e.kind] || 'امتحان'})`;
  const reviewDay = addDays(e.date, -1);
  if (n > 1 && !store.state.tasks.some((t) => t.title === reviewTitle && t.date === reviewDay)) addTask({ title: reviewTitle, date: reviewDay, tag: 'study', priority: 1 });
  toast(`انوزّعت ${lecWord(lects.length)} على ${daysText(days)}`);
}

/* ---------- نافذة الإضافة والتعديل ---------- */
export function openExamEdit(id, preset = {}) {
  const ex = id ? store.state.exams.find((x) => x.id === id) : null;
  if (!store.state.subjects.length) { toast('أضف مادة أول.', { kind: 'warn' }); openSubjectEdit(null); return; }
  const today = logicalToday();
  const d = ex ? { outOf: 100, ...JSON.parse(JSON.stringify(ex)) } : { kind: 'quiz', subjectId: preset.subjectId || store.state.subjects.find((x) => !x.archived)?.id || null, date: addDays(today, 7), time: null, place: '', lectureIds: [], notes: '', qtype: null, qcount: null, duration: null, outOf: 100 };
  openSheet(null, (body, close) => {
    function step(label, key, stepN, min, max, suffix = '') {
      const v = d[key];
      return h('div', { class: 'xf-step' }, h('small', null, label),
        h('span', null,
          h('button', { type: 'button', 'aria-label': 'أقل', onclick: () => { d[key] = Math.max(min, (v || 0) - stepN) || null; render(); } }, icon('minus', 10)),
          h('b', { class: 'num' }, v ? `${v}${suffix}` : '—'),
          h('button', { type: 'button', 'aria-label': 'أكتر', onclick: () => { d[key] = Math.min(max, (v || 0) + stepN); render(); } }, icon('plus', 10))));
    }
    function render() {
      const s = subjectById(d.subjectId);
      const c = tintHex(s?.color || 'sky');
      const n = daysBetween(today, d.date);
      fill(body, [
        h('div', { class: 'am-title' },
          h('h3', null, icon(ex ? 'pen' : 'plus', 14), ex ? 'تعديل المذاكرة' : 'مذاكرة جديدة',
            h('button', { type: 'button', class: 'am-x', 'aria-label': 'إغلاق', onclick: () => close() }, icon('close', 16))),
          h('small', null, `${WEEKDAYS[parseISO(d.date).getDay()]} ${shortDate(d.date)} · ${n < 0 ? 'مضى' : inDaysText(n)}`)),
        h('div', { class: 'f-row' }, h('label', { class: 'f-label' }, 'المادة'),
          h('div', { class: 'it-row' }, store.state.subjects.filter((x) => !x.archived).map((x) => {
            const xc = tintHex(x.color || 'sky');
            return h('button', { type: 'button', class: `it-card${d.subjectId === x.id ? ' on' : ''}`, style: { '--c': xc }, onclick: () => { if (d.subjectId !== x.id) { d.subjectId = x.id; d.lectureIds = []; haptic('select'); render(); } } },
              h('span', { class: 'it-im xf-im', style: { '--c': xc } }, x.image ? h('img', { src: x.image, alt: '', loading: 'lazy' }) : icon(x.icon || 'grad', 26)),
              h('b', null, x.name), h('small', null, (x.lectures || []).length ? ((x.lectures || []).length === 1 ? 'محاضرة وحدة' : lecWord(x.lectures.length)) : 'بلا محاضرات'));
          }))),
        h('div', { class: 'f-row' }, h('label', { class: 'f-label' }, 'النوع'),
          h('div', { class: 'xf-tiles k5' }, KIND_TILES.map(([k, l, ic]) => h('button', { type: 'button', class: d.kind === k ? 'on' : '', onclick: () => { d.kind = k; haptic('select'); render(); } }, h('i', null, icon(ic, 14)), l)))),
        h('div', { class: 'f-row' }, h('label', { class: 'f-label' }, 'متى ووين'),
          h('div', { class: 'xf-when' },
            h('button', { type: 'button', class: 'on', onclick: () => openDatePicker({ value: d.date, today, title: 'تاريخ المذاكرة', onPick: (v) => { if (v) { d.date = v; render(); } } }) }, icon('calendar', 13), h('b', null, `${WEEKDAYS[parseISO(d.date).getDay()]} ${parseISO(d.date).getDate()}`)),
            h('button', { type: 'button', class: d.time ? 'on' : '', onclick: () => openTimePicker({ value: d.time, onPick: (v) => { d.time = v || null; render(); } }) }, icon('clock', 13), h('b', null, d.time ? time12(d.time) : 'الساعة')),
            h('label', { class: d.place ? 'on' : '' }, icon('location-dot', 13), h('input', { type: 'text', value: d.place || '', placeholder: 'القاعة', oninput: (ev) => { d.place = ev.target.value; } })))),
        h('div', { class: 'f-row' }, h('label', { class: 'f-label' }, 'نظام الأسئلة'),
          h('div', { class: 'xf-tiles k3' }, Object.entries(QTYPES).map(([k, q]) => h('button', { type: 'button', class: d.qtype === k ? 'on' : '', onclick: () => { d.qtype = d.qtype === k ? null : k; haptic('select'); render(); } }, h('i', null, icon(q.ic, 14)), q.name))),
          h('div', { class: 'xf-steps' }, step('عدد الأسئلة', 'qcount', 5, 0, 300), step('المدة', 'duration', 15, 0, 300, ' د'), step('العلامة من', 'outOf', 10, 10, 200))),
        h('div', { class: 'f-row' }, h('label', { class: 'f-label xf-lh' }, 'المحاضرات الداخلة', h('em', null, `${d.lectureIds.length} من ${(s?.lectures || []).length}`),
          s?.lectures?.length ? h('button', { type: 'button', class: 'link-btn', onclick: () => { d.lectureIds = d.lectureIds.length === s.lectures.length ? [] : s.lectures.map((l) => l.id); render(); } }, d.lectureIds.length === s.lectures.length ? 'ولا وحدة' : 'الكل') : null),
          s?.lectures?.length ? h('div', { class: 'xl-list pick' }, s.lectures.map((l, i) => {
            const on = d.lectureIds.includes(l.id);
            return h('div', { class: `xl-row${on ? ' on' : ''}`, style: { '--c': c } },
              h('button', { type: 'button', class: 'xl-tap', onclick: () => { d.lectureIds = on ? d.lectureIds.filter((x) => x !== l.id) : [...d.lectureIds, l.id]; haptic('select'); render(); } },
                thumb(l, i, c, s), h('div', { class: 'xl-in' }, h('b', null, l.title), h('small', null, `محاضرة ${i + 1}`))),
              h('button', { type: 'button', class: `xl-pdf${l.pdf ? '' : ' add'}`, 'aria-label': 'رابط PDF', onclick: () => editPdf(s.id, l.id, render) }, l.pdf ? icon('file-pdf', 13) : [icon('link', 10), h('small', null, 'PDF')]),
              h('span', { class: 'xl-cb' }, on ? icon('check', 11) : null));
          })) : h('p', { class: 'field-hint' }, 'هالمادة ما فيها محاضرات بعد — أضفها من صفحة المادة.')),
        h('div', { class: 'f-row' }, h('label', { class: 'f-label' }, 'ملاحظات'), h('textarea', { rows: 2, placeholder: 'متل: الدكتور قال ركّزوا على الجداول', oninput: (ev) => { d.notes = ev.target.value; } }, d.notes || '')),
        h('div', { class: 'am-sticky' },
          h('button', { type: 'button', class: 'btn', style: { flex: 2 }, onclick: save }, icon('check', 15), ex ? 'احفظ' : `أضف المذاكرة — ${WEEKDAYS[parseISO(d.date).getDay()]} ${parseISO(d.date).getDate()}`),
          h('button', { type: 'button', class: 'btn secondary', style: { flex: 1 }, onclick: () => close() }, 'إلغاء')),
      ]);
    }
    function save() {
      if (!d.subjectId || !d.date) { toast('اختار المادة والتاريخ.', { kind: 'warn' }); return; }
      d.place = (d.place || '').trim();
      store.update((st) => { if (ex) { const i = st.exams.findIndex((x) => x.id === id); st.exams[i] = { ...st.exams[i], ...d }; } else st.exams.push({ id: uid('ex'), ...d, createdAt: Date.now() }); });
      haptic('success'); close(); toast(ex ? 'انحفظت' : `انضافت ${EXAM_KINDS[d.kind]} ${shortDate(d.date)}`);
    }
    render();
  }, { cls: 'task-form' });
}

/* ---------- المشاركة ---------- */
const TITLE_KEY = 'manz:shareTitle';
// صورة مصغّرة (مشان الرابط ما يطول)
function shrink(src, size, q = 0.7) {
  return new Promise((res) => {
    if (!src) { res(null); return; }
    const img = new Image();
    img.onload = () => {
      try {
        const k = Math.min(1, size / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(img.width * k)); cv.height = Math.max(1, Math.round(img.height * k));
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        res(cv.toDataURL('image/jpeg', q));
      } catch { res(null); }
    };
    img.onerror = () => res(null);
    img.crossOrigin = 'anonymous';
    img.src = src;
  });
}
const examsOf = (ids) => ids.map((id) => store.state.exams.find((x) => x.id === id)).filter(Boolean).map(examView).sort((a, b) => a.date.localeCompare(b.date));
// البيانات اللي بتنشارك: مواعيد ومحاضرات وروابط — بلا أي تقدّم.
// pic: كيف بتنحط الصورة (افتراضياً صورة مصغّرة جوّا البيانات، وبالرابط رقم ملفها على درايف)
async function payload(ids, title, { subImg = 0, lecImg = 0, pic = null } = {}) {
  const img = pic || ((src, size) => shrink(src, size));
  const x = [];
  for (const e of examsOf(ids)) {
    const s = e.subject;
    const lecs = [];
    for (const l of e.lectureList) {
      const idx = (s?.lectures || []).findIndex((y) => y.id === l.id);
      lecs.push([l.title, l.pdf || '', lecImg && l.image ? (await img(l.image, lecImg)) || 0 : 0, idx + 1]);
    }
    const o = { s: e.subjectName, c: tintHex(e.subjectColor || 'sky'), ic: s?.icon || 'grad', i: subImg && s?.image ? await img(s.image, subImg) : null, k: e.kindLabel, d: e.date, h: e.time, p: e.place, q: e.qtype, n: e.qcount, m: e.duration, o: e.outOf, no: e.notes, l: lecs };
    // الحقول الفاضية ما منبعتها — كل حرف بيطوّل الرابط
    for (const k of Object.keys(o)) if (o[k] == null || o[k] === '' || o[k] === 0) delete o[k];
    x.push(o);
  }
  return { v: 1, t: title, u: logicalToday(), x };
}
const b64url = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
async function encode(obj) {
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  if (typeof CompressionStream === 'function') {
    const buf = await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer();
    return `z${b64url(new Uint8Array(buf))}`;
  }
  return `j${b64url(raw)}`;
}
const shareBase = () => new URL('share.html', location.href.split('#')[0]).href;

// الصور ما بتنحط جوّا الرابط نفسه: بتطوّله لآلاف الأحرف، وواتساب وتلغرام بيقصّوه فما بينفتح.
// بدالها بتنرفع على درايفك، والرابط بيحمل رقم كل صورة بس (g:رقم).
export const LINK_SAFE = 3500;
const SUB_PX = 240, LEC_PX = 160;
const picKey = (src, size) => `${size}|${src}`;
// كل الصور اللي بتلزم لهالمذاكرات
export function linkPics(ids) {
  const want = new Map();
  for (const e of examsOf(ids)) {
    if (e.subject?.image) want.set(picKey(e.subject.image, SUB_PX), { src: e.subject.image, size: SUB_PX, name: `${e.subjectName}.jpg` });
    for (const l of e.lectureList) if (l.image) want.set(picKey(l.image, LEC_PX), { src: l.image, size: LEC_PX, name: `${e.subjectName} — ${l.title}.jpg` });
  }
  return want;
}
async function digest(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) await fn(items[i++]); }));
}
// برفع الصور الناقصة على درايف (اللي انرفعت قبل بتنعاد بلا رفع). بترجّع: مفتاح الصورة ← رقم ملفها
export async function uploadLinkPics(ids, onProgress) {
  const items = [...linkPics(ids).entries()];
  const cache = { ...(store.state.shareImgs || {}) };
  const found = new Map();
  let done = 0, failed = 0;
  onProgress?.(0, items.length);
  await pool(items, 4, async ([k, w]) => {
    const hk = await digest(k);
    let id = cache[hk];
    if (id && !(await driveFileAlive(id))) id = null;
    if (!id) {
      try {
        const data = await shrink(w.src, w.size, 0.82);
        if (data) { id = await uploadPublicImage(await (await fetch(data)).blob(), w.name); cache[hk] = id; }
      } catch (e) { if (e?.message === 'expired') throw e; failed += 1; }
    }
    if (id) found.set(k, id);
    onProgress?.(++done, items.length);
  });
  store.update((s) => { s.shareImgs = cache; }, { silent: true });
  return { found, failed };
}
export async function shareUrl(ids, title, found = null) {
  const opts = found ? { subImg: SUB_PX, lecImg: LEC_PX, pic: (src, size) => (found.has(picKey(src, size)) ? `g:${found.get(picKey(src, size))}` : 0) } : {};
  return `${shareBase()}#${await encode(await payload(ids, title, opts))}`;
}
// بيبعت الرابط. بيرمي NotAllowedError إذا راحت «ضغطتك» (بعد رفع طويل) — وقتها منطلب ضغطة جديدة
async function sendUrl(url, title, n) {
  const text = `${title} — ${n === 1 ? 'مذاكرة' : `${n} مذاكرات`}`;
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); return; } catch (err) {
      if (err?.name === 'AbortError') return;
      if (err?.name === 'NotAllowedError') throw err;
    }
  }
  await copyUrl(url);
}
async function copyUrl(url) {
  try { await navigator.clipboard.writeText(url); toast('انسخ الرابط — الصقه لرفقاتك'); } catch { window.open(url, '_blank', 'noopener'); }
}
async function shareFile(ids, title) {
  const data = await payload(ids, title, { subImg: 240, lecImg: 120 });
  const tpl = await (await fetch('share.html')).text();
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const html = tpl.replace('</head>', `<script>window.SHARE_DATA=${json};</script></head>`);
  const name = `${title.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'مذاكرات'}.html`;
  const file = new File([html], name, { type: 'text/html' });
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title }); return; } catch (err) { if (err?.name === 'AbortError') return; } }
  download(file, name);
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('انحفظ الملف — بعته من التنزيلات');
}

// صورة بنفس البطاقات (للستوري والمجموعات)
async function shareImage(ids, title) {
  const blob = await examsImage(ids, title);
  const file = new File([blob], 'mudhakarat.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title }); return; } catch (err) { if (err?.name === 'AbortError') return; } }
  download(file, 'مذاكرات.png');
}
export async function examsImage(ids, title) {
  const data = await payload(ids, title, { subImg: 160, lecImg: 0 });
  try { await document.fonts?.ready; } catch { /* */ }
  const W = 1080, P = 56, CH = 230, G = 26;
  const H = P * 2 + 190 + data.x.length * (CH + G);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const F = (w, s) => `${w} ${s}px "IBM Plex Sans Arabic", system-ui, sans-serif`;
  const rr = (x, y, w, hh, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + hh, r); g.arcTo(x + w, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#0f1420'); bg.addColorStop(1, '#0b0b0f');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W, 0, 10, W, 0, 700); glow.addColorStop(0, 'rgba(76,184,212,.22)'); glow.addColorStop(1, 'rgba(76,184,212,0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  g.direction = 'rtl'; g.textAlign = 'right'; g.textBaseline = 'alphabetic';
  g.fillStyle = '#e6e6ec'; g.font = F(700, 58); g.fillText(title, W - P, P + 70);
  g.fillStyle = '#8a8a99'; g.font = F(500, 30); g.fillText(`${data.x.length === 1 ? 'مذاكرة وحدة' : `${data.x.length} مذاكرات`} · ${shortDate(data.u)}`, W - P, P + 122);
  let y = P + 190;
  const imgs = await Promise.all(data.x.map((e) => new Promise((res) => { if (!e.i) { res(null); return; } const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = e.i; })));
  data.x.forEach((e, i) => {
    rr(P, y, W - P * 2, CH, 34); g.fillStyle = '#14141b'; g.fill(); g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 2; g.stroke();
    g.save(); rr(P, y, W - P * 2, CH, 34); g.clip(); g.fillStyle = e.c; g.fillRect(W - P - 10, y, 10, CH); g.restore();
    // التاريخ
    const dx = W - P - 40 - 150, dt = parseISO(e.d);
    rr(dx, y + 30, 150, CH - 60, 26); g.fillStyle = `${e.c}26`; g.fill();
    g.textAlign = 'center'; g.fillStyle = e.c; g.font = F(700, 66); g.fillText(String(dt.getDate()), dx + 75, y + 112);
    g.fillStyle = '#c4c4ce'; g.font = F(500, 26); g.fillText(MONTHS[dt.getMonth()], dx + 75, y + 150);
    g.fillStyle = '#8a8a99'; g.font = F(500, 24); g.fillText(WEEKDAYS[dt.getDay()], dx + 75, y + 182);
    // المعلومات
    g.textAlign = 'right';
    const tx = dx - 30;
    g.fillStyle = '#e6e6ec'; g.font = F(700, 40); g.fillText(e.s, tx, y + 78);
    g.fillStyle = e.c; g.font = F(600, 28); g.fillText(e.k, tx, y + 124);
    g.fillStyle = '#a0a0ae'; g.font = F(500, 27);
    const line = [e.h ? time12(e.h) : null, e.p || null, e.l.length ? lecWord(e.l.length) : null].filter(Boolean).join('  ·  ');
    g.fillText(line, tx, y + 168);
    const q = QTYPES[e.q];
    if (q || e.m) { g.fillStyle = '#8a8a99'; g.font = F(500, 25); g.fillText([q ? `${q.name}${e.n ? ` ${countText(e.n, ['سؤال واحد', 'سؤالين', 'أسئلة', 'سؤال'])}` : ''}` : null, e.m ? `${e.m} دقيقة` : null].filter(Boolean).join('  ·  '), tx, y + 204); }
    // صورة المادة
    const ix = P + 34, iy = y + 45, isz = CH - 90;
    g.save(); rr(ix, iy, isz, isz, 28); g.clip();
    if (imgs[i]) { const im = imgs[i]; const k = Math.max(isz / im.width, isz / im.height); g.drawImage(im, ix + (isz - im.width * k) / 2, iy + (isz - im.height * k) / 2, im.width * k, im.height * k); } else { const gg = g.createLinearGradient(ix, iy, ix + isz, iy + isz); gg.addColorStop(0, e.c); gg.addColorStop(1, '#1b1b24'); g.fillStyle = gg; g.fillRect(ix, iy, isz, isz); }
    g.restore();
    y += CH + G;
  });
  g.textAlign = 'center'; g.fillStyle = '#6e6e7d'; g.font = F(500, 26); g.fillText('انعملت بتطبيقي', W / 2, H - P / 2 - 6);
  return new Promise((res) => cv.toBlob(res, 'image/png'));
}

export function openShareExams(preIds = null) {
  const today = logicalToday();
  const upcoming = examsBetween(today, '9999-12-31');
  const all = [...upcoming];
  for (const id of preIds || []) if (!all.some((e) => e.id === id)) { const raw = store.state.exams.find((x) => x.id === id); if (raw) all.push(examView(raw)); }
  if (!all.length) { toast('ما في مذاكرات جاية لتشاركها.', { kind: 'warn' }); return; }
  const sel = new Set(preIds || upcoming.map((e) => e.id));
  let how = 'link';
  let title = (() => { try { return localStorage.getItem(TITLE_KEY) || 'المذاكرات الجاية'; } catch { return 'المذاكرات الجاية'; } })();
  let busy = false;
  let withPics = true;
  let progress = null;   // {done, total} وقت رفع الصور
  let ready = null;      // {url, n, t}: الرابط جاهز وبدّه ضغطة جديدة ليتبعت
  const selIds = () => all.filter((e) => sel.has(e.id)).map((e) => e.id);
  // منحضّر عميل جوجل من هلّق، حتى نافذة تسجيل الدخول تنفتح جوّا ضغطة «أرسل»
  if (linkPics(all.map((e) => e.id)).size && navigator.onLine) prepareDrive().catch(() => {});
  openSheet(null, (body, close) => {
    function picsRow() {
      if (how !== 'link') return null;
      const n = linkPics(selIds()).size;
      if (!n) return null;
      return h('div', { class: 'f-row' }, toggleRow({
        ic: 'image', title: `مع صور المواد والمحاضرات (${countText(n, ['صورة وحدة', 'صورتين', 'صور', 'صورة'])})`,
        sub: driveHasToken()
          ? 'الصور بتنحفظ بدرايفك بمجلّد «صور المشاركة»، وبيشوفها بس اللي معه الرابط.'
          : 'بتنحفظ بدرايفك (بتختار حساب جوجل أول مرة)، وبيشوفها بس اللي معه الرابط.',
        checked: withPics, onChange: (v) => { withPics = v; },
      }));
    }
    function render() {
      if (ready) {
        fill(body, [
          h('div', { class: 'am-title' },
            h('h3', null, icon('circle-check', 14), 'الرابط جاهز', h('button', { type: 'button', class: 'am-x', 'aria-label': 'إغلاق', onclick: () => close() }, icon('close', 16))),
            h('small', null, ready.failed ? `${countText(ready.failed, ['صورة وحدة', 'صورتين', 'صور', 'صورة'])} ما انرفعت — بتطلع مكانها أيقونة المادة` : 'الصور انرفعت. ابعته لرفقاتك.')),
          h('div', { class: 'am-sticky' },
            h('button', { type: 'button', class: 'btn secondary', onclick: () => copyUrl(ready.url).then(() => close()) }, icon('copy', 15), 'انسخ'),
            h('button', { type: 'button', class: 'btn', style: { flex: 1 }, onclick: () => sendUrl(ready.url, ready.t, ready.n).then(() => close()).catch(() => copyUrl(ready.url).then(() => close())) }, icon('paper-plane', 15), 'أرسل الرابط')),
        ]);
        return;
      }
      const label = progress ? (progress.total ? `عم نرفع الصور ${progress.done} من ${progress.total}…` : 'عم نجهّزها…') : busy ? 'عم نجهّزها…' : 'أرسل';
      fill(body, [
        h('div', { class: 'am-title' },
          h('h3', null, icon('share-nodes', 14), 'شارك المذاكرات', h('button', { type: 'button', class: 'am-x', 'aria-label': 'إغلاق', onclick: () => close() }, icon('close', 16))),
          h('small', null, 'رفقاتك بيشوفوا المواعيد والمحاضرات وروابط الـPDF — مش جاهزيتك ولا تقدّمك')),
        h('div', { class: 'f-row' }, h('label', { class: 'f-label' }, 'شو بدك تشارك؟'),
          h('div', { class: 'chips' }, all.map((e) => h('button', { type: 'button', class: 'chip small', 'aria-pressed': String(sel.has(e.id)), onclick: () => { if (sel.has(e.id)) sel.delete(e.id); else sel.add(e.id); render(); } },
            sel.has(e.id) ? icon('check', 11) : null, `${e.subjectName} ${parseISO(e.date).getDate()}`)))),
        h('div', { class: 'f-row' }, h('label', { class: 'f-label' }, 'العنوان اللي بيطلع فوق'),
          h('input', { type: 'text', value: title, oninput: (ev) => { title = ev.target.value; } })),
        h('div', { class: 'f-row' }, h('label', { class: 'f-label' }, 'كيف؟'),
          h('div', { class: 'sh-opts' }, [
            ['link', 'link', '#4cb8d4', 'رابط تفاعلي', 'بيفتح بأي متصفح — بيضغطوا على المذاكرة فبتطلع محاضراتها بصورها وروابط الـPDF'],
            ['image', 'image', '#e06a9e', 'صورة', 'للستوري والمجموعات — المذاكرات بنفس البطاقات'],
            ['file', 'file-code', '#e8c46a', 'ملف', 'نفس الصفحة التفاعلية مع صور المواد والمحاضرات — بيفتح بدون نت'],
          ].map(([k, ic, c, t, s]) => h('button', { type: 'button', class: `sh-o${how === k ? ' on' : ''}`, style: { '--c': c }, onclick: () => { how = k; render(); } },
            h('span', { class: 'sh-ic' }, icon(ic, 15)), h('span', null, h('b', null, t), h('small', null, s)), how === k ? icon('circle-check', 16) : null)))),
        picsRow(),
        h('div', { class: 'am-sticky' },
          h('button', { type: 'button', class: 'btn', style: { flex: 1 }, disabled: busy || !sel.size ? true : null, onclick: send }, icon('paper-plane', 15), label)),
      ]);
    }
    async function sendLink(ids, t) {
      let found = null, failed = 0;
      if (withPics && linkPics(ids).size) {
        if (!navigator.onLine) { toast('بدها نت لترفع الصور — طفّيت الصور، اضغط «أرسل» لتبعته بلاها.', { kind: 'warn' }); withPics = false; busy = false; render(); return; }
        {
          try {
            await driveSignIn();
            progress = { done: 0, total: 0 }; render();
            ({ found, failed } = await uploadLinkPics(ids, (done, total) => { progress = { done, total }; render(); }));
          } catch (err) {
            // ما زبط درايف: منطفي الصور ومنخلّيه يضغط «أرسل» مرة تانية إذا بدّه يبعته بلاها
            console.warn(err);
            const why = { popup_closed: 'انسكّرت نافذة جوجل', popup_failed_to_open: 'المتصفح منع نافذة جوجل', access_denied: 'انلغى تسجيل الدخول', denied: 'انلغى تسجيل الدخول', offline: 'ما في نت', expired: 'انتهى الإذن، جرّب كمان مرة' }[err?.message] || 'جرّب بعد شوي';
            toast(`ما انرفعت الصور (${why}). اضغط «أرسل» لتبعته بلا صور.`, { kind: 'warn' });
            withPics = false; progress = null; busy = false; render();
            return;
          }
        }
      }
      const url = await shareUrl(ids, t, found);
      if (url.length > LINK_SAFE) toast('الرابط طويل شوي — إذا ما انفتح عند رفقاتك ابعتلهم «ملف»', { kind: 'warn' });
      try {
        await sendUrl(url, t, ids.length); close();
        if (failed) toast(`${countText(failed, ['صورة وحدة', 'صورتين', 'صور', 'صورة'])} ما انرفعت — بتطلع مكانها أيقونة المادة`, { kind: 'warn' });
      } catch {
        // الرفع طوّل فراحت «ضغطتك» — منطلب ضغطة جديدة
        progress = null; ready = { url, t, n: ids.length, failed }; render();
      }
    }
    async function send() {
      if (busy || !sel.size) return;
      const t = (title || '').trim() || 'المذاكرات الجاية';
      try { localStorage.setItem(TITLE_KEY, t); } catch { /* */ }
      busy = true; render();
      const ids = selIds();
      try {
        if (how === 'link') { await sendLink(ids, t); return; }
        if (how === 'file') await shareFile(ids, t);
        else await shareImage(ids, t);
        close();
      } catch (err) { console.warn(err); toast('ما زبطت المشاركة — جرّب طريقة تانية.', { kind: 'warn' }); busy = false; progress = null; render(); }
    }
    render();
  }, { cls: 'task-form' });
}
