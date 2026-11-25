// الورد: نافذة الإنجاز اللي بتنفتح من صفحة المهام (لوين وصلت وقديش قرأت) — بس إنجاز.
// تخطيط الختمة (ختمة بعدد أيام، أو عدة ختمات بالشهر) صار بصفحة القرآن الكريم بالعبادات: khatmaPlanCard.
// إذا ما كمّلت، بكرة الباقي بيتوزّع على الأيام الباقية لحالو.
import { h, icon, fill, openSheet, toast, haptic, bar } from '../ui.js';
import { store } from '../store.js';
import { logicalToday } from '../prayer.js';
import { shortDate, WEEKDAYS, parseISO, addDays, daysBetween, daysText, pagesText } from '../dates.js';
import { wirdToday, readQuranTo, setKhatmaPlan, clearKhatmaPlan, khatmaDuration, quranPage } from '../worship.js';
import { TOTAL_PAGES, surahOfPage } from '../data/quran-meta.js';
import { openReader } from './worship.js';

const juz = (pages) => {
  const j = pages / 20;
  return j >= 1 ? `${+j.toFixed(1)} جزء` : pagesText(pages);
};
const dayName = (d) => `${WEEKDAYS[parseISO(d).getDay()]} ${shortDate(d)}`;

export function openKhatma(day = logicalToday()) {
  let unsub = null;
  openSheet('ورد اليوم', (body, close) => {
    function render() {
      const w = wirdToday(day);
      const p = w.plan;
      const pct = Math.min(1, w.read / Math.max(1, w.target));
      const left = Math.max(0, w.target - w.read);
      const rows = [];
      rows.push(h('div', { class: 'kh-card' },
        h('div', { class: 'kh-top' },
          p ? h('span', { class: 'pill good' }, icon('quran', 12), p.mode === 'month' ? `الختمة ${p.n || 1} من ${p.perMonth} هالشهر` : `ختمة بـ ${daysText(p.days)}`) : h('span', { class: 'pill' }, icon('quran', 12), 'ورد يومي'),
          p ? h('span', { class: 'muted' }, w.daysLeft > 1 ? `باقي ${daysText(w.daysLeft)}` : 'آخر يوم') : null),
        h('div', { class: 'kh-k' }, 'ورد اليوم'),
        h('div', { class: 'kh-range' }, `من ص ${w.from} إلى ص ${w.to}`),
        h('div', { class: 'muted' }, `${surahOfPage(w.from).name} ← ${surahOfPage(w.to).name} · ${juz(w.target)}`),
        h('div', { class: 'kh-prog' }, h('span', null, `قرأت ${w.read} من ${pagesText(w.target)}`), h('b', null, `${Math.round(pct * 100)}%`)),
        bar(pct, { cls: 'good big' }),
        h('div', { class: 'kh-acts' },
          h('button', { type: 'button', class: 'btn good', onclick: () => { close(); setTimeout(() => openReader(w.nowPage, day), 240); } }, icon('bookOpen', 15), `كمّل من ص ${w.nowPage}`),
          h('button', { type: 'button', class: 'btn secondary', onclick: () => askPage() }, icon('flag', 14), 'وصلت لصفحة…')),
        h('div', { class: 'kh-quick' }, [5, 10, 20].map((n) => h('button', { type: 'button', class: 'chip small', onclick: () => log(Math.min(TOTAL_PAGES, w.nowPage + n - 1)) }, `+${n} ${n <= 10 ? 'صفحات' : 'صفحة'}`)),
          left > 0 ? h('button', { type: 'button', class: 'chip small good-chip', onclick: () => log(w.to) }, icon('check', 11), 'خلّصت ورد اليوم') : null)));
      // التخطيط مش هون: رابط لصفحة القرآن الكريم بالعبادات
      rows.push(h('button', { type: 'button', class: 'kh-link', onclick: () => { close(); setTimeout(() => { location.hash = '#/tracks/quran'; }, 240); } },
        icon('sliders', 14), h('span', null, p ? 'خطة الختمة والورد اليومي' : 'ابدأ ختمة أو غيّر الورد اليومي', h('small', null, 'بصفحة القرآن الكريم بالعبادات')), icon('chevL', 12)));
      fill(body, rows);
    }
    function log(to) {
      const n = readQuranTo(day, to);
      if (n === -1) { toast('مبارك! ختمت القرآن الكريم', { kind: 'gold', duration: 6000 }); haptic('success'); }
      else if (n > 0) { toast(`سجّلنا ${n} صفحة`); haptic('success'); }
      render();
    }
    function askPage() {
      openSheet('وصلت لأي صفحة؟', (bd, cl) => {
        const inp = h('input', { type: 'number', placeholder: `بعد ص ${quranPage() - 1}`, 'data-autofocus': true });
        fill(bd, [h('p', { class: 'hint' }, `آخر صفحة قرأتها كانت ${quranPage() - 1}.`), inp,
          h('button', { type: 'button', class: 'btn block', onclick: () => { const v = Number(inp.value); if (!v || v < quranPage()) { toast('اكتب رقم صفحة بعد مكانك.', { kind: 'warn' }); return; } cl(); setTimeout(() => log(Math.min(TOTAL_PAGES, v)), 230); } }, 'سجّل')]);
      });
    }
    render();
    unsub = store.subscribe(() => { if (document.contains(body)) render(); });
  }, { onClose: () => unsub?.() });
}

/* ---------- خطة الختمة (بصفحة القرآن الكريم) ---------- */
export function khatmaPlanCard(day = logicalToday()) {
  const w = wirdToday(day);
  const p = w.plan;
  const wrap = h('div', null);
  if (p) {
    wrap.append(h('div', { class: 'kh-sum' },
      h('div', { class: 'kh-top' },
        h('span', { class: 'pill good' }, icon('quran', 12), p.mode === 'month' ? `الختمة ${p.n || 1} من ${p.perMonth} هالشهر` : `ختمة بـ ${daysText(p.days)}`),
        h('span', { class: 'muted' }, `الهدف ${dayName(p.end)}`)),
      h('div', { class: 'kh3' },
        h('div', null, h('b', { class: 'num' }, String(w.target)), h('small', null, `${w.target >= 3 && w.target <= 10 ? 'صفحات' : 'صفحة'} باليوم`)),
        h('div', null, h('b', null, w.daysLeft === 1 ? 'اليوم' : daysText(w.daysLeft)), h('small', null, w.daysLeft === 1 ? 'آخر يوم' : 'باقي')),
        h('div', null, h('b', null, w.eta ? `${WEEKDAYS[parseISO(w.eta).getDay()]}` : '—'), h('small', null, 'بتخلص على سرعتك'))),
      w.read < w.target && w.daysLeft > 1 ? h('p', { class: 'muted', style: { marginTop: '8px' } }, 'إذا ما كمّلت ورد اليوم، الباقي بيتوزّع على الأيام الجاية لحاله.') : null));
  }
  wrap.append(planForm(p, day));
  return wrap;
}
function planForm(p, day) {
      const f = { mode: p?.mode === 'month' ? 'month' : (p?.mode === 'days' && ![7].includes(p.days) ? 'custom' : 'days7'), days: p?.days || 10, perMonth: p?.perMonth || 4, fromStart: !p };
      const box = h('div', { class: 'kh-box' });
      function draw() {
        const dur = f.mode === 'month' ? khatmaDuration({ mode: 'month', perMonth: f.perMonth }) : f.mode === 'days7' ? 7 : f.days;
        const startPage = f.fromStart ? 1 : quranPage();
        const daily = Math.ceil((TOTAL_PAGES - startPage + 1) / dur);
        fill(box, [
          h('label', { class: 'f-label' }, 'بدّي أختم'),
          h('div', { class: 'seg' },
            h('button', { type: 'button', 'aria-pressed': String(f.mode === 'days7'), onclick: () => { f.mode = 'days7'; draw(); } }, 'ختمة بـ 7 أيام'),
            h('button', { type: 'button', 'aria-pressed': String(f.mode === 'month'), onclick: () => { f.mode = 'month'; draw(); } }, 'عدد ختمات بالشهر'),
            h('button', { type: 'button', 'aria-pressed': String(f.mode === 'custom'), onclick: () => { f.mode = 'custom'; draw(); } }, 'مدة بختارها')),
          f.mode === 'month' ? h('div', { class: 'chips', style: { marginBottom: '12px' } }, [1, 2, 3, 4].map((n) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(f.perMonth === n), onclick: () => { f.perMonth = n; draw(); } }, `${n} ${n === 1 ? 'ختمة' : 'ختمات'}`))) : null,
          f.mode === 'custom' ? h('div', { class: 'chips', style: { marginBottom: '12px' } }, [3, 5, 10, 14, 20, 30].map((n) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(f.days === n), onclick: () => { f.days = n; draw(); } }, daysText(n)))) : null,
          h('label', { class: 'f-label' }, 'ببلّش من'),
          h('div', { class: 'seg' },
            h('button', { type: 'button', 'aria-pressed': String(f.fromStart), onclick: () => { f.fromStart = true; draw(); } }, 'أول المصحف'),
            h('button', { type: 'button', 'aria-pressed': String(!f.fromStart), onclick: () => { f.fromStart = false; draw(); } }, `مكاني (ص ${quranPage()})`)),
          h('p', { class: 'muted' }, `= ${daily} صفحة باليوم تقريباً (${juz(daily)}) · بتطلع كمهمة ببعد الفجر`),
          h('button', { type: 'button', class: 'btn good block', onclick: () => {
            setKhatmaPlan({ mode: f.mode === 'month' ? 'month' : 'days', days: f.mode === 'days7' ? 7 : f.days, perMonth: f.perMonth, fromStart: f.fromStart }, day);
            toast('انحفظت خطة الختمة');
          } }, icon('check', 15), p ? 'غيّر الخطة' : 'ابدأ الختمة'),
          p ? h('button', { type: 'button', class: 'btn danger block', onclick: () => { clearKhatmaPlan(); toast('وقفت الخطة — رجعنا للورد اليومي'); } }, 'وقّف الخطة (رجوع للورد اليومي)') : null,
        ]);
      }
      draw();
      return box;
}
