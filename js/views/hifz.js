// شاشة الحفظ: الجديد اليوم، والمراجعة القريبة والبعيدة بتقييم بعد التسميع، وخريطة الأجزاء، وخطتك
import { h, icon, fill, openSheet, toast, haptic, openPicker } from '../ui.js';
import { store } from '../store.js';
import { logicalToday } from '../prayer.js';
import { daysText, pagesText } from '../dates.js';
import { SURAHS } from '../data/quran-meta.js';
import {
  AMOUNTS, ORDERS, WORK_MODES, hifzPlan, hifzToday, hifzStats, pagesLabel, rateNew, rateReview, undoRate,
  setHifzPlan, clearHifzPlan, markMemorized, unmarkPages, juzPages, surahPages, migrateLegacyHifz, isWorkDay,
} from '../hifz.js';
import { openReader, fetchPage } from './worship.js';
import { RECITERS, audioCfg, portionAyahs, createPlayer, saveOffline, isSaved } from '../qaudio.js';
import { secTitle } from './components.js';

const RATES = [['good', 'متقن', 'g'], ['mid', 'فيه أخطاء', 'a'], ['redo', 'بدّه إعادة', 'r']];
const RATE_NAME = { good: 'متقن', mid: 'فيه أخطاء', redo: 'بدّه إعادة' };

function rateRow(current, onRate, onUndo) {
  if (current) return h('div', { class: 'hz-rated' }, icon('check', 12), h('span', null, `سمّعت — ${RATE_NAME[current]}`), h('button', { type: 'button', class: 'link-btn', onclick: onUndo }, 'تراجع'));
  return h('div', { class: 'hz-rate' }, RATES.map(([k, l, c]) => h('button', { type: 'button', class: c, onclick: () => { haptic(k === 'good' ? 'success' : 'select'); onRate(k); } }, l)));
}

export function renderHifz(ctx) {
  migrateLegacyHifz();
  const today = ctx.today;
  const plan = hifzPlan();
  const st = hifzStats(today);
  if (!plan) {
    return h('div', null,
      h('div', { class: 'hz-hero intro' },
        h('span', { class: 'hz-ic' }, icon('quran', 26)),
        h('b', null, 'خطة حفظ يومية'),
        h('p', null, 'بتحدد قدّيش بدك تحفظ كل يوم (ربع صفحة، نص، صفحة…) ومن وين. والتطبيق كل يوم بيطلعلك: الجديد، ومراجعة قريبة لآخر اللي حفظته، ومراجعة بعيدة بتدور على القديم — والضعيف بيرجعلك أبكر.'),
        h('button', { type: 'button', class: 'btn block', onclick: () => openPlan() }, icon('sliders', 15), 'اعمل خطتك'),
        h('button', { type: 'button', class: 'btn secondary block', style: { marginTop: '8px' }, onclick: () => openOld() }, icon('check-double', 15), 'سجّل اللي حافظه من قبل')),
      st.pages ? [secTitle('الأجزاء', { ic: 'grid', count: `${+st.juzCount.toFixed(1)} جزء` }), juzMap(st)] : null);
  }
  const t = hifzToday(today);
  const work = isWorkDay(today);
  const root = h('div', null);
  // الجديد
  if (t.log.new) {
    const lb = pagesLabel(t.log.new.pages);
    root.append(h('div', { class: 'hz-hero done' },
      h('div', { class: 'hz-top' }, h('span', { class: 'pill good' }, icon('check', 10), 'الجديد اليوم خلص'), h('small', null, lb.range)),
      h('div', { class: 'hz-ay' }, `سورة ${lb.names}`),
      rateRow(t.log.new.rate, null, () => undoRate(today, 'new'))));
  } else if (t.portion) {
    const lb = pagesLabel(t.portion.pages);
    root.append(h('div', { class: 'hz-hero' },
      h('div', { class: 'hz-top' }, h('span', { class: 'pill good' }, 'الجديد اليوم'), h('small', null, `${AMOUNTS[t.plan.amount] || ''}${work && t.plan.work === 'half' ? ' (نص — يوم شغل)' : ''} · ${lb.range}`)),
      h('div', { class: 'hz-ay' }, `سورة ${lb.names}`),
      t.portion.of > 1 ? h('p', { class: 'hz-sub' }, `${t.portion.label} من الصفحة`) : null,
      h('div', { class: 'hz-btns' },
        h('button', { type: 'button', class: 'btn', onclick: () => openListen(t.portion) }, icon('headphones', 15), 'استمع وردّد'),
        h('button', { type: 'button', class: 'btn secondary', onclick: () => openReader(t.portion.pages[0], today) }, icon('bookOpen', 15), 'المصحف')),
      h('p', { class: 'hz-q' }, 'بعد ما تحفظ وتسمّع، شلون كان؟'),
      rateRow(null, (r) => { rateNew(today, t.portion, r); if (r === 'redo') toast('ولا يهمك — بتعيده بكرة'); else toast('الله يثبّته — +10'); }, null)));
  } else {
    root.append(h('div', { class: 'hz-hero rest' },
      h('span', { class: 'hz-ic' }, icon(work ? 'briefcase' : 'check', 20)),
      h('b', null, work && t.plan.work === 'review' ? 'يوم شغل — مراجعة بس' : 'ما في جديد اليوم'),
      h('p', null, work && t.plan.work === 'review' ? 'بأيام الشغل خطتك مراجعة بس. ثبّت اللي حفظته.' : 'خلصت خطتك — الله يتقبّل. غيّر نقطة البداية من الخطة إذا بدك تكمّل.')));
  }
  // المراجعة
  root.append(secTitle('المراجعة اليوم', { ic: 'rotate-left', count: [t.near.length && !t.log.near, t.far.length && !t.log.far].filter(Boolean).length || null }));
  const rev = h('div', { class: 'hz-revs' });
  const revRow = (key, title, ic, c, pages, cur) => {
    if (!pages.length) return null;
    const lb = pagesLabel(pages);
    return h('div', { class: 'hz-row', style: { '--c': c } },
      h('div', { class: 'hz-rh' },
        h('button', { type: 'button', class: 'hz-ric', 'aria-label': 'افتح المصحف', onclick: () => openReader(pages[0], today) }, icon(ic, 14)),
        h('span', { class: 'hz-rin' }, h('b', null, title), h('small', null, `${lb.names} · ${lb.range}`)),
        h('button', { type: 'button', class: 'hz-ear', 'aria-label': 'استمع', onclick: () => openListen({ pages, part: 1, of: 1 }) }, icon('headphones', 13))),
      rateRow(cur, (r) => rateReview(today, key, pages, r), () => undoRate(today, key)));
  };
  const nr = revRow('near', `القريبة: ${t.near.length === 1 ? 'آخر صفحة' : `آخر ${t.near.length} صفحات`}`, 'rotate-left', '#e0a04a', t.near, t.log.near?.rate);
  const fr = revRow('far', 'البعيدة: دور على القديم', 'clock-rotate-left', '#6F86D9', t.far, t.log.far?.rate);
  if (nr) rev.append(nr);
  if (fr) rev.append(fr);
  if (!nr && !fr) rev.append(h('p', { class: 'section-note' }, st.pages ? 'ما في مراجعة مستحقة اليوم — ممتاز.' : 'لما تحفظ أول صفحة بتبلّش المراجعة.'));
  root.append(rev);
  // الأجزاء
  root.append(secTitle('الأجزاء', { ic: 'grid', count: st.pages ? `${+st.juzCount.toFixed(1)} جزء · ${st.pages} صفحة` : null }), juzMap(st));
  // الخطة
  root.append(secTitle('خطتك', { ic: 'sliders', action: h('button', { type: 'button', class: 'link-btn', onclick: () => openPlan() }, icon('pen', 12), 'عدّل') }),
    h('div', { class: 'group rows' },
      h('div', { class: 'row' }, h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, 'المقدار اليومي')), h('b', { class: 'hz-v' }, AMOUNTS[t.plan.amount])),
      h('div', { class: 'row' }, h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, 'الترتيب'), h('span', { class: 'row-sub' }, `من صفحة ${t.plan.start}`)), h('b', { class: 'hz-v' }, t.plan.order === 'forward' ? 'لقدّام' : 'للخلف')),
      store.state.settings.shift?.enabled ? h('div', { class: 'row' }, h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, 'بأيام الشغل')), h('b', { class: 'hz-v' }, WORK_MODES[t.plan.work])) : null,
      st.eta ? h('div', { class: 'row-note' }, `باقي ${pagesText(st.eta.left)} من الجزء ${st.eta.juz} — بهالمعدّل بتخلصه بشي ${daysText(st.eta.days)} إن شاء الله.`) : null),
    h('button', { type: 'button', class: 'link-btn', style: { margin: '10px 16px 0' }, onclick: () => openOld() }, icon('check-double', 13), 'سجّل أو شيل محفوظ قديم'));
  return root;
}
export function hifzActions() { return h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'الخطة', onclick: () => openPlan() }, icon('sliders', 19)); }

/* ---------- استمع وردّد ---------- */
const AR_NUM = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
function openListen(portion) {
  let player = null;
  openSheet(null, (body, close) => {
    fill(body, [h('div', { class: 'ql-load' }, icon('spinner', 18), 'عم نجيب الآيات…')]);
    (async () => {
      let ayahs = [];
      try { for (const p of portion.pages) ayahs.push(...(await fetchPage(p))); } catch {
        fill(body, [h('div', { class: 'ql-load' }, icon('wifi', 18), 'بدها نت أول مرة — بعدها النص بيضل محفوظ.'), h('button', { type: 'button', class: 'btn block', onclick: () => close() }, 'تمام')]);
        return;
      }
      ayahs = portionAyahs(ayahs, portion.part || 1, portion.of || 1);
      if (!ayahs.length) { close(); return; }
      let st = null, saving = null, saved = false;
      const draw = () => {
        const s = st || player.state();
        const c = s.cfg;
        fill(body, [
          h('div', { class: 'am-title' }, h('h3', null, icon('headphones', 14), 'استمع وردّد', h('button', { type: 'button', class: 'am-x', 'aria-label': 'إغلاق', onclick: () => close() }, icon('close', 16))),
            h('small', null, `${pagesLabel(portion.pages).names} · ${portion.of > 1 ? `${['', 'النص الأول', 'النص التاني'][portion.part] || `الجزء ${portion.part}`} من ` : ''}${pagesLabel(portion.pages).range}`)),
          h('div', { class: 'ql-text' }, ayahs.map((a, k) => [h('span', { class: k === s.i ? 'cur' : '', onclick: () => { player.jump(k - s.i); } }, a.t), h('em', null, ` ﴿${AR_NUM(a.n)}﴾ `)])),
          h('div', { class: 'ql-prog' }, h('i', { style: { width: `${Math.round(((s.i + (s.rep - 1) / c.perAyah) / s.total) * 100)}%` } })),
          h('div', { class: 'ql-st' }, h('span', null, `الآية ${s.i + 1} من ${s.total} · المرة ${s.rep} من ${c.perAyah}`), h('span', null, s.echo ? 'ردّد هلّق…' : `الدورة ${s.loop} من ${c.loops}`)),
          s.error ? h('p', { class: 'ql-err' }, 'ما زبط الصوت — يا ما في نت، يا جرّب قارئ تاني.') : null,
          s.finished ? h('p', { class: 'ql-ok' }, 'خلصت الدورات — سمّع لحالك هلّق.') : null,
          h('div', { class: 'ql-ctrl' },
            h('button', { type: 'button', 'aria-label': 'الآية اللي قبل', onclick: () => player.jump(-1) }, icon('forward-step', 16)),
            h('button', { type: 'button', class: 'pl', 'aria-label': s.playing ? 'وقّف' : 'شغّل', onclick: () => player.toggle() }, icon(s.playing ? 'pause' : 'play', 20)),
            h('button', { type: 'button', 'aria-label': 'الآية اللي بعد', onclick: () => player.jump(1) }, icon('backward-step', 16))),
          h('div', { class: 'ql-opts' },
            h('div', null, h('small', null, 'القارئ'), h('div', { class: 'chips' }, Object.entries(RECITERS).map(([k, l]) => h('button', { type: 'button', class: 'chip small', 'aria-pressed': String(c.reciter === k), onclick: () => { player.setCfg({ reciter: k }); saved = false; } }, l)))),
            h('div', null, h('small', null, 'كل آية'), h('div', { class: 'chips' }, [1, 3, 5].map((n) => h('button', { type: 'button', class: 'chip small', 'aria-pressed': String(c.perAyah === n), onclick: () => player.setCfg({ perAyah: n }) }, n === 1 ? 'مرة' : `${n} مرات`)))),
            h('div', null, h('small', null, 'المقطع كله'), h('div', { class: 'chips' }, [1, 3, 5].map((n) => h('button', { type: 'button', class: 'chip small', 'aria-pressed': String(c.loops === n), onclick: () => player.setCfg({ loops: n }) }, n === 1 ? 'مرة' : `${n} مرات`)))),
            h('div', null, h('small', null, 'الترديد والسرعة'), h('div', { class: 'chips' },
              h('button', { type: 'button', class: 'chip small', 'aria-pressed': String(Boolean(c.echo)), onclick: () => player.setCfg({ echo: !c.echo }) }, 'وضع الترديد'),
              [0.75, 1].map((v) => h('button', { type: 'button', class: 'chip small', 'aria-pressed': String((c.speed || 1) === v), onclick: () => player.setCfg({ speed: v }) }, v === 1 ? 'عادي' : 'أبطأ'))))),
          h('button', { type: 'button', class: 'btn secondary block', disabled: saving || saved ? true : null, onclick: async () => {
            saving = `0/${ayahs.length}`; draw();
            try { await saveOffline(c.reciter, ayahs, (d, n) => { saving = `${d}/${n}`; draw(); }); saved = true; toast('انحفظ الصوت — بيشتغل بلا نت'); } catch { toast('ما قدرنا نحفظه — بدها نت.', { kind: 'warn' }); }
            saving = null; draw();
          } }, icon(saved ? 'check' : 'download', 14), saved ? 'الصوت محفوظ عالجهاز' : saving ? `عم نحفظ… ${saving}` : 'احفظ الصوت عالجهاز'),
        ]);
      };
      player = createPlayer(ayahs, (s) => { st = s; draw(); });
      saved = await isSaved(audioCfg().reciter, ayahs);
      draw();
    })();
  }, { tall: true, cls: 'ql-sheet', onClose: () => player?.destroy() });
}

function juzMap(st) {
  return h('div', { class: 'group hz-map' },
    h('div', { class: 'hz-juz' }, st.juz.map((j) => h('i', { class: j.st, title: `الجزء ${j.j}: ${j.n} من ${j.len}` }, h('b', { class: 'num' }, String(j.j)), j.n && j.n < j.len && j.st !== 'n' ? h('em', { style: { width: `${Math.round((j.n / j.len) * 100)}%` } }) : null))),
    h('div', { class: 'lg3' },
      h('span', null, h('i', { style: { background: 'rgba(53,183,145,.6)' } }), 'متين'),
      h('span', null, h('i', { style: { background: 'rgba(224,160,74,.55)' } }), 'بدّه مراجعة'),
      h('span', null, h('i', { style: { background: 'rgba(76,184,212,.4)' } }), 'عم تحفظ فيه'),
      h('span', null, h('i', { style: { background: 'var(--s3)' } }), 'لسّا')));
}

function openPlan() {
  const cur = hifzPlan();
  const d = cur ? { ...cur } : { amount: 0.5, order: 'back', start: 604, work: 'review', near: 5 };
  openSheet('خطة الحفظ', (body, close) => {
    function render() {
      fill(body, [
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'كل يوم بحفظ'),
          h('div', { class: 'chips' }, Object.entries(AMOUNTS).map(([v, l]) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(Number(v) === d.amount), onclick: () => { d.amount = Number(v); render(); } }, l)))),
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'الترتيب'),
          h('div', { class: 'seg' }, Object.entries(ORDERS).map(([v, l]) => h('button', { type: 'button', 'aria-pressed': String(d.order === v), onclick: () => { d.order = v; d.start = v === 'forward' ? 1 : 604; render(); } }, l.split(' (')[0])))),
        h('button', { type: 'button', class: 'select-btn', onclick: () => openPicker({ title: 'من أي سورة تبلّش؟', value: null, options: SURAHS.map((x) => ({ value: x.n, label: `${x.n}. ${x.name}`, sub: `صفحة ${x.page}` })), onPick: (v) => { const s = SURAHS[v - 1]; d.start = d.order === 'forward' ? s.page : surahPages(v).slice(-1)[0]; render(); } }) },
          icon('quran', 16), h('span', { class: 'sb-val' }, `البداية: صفحة ${d.start} — سورة ${pagesLabel([d.start]).names}`), icon('chevD', 16)),
        store.state.settings.shift?.enabled ? h('div', { class: 'field', style: { marginTop: '12px' } }, h('span', { class: 'field-label' }, 'بأيام الشغل'),
          h('div', { class: 'chips' }, Object.entries(WORK_MODES).map(([v, l]) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(d.work === v), onclick: () => { d.work = v; render(); } }, l)))) : null,
        h('div', { class: 'field', style: { marginTop: '12px' } }, h('span', { class: 'field-label' }, 'المراجعة القريبة: آخر كم صفحة؟'),
          h('div', { class: 'chips' }, [3, 5, 7, 10].map((n) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(d.near === n), onclick: () => { d.near = n; render(); } }, String(n))))),
        h('button', { type: 'button', class: 'btn block', onclick: () => { setHifzPlan(d); close(); toast(cur ? 'انحفظت الخطة' : 'بلّشت خطة الحفظ — الله يفتح عليك'); } }, icon('check', 15), cur ? 'احفظ' : 'بلّش'),
        cur ? h('button', { type: 'button', class: 'btn danger block', onclick: () => { clearHifzPlan(); close(); toast('وقّفت الخطة — محفوظك ضل محفوظ'); } }, 'وقّف الخطة') : null,
      ]);
    }
    render();
  });
}

// «حافظه من قبل»: أجزاء أو سورة
function openOld() {
  openSheet('محفوظك القديم', (body, close) => {
    let sel = new Set();
    let surah = null;
    function render() {
      const memo = store.state.quran.memo || {};
      fill(body, [
        h('p', { class: 'hint' }, 'علّم الأجزاء أو السور اللي حافظها من قبل — بتدخل بالمراجعة البعيدة وبتطلع بخريطة الأجزاء.'),
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'أجزاء'),
          h('div', { class: 'chips hz-jchips' }, Array.from({ length: 30 }, (_, i) => 30 - i).map((j) => {
            const has = juzPages(j).every((p) => memo[p]);
            return h('button', { type: 'button', class: `chip small${has ? ' has' : ''}`, 'aria-pressed': String(sel.has(j)), onclick: () => { if (sel.has(j)) sel.delete(j); else sel.add(j); render(); } }, String(j));
          }))),
        h('button', { type: 'button', class: 'select-btn', onclick: () => openPicker({ title: 'سورة', value: surah, options: SURAHS.map((x) => ({ value: x.n, label: `${x.n}. ${x.name}`, sub: `صفحة ${x.page}` })), onPick: (v) => { surah = v; render(); } }) },
          icon('quran', 16), h('span', { class: surah ? 'sb-val' : 'sb-val ph' }, surah ? `سورة ${SURAHS[surah - 1].name}` : 'أو سورة لحالها'), icon('chevD', 16)),
        h('div', { class: 'two', style: { marginTop: '14px' } },
          h('button', { type: 'button', class: 'btn', onclick: () => {
            const pages = [...sel].flatMap(juzPages).concat(surah ? surahPages(surah) : []);
            if (!pages.length) { toast('اختار جزء أو سورة.', { kind: 'warn' }); return; }
            markMemorized(pages); close(); toast(`انسجلت ${pages.length} صفحة محفوظة`);
          } }, icon('check', 15), 'حافظها'),
          h('button', { type: 'button', class: 'btn secondary', onclick: () => {
            const pages = [...sel].flatMap(juzPages).concat(surah ? surahPages(surah) : []);
            if (!pages.length) { toast('اختار جزء أو سورة.', { kind: 'warn' }); return; }
            unmarkPages(pages); close(); toast('انشالت من المحفوظ');
          } }, 'شيلها')),
      ]);
    }
    render();
  });
}
