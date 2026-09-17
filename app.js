/* Committee Website — frontend (V4)
 *
 * Data field names, response shape, and the Google Drive image pipeline
 * (driveId / img / originalImageUrl / imageFallback) are unchanged from
 * V3.1 on purpose — existing Sheets and Drive links keep working with no
 * edits needed.
 *
 * What's new: theme (light/dark) with localStorage + system preference,
 * a real mobile menu, active-page highlighting, hash-based navigation
 * (so pages are bookmarkable/shareable without a full reload), lazy image
 * loading, and leadership lookup by Position instead of row order.
 */

let DATA = { settings: [], mainCommittee: [], subCommittee: [], slideshow: [], gallery: [], notices: [], transactions: [] };
let si = 0;
const $ = x => document.getElementById(x);
const setting = (k, d = '') => { const x = DATA.settings.find(r => r.Setting === k); return x ? x.Value : d; };

const PRESIDENT_LABEL = 'সভাপতি';
const SECRETARY_LABELS = ['সাধারণ সম্পাদক', 'সম্পাদক'];

function pickLeader(list, wantedLabels, exclude) {
  const hit = list.find(x => !exclude.includes(x) && wantedLabels.includes(String(x.Position || '').trim()));
  if (hit) return hit;
  return list.find(x => !exclude.includes(x)) || {};
}

/* ---------- Google Drive image handling (unchanged from V3.1) ---------- */
function driveId(u) {
  const s = String(u || '');
  let m = s.match(/\/d\/([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  m = s.match(/[?&]id=([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  return '';
}
function img(u, size = 'w1600') {
  if (!u) return '';
  const id = driveId(u);
  if (id) return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=' + size;
  return String(u);
}
function originalImageUrl(u) {
  const id = driveId(u);
  return id ? 'https://drive.google.com/uc?export=view&id=' + encodeURIComponent(id) : String(u || '');
}
function imageFallback(el) {
  if (!el) return;
  const original = el.dataset.original || '';
  const stage = Number(el.dataset.fallbackStage || 0);
  if (stage === 0 && original) {
    el.dataset.fallbackStage = '1';
    el.src = originalImageUrl(original);
    return;
  }
  el.dataset.fallbackStage = '2';
  el.src = ph(el.dataset.fallbackText || 'ছবি দেখা যাচ্ছে না');
  el.classList.add('image-error');
}
function setImage(el, u, text) {
  el.dataset.original = String(u || '');
  el.dataset.fallbackText = text;
  el.dataset.fallbackStage = '0';
  el.loading = 'lazy';
  el.alt = text;
  el.src = img(u) || ph(text);
  el.onerror = () => imageFallback(el);
}

/* ---------- small helpers ---------- */
function esc(x) { return String(x ?? '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])); }
function money(x) { return '৳' + (Number(String(x || '').replace(/,/g, '')) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function ph(t) {
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750"><rect width="100%" height="100%" fill="#245641"/>' +
    '<text x="50%" y="50%" fill="white" text-anchor="middle" font-size="30">' + t + '</text></svg>');
}

/* ---------- theme ---------- */
function initTheme() {
  const btn = $('themeToggle');
  const apply = mode => {
    document.documentElement.setAttribute('data-theme', mode);
    btn.textContent = mode === 'dark' ? '☀️' : '🌙';
  };
  let saved = null;
  try { saved = localStorage.getItem('theme'); } catch (e) {}
  const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  apply(saved || (systemDark ? 'dark' : 'light'));
  btn.onclick = () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    apply(next);
    try { localStorage.setItem('theme', next); } catch (e) {}
  };
}

/* ---------- mobile menu ---------- */
function initMenu() {
  const menuBtn = $('menuBtn');
  const nav = $('nav');
  menuBtn.onclick = () => {
    const open = nav.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    menuBtn.textContent = open ? '×' : '☰';
  };
}
function closeMenu() {
  $('nav').classList.remove('open');
  $('menuBtn').setAttribute('aria-expanded', 'false');
  $('menuBtn').textContent = '☰';
}

/* ---------- skeleton (first-ever visit only — no cache to paint from yet) ---------- */
function showSkeleton() {
  ['siteName', 'address', 'mainPresidentName', 'mainPresidentRole', 'mainSecretaryName', 'mainSecretaryRole',
    'subPresidentName', 'subPresidentRole', 'subSecretaryName', 'subSecretaryRole', 'income', 'expense', 'balance']
    .forEach(id => $(id).classList.add('skel'));
  ['mainPresident', 'mainSecretary', 'subPresident', 'subSecretary'].forEach(id => $(id).classList.add('skel-block'));
  $('slides').innerHTML = '<div class="skel-block" style="width:100%;height:100%"></div>';
  $('mainMembers').innerHTML = skeletonCards(4, '4/5');
  $('subMembers').innerHTML = skeletonCards(3, '4/5');
  $('galleryGrid').innerHTML = skeletonCards(6, '3/2');
  $('noticeList').innerHTML = '<div class="skel-block" style="height:56px;margin-bottom:10px"></div><div class="skel-block" style="height:56px"></div>';
}
function skeletonCards(n, ratio) {
  return Array.from({ length: n }).map(() => `<div class="skel-block" style="aspect-ratio:${ratio}"></div>`).join('');
}

/* ---------- boot ---------- */
// Instant repeat visits: paint from the last-known data cached in this
// browser (no network wait) while a fresh copy loads quietly in the
// background. First-ever visit still waits for the real fetch.
async function init() {
  initTheme();
  initMenu();
  window.addEventListener('hashchange', routeFromHash);

  let cached = null;
  try {
    const raw = localStorage.getItem('site_data_cache');
    if (raw) cached = JSON.parse(raw);
  } catch (e) {}

  if (cached) {
    DATA = cached;
    render();
    routeFromHash();
  } else {
    showSkeleton();
  }

  try {
    if (!API_URL.includes('PASTE_')) {
      DATA = await fetch(API_URL).then(r => r.json());
      try { localStorage.setItem('site_data_cache', JSON.stringify(DATA)); } catch (e) {}
    } else if (!cached) {
      demo();
    } else {
      return; // demo mode + already showed cached data — nothing new to paint
    }
  } catch (e) {
    if (cached) return; // fetch failed but we already showed last-known data
    demo();
    render();
    routeFromHash();
    $('noticeList').innerHTML = '<div class="empty-state">তথ্য লোড করা যায়নি — একটু পরে আবার চেষ্টা করুন।</div>';
    return;
  }

  render();
  routeFromHash();
}

function demo() {
  DATA.settings = [
    { Setting: 'Website Name', Value: 'গ্রাম উন্নয়ন মাঠ কমিটি' },
    { Setting: 'Committee Name', Value: 'গ্রাম উন্নয়ন মাঠ কমিটি' },
    { Setting: 'Address', Value: 'ধামরাই, ঢাকা' },
    { Setting: 'About Text', Value: 'কমিটির সংক্ষিপ্ত পরিচিতি এখানে লিখুন।' },
    { Setting: 'Footer Text', Value: '© গ্রাম উন্নয়ন মাঠ কমিটি' }
  ];
  DATA.mainCommittee = [
    { Order: '1', Name: 'ডেমো সভাপতি', Position: 'সভাপতি', Photo: '' },
    { Order: '2', Name: 'ডেমো সদস্য', Position: 'সহ-সভাপতি', Photo: '' },
    { Order: '3', Name: 'ডেমো সদস্য', Position: 'সাধারণ সম্পাদক', Photo: '' }
  ];
  DATA.subCommittee = [
    { Order: '1', Name: 'ডেমো সভাপতি', Position: 'সভাপতি', Photo: '' },
    { Order: '2', Name: 'ডেমো সম্পাদক', Position: 'সাধারণ সম্পাদক', Photo: '' },
    { Order: '3', Name: 'ডেমো সদস্য', Position: 'সদস্য', Photo: '' }
  ];
  DATA.slideshow = [
    { Image: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1600&q=80', Caption: 'কমিটির কার্যক্রম (ডেমো ছবি)' },
    { Image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1600&q=80', Caption: 'সামাজিক কার্যক্রম (ডেমো ছবি)' }
  ];
  DATA.gallery = DATA.slideshow.map(x => x);
  DATA.notices = [
    { Date: '15-09-2026', Notice: 'এটি সর্বশেষ ডেমো নোটিশ — Google Sheet থেকে পরিবর্তন করুন।' },
    { Date: '01-08-2026', Notice: 'এটি পুরনো ডেমো নোটিশ।' }
  ];
  DATA.transactions = [
    { Date: '2026-01-10', Description: 'অনুদান', Category: 'অনুদান', Income: '50000', Expense: '', Comment: 'ডেমো', Voucher: '' },
    { Date: '2026-02-02', Description: 'মাঠ রক্ষণাবেক্ষণ', Category: 'রক্ষণাবেক্ষণ', Income: '', Expense: '12000', Comment: 'ডেমো', Voucher: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80' }
  ];
}

/* ---------- render ---------- */
function render() {
  $('siteName').textContent = setting('Website Name', setting('Committee Name', 'কমিটি'));
  $('siteName').classList.remove('skel');
  $('address').textContent = setting('Address');
  $('address').classList.remove('skel');
  $('footer').textContent = setting('Footer Text', '© কমিটি');

  const logoUrl = setting('Logo URL') || setting('Logo');
  if (logoUrl && !String(logoUrl).includes('PASTE_')) {
    setImage($('logo'), logoUrl, 'লোগো');
    $('logo').style.display = 'block';
  } else {
    $('logo').style.display = 'none';
  }

  nav();
  pres();
  slides();
  members();
  gallery();
  notices();
  tx();
  dashYearOptions();
  $('aboutText').textContent = setting('About Text') || 'শীঘ্রই তথ্য যুক্ত করা হবে।';
}

function nav() {
  const items = [
    ['home', 'হোম'], ['about', 'আমাদের সম্পর্কে'], ['committee', 'কমিটি'],
    ['gallery', 'গ্যালারি'], ['finance', 'হিসাব'], ['statement', 'স্টেটমেন্ট']
  ];
  $('nav').innerHTML = items.map(x => `<button type="button" data-page="${x[0]}" onclick="goPage('${x[0]}')">${x[1]}</button>`).join('');
}

function goPage(id) {
  location.hash = '#' + id;
}

function routeFromHash() {
  const valid = ['home', 'about', 'committee', 'gallery', 'finance', 'statement'];
  const id = valid.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
  page(id);
}

function page(id) {
  document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
  const target = $(id);
  if (target) target.classList.add('active');
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.page === id));
  closeMenu();
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function pres() {
  const mainPresident = pickLeader(DATA.mainCommittee, [PRESIDENT_LABEL], []);
  const mainSecretary = pickLeader(DATA.mainCommittee, SECRETARY_LABELS, [mainPresident]);
  const subPresident = pickLeader(DATA.subCommittee, [PRESIDENT_LABEL], []);
  const subSecretary = pickLeader(DATA.subCommittee, SECRETARY_LABELS, [subPresident]);
  setLeader('mainPresident', mainPresident);
  setLeader('mainSecretary', mainSecretary);
  setLeader('subPresident', subPresident);
  setLeader('subSecretary', subSecretary);
}
function setLeader(prefix, x) {
  const photo = x['Photo URL'] || x.Photo || '';
  setImage($(prefix), photo, x.Position || 'সদস্য');
  $(prefix).classList.remove('skel-block');
  $(prefix + 'Name').textContent = x.Name || '';
  $(prefix + 'Name').classList.remove('skel');
  $(prefix + 'Role').textContent = x.Position || '';
  $(prefix + 'Role').classList.remove('skel');
}

function slides() {
  const s = DATA.slideshow.filter(x => x['Image URL'] || x.Image);
  if (!s.length) {
    $('slides').innerHTML = '<div class="slider-empty">কোনো স্লাইড যোগ করা হয়নি</div>';
    $('dots').innerHTML = '';
    return;
  }
  $('slides').innerHTML = s.map(x => {
    const photo = x['Image URL'] || x.Image || '';
    return `<div class="slide">
      <img src="${esc(img(photo))}" data-original="${esc(photo)}" data-fallback-text="স্লাইড ছবি"
           onerror="imageFallback(this)" alt="${esc(x.Caption || 'স্লাইড ছবি')}" loading="lazy">
      <div class="caption">${esc(x.Caption)}</div>
    </div>`;
  }).join('');
  $('dots').innerHTML = s.map((_, i) => `<button type="button" class="${i ? '' : 'on'}" aria-label="স্লাইড ${i + 1}" onclick="goToSlide(${i})"></button>`).join('');
  si = 0;
}
function currentSlides() { return DATA.slideshow.filter(x => x['Image URL'] || x.Image); }
function moveSlide(n) {
  const s = currentSlides();
  if (!s.length) return;
  si = (si + n + s.length) % s.length;
  applySlide();
}
function goToSlide(i) { si = i; applySlide(); }
function applySlide() {
  $('slides').style.transform = `translateX(-${si * 100}%)`;
  document.querySelectorAll('#dots button').forEach((x, i) => x.classList.toggle('on', i === si));
}
setInterval(() => moveSlide(1), 5000);

function memberCard(x) {
  const photo = x['Photo URL'] || x.Photo || '';
  return `<article class="member-card">
    <div class="photo-wrap">
      <img data-original="${esc(photo)}" data-fallback-text="সদস্য" onerror="imageFallback(this)" loading="lazy">
      ${x.Position ? `<span class="tag">${esc(x.Position)}</span>` : ''}
    </div>
    <div class="info"><h4>${esc(x.Name)}</h4>${x.Phone ? `<p>${esc(x.Phone)}</p>` : ''}</div>
  </article>`;
}
function members() {
  const fill = (containerId, list) => {
    const el = $(containerId);
    if (!list.length) { el.innerHTML = '<div class="empty-state">এখনো কোনো সদস্য যোগ করা হয়নি</div>'; return; }
    el.innerHTML = list.map(memberCard).join('');
    el.querySelectorAll('img[data-original]').forEach(img => setImage(img, img.dataset.original, img.dataset.fallbackText));
  };
  fill('mainMembers', DATA.mainCommittee);
  fill('subMembers', DATA.subCommittee);
}

function gallery() {
  const items = DATA.gallery.filter(x => x['Image URL'] || x.Image);
  const el = $('galleryGrid');
  if (!items.length) { el.innerHTML = '<div class="empty-state">এখনো কোনো ছবি যোগ করা হয়নি</div>'; return; }
  el.innerHTML = items.map(x => {
    const photo = x['Image URL'] || x.Image || '';
    return `<article class="gallery-card">
      <img data-original="${esc(photo)}" data-fallback-text="গ্যালারি ছবি" onerror="imageFallback(this)" loading="lazy" onclick="openLightbox(this.src, this.alt)">
      <p>${esc(x.Caption)}</p>
    </article>`;
  }).join('');
  el.querySelectorAll('img[data-original]').forEach(img => setImage(img, img.dataset.original, img.dataset.fallbackText));
}

function openLightbox(src, alt) {
  $('lightboxImg').src = src;
  $('lightboxImg').alt = alt || '';
  $('lightbox').classList.add('show');
}
function openVoucher(u) {
  const e = $('lightboxImg');
  e.dataset.original = u;
  e.dataset.fallbackText = 'ভাউচার দেখা যাচ্ছে না';
  e.dataset.fallbackStage = '0';
  e.alt = 'ভাউচার';
  e.onerror = () => imageFallback(e);
  e.src = img(u, 'w2000');
  $('lightbox').classList.add('show');
}
function closeLightbox() { $('lightbox').classList.remove('show'); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

function parseFlexDate(s) {
  s = String(s || '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
  m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]).getTime();
  const t = Date.parse(s);
  return isNaN(t) ? null : t;
}
function sortedNotices() {
  return DATA.notices
    .map((x, i) => ({ x, i, t: parseFlexDate(x.Date) }))
    .sort((a, b) => (a.t != null && b.t != null) ? b.t - a.t : (a.t != null ? -1 : (b.t != null ? 1 : b.i - a.i)))
    .map(w => w.x);
}
function notices() {
  const list = sortedNotices().filter(x => x.Notice || x.Date);
  const el = $('noticeList');
  el.innerHTML = list.length
    ? list.map(x => `<div class="notice"><b>${esc(x.Date)}</b><br>${esc(x.Notice)}</div>`).join('')
    : '<div class="empty-state">কোনো নোটিশ নেই</div>';

  const ticker = $('noticeTicker');
  const latest = list.find(x => x.Notice);
  if (latest) {
    $('tickerText').textContent = latest.Notice;
    $('tickerText').style.animationDuration = Math.max(12, Math.min(30, String(latest.Notice).length / 6)) + 's';
    ticker.style.display = 'flex';
  } else {
    ticker.style.display = 'none';
  }
}

function tx() {
  const years = [...new Set(DATA.transactions.map(x => String(x.Date).slice(0, 4)))].filter(Boolean).sort().reverse();
  $('yearFilter').innerHTML = '<option value="">সব বছর</option>' + years.map(y => `<option>${y}</option>`).join('');
  $('search').oninput = draw;
  $('yearFilter').onchange = draw;
  draw();
}
function draw() {
  const q = $('search').value.toLowerCase();
  const y = $('yearFilter').value;
  const rows = DATA.transactions.filter(x => (!y || String(x.Date).startsWith(y)) &&
    (!q || [x.Description, x.Category, x.Comment].join(' ').toLowerCase().includes(q)));
  const body = $('txBody');
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="7"><div class="empty-state">কোনো লেনদেন পাওয়া যায়নি</div></td></tr>`;
    return;
  }
  body.innerHTML = rows.map(x => `<tr>
    <td>${esc(x.Date)}</td><td>${esc(x.Description)}</td><td>${esc(x.Category)}</td>
    <td>${x.Income ? money(x.Income) : ''}</td><td>${x.Expense ? money(x.Expense) : ''}</td>
    <td>${esc(x.Comment)}</td>
    <td>${x.Voucher ? `<button class="voucher-btn" type="button" onclick="openVoucher('${esc(x.Voucher)}')">📄 দেখুন</button>` : ''}</td>
  </tr>`).join('');
}

function dashYearOptions() {
  const txYears = [...new Set(DATA.transactions.map(x => String(x.Date).slice(0, 4)))].filter(Boolean);
  const nowYear = String(new Date().getFullYear());
  const years = [...new Set([nowYear, ...txYears])].sort().reverse();
  const sel = $('dashYear');
  sel.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
  sel.value = years.includes(nowYear) ? nowYear : years[0];
  sel.onchange = dash;
  dash();
}
function dash() {
  const y = $('dashYear').value || String(new Date().getFullYear());
  const r = DATA.transactions.filter(x => String(x.Date).startsWith(y));
  const inc = r.reduce((s, x) => s + (Number(x.Income) || 0), 0);
  const exp = r.reduce((s, x) => s + (Number(x.Expense) || 0), 0);
  $('income').textContent = money(inc);
  $('income').classList.remove('skel');
  $('expense').textContent = money(exp);
  $('expense').classList.remove('skel');
  $('balance').textContent = money(inc - exp);
  $('balance').classList.remove('skel');

  const expSeg = $('expenseSeg');
  const remSeg = $('remainingSeg');
  if (inc <= 0) {
    expSeg.style.width = '0%';
    remSeg.style.width = '100%';
    remSeg.classList.add('empty');
    $('expensePct').textContent = '—';
    $('remainingPct').textContent = 'কোনো আয় নেই';
  } else if (exp > inc) {
    expSeg.style.width = '100%';
    remSeg.style.width = '0%';
    remSeg.classList.remove('empty');
    $('expensePct').textContent = Math.round(exp / inc * 100) + '%';
    $('remainingPct').textContent = 'ঘাটতি ' + money(exp - inc);
  } else {
    const expPct = Math.round(exp / inc * 100);
    expSeg.style.width = expPct + '%';
    remSeg.style.width = (100 - expPct) + '%';
    remSeg.classList.remove('empty');
    $('expensePct').textContent = expPct + '%';
    $('remainingPct').textContent = (100 - expPct) + '%';
  }
}

async function makeStatement() {
  if (API_URL.includes('PASTE_')) { $('status').textContent = 'প্রথমে config.js-এ Apps Script URL দিন।'; return; }
  const from = $('from').value, to = $('to').value, password = $('password').value;
  if (!from || !to) { $('status').textContent = 'শুরু ও শেষ তারিখ দিন।'; return; }
  $('status').textContent = 'তৈরি হচ্ছে...';
  try {
    const r = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'statement', payload: { from, to, password } })
    }).then(x => x.json());
    if (r.error) throw new Error(r.error);
    const a = document.createElement('a');
    a.href = 'data:application/pdf;base64,' + r.data;
    a.download = r.name;
    a.click();
    $('status').textContent = 'PDF প্রস্তুত হয়েছে।';
  } catch (e) {
    $('status').textContent = e.message;
  }
}

init();
