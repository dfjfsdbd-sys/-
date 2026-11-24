// الأيقونات: Font Awesome الممتلئة، نفس أسلوب النسخة الأولى من التطبيق
// كل اسم داخلي بيقابله اسم من Font Awesome. أي اسم مش موجود هون منعتبره اسم Font Awesome مباشرة.
const FA = {
  // واجهة
  home: 'house', today: 'list-check', list: 'list-ul', listCheck: 'list-check', plan: 'chart-line', calendar: 'calendar',
  calCheck: 'calendar-check', calDays: 'calendar-days', calWeek: 'calendar-week', tracks: 'book', library: 'book', grid: 'table-cells-large',
  trophy: 'trophy', stats: 'chart-simple', routine: 'sitemap', plus: 'plus', minus: 'minus', close: 'xmark', chevR: 'chevron-right',
  chevL: 'chevron-left', chevD: 'chevron-down', chevU: 'chevron-up', arrowR: 'arrow-right', sliders: 'sliders', settings: 'gear',
  search: 'magnifying-glass', trash: 'trash', edit: 'pen', refresh: 'rotate', undo: 'rotate-left', check: 'check',
  checkCircle: 'circle-check', circle: 'circle', chart: 'chart-simple', trend: 'chart-line', target: 'bullseye',
  flag: 'flag', bell: 'bell', bellOff: 'bell-slash', clock: 'clock', alarm: 'clock', timer: 'stopwatch', repeat: 'repeat',
  inbox: 'inbox', info: 'circle-info', alert: 'triangle-exclamation', more: 'ellipsis', drag: 'grip-vertical',
  download: 'download', upload: 'upload', link: 'link', external: 'arrow-up-right-from-square', image: 'image',
  camera: 'camera', note: 'note-sticky', mic: 'microphone', send: 'paper-plane', sparkle: 'wand-magic-sparkles',
  star: 'star', shield: 'shield-halved', lock: 'lock', eye: 'eye', user: 'user', play: 'play', pause: 'pause',
  stop: 'stop', skip: 'forward-step', expand: 'expand', compress: 'compress', rotate: 'rotate', layers: 'layer-group', move: 'up-down-left-right',
  copy: 'copy', pin: 'location-dot', sun: 'sun', sunrise: 'cloud-sun', sunset: 'cloud-moon', moon: 'moon',
  cloud: 'cloud-arrow-up', flame: 'fire', bolt: 'bolt', gift: 'gift', heart: 'heart', medal: 'medal', coins: 'coins',
  route: 'route', eraser: 'eraser', wand: 'wand-magic-sparkles',
  // المسارات
  mosque: 'mosque', quran: 'book-quran', beads: 'hands-praying', hands: 'hands-praying', book: 'book', bookOpen: 'book-open',
  grad: 'graduation-cap', video: 'video', youtube: 'youtube', dumbbell: 'dumbbell', run: 'person-running',
  scale: 'weight-scale', apple: 'apple-whole', food: 'utensils', droplet: 'droplet', habit: 'compass', phone: 'mobile-screen',
  briefcase: 'briefcase', house: 'house', bag: 'bag-shopping', ring: 'ring', pill: 'pills', tooth: 'tooth', brain: 'brain',
  leaf: 'leaf', feather: 'feather', compass: 'compass', bulb: 'lightbulb', people: 'users', car: 'car', cart: 'cart-shopping',
  box: 'box', tag: 'tag', kaaba: 'kaaba', wifiOff: 'wifi', spa: 'spa', clapper: 'clapperboard', mug: 'mug-hot', pen: 'pen',
  microscope: 'microscope', flask: 'flask', fire: 'fire', seedling: 'seedling',
};
const BRANDS = new Set(['youtube', 'google']);
const REGULAR = new Set(['circle']);

export const ICONS = FA;

export function icon(name, size = 22, { fill } = {}) {
  const fa = FA[name] || (/^[a-z0-9-]+$/.test(String(name || '')) ? name : 'tag');
  const el = document.createElement('i');
  let style = 'fa-solid';
  if (BRANDS.has(fa)) style = 'fa-brands';
  else if (REGULAR.has(name) || (name === 'star' && fill === 'none')) style = 'fa-regular';
  el.className = `${style} fa-${fa} icon`;
  el.setAttribute('aria-hidden', 'true');
  el.style.fontSize = `${Math.max(9, Math.round(size * 0.7))}px`;
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  return el;
}

// ألوان التصنيفات من النسخة الأولى
export const TINTS = {
  dawn: '#4cb8d4',   // لون التطبيق
  sky: '#4a9ee0',    // دراسة
  mint: '#35b791',   // عبادات
  sage: '#7bc39a',   // استراحة
  gold: '#e8c46a',   // نقاط ومكافآت
  amber: '#e0a04a',  // شغل
  coral: '#e0705f',  // رياضة
  rose: '#e06a9e',   // سلاسل
  violet: '#a682e8', // فقه النفس
  blue: '#3f7cc4',
  brown: '#c08a4e',  // كتب
  slate: '#8a8a99',  // عامة
};
export const TINT_KEYS = Object.keys(TINTS);
// الألوان القديمة كانت hex أو متغيّرات CSS؛ نقبل الاثنين
const VARS = { '--cat-god': '#35b791', '--cat-study': '#4a9ee0', '--cat-series': '#a682e8', '--cat-sport': '#e0705f', '--cat-work': '#e0a04a', '--cat-break': '#7bc39a', '--cat-book': '#c08a4e', '--cat-newseries': '#e06a9e', '--accent-color': '#4cb8d4' };
export const tintHex = (key) => {
  if (!key) return TINTS.slate;
  if (TINTS[key]) return TINTS[key];
  if (/^#[0-9a-f]{3,8}$/i.test(key)) return key;
  const m = String(key).match(/var\((--[a-z-]+)\)/);
  if (m && VARS[m[1]]) return VARS[m[1]];
  return TINTS.slate;
};

export const ITEM_ICON_CHOICES = [
  'book', 'bookOpen', 'grad', 'quran', 'mosque', 'beads', 'spa', 'video', 'clapper', 'brain', 'microscope', 'flask', 'tooth', 'pill',
  'dumbbell', 'run', 'scale', 'apple', 'heart', 'star', 'leaf', 'feather', 'compass', 'bulb', 'shield', 'phone',
  'ring', 'house', 'briefcase', 'people', 'kaaba', 'flame', 'sun', 'moon', 'target', 'trophy',
];

// مربّع ملوّن فيه أيقونة، أو صورة إن وُجدت
export function badge(name, tint = 'slate', size = 40, image = null) {
  const el = document.createElement('span');
  el.className = image ? 'badge has-img' : 'badge';
  el.style.setProperty('--tint', tintHex(tint));
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.setAttribute('aria-hidden', 'true');
  if (image) {
    const img = document.createElement('img');
    img.src = image; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
    el.append(img);
  } else {
    el.append(icon(name || 'tag', Math.round(size * 0.62)));
  }
  return el;
}
