/* Portée : portée radio sur relief, bâtiments et forêt (données swisstopo). Tout est calculé sur l'appareil. */
(() => {
'use strict';

/* ================= outils ================= */
const $ = id => document.getElementById(id);
const h = (tag, o, ...kids) => {
  const e = document.createElement(tag);
  if (o) for (const k in o) {
    const v = o[k];
    if (v == null || v === false) continue;
    if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
};
const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  layers: '<path d="M12 4 3 9l9 5 9-5z"/><path d="m3 14 9 5 9-5"/>',
  locate: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
  down: '<path d="m7 10 5 5 5-5"/>',
  up: '<path d="m7 14 5-5 5 5"/>',
  right: '<path d="m10 7 5 5-5 5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  trash: '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.5" cy="6.5" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="17.5" r="1" fill="currentColor"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
  antenna: '<path d="M12 10v11M8.5 21h7"/><circle cx="12" cy="8" r="1.6"/><path d="M8.6 4.6a5 5 0 0 0 0 6.8M15.4 4.6a5 5 0 0 1 0 6.8M6 2.5a8.5 8.5 0 0 0 0 11M18 2.5a8.5 8.5 0 0 1 0 11"/>',
  profile: '<path d="M3 19l5-8 4 5 3-4 6 7z"/><path d="M3 6.5h18" stroke-dasharray="2 2.5"/>',
  target: '<circle cx="12" cy="12" r="7"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.6" r="1" fill="currentColor"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11"/><path d="M5 15.5V4.5h11"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  dup: '<rect x="8.5" y="8.5" width="11" height="11"/><path d="M5 15.5V4.5h11"/>',
  pen: '<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z"/><path d="M14.5 6.5l3 3"/>',
  share: '<path d="M12 3.5v11M8 7l4-3.5L16 7"/><path d="M7 10.5H5.5v10h13v-10H17"/>',
  file: '<path d="M6.5 3.5h7.5l4 4v13h-11.5z"/><path d="M14 3.5v4h4"/>',
  down2: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14"/>',
  cloud: '<path d="M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4 1.6A3.8 3.8 0 0 1 17.5 18.5z"/><path d="M12 11v5M9.8 13.8 12 16l2.2-2.2"/>',
  gauge: '<path d="M4.5 16a7.5 7.5 0 1 1 15 0"/><path d="M12 16l4-5"/>',
  relay: '<path d="M5 21v-9M19 21v-9M3 21h4M17 21h4"/><circle cx="5" cy="10" r="1.6"/><circle cx="19" cy="10" r="1.6"/><path d="M7.6 8.2c2.6-3.2 6.2-3.2 8.8 0" stroke-dasharray="2.2 2.4"/>',
};
const icon = n => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;
const iEl = n => h('i', { 'data-i': n, html: icon(n) });
document.querySelectorAll('i[data-i]').forEach(el => { el.innerHTML = icon(el.dataset.i); });

const fr = (v, dec = 1) => (v == null || !isFinite(v) ? '-' : v.toFixed(dec).replace('.', ',').replace('-', '−'));
const sgn = (v, dec = 1) => (v >= 0 ? '+' : '') + fr(v, dec);
const grp = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
const dBm = w => 10 * Math.log10(w * 1000);
const wTxt = w => (w < 1 ? fr(w, 1) : fr(w, 0)) + ' W';
const uid = () => Math.random().toString(36).slice(2, 9);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (s, def) => { const v = parseFloat(String(s).replace(',', '.').replace(/[’'\s]/g, '')); return isFinite(v) ? v : def; };

function toLV95(lat, lng) {
  const p = (lat * 3600 - 169028.66) / 10000, l = (lng * 3600 - 26782.5) / 10000;
  return [2600072.37 + 211455.93 * l - 10938.51 * l * p - 0.36 * l * p * p - 44.54 * l * l * l,
          1200147.07 + 308807.95 * p + 3745.25 * l * l + 76.63 * p * p - 194.56 * l * l * p + 119.79 * p * p * p];
}
function fromLV95(E, N) {
  const y = (E - 2600000) / 1e6, x = (N - 1200000) / 1e6;
  const l = 2.6779094 + 4.728982 * y + 0.791484 * y * x + 0.1306 * y * x * x - 0.0436 * y * y * y;
  const p = 16.9023892 + 3.238272 * x - 0.270978 * y * y - 0.002528 * x * x - 0.0447 * y * y * x - 0.0140 * x * x * x;
  return [p * 100 / 36, l * 100 / 36];
}
const lvTxt = (lat, lon) => { const [E, N] = toLV95(lat, lon); return grp(E) + ' / ' + grp(N); };

/* ================= catalogues ================= */
/* Matériel du règlement 58.430 « Système radio SE-235 » (2003) : SE-235/t portable 0,5 ou 5 W, SE-235/m avec amplificateur
   LV-235 jusqu'à 50 W, 30 à 88 MHz ; antennes MA-235, HA-235, téléantennes FA-235 et antenne de véhicule FzA-235 (ch. 95 à 98).
   Gains efficaces et seuil de réception étalonnés sur le tableau des portées du ch. 43 (Plateau, 80 % des emplacements,
   mode FHOP) : outil tools/etalonnage.js. Ils incluent câbles et montage.
   SE-135 : règlement 58.440 « Système radio SE-135 » : 0,2 ou 2 W, 30 à 87,975 MHz, portée d'environ 5 km à 2 W avec
   l'antenne fouet MA-135 déployée (ch. 1.4, 2.2.4, 3.2), compatible SE-235. Gain MA-135 étalonné sur ces 5 km ;
   WA-135 (antenne hélicoïdale, « pas de longues portées ») et câble HF du ZA-135 (20 m au plus) : estimations. */
const RADIOS = {
  se235t: { n: 'SE-235 portable', sub: 'SE-235/t : 0,5 ou 5 W', pw: [0.5, 5], d: 5, ant: 'MA', band: [30, 88], fam: '235' },
  se235m: { n: 'SE-235 véhicule', sub: 'SE-235/m avec amplificateur LV-235 : 0,5, 5 ou 50 W', pw: [0.5, 5, 50], d: 50, ant: 'FAm', band: [30, 88], fam: '235' },
  se135: { n: 'SE-135', sub: 'Portable léger : 0,2 ou 2 W, portée d\'environ 5 km à 2 W avec la MA-135 (règlement 58.440)', pw: [0.2, 2], d: 2, ant: 'MA135', band: [30, 88], fam: '135' },
  autre: { n: 'Autre poste', pw: null, d: 5, ant: 'FzA', band: null },
};
const ANTS = {
  MA: { n: 'MA-235', l: 'Antenne fouet, sur le poste porté (1,3 m)', g: -3.0, h: 1.8, tab: 0, fam: '235' },
  HA: { n: 'HA-235', l: 'Antenne extérieure, 2,9 m', g: -0.9, h: 2.5, tab: 1, fam: '235' },
  FAt: { n: 'FA-235/t', l: 'Téléantenne portable, mât PU-4 de 7,6 m', g: 0, h: 6, tab: 2, fam: '235' },
  FAm: { n: 'FA-235/m', l: 'Téléantenne de véhicule, mât Geroh de 9,3 m', g: -3.0, h: 7.8, tab: 3, fam: '235' },
  FAm8: { n: 'FA-235/m8', l: 'Téléantenne de véhicule, mât PU-8 de 11,3 m', g: -2.8, h: 9.8, tab: 4, fam: '235' },
  FzA: { n: 'FzA-235', l: 'Antenne de véhicule (dipôle sur le véhicule)', g: -3.0, h: 3, tab: 5, fam: '235' },
  dir: { n: 'Directive', l: 'Antenne directive (autre matériel)', g: 6, h: 8, dir: true },
  MA135: { n: 'MA-135', l: 'Antenne fouet du SE-135, verticale et déployée', g: -2.1, h: 1.5, fam: '135' },
  ZA135: { n: 'ZA-135', l: 'Fouet MA-135 sur piquet, à 20 m au plus du poste (câble HF compris, estimation)', g: -4.1, h: 1.5, fam: '135' },
  WA135: { n: 'WA-135', l: 'Antenne hélicoïdale courte, pour équipage de char (estimation)', g: -12.1, h: 1.5, fam: '135' },
};
const SENS = -102;
/* portées du règlement (km) : 5 W pour MA, HA et FA-235/t, 50 W pour FA-235/m, FA-235/m8 et FzA-235 */
const TAB_RANGE = [[6, 7, 8, 9, 10, 6], [7, 8, 9, 10, 11, 7], [8, 9, 12, 13, 14, 10], [9, 10, 13, 22, 23, 15], [10, 11, 14, 23, 24, 16], [6, 7, 10, 15, 16, 11]];
const TAB_PW = [5, 5, 5, 50, 50, 50];
function refRange(a, b) {
  const A = ANTS[a.ant], B = ANTS[b.ant];
  if (a.ant === 'MA135' && b.ant === 'MA135') return { km: 5, std: a.pw === 2 && b.pw === 2, reg: '58.440' };
  if (!A || !B || A.tab == null || B.tab == null) return null;
  return { km: TAB_RANGE[A.tab][B.tab], std: a.pw === TAB_PW[A.tab] && b.pw === TAB_PW[B.tab] };
}
/* stations relais du règlement (ch. 137 et 138) : deux SE-235 reliés par câble relais */
const RELAYS = {
  m2: { n: 'SE-235/m2', l: 'Relais de véhicule : LV-235 50 W et 5 W, deux FA-235/m', a: { radio: 'se235m', pw: 50, ant: 'FAm' }, b: { radio: 'se235m', pw: 5, ant: 'FAm' } },
  tFA: { n: 'SE-235/t, FA', l: 'Relais portable : deux postes 5 W, deux FA-235/t', a: { radio: 'se235t', pw: 5, ant: 'FAt' }, b: { radio: 'se235t', pw: 5, ant: 'FAt' } },
  tHA: { n: 'SE-235/t, HA', l: 'Relais portable : deux postes 5 W, deux HA-235', a: { radio: 'se235t', pw: 5, ant: 'HA' }, b: { radio: 'se235t', pw: 5, ant: 'HA' } },
};
const sideOf = (o, k) => { const A = ANTS[o.ant]; return Object.assign({ radio: o.radio, pw: o.pw, ant: o.ant, h: A.h, g: A.g, lc: 0, sens: SENS }); };
const relayPreset = k => { const P = RELAYS[k] || RELAYS.m2; return { preset: k, a: sideOf(P.a), b: sideOf(P.b) }; };
const COLORS = ['#0A84FF', '#FF9F0A', '#BF5AF2', '#FF375F', '#64D2FF', '#FFD60A', '#5E5CE6', '#AC8E68'];
/* fonds swisstopo, comme dans Calque */
const CHB = L.latLngBounds([45.35, 5.3], [48.25, 11.2]);
const BASES = {
  map: { url: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg', max: 18, tag: 'Carte nationale' },
  grey: { url: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-grau/default/current/3857/{z}/{x}/{y}.jpeg', max: 18, tag: 'Carte grise' },
  photo: { url: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg', max: 19, tag: 'Photo aérienne' },
};
const DEF_PARAMS = () => ({
  dir: 'both', r: 10, prec: 'norm', buildings: true, forest: true, forestDb: 6, fade: 10, k: 4 / 3, corr: 0,
  c: { radio: 'se235t', pw: 5, ant: 'MA', h: 1.8, g: -3, lc: 0, sens: SENS },
  relay: relayPreset('m2'), access: true, tracks: true,
  net: { on: false, main: null, need: 'bonne' },
});

/* ================= données ================= */
const KEY = 'portee.v1';
let store;
try { store = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { store = null; }
if (!store || !Array.isArray(store.studies) || !store.studies.length) {
  store = { studies: [{ id: uid(), name: 'Étude 1', stations: [], params: DEF_PARAMS() }], cur: null, prefs: { base: 'grey', op: 0.6, show: true, circles: true } };
  store.cur = store.studies[0].id;
}
store.prefs = Object.assign({ base: 'map', op: 0.6, show: true, circles: true, links: true, detail: 1 }, store.prefs || {});
/* le fond par défaut devient celui de Calque (carte nationale), sauf choix déjà fait */
if (!store.prefs.baseSet) { store.prefs.base = 'map'; store.prefs.baseSet = true; }
for (const s of store.studies) s.params = Object.assign(DEF_PARAMS(), s.params || {}, { c: Object.assign(DEF_PARAMS().c, (s.params || {}).c || {}) });
/* reprise des études enregistrées avant le catalogue du règlement 58.430 */
const OLD_ANT = { marche: 'MA', haute: 'HA', veh: 'FzA', mat: 'FAm' }, OLD_RADIO = { se235p: 'se235t', se235v: 'se235m' };
function migrateRadio(o) {
  if (!o) return;
  if (OLD_RADIO[o.radio]) o.radio = OLD_RADIO[o.radio];
  if (OLD_ANT[o.ant]) { const k = OLD_ANT[o.ant]; if (o.ant === 'mat' && o.h === 10) o.h = ANTS[k].h; o.ant = k; o.g = ANTS[k].g; }
  if (o.sens === -113) o.sens = SENS;
  /* SE-135 provisoire (1 W, MA-235) : valeurs du règlement 58.440 */
  if (o.radio === 'se135') {
    if (o.pw !== 0.2 && o.pw !== 2) o.pw = 2;
    if (!ANTS[o.ant] || ANTS[o.ant].fam !== '135') { o.ant = 'MA135'; o.g = ANTS.MA135.g; o.h = ANTS.MA135.h; }
  }
}
for (const st of store.studies) {
  st.stations.forEach(x => { migrateRadio(x); if (x.b) migrateRadio(x.b); });
  migrateRadio(st.params.c);
  if (!st.params.relay || !st.params.relay.a) st.params.relay = relayPreset('m2');
  if (!Array.isArray(st.obs)) st.obs = [];
}
const study = () => store.studies.find(s => s.id === store.cur) || store.studies[0];
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} };

/* ================= carte ================= */
const st0 = study().stations[0];
const map = L.map('map', { zoomControl: false, attributionControl: false, minZoom: 7, maxZoom: 20, zoomSnap: 1,
  maxBounds: CHB, maxBoundsViscosity: 0.8, boxZoom: false })
  .setView(st0 ? [st0.lat, st0.lon] : (store.view ? store.view.c : [46.8, 8.2]), st0 ? 12 : (store.view ? store.view.z : 8));
let baseLayer = null;
const detail = () => (store.prefs.detail === 0 ? 0 : 1);
function setBase(k) {
  const b = BASES[k] || BASES.map, dz = detail();
  store.prefs.base = BASES[k] ? k : 'map';
  if (baseLayer) map.removeLayer(baseLayer);
  /* détail +1 (comme Calque) : chaque case de 128 px reçoit la tuile du niveau de zoom suivant, carte plus fine et plus nette */
  baseLayer = L.tileLayer(b.url, { crossOrigin: 'anonymous', tileSize: 256 >> dz, zoomOffset: dz, maxNativeZoom: b.max - dz, maxZoom: 20, minZoom: 7, bounds: CHB, keepBuffer: 3, referrerPolicy: 'no-referrer' }).addTo(map);
  const tag = $('baseTag');
  tag.textContent = b.tag; tag.classList.add('flash'); setTimeout(() => tag.classList.remove('flash'), 1200);
  save();
}
setBase(store.prefs.base);
const coordEl = $('coord');
function showCoord() {
  const c = map.getCenter();
  coordEl.innerHTML = '<small>MN95</small>' + lvTxt(c.lat, c.lng);
  store.view = { c: [c.lat, c.lng], z: map.getZoom() };
}
map.on('move', showCoord); map.on('moveend', save); showCoord();

/* ================= toast, tiroirs ================= */
const toastEl = $('toast');
let toastT = 0;
function toast(msg, ms) {
  clearTimeout(toastT);
  toastEl.textContent = msg; toastEl.hidden = true; void toastEl.offsetWidth; toastEl.hidden = false;
  toastT = setTimeout(() => { toastEl.hidden = true; }, ms || Math.min(5000, Math.max(2200, 900 + msg.length * 50)));
}
const sheet = $('sheet'), scrim = $('scrim');
const sHandle = h('div', { class: 'shandle' }), sBody = h('div', { class: 'sbody' });
sheet.append(sHandle, sBody);
let onSheetClose = null;
function openSheet(title, body, onClose, large) {
  if (onSheetClose) { const f = onSheetClose; onSheetClose = null; f(); }
  const x = h('button', { type: 'button', class: 'xbtn', 'aria-label': 'Fermer', html: icon('close'), onclick: closeSheet });
  sHandle.replaceChildren(h('div', { class: 'grab' }), h('div', { class: 'shead' }, h('h2', { text: title }), x));
  sBody.replaceChildren(...[body].flat());
  sBody.scrollTop = 0;
  sheet.style.removeProperty('--dy');
  if (large) sheet.dataset.d = 'large'; else delete sheet.dataset.d;
  sheet.setAttribute('aria-label', title);
  sheet.classList.add('open'); scrim.classList.add('on');
  onSheetClose = onClose || null;
}
function closeSheet() {
  if (!sheet.classList.contains('open')) return;
  sheet.classList.remove('open', 'dragging'); scrim.classList.remove('on'); sheet.style.removeProperty('--dy');
  if (document.activeElement && sheet.contains(document.activeElement)) document.activeElement.blur();
  if (onSheetClose) { const f = onSheetClose; onSheetClose = null; f(); }
}
scrim.addEventListener('click', closeSheet);
/* glisser la poignée vers le bas pour fermer */
function dragClose(handle, panel, close) {
  let y0 = null, dy = 0;
  handle.addEventListener('pointerdown', e => { if (e.target.closest('button,input')) return; y0 = e.clientY; dy = 0; panel.classList.add('dragging'); handle.setPointerCapture(e.pointerId); });
  handle.addEventListener('pointermove', e => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); panel.style.setProperty('--dy', dy + 'px'); });
  const end = () => { if (y0 == null) return; y0 = null; panel.classList.remove('dragging'); if (dy > 80) close(); else panel.style.removeProperty('--dy'); };
  handle.addEventListener('pointerup', end); handle.addEventListener('pointercancel', end);
}
dragClose(sHandle, sheet, closeSheet);
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (sheet.classList.contains('open')) closeSheet(); else closeEdit(); } });

/* contrôles */
function seg(opts, val, fn) {
  const box = h('div', { class: 'seg', role: 'group' });
  const draw = v => box.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === String(v))));
  for (const [v, t] of opts) box.append(h('button', { type: 'button', 'data-v': String(v), text: t, onclick: () => { draw(v); fn(v); } }));
  draw(val);
  return box;
}
function chips(opts, val, fn, wrap) {
  const box = h('div', { class: 'chips' + (wrap ? ' wrap' : '') });
  const draw = v => box.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === String(v))));
  for (const [v, t] of opts) box.append(h('button', { type: 'button', class: 'chip', 'data-v': String(v), text: t, onclick: () => { draw(v); fn(v); } }));
  draw(val);
  return box;
}
function swRow(title, sub, val, fn) {
  const b = h('button', { type: 'button', class: 'sw', 'aria-pressed': String(!!val), 'aria-label': title });
  b.addEventListener('click', () => { const v = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(v)); fn(v); });
  return h('div', { class: 'line' }, h('span', null, title, sub ? h('small', { text: sub }) : null), b);
}
function numField(val, fn, o = {}) {
  const f = h('input', { class: 'field num', type: 'text', inputmode: o.int ? 'numeric' : 'decimal', value: fr(val, o.dec != null ? o.dec : 1).replace('−', '-'), 'aria-label': o.label || '' });
  f.addEventListener('focus', () => f.select());
  f.addEventListener('change', () => {
    let v = num(f.value, val);
    if (o.min != null) v = Math.max(o.min, v);
    if (o.max != null) v = Math.min(o.max, v);
    f.value = fr(v, o.dec != null ? o.dec : 1).replace('−', '-'); val = v; fn(v);
  });
  return f;
}
function numLine(title, sub, val, unit, fn, o) {
  return h('div', { class: 'line' }, h('span', null, title, sub ? h('small', { text: sub }) : null), numField(val, fn, Object.assign({ label: title }, o)), h('span', { class: 'unit', text: unit }));
}
function stepper(val, step, min, max, unit, fn) {
  const f = numField(val, v => { val = v; fn(v); }, { min, max, label: 'Hauteur' });
  const mk = (n, d) => h('button', { type: 'button', class: 'iconbtn', 'aria-label': d > 0 ? 'Plus' : 'Moins', html: icon(n), onclick: () => {
    val = clamp(Math.round((val + d) * 10) / 10, min, max); f.value = fr(val, 1); fn(val);
  } });
  return h('div', { class: 'step' }, mk('minus', -step), f, mk('plus', step), h('span', { class: 'unit', text: unit }));
}

/* ================= stations sur la carte ================= */
const markers = new Map();
let selId = null;
const colorOf = i => COLORS[i % COLORS.length];
function stIcon(s, i, sel) {
  const c = colorOf(i);
  const svg = `<svg width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="${c}" stroke="#fff" stroke-width="2.5"/>
    <g fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M18 16v11M14.5 27h7"/><path d="M13.6 10.6a6.2 6.2 0 0 0 0 8.8M22.4 10.6a6.2 6.2 0 0 1 0 8.8"/></g>
    <circle cx="18" cy="15" r="2" fill="#fff"/>${s.ant === 'dir' ? `<path d="M18 18 L18 1" stroke="#fff" stroke-width="2.4" stroke-linecap="round" transform="rotate(${s.az || 0} 18 18)"/>` : ''}</svg>`;
  const off = netActive && netActive[i] === false;
  return L.divIcon({ className: 'stn' + (sel ? ' sel' : '') + (off ? ' off' : ''), html: svg + `<b>${esc(s.name)}</b>`, iconSize: [36, 36], iconAnchor: [18, 18] });
}
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function drawStations() {
  const S = study().stations;
  for (const [id, m] of markers) if (!S.find(s => s.id === id)) { map.removeLayer(m.mk); if (m.ci) map.removeLayer(m.ci); markers.delete(id); }
  S.forEach((s, i) => {
    let m = markers.get(s.id);
    if (!m) {
      const mk = L.marker([s.lat, s.lon], { draggable: true, autoPan: true, keyboard: false, zIndexOffset: 500 }).addTo(map);
      mk.on('click', () => openEdit(s.id));
      mk.on('drag', () => {
        const st = study().stations.find(x => x.id === s.id); if (!st) return;
        const p = mk.getLatLng(); st.lat = p.lat; st.lon = p.lng;
        const mm = markers.get(s.id); if (mm && mm.ci) mm.ci.setLatLngs(ringPts(p.lat, p.lng, study().params.r * 1000));
        dragPreview(st);
      });
      mk.on('dragend', () => { const st = study().stations.find(x => x.id === s.id); if (!st) return; const p = mk.getLatLng(); st.lat = p.lat; st.lon = p.lng; st.alt = null; pv.st = null; changed(); if (selId === st.id) openEdit(st.id); });
      m = { mk, ci: null }; markers.set(s.id, m);
    }
    m.mk.setLatLng([s.lat, s.lon]);
    m.mk.setIcon(stIcon(s, i, selId === s.id));
    const r = study().params.r * 1000;
    if (store.prefs.circles) {
      if (!m.ci) m.ci = L.polyline(ringPts(s.lat, s.lon, r), { color: colorOf(i), weight: 1.5, dashArray: '5 6', interactive: false }).addTo(map);
      else m.ci.setLatLngs(ringPts(s.lat, s.lon, r));
      m.ci.setStyle({ color: colorOf(i) });
    } else if (m.ci) { map.removeLayer(m.ci); m.ci = null; }
  });
}

/* cercle de portée en polyligne : Leaflet n'en dessine que la partie visible, même très zoomé */
function ringPts(lat, lon, r) {
  const pts = [], c = Math.cos(lat * Math.PI / 180), dl = r / 111320;
  for (let a = 0; a <= 360; a += 2) { const t = a * Math.PI / 180; pts.push([lat + dl * Math.cos(t), lon + dl * Math.sin(t) / c]); }
  return pts;
}

/* ================= éditeur de station (tiroir non modal) ================= */
const editEl = $('edit');
function closeEdit() {
  if (editEl.hidden) return;
  editEl.hidden = true; document.body.classList.remove('editing');
  const was = selId; selId = null;
  if (was) drawStations();
}
function radioFields(o, onChange, withFreq, opt = {}) {
  /* o : station, côté de relais ou poste en face (radio, pw, ant, h, g, lc, sens [, f, az, bw]) */
  const box = h('div', { style: 'display:flex;flex-direction:column;gap:12px' });
  const draw = () => {
    const R = RADIOS[o.radio] || RADIOS.autre, A = ANTS[o.ant] || ANTS.FzA;
    const kids = [];
    if (opt.title) kids.push(h('div', { class: 'grp', text: opt.title }));
    kids.push(h('div', { class: 'label', text: 'Poste' }));
    kids.push(chips(Object.entries(RADIOS).map(([k, v]) => [k, v.n]), o.radio, k => {
      o.radio = k; const R2 = RADIOS[k];
      if (R2.pw && R2.pw.indexOf(o.pw) < 0) o.pw = R2.d;
      const keep = R2.fam && ANTS[o.ant] && ANTS[o.ant].fam === R2.fam && (k !== 'se235t' || /^(MA|HA|FAt)$/.test(o.ant));
      if (R2.ant && o.ant !== R2.ant && !keep && !(k === 'se235m' && /^(FA|FzA|dir)/.test(o.ant))) { o.ant = R2.ant; o.g = ANTS[o.ant].g; o.h = ANTS[o.ant].h; }
      onChange(); draw();
    }));
    if (R.sub) kids.push(h('p', { class: 'note', text: R.sub }));
    kids.push(h('div', { class: 'label', text: 'Puissance' }));
    if (R.pw) kids.push(h('div', { class: 'line' }, seg(R.pw.map(w => [w, wTxt(w)]), o.pw, w => { o.pw = +w; onChange(); })));
    else kids.push(numLine('Puissance d\'émission', null, o.pw, 'W', v => { o.pw = v; onChange(); }, { min: 0.01, max: 1000, dec: 1 }));
    kids.push(h('div', { class: 'label', text: 'Antenne' }));
    const fits = ([k, v]) => !R.fam || v.fam === R.fam || (R.fam === '235' && v.dir) || k === o.ant;
    kids.push(chips(Object.entries(ANTS).filter(fits).map(([k, v]) => [k, v.n]), o.ant, k => {
      o.ant = k; o.g = ANTS[k].g; o.h = ANTS[k].h;
      if (ANTS[k].dir) { o.az = o.az || 0; o.bw = o.bw || 60; }
      onChange(); draw();
    }));
    kids.push(h('div', { class: 'line' }, h('span', null, 'Hauteur au-dessus du sol', h('small', { text: A.l })), stepper(o.h, o.h < 5 ? 0.5 : 1, 0.5, 120, 'm', v => { o.h = v; onChange(); })));
    if (A.dir && 'az' in o) {
      kids.push(numLine('Azimut', 'Direction du lobe, depuis le nord', o.az, '°', v => { o.az = ((v % 360) + 360) % 360; onChange(); }, { min: 0, max: 360, dec: 0, int: true }));
      kids.push(h('div', { class: 'line' }, h('span', null, 'Ouverture'), seg([[30, '30°'], [60, '60°'], [90, '90°']], o.bw, v => { o.bw = +v; onChange(); })));
    }
    if (withFreq) {
      const out = R.band && (o.f < R.band[0] || o.f > R.band[1]);
      kids.push(numLine('Fréquence', out ? 'Hors de la bande du poste (30 à 87,975 MHz)' : 'Fréquence du réseau', o.f, 'MHz', v => { o.f = v; onChange(); draw(); }, { min: 1, max: 6000, dec: 3 }));
      if (out) kids[kids.length - 1].querySelector('small').classList.add('warn');
    }
    const det = h('div', { style: 'display:flex;flex-direction:column;gap:12px', hidden: !o._open });
    det.append(
      numLine('Gain efficace', A.tab != null ? 'Étalonné sur le règlement : ' + sgn(A.g) + ' dBi' : 'Valeur typique, à ajuster', o.g, 'dBi', v => { o.g = v; onChange(); }, { min: -30, max: 30 }),
      numLine('Pertes de câble en plus', 'Déjà comprises pour le matériel du règlement', o.lc, 'dB', v => { o.lc = v; onChange(); }, { min: 0, max: 30 }),
      numLine('Seuil de réception', 'Étalonné, mode FHOP : ' + SENS + ' dBm', o.sens, 'dBm', v => { o.sens = v; onChange(); }, { min: -150, max: -50 }),
    );
    if (opt.ref) { const r = opt.ref(); if (r) kids.push(r); }
    const more = h('button', { type: 'button', class: 'more', html: (o._open ? 'Moins de réglages' : 'Plus de réglages') + icon(o._open ? 'down' : 'right') });
    more.addEventListener('click', () => { o._open = !o._open; draw(); });
    kids.push(more, det);
    box.replaceChildren(...kids);
  };
  draw();
  return box;
}
function openEdit(id) {
  const S = study().stations, s = S.find(x => x.id === id);
  if (!s) return;
  closeSheet();
  selId = id; drawStations();
  document.body.classList.add('editing');
  const handle = h('div', { class: 'ehandle' }, h('div', { class: 'grab' }));
  const name = h('input', { class: 'field', value: s.name, 'aria-label': 'Nom de la station', maxlength: 40 });
  name.addEventListener('change', () => { s.name = name.value.trim() || s.name; name.value = s.name; save(); drawStations(); });
  const where = h('p', { class: 'note' });
  const showWhere = () => { where.innerHTML = '<b>MN95</b> ' + lvTxt(s.lat, s.lon) + (s.alt != null ? ' · altitude ' + grp(s.alt) + ' m' : ''); };
  showWhere();
  fetchAlt(s).then(showWhere);
  const body = h('div', { class: 'ebody' },
    h('div', { class: 'ehead' }, h('span', { class: 'dot', style: `background:${colorOf(S.indexOf(s))};width:14px;height:14px` }), name,
      h('button', { type: 'button', class: 'xbtn', 'aria-label': 'Fermer', html: icon('close'), onclick: closeEdit })),
    where,
    h('div', { class: 'line' }, seg([['st', 'Station'], ['relais', 'Station relais']], s.kind === 'relais' ? 'relais' : 'st', v => {
      if (v === 'relais') { s.kind = 'relais'; if (!s.b) { const P = relayPreset('m2'); Object.assign(s, P.a, { preset: 'm2' }); s.b = P.b; } }
      else s.kind = null;
      save(); drawStations(); changed(); openEdit(s.id);
    })),
    ...(s.kind === 'relais' ? [
      h('div', { class: 'label', text: 'Station relais du règlement' }),
      chips([...Object.entries(RELAYS).map(([k, v]) => [k, v.n]), ['perso', 'Autre']], s.preset || 'perso', k => {
        if (k !== 'perso') { const P = relayPreset(k); Object.assign(s, P.a, { preset: k }); s.b = P.b; } else s.preset = 'perso';
        save(); drawStations(); changed(); openEdit(s.id);
      }),
      h('p', { class: 'note', text: (RELAYS[s.preset] || { l: 'Deux postes reliés par câble relais : chaque côté se règle séparément.' }).l }),
      radioFields(s, () => { s.preset = 'perso'; save(); drawStations(); changed(); }, true, { title: 'Côté 1', ref: () => refNote(s) }),
      radioFields(s.b, () => { s.preset = 'perso'; save(); drawStations(); changed(); }, false, { title: 'Côté 2', ref: () => refNote(s.b) }),
    ] : [radioFields(s, () => { save(); drawStations(); changed(); }, true, { ref: () => refNote(s) })]),
    h('div', { class: 'acts' },
      h('button', { type: 'button', class: 'act', onclick: () => { const c = map.getCenter(); s.lat = c.lat; s.lon = c.lng; s.alt = null; changed(); openEdit(s.id); } }, iEl('target'), 'Au réticule'),
      S.length > 1 ? h('button', { type: 'button', class: 'act', onclick: () => pickLink(s) }, iEl('link'), 'Liaison') : null),
    h('div', { class: 'acts' }, h('button', { type: 'button', class: 'act danger', onclick: () => {
      const i = S.indexOf(s); if (i >= 0) S.splice(i, 1); closeEdit(); changed(); toast('Station supprimée');
    } }, iEl('trash'), 'Supprimer')),
  );
  editEl.replaceChildren(handle, body);
  editEl.style.removeProperty('--dy');
  editEl.hidden = false;
  dragClose(handle, editEl, closeEdit);
}
/* portée de référence du règlement avec le poste en face */
function refNote(o) {
  const c = study().params.c, r = refRange(o, c);
  if (!r) return null;
  if (r.reg === '58.440') return h('p', { class: 'note', html: `<b>Règlement 58.440</b> : environ ${r.km} km entre deux SE-135 avec la MA-135 déployée, 80 % des emplacements` + (r.std ? '' : ', pour 2 W') + '.' });
  return h('p', { class: 'note', html: `<b>Règlement 58.430</b> : ${r.km} km avec le poste en face (${ANTS[c.ant].n}), Plateau, 80 % des emplacements, mode FHOP` + (r.std ? '' : ', pour 5 W en portable et 50 W en véhicule') + '.' });
}
function pickLink(s) {
  const S = study().stations.filter(x => x.id !== s.id);
  openSheet('Liaison depuis ' + s.name, h('div', { class: 'list' }, S.map(t => h('button', { type: 'button', class: 'row', onclick: () => { closeSheet(); showProfile(s, { st: t }); } },
    h('span', { class: 'dot', style: `background:${colorOf(study().stations.indexOf(t))}` }), h('span', { class: 't' }, h('b', { text: t.name }), h('small', { text: descr(t) })), iEl('right')))));
}
const descr1 = s => `${(RADIOS[s.radio] || RADIOS.autre).n} · ${wTxt(s.pw)} · ${(ANTS[s.ant] || ANTS.FzA).n} ${fr(s.h, s.h % 1 ? 1 : 0)} m`;
const descr = s => s.kind === 'relais' && s.b ? `Relais ${(RELAYS[s.preset] || { n: '' }).n} · ${wTxt(s.pw)} ${ANTS[s.ant].n} / ${wTxt(s.b.pw)} ${ANTS[s.b.ant].n}`.replace('Relais  ·', 'Relais ·') : descr1(s);

/* altitude du site (modèle swissALTI3D, service de swisstopo) */
async function fetchAlt(s) {
  if (s.alt != null) return;
  try {
    const [E, N] = toLV95(s.lat, s.lon);
    const r = await fetch(`https://api3.geo.admin.ch/rest/services/height?easting=${E.toFixed(1)}&northing=${N.toFixed(1)}&sr=2056`, { credentials: 'omit', referrerPolicy: 'no-referrer' });
    const j = await r.json();
    const v = parseFloat(j.height);
    if (isFinite(v)) { s.alt = v; save(); }
  } catch (e) {}
}

/* ajouter une station au réticule */
$('addBtn').addEventListener('click', () => {
  const S = study().stations;
  if (S.length >= 8) { toast('Huit stations au plus par étude'); return; }
  clearTimeout(toastT); toastEl.hidden = true;
  const c = map.getCenter(), prev = S[S.length - 1];
  const s = prev ? Object.assign({}, prev, { id: uid(), name: 'Station ' + (S.length + 1), lat: c.lat, lon: c.lng, alt: null, _open: false, kind: null, b: null })
    : { id: uid(), name: 'Station 1', lat: c.lat, lon: c.lng, radio: 'se235m', pw: 50, ant: 'FAm', h: ANTS.FAm.h, g: ANTS.FAm.g, lc: 0, sens: SENS, f: 50, az: 0, bw: 60 };
  S.push(s);
  changed();
  openEdit(s.id);
});

/* ================= calcul ================= */
const worker = new Worker(URL.createObjectURL(new Blob([document.getElementById('engine').textContent], { type: 'text/javascript' })));
let runId = 0, result = null, covLayer = null, covSrc = null, runT = 0, pending = null, runMap = {}, lastMap = [];
const statusEl = $('status');
function changed() {
  if (search) endSearch(true);
  save(); drawStations();
  clearTimeout(runT); runT = setTimeout(compute, 450);
}
function engineStation(s) {
  const A = ANTS[s.ant] || ANTS.FzA;
  return { lat: s.lat, lon: s.lon, h: s.h, p: dBm(s.pw), lc: s.lc || 0, sens: s.sens, f: s.f, ant: { g: s.g, dir: !!A.dir, az: s.az || 0, bw: s.bw || 60 } };
}
/* côté 2 d'une station relais : même emplacement et même nom de station */
const sideB = s => Object.assign({}, s, s.b, { id: s.id, name: s.name + ' (côté 2)', kind: null, b: null, f: s.f, lat: s.lat, lon: s.lon });
const sidesOf = s => (s.kind === 'relais' && s.b ? [s, sideB(s)] : [s]);
/* trajet de la liaison : départ, relais dans l'ordre, arrivée. Tant qu'il n'est pas modifié, c'est l'ordre des stations. */
function routeIds(st = study()) {
  const S = st.stations, ok = id => S.some(x => x.id === id);
  const r = Array.isArray(st.route) ? st.route.filter(ok) : S.map(x => x.id);
  return r.filter((id, q) => r.indexOf(id) === q);
}
const routeSt = () => routeIds().map(id => study().stations.find(x => x.id === id));
/* un relais capte du côté 1 (vers le départ) et réémet du côté 2 (vers l'arrivée) */
const sideIn = x => x;
const sideOut = x => (x.kind === 'relais' && x.b ? sideB(x) : x);
const roleOf = (q, n) => (q === 0 ? 'Départ' : q === n - 1 ? 'Arrivée' : 'Relais ' + q);
/* liste envoyée au moteur et correspondance vers les stations de l'étude */
function engineList() {
  const list = [], emap = [];
  study().stations.forEach((s, i) => sidesOf(s).forEach(x => { list.push(engineStation(x)); emap.push(i); }));
  return { list, emap };
}
const cptOf = o => ({ h: o.h, p: dBm(o.pw), g: o.g, lc: o.lc || 0, sens: o.sens });
function engineParams() {
  const P = study().params, c = P.c, { emap } = engineList();
  return { dir: P.dir, r: P.r, prec: P.prec, buildings: P.buildings, forest: P.forest, forestDb: P.forestDb, fade: P.fade, k: P.k, f: 50, corr: P.corr || 0,
    hr: c.h, c: cptOf(c),
    active: P.net.on && netActive && netActive.length === study().stations.length ? emap.map(i => netActive[i]) : null };
}
/* aperçu pendant le glisser : une requête à la fois, la dernière position gagne */
const pv = { busy: false, st: null };
function dragPreview(st) {
  pv.st = st;
  if (pv.busy || !result) return;
  const S = study().stations, si = S.indexOf(st);
  if (si < 0) return;
  const { list, emap } = engineList(), idx = emap.map((v, q) => (v === si ? q : -1)).filter(q => q >= 0);
  pv.busy = true; pv.sent = st;
  clearTimeout(runT);
  runId++;
  runMap[runId] = emap;
  worker.postMessage({ t: 'preview', id: runId, stations: list, P: engineParams(), idx });
}
function compute() {
  const S = study().stations;
  if (!S.length) { clearCov(); result = null; updLegend(); return; }
  runId++;
  pending = { id: runId, t0: Date.now() };
  showStatus('Préparation', 0);
  const { list, emap } = engineList();
  runMap[runId] = emap;
  worker.postMessage({ t: 'run', id: runId, stations: list, P: engineParams() });
}
function showStatus(phase, f) {
  statusEl.hidden = false;
  statusEl.replaceChildren(h('span', null, phase.trim(), h('em', { text: Math.round(f * 100) + ' %' })), h('i', { class: 'pbar' }, h('b', { style: `width:${(f * 100).toFixed(1)}%` })));
}
const preq = new Map();
let pid = 0;
const askProfile = (S, T) => new Promise(res => { const id = ++pid; preq.set(id, res); worker.postMessage({ t: 'profile', id, S, T }); });
worker.onmessage = e => {
  const m = e.data;
  if (m.t === 'prog') { if (m.id === runId) showStatus(m.phase, m.f); return; }
  if (m.t === 'profile') { const f = preq.get(m.id); if (f) { preq.delete(m.id); f({ r: m }); } return; }
  if (m.t === 'err') {
    if (m.kind === 'profile') { const f = preq.get(m.id); if (f) { preq.delete(m.id); f({ err: m.msg }); } return; }
    if (m.id !== runId) return;
    statusEl.hidden = true;
    toast(m.net ? 'Données swisstopo injoignables : vérifier la connexion.' : m.msg, 6000);
    return;
  }
  if (m.t === 'done') { if (runMap[m.id]) lastMap = runMap[m.id]; m.emap = lastMap; for (const k in runMap) if (+k <= m.id) delete runMap[k]; }
  if (m.t === 'done' && m.recomp) { if (m.id === runId) { result = m; drawCov(); updLegend(); } return; }
  if (m.t === 'skip' || (m.t === 'done' && m.preview)) {
    pv.busy = false;
    if (m.t === 'done' && m.id === runId) { result = m; drawCov(); updLegend(); evalLinks(); }
    if (pv.st && pv.st !== pv.sent) dragPreview(pv.st);
    else if (pv.st) { const again = pv.st; pv.sent = null; setTimeout(() => { if (pv.st === again && !pv.busy) dragPreview(again); }, 60); }
    return;
  }
  if (m.t === 'done' && m.id === runId) {
    statusEl.hidden = true;
    result = m;
    drawCov(); updLegend();
    if (search) { showSearch(m); return; }
    evalLinks().then(maybeNet);
    if (live) liveRefresh(true);
    if (m.vtFailed) toast('Bâtiments et forêt incomplets : ' + m.vtFailed + ' tuiles manquantes');
  }
};
worker.onerror = () => { statusEl.hidden = true; toast('Le calcul a échoué sur cet appareil.'); };

const CLS = () => {
  const F = study().params.fade;
  return [
    { k: 'sure', n: 'Liaison sûre', min: F + 10, c: [30, 142, 78, 1] },
    { k: 'bonne', n: 'Liaison bonne', min: F, c: [127, 203, 79, 1] },
    { k: 'inc', n: 'Incertaine', min: 0, c: [242, 178, 51, 1] },
    { k: 'hors', n: 'Hors portée', min: -Infinity, c: [224, 72, 60, 0.5] },
  ];
};
function clearCov() { if (covLayer) { map.removeLayer(covLayer); covLayer = null; } covSrc = null; }
/* couverture en tuiles de 256 px : chaque tuile ne reprend que sa part de la grille, la mémoire reste la même à tout zoom */
map.createPane('cov').style.zIndex = 350;
map.getPane('cov').style.pointerEvents = 'none';
const CovLayer = L.GridLayer.extend({
  createTile(coords) {
    const t = document.createElement('canvas'), sz = this.getTileSize();
    t.width = sz.x; t.height = sz.y;
    const src = covSrc, b = src && src.b;
    if (!src) return t;
    const nw = map.project(L.latLng(b[1][0], b[0][1]), coords.z), se = map.project(L.latLng(b[0][0], b[1][1]), coords.z);
    const kx = (se.x - nw.x) / src.width, ky = (se.y - nw.y) / src.height;
    const ox = coords.x * sz.x - nw.x, oy = coords.y * sz.y - nw.y;
    /* une cellule de marge de chaque côté : pas de couture entre tuiles */
    const i0 = Math.max(0, Math.floor(ox / kx) - 1), j0 = Math.max(0, Math.floor(oy / ky) - 1);
    const i1 = Math.min(src.width, Math.ceil((ox + sz.x) / kx) + 1), j1 = Math.min(src.height, Math.ceil((oy + sz.y) / ky) + 1);
    if (i1 <= i0 || j1 <= j0) return t;
    const ctx = t.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(src, i0, j0, i1 - i0, j1 - j0, i0 * kx - ox, j0 * ky - oy, (i1 - i0) * kx, (j1 - j0) * ky);
    return t;
  },
});
function drawCov() {
  if (!result) return;
  const { nx, ny, mar, nod } = result, cls = CLS();
  const cv = document.createElement('canvas'); cv.width = nx; cv.height = ny;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(nx, ny), D = img.data, cnt = [0, 0, 0, 0];
  for (let k = 0; k < nx * ny; k++) {
    const M = mar[k];
    if (!(M === M) || (nod && nod[k])) continue;
    const q = M >= cls[0].min ? 0 : M >= cls[1].min ? 1 : M >= 0 ? 2 : 3, c = cls[q].c;
    cnt[q]++;
    const o = k * 4; D[o] = c[0]; D[o + 1] = c[1]; D[o + 2] = c[2]; D[o + 3] = Math.round(c[3] * 255);
  }
  ctx.putImageData(img, 0, 0);
  result.cnt = cnt;
  cv.b = result.bounds;
  covSrc = cv;
  const bb = L.latLngBounds(result.bounds);
  if (!covLayer) covLayer = new CovLayer({ pane: 'cov', opacity: store.prefs.show ? store.prefs.op : 0, bounds: bb, keepBuffer: 2, maxZoom: 20, className: 'cov' }).addTo(map);
  else { covLayer.options.bounds = bb; covLayer.redraw(); }
}
const legendEl = $('legend');
legendEl.addEventListener('click', () => { legendEl.classList.toggle('min'); });
function updLegend() {
  if (!result || !study().stations.length) { legendEl.hidden = true; return; }
  const cls = CLS(), cnt = result.cnt || [0, 0, 0, 0], tot = cnt.reduce((a, b) => a + b, 0) || 1;
  const pct = q => Math.round(cnt[q] / tot * 100);
  const thr = c => c.min === -Infinity ? '< 0 dB' : '≥ ' + fr(c.min, 0) + ' dB';
  const SS = study().stations, sa = search && SS.find(x => x.id === search.a), sb = search && SS.find(x => x.id === search.b);
  legendEl.replaceChildren(
    search ? h('div', { class: 'lr lh' }, 'Relais ' + (sa ? sa.name : '') + ' ↔ ' + (sb ? sb.name : ''))
      : h('div', { class: 'lr lh' }, study().params.net.on ? 'Couverture du réseau' : 'Marge de liaison', h('em', { text: 'rayon ' + study().params.r + ' km' })),
    ...cls.map((c, q) => h('div', { class: 'lr' }, h('span', { class: 'sq', style: `background:rgba(${c.c.slice(0, 3)},1)` }), c.n, h('em', { text: thr(c) + ' · ' + pct(q) + ' %' }))),
  );
  legendEl.hidden = false;
}

/* ================= profil ================= */
let tgtMk = null;
map.on('click', e => {
  if (editEl.hidden === false) { closeEdit(); return; }
  if (search) { relayTap(e.latlng); return; }
  const S = study().stations;
  if (!S.length) { toast('Placer d\'abord une antenne au réticule'); return; }
  if (!result) { toast('Calcul en cours'); return; }
  /* station qui dessert le mieux ce point, sinon la plus proche */
  let si = -1;
  const { nx, ny, bounds, best } = result;
  const X = L.CRS.EPSG3857.project(e.latlng), P0 = L.CRS.EPSG3857.project(L.latLng(bounds[0][0], bounds[0][1])), P1 = L.CRS.EPSG3857.project(L.latLng(bounds[1][0], bounds[1][1]));
  const i = Math.floor((X.x - P0.x) / (P1.x - P0.x) * nx), j = Math.floor((P1.y - X.y) / (P1.y - P0.y) * ny);
  if (i >= 0 && j >= 0 && i < nx && j < ny && best[j * nx + i] !== 255) si = result.emap ? result.emap[best[j * nx + i]] : best[j * nx + i];
  if (si < 0 || !S[si]) { let dm = Infinity; S.forEach((s, q) => { const d = map.distance([s.lat, s.lon], e.latlng); if (d < dm) { dm = d; si = q; } }); }
  showProfile(S[si], { lat: e.latlng.lat, lon: e.latlng.lng });
});
function showProfile(s, tgt) {
  const P = study().params, c = P.c, Sx = study().stations;
  const ES = engineStation(s);
  let T, tName, tStation = tgt.st || null;
  if (tStation) { const t = engineStation(tStation); T = Object.assign({}, t, { g: t.ant.g }); tName = tStation.name; }
  else { T = { lat: tgt.lat, lon: tgt.lon, h: c.h, p: dBm(c.pw), g: c.g, lc: c.lc || 0, sens: c.sens }; tName = 'Point'; }
  if (tgtMk) { map.removeLayer(tgtMk); tgtMk = null; }
  if (!tStation) tgtMk = L.marker([tgt.lat, tgt.lon], { icon: L.divIcon({ className: 'tgt', html: '<i></i>', iconSize: [36, 36], iconAnchor: [18, 18] }), interactive: false }).addTo(map);
  const body = h('div', { style: 'display:flex;flex-direction:column;gap:12px' }, h('p', { class: 'note', text: 'Calcul du profil…' }));
  const head = [];
  if (!tStation && Sx.length > 1) head.push(chips(Sx.map((x, q) => [x.id, x.name]), s.id, id => showProfile(Sx.find(x => x.id === id), tgt)));
  const tok = {};
  openSheet(s.name + ' → ' + tName, [...head, body], () => { tok.dead = true; if (tgtMk) { map.removeLayer(tgtMk); tgtMk = null; } }, true);
  askProfile(ES, T).then(({ r, err }) => {
    if (tok.dead) return;
    if (!r) { body.replaceChildren(h('p', { class: 'note', text: err || 'Profil indisponible.' })); return; }
    body.replaceChildren(...profileView(r, s, tStation, tgt));
  });
}
function verdictOf(M) {
  const cls = CLS();
  return M >= cls[0].min ? cls[0] : M >= cls[1].min ? cls[1] : M >= 0 ? cls[2] : cls[3];
}
function profileView(r, s, tStation, tgt) {
  const P = study().params, dir = P.dir;
  const M = dir === 'down' ? r.down : dir === 'up' ? r.up : Math.min(r.down, r.up);
  const V = verdictOf(M);
  const si = study().stations.findIndex(x => x.id === s.id), ei = result && result.emap ? result.emap.indexOf(si) : si;
  const off = s.alt != null && result && result.t0 && result.t0[ei] != null ? s.alt - result.t0[ei] : 0;
  const out = [];
  out.push(h('div', { class: 'verdict' }, h('span', { class: 'sq', style: `background:rgba(${V.c.slice(0, 3)},1)` }), h('b', { text: V.n }), h('span', { text: sgn(M) + ' dB' })));
  out.push(profileSvg(r, off, colorOf(si)));
  out.push(h('div', { class: 'pkey' },
    h('span', null, h('i', { style: 'background:#fff' }), 'Visée'),
    h('span', null, h('i', { style: 'background:#8E8E93' }), '60 % de la 1re zone de Fresnel'),
    h('span', null, h('i', { style: 'background:#FF9F0A' }), 'Arête dominante'),
    h('span', null, h('i', { style: 'background:#34C759' }), 'Forêt')));
  const mils = Math.round(r.bearing / 360 * 6400) % 6400;
  const excess = Math.sqrt(r.Fpe * r.Fpe + r.Lb * r.Lb);
  const row = (t, v, sub, big) => h('div', { class: 'row' + (sub ? ' sub' : '') }, h('span', { class: 't' }, h('b', { text: t })), h('span', { class: 'v' + (big ? ' big' : ''), text: v }));
  out.push(h('div', { class: 'label', text: 'Trajet' }));
  out.push(h('div', { class: 'list' },
    row('Distance', fr(r.dKm, r.dKm < 10 ? 2 : 1) + ' km'),
    row('Azimut', Math.round(r.bearing) + '° · ' + String(mils).padStart(4, '0') + ' ‰'),
    row('Visée', r.los ? (r.Luc > 0 ? 'directe, zone de Fresnel entamée' : 'directe et dégagée') : 'masquée par le relief'),
    tStation ? null : row('Point', lvTxt(tgt.lat, tgt.lon))));
  out.push(h('div', { class: 'label', text: 'Affaiblissement' }));
  out.push(h('div', { class: 'list' },
    row('Espace libre', fr(r.Lfs) + ' dB'),
    row('Sol (terre plane)', sgn(r.Fpe) + ' dB', true),
    row('Hauteurs effectives', fr(r.he1, 0) + ' m / ' + fr(r.he2, 0) + ' m', true),
    row('Relief et bâtiments (diffraction)', sgn(r.Lb) + ' dB', true),
    row('Sol et diffraction combinés', sgn(excess) + ' dB'),
    r.Lfo ? row('Forêt', sgn(r.Lfo) + ' dB') : null,
    row('Total', fr(r.L) + ' dB', false, true)));
  const tn = tStation ? tStation.name : 'Poste en face';
  out.push(h('div', { class: 'label', text: 'Bilan' }));
  out.push(h('div', { class: 'list' },
    row(s.name + ' → ' + tn, fr(r.rxDown) + ' dBm'),
    row('Marge', sgn(r.down) + ' dB', true, dir !== 'up'),
    row(tn + ' → ' + s.name, fr(r.rxUp) + ' dBm'),
    row('Marge', sgn(r.up) + ' dB', true, dir !== 'down')));
  if (!tStation) {
    out.push(h('div', { class: 'acts' }, h('button', { type: 'button', class: 'act', onclick: () => copyText(lvTxt(tgt.lat, tgt.lon).replace(/'/g, '')) }, iEl('copy'), 'Copier MN95')));
  }
  return out;
}
function profileSvg(r, off, col) {
  const W = 640, H = 230, pl = 44, pr = 10, pt = 14, pb = 26;
  const n = r.n, d = r.d, dk = r.dKm, C = r.C;
  const bulge = i => C * d[i] * (dk - d[i]);
  const yT = [], yO = [];
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i <= n; i++) { yT.push(r.ter[i] + bulge(i)); yO.push(r.obs[i] + bulge(i)); lo = Math.min(lo, yT[i]); hi = Math.max(hi, yO[i]); }
  hi = Math.max(hi, r.hts, r.hrs);
  if (!r.los) hi = Math.max(hi, r.hb);
  for (let i = 0; i <= n; i++) {
    const di = d[i] * 1000, dd = (dk - d[i]) * 1000, los = r.hts + (r.hrs - r.hts) * d[i] / dk;
    lo = Math.min(lo, los - 0.6 * Math.sqrt(r.lam * di * dd / (dk * 1000)));
  }
  const span = Math.max(30, hi - lo);
  lo -= span * 0.08; hi += span * 0.12;
  const X = x => pl + x / dk * (W - pl - pr), Y = y => pt + (hi - y) / (hi - lo) * (H - pt - pb);
  const pts = a => a.map((y, i) => X(d[i]).toFixed(1) + ',' + Y(y).toFixed(1)).join(' ');
  const base = `${X(dk).toFixed(1)},${H - pb} ${X(0).toFixed(1)},${H - pb}`;
  let fz = '';
  for (let i = 0; i <= n; i++) {
    const di = d[i] * 1000, dd = (dk - d[i]) * 1000, los = r.hts + (r.hrs - r.hts) * d[i] / dk;
    const rf = 0.6 * Math.sqrt(r.lam * di * dd / (dk * 1000));
    fz += (i ? ' ' : '') + X(d[i]).toFixed(1) + ',' + Y(los - rf).toFixed(1);
  }
  let forest = '';
  for (let i = 0; i <= n; i++) if (r.fo[i]) {
    const x0 = X(Math.max(0, d[i] - dk / n / 2)), x1 = X(Math.min(dk, d[i] + dk / n / 2));
    forest += `<rect x="${x0.toFixed(1)}" y="${Y(yT[i] + 14).toFixed(1)}" width="${Math.max(0.6, x1 - x0).toFixed(1)}" height="${Math.max(1, Y(yT[i]) - Y(yT[i] + 14)).toFixed(1)}"/>`;
  }
  let edge = '';
  if (!r.los && r.db > 0 && r.db < dk) {
    edge = `<polyline points="${X(0)},${Y(r.hts)} ${X(r.db)},${Y(r.hb)} ${X(dk)},${Y(r.hrs)}" fill="none" stroke="#FF9F0A" stroke-width="1.6" stroke-dasharray="5 4"/><circle cx="${X(r.db)}" cy="${Y(r.hb)}" r="4" fill="#FF9F0A"/>`;
  } else if (r.edge > 0 && r.Luc > 0) {
    edge = `<circle cx="${X(d[r.edge])}" cy="${Y(yO[r.edge])}" r="4" fill="#FF9F0A"/>`;
  }
  const ticks = [];
  const nt = 4;
  for (let q = 0; q <= nt; q++) { const x = dk * q / nt; ticks.push(`<text x="${X(x).toFixed(1)}" y="${H - 8}" text-anchor="${q === 0 ? 'start' : q === nt ? 'end' : 'middle'}">${fr(x, dk < 4 ? 1 : 0)}${q === nt ? ' km' : ''}</text>`); }
  const hv = [lo + (hi - lo) * 0.15, (lo + hi) / 2, hi - (hi - lo) * 0.1];
  const hl = hv.map(v => `<text x="${pl - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${grp(v + off)}</text><line x1="${pl}" x2="${W - pr}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="rgba(255,255,255,.07)"/>`).join('');
  const svg = `<svg class="prof" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="Inter,system-ui,sans-serif" font-size="11" fill="#8E8E93">
    <defs><clipPath id="pc"><rect x="${pl}" y="0" width="${W - pl - pr}" height="${H - pb}"/></clipPath></defs>
    ${hl}<g clip-path="url(#pc)">
    <polygon points="${pts(yO)} ${base}" fill="#636366"/>
    <polygon points="${pts(yT)} ${base}" fill="#3A3A3C" stroke="#AEAEB2" stroke-width="1.2"/>
    <g fill="rgba(52,199,89,.55)">${forest}</g>
    <polyline points="${fz}" fill="none" stroke="#8E8E93" stroke-width="1.2" stroke-dasharray="3 3"/>
    <line x1="${X(0)}" y1="${Y(r.hts)}" x2="${X(dk)}" y2="${Y(r.hrs)}" stroke="#fff" stroke-width="1.6"/>
    ${edge}
    <line x1="${X(0)}" y1="${Y(yT[0])}" x2="${X(0)}" y2="${Y(r.hts)}" stroke="${col}" stroke-width="3"/>
    <circle cx="${X(0)}" cy="${Y(r.hts)}" r="4.5" fill="${col}" stroke="#fff" stroke-width="1.5"/>
    <line x1="${X(dk)}" y1="${Y(yT[n])}" x2="${X(dk)}" y2="${Y(r.hrs)}" stroke="#fff" stroke-width="3"/>
    <circle cx="${X(dk)}" cy="${Y(r.hrs)}" r="4.5" fill="#fff" stroke="${col}" stroke-width="1.5"/></g>
    ${ticks.join('')}
    <text x="${pl - 6}" y="${pt - 2}" text-anchor="end">m</text>
  </svg>`;
  const wrap = h('div', { html: svg });
  return wrap.firstElementChild;
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast('Copié : ' + t); }
  catch (e) { toast(t, 6000); }
}

/* ================= feuilles ================= */
/* stations et liaisons entre stations */
$('tabStations').addEventListener('click', () => {
  const S = study().stations;
  const kids = [];
  if (!S.length) kids.push(h('p', { class: 'note', text: 'Aucune station. Centrer la carte sur l\'emplacement voulu, puis « Antenne » pour poser une station au réticule.' }));
  else {
    kids.push(h('div', { class: 'list' }, S.map((s, i) => {
      let best = -1;
      if (!search && result && result.emap) result.emap.forEach((v, q) => { const t = result.stats[q]; if (v === i && t && t.tot) best = Math.max(best, (t.sure + t.bonne) / t.tot); });
      const cov = best >= 0 ? Math.round(best * 100) + ' % en liaison bonne ou sûre' : 'calcul en attente';
      return h('button', { type: 'button', class: 'row', onclick: () => { closeSheet(); map.setView([s.lat, s.lon], Math.max(map.getZoom(), 12)); openEdit(s.id); } },
        h('span', { class: 'dot', style: `background:${colorOf(i)}` }), h('span', { class: 't' }, h('b', { text: s.name }), h('small', { text: descr(s) }), h('small', { text: cov })), iEl('right'));
    })));
    if (S.length > 1) kids.push(h('p', { class: 'note', text: 'Trajet de la liaison, du départ à l\'arrivée par les relais : onglet Relais.' }));
  }
  kids.push(h('p', { class: 'note', html: 'Toucher la carte affiche le profil depuis la station qui dessert le mieux ce point. Les stations se déplacent en les faisant glisser.' }));
  openSheet('Stations', kids);
});
/* ================= relais ================= */
/* maillons du trajet (les deux sens : la plus faible marge compte), tracés sur la carte */
let links = [], linksP = null, linkAgain = false, netActive = null, search = null, linksCb = null;
const linksLayer = L.layerGroup().addTo(map);
map.on('zoomend', () => { if (links.length) drawLinks(); });
const needMin = () => { const P = study().params, F = P.fade; return P.net.need === 'sure' ? F + 10 : P.net.need === 'bonne' ? F : 0; };
/* un maillon : le côté qui réémet de la station a vers le côté qui capte de la station b */
async function hopOf(a, b) {
  const x = sideOut(a), y = sideIn(b), t = engineStation(y);
  const { r } = await askProfile(engineStation(x), Object.assign({}, t, { g: t.ant.g }));
  return { a, b, x, y, r: r || null, M: r ? Math.min(r.down, r.up) : null };
}
function evalLinks() {
  if (linksP) { linkAgain = true; return linksP; }
  linksP = (async () => {
    await null; /* le drapeau « en cours » est posé avant la première reprise */
    do {
      linkAgain = false;
      const sid = store.cur, res = result, T = routeSt(), out = [];
      if (result && !search) for (let q = 0; q + 1 < T.length; q++) out.push(await hopOf(T[q], T[q + 1]));
      /* étude changée ou nouveau calcul pendant l'évaluation : ces maillons ne valent plus */
      links = store.cur === sid && result === res ? out : [];
      drawLinks();
      if (linksCb) linksCb();
    } while (linkAgain);
    linksP = null;
  })();
  return linksP;
}
function drawLinks() {
  linksLayer.clearLayers();
  if (!store.prefs.links || search) return;
  for (const l of links) {
    const V = l.r ? verdictOf(l.M) : null, col = V ? `rgb(${V.c.slice(0, 3)})` : '#8E8E93';
    const pts = [[l.a.lat, l.a.lon], [l.b.lat, l.b.lon]];
    L.polyline(pts, { color: '#16181B', weight: 7, opacity: 0.5, interactive: false }).addTo(linksLayer);
    L.polyline(pts, { color: col, weight: 4, dashArray: V && l.M >= 0 ? null : '8 7', interactive: false }).addTo(linksLayer);
    const lab = l.r ? sgn(l.M, 0) + ' dB' : 'hors zone';
    const mid = [(l.a.lat + l.b.lat) / 2, (l.a.lon + l.b.lon) / 2];
    /* sens du trajet : flèche au milieu du maillon */
    const p0 = map.latLngToLayerPoint(pts[0]), p1 = map.latLngToLayerPoint(pts[1]), ang = Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180 / Math.PI;
    if (p0.distanceTo(p1) > 90) L.marker(map.layerPointToLatLng(p0.add(p1.subtract(p0).multiplyBy(0.28))), { icon: L.divIcon({ className: 'arw', html: `<i style="transform:rotate(${ang.toFixed(0)}deg);color:${col}"></i>`, iconSize: [0, 0] }), interactive: false, keyboard: false }).addTo(linksLayer);
    L.marker(mid, { icon: L.divIcon({ className: 'lnk', html: `<b style="border-color:${col}">${lab}</b>`, iconSize: [0, 0] }), keyboard: false, zIndexOffset: 300 })
      .on('click', () => showProfile(l.x || l.a, { st: l.y || l.b })).addTo(linksLayer);
  }
}
/* stations reliées à la station principale, de proche en proche */
function netActiveFrom() {
  const S = study().stations, P = study().params;
  if (!P.net.on || S.length < 2) return null;
  let main = S.findIndex(s => s.id === P.net.main);
  if (main < 0) main = Math.max(0, S.findIndex(s => s.id === routeIds()[0]));
  const act = S.map((_, i) => i === main), need = needMin();
  for (let grew = true; grew;) {
    grew = false;
    for (const l of links) {
      const ia = S.indexOf(l.a), ib = S.indexOf(l.b);
      if (ia < 0 || ib < 0 || l.M == null || l.M < need || act[ia] === act[ib]) continue;
      act[ia] = act[ib] = true; grew = true;
    }
  }
  return act;
}
function maybeNet() {
  const act = netActiveFrom(), same = JSON.stringify(act) === JSON.stringify(netActive);
  netActive = act;
  drawStations();
  if (!same && result && !search) {
    runId++;
    const { list, emap } = engineList();
    runMap[runId] = emap;
    worker.postMessage({ t: 'recomp', id: runId, stations: list, P: engineParams() });
  }
}
/* recherche de l'emplacement d'un relais entre deux stations : les deux liaisons doivent passer.
   Le relais a deux postes : le côté 1 travaille vers la 1re station, le côté 2 vers la 2e. */
const modeEl = $('modebar');
const spotsLayer = L.layerGroup().addTo(map);
let searchRes = null;
const relayName = R => (RELAYS[R.preset] || { n: 'Relais' }).n;
function startSearch(a, b) {
  const P = study().params, R = P.relay, S = study().stations;
  closeSheet(); closeEdit();
  search = { a: a.id, b: b.id };
  searchRes = null;
  document.body.classList.add('searching');
  linksLayer.clearLayers(); spotsLayer.clearLayers();
  modeEl.replaceChildren(h('span', null, 'Emplacement du relais', h('small', { text: 'Toucher la carte pour le détail' })),
    h('button', { type: 'button', class: 'chip', text: 'Résultats', onclick: () => searchSheet() }),
    h('button', { type: 'button', class: 'chip', text: 'Terminer', onclick: () => endSearch() }));
  modeEl.hidden = false;
  clearTimeout(runT);
  runId++;
  const EA = Object.assign(engineStation(a), { cpt: cptOf(R.a) }), EB = Object.assign(engineStation(b), { cpt: cptOf(R.b) });
  const Pe = Object.assign(engineParams(), { dir: 'both', combine: 'min', active: null, access: !!P.access, tracks: !!P.tracks, need: needMin(), rel: { a: cptOf(R.a), b: cptOf(R.b) } });
  runMap[runId] = [S.indexOf(a), S.indexOf(b)];
  showStatus('Préparation', 0);
  worker.postMessage({ t: 'run', id: runId, stations: [EA, EB], P: Pe });
  const bb = L.latLngBounds([[a.lat, a.lon], [b.lat, b.lon]]);
  map.fitBounds(bb.pad(0.35), { maxZoom: 14 });
}
function endSearch(silent) {
  if (!search) return;
  search = null; searchRes = null;
  document.body.classList.remove('searching');
  modeEl.hidden = true;
  spotsLayer.clearLayers();
  if (tgtMk) { map.removeLayer(tgtMk); tgtMk = null; }
  if (!silent) compute();
}
/* résultats : meilleurs emplacements numérotés, ou chaîne de deux relais */
function showSearch(m) {
  searchRes = m;
  spotsLayer.clearLayers();
  const need = needMin(), S = study().stations, A = S.find(x => x.id === search.a), B = S.find(x => x.id === search.b);
  const pin = (ll, txt, M) => {
    const V = verdictOf(M), col = `rgb(${V.c.slice(0, 3)})`;
    L.marker([ll.lat, ll.lon], { icon: L.divIcon({ className: 'spot', html: `<b style="border-color:${col}">${txt}</b>`, iconSize: [0, 0] }), zIndexOffset: 600 })
      .on('click', () => relayTap(L.latLng(ll.lat, ll.lon))).addTo(spotsLayer);
  };
  const one = m.spots && m.spots.length && m.spots[0].M >= need;
  if (!one && m.chain && m.chain.r1) {
    const c = m.chain;
    L.polyline([[A.lat, A.lon], [c.r1.lat, c.r1.lon], [c.r2.lat, c.r2.lon], [B.lat, B.lon]], { color: '#fff', weight: 2.5, dashArray: '6 6', interactive: false }).addTo(spotsLayer);
    pin(c.r1, 'R1', Math.min(c.M1, c.M12)); pin(c.r2, 'R2', Math.min(c.M12, c.M2));
  } else (m.spots || []).forEach((p, q) => pin(p, String(q + 1), p.M));
  searchSheet();
}
function searchSheet() {
  const m = searchRes;
  if (!m) { toast('Calcul en cours'); return; }
  const need = needMin(), S = study().stations, A = S.find(x => x.id === search.a), B = S.find(x => x.id === search.b), R = study().params.relay;
  const kids = [h('p', { class: 'note', text: `${relayName(R)} entre ${A.name} et ${B.name}` + (m.roads ? ', emplacements à moins d\'une cellule d\'une route' + (study().params.tracks ? ' ou d\'une piste' : '') : '') + '. Liaison exigée : ' + (need > 0 ? '≥ ' + need + ' dB' : '≥ 0 dB') + '.' })];
  if (m.noRoads && study().params.access) kids.push(h('p', { class: 'note warn', text: 'Routes indisponibles pour cette zone : tous les points sont montrés, accessibles ou non.' }));
  const spots = m.spots || [];
  const go = p => { closeSheet(); map.setView([p.lat, p.lon], Math.max(map.getZoom(), 14)); relayTap(L.latLng(p.lat, p.lon)); };
  if (spots.length && spots[0].M >= need) {
    kids.push(h('div', { class: 'label', text: 'Meilleurs emplacements' }));
    kids.push(h('div', { class: 'list' }, spots.map((p, q) => {
      const V = verdictOf(p.M);
      return h('button', { type: 'button', class: 'row', onclick: () => go(p) }, h('span', { class: 'sq', style: `background:rgb(${V.c.slice(0, 3)})` }),
        h('span', { class: 't' }, h('b', { text: 'Point ' + (q + 1) }), h('small', { text: lvTxt(p.lat, p.lon) })), h('span', { class: 'v big', text: sgn(p.M) + ' dB' }), iEl('right'));
    })));
  } else if (m.chain && m.chain.r1) {
    const c = m.chain;
    kids.push(h('div', { class: 'verdict' }, h('span', { class: 'sq', style: `background:rgb(${verdictOf(c.M).c.slice(0, 3)})` }), h('b', { text: 'Un relais ne suffit pas : deux relais' }), h('span', { text: sgn(c.M) + ' dB' })));
    const row = (t, v) => h('div', { class: 'row' }, h('span', { class: 't' }, h('b', { text: t })), h('span', { class: 'v big', text: sgn(v) + ' dB' }));
    kids.push(h('div', { class: 'list' }, row(A.name + ' ↔ R1', c.M1), row('R1 ↔ R2', c.M12), row('R2 ↔ ' + B.name, c.M2)));
    kids.push(h('div', { class: 'acts' }, h('button', { type: 'button', class: 'act primary', onclick: () => {
      const S2 = study().stations;
      if (S2.length > 6) { toast('Huit stations au plus par étude'); return; }
      const r1 = relayStation(L.latLng(c.r1.lat, c.r1.lon), A, 'Relais 1'), r2 = relayStation(L.latLng(c.r2.lat, c.r2.lon), A, 'Relais 2');
      S2.push(r1, r2); routeInsert(A, B, [r1.id, r2.id]);
      store.prefs.links = true;
      closeSheet(); endSearch(true); changed(); toast('Deux relais posés');
    } }, iEl('plus'), 'Poser les deux relais')));
  } else {
    const best = spots[0];
    kids.push(h('div', { class: 'verdict' }, h('span', { class: 'sq', style: 'background:rgb(224,72,60)' }), h('b', { text: 'Aucun emplacement trouvé' }), h('span', { text: best ? sgn(best.M) + ' dB' : '' })));
    kids.push(h('p', { class: 'note', text: 'Avec ce matériel, aucun relais ni aucune chaîne de deux relais n\'atteint la liaison exigée. Essayer un mât plus haut, la station SE-235/m2 à 50 W, un rayon plus grand ou une liaison exigée plus basse.' }));
    if (best) kids.push(h('div', { class: 'acts' }, h('button', { type: 'button', class: 'act', onclick: () => go(best) }, iEl('target'), 'Voir le meilleur point')));
  }
  openSheet('Emplacement du relais', kids);
}
/* relais posés entre a et b : ils prennent place dans le trajet entre ces deux stations */
function routeInsert(a, b, ids) {
  const r = routeIds().filter(id => !ids.includes(id)), ia = r.indexOf(a.id), ib = r.indexOf(b.id);
  if (ia < 0 || ib < 0) { study().route = [a.id, ...ids, b.id]; return; }
  const lo = Math.min(ia, ib), hi = Math.max(ia, ib);
  study().route = r.slice(0, lo + 1).concat(ia < ib ? ids : ids.slice().reverse(), r.slice(hi));
}
const relayStation = (ll, from, name) => {
  const R = study().params.relay;
  return Object.assign({}, R.a, { id: uid(), kind: 'relais', preset: R.preset, b: Object.assign({}, R.b), name: name || 'Relais', lat: ll.lat, lon: ll.lng, f: from.f, az: 0, bw: 60 });
};
async function relayTap(ll) {
  const S = study().stations, A = S.find(x => x.id === search.a), B = S.find(x => x.id === search.b);
  if (!A || !B) { endSearch(); return; }
  const rel = Object.assign(relayStation(ll, A, 'Relais'), { id: 'relais' }), relB = sideB(rel);
  if (tgtMk) map.removeLayer(tgtMk);
  tgtMk = L.marker(ll, { icon: L.divIcon({ className: 'tgt', html: '<i></i>', iconSize: [36, 36], iconAnchor: [18, 18] }), interactive: false }).addTo(map);
  const body = h('div', { style: 'display:flex;flex-direction:column;gap:12px' }, h('p', { class: 'note', text: 'Calcul des deux liaisons…' }));
  openSheet('Relais ici', body);
  const T = o => { const t = engineStation(o); return Object.assign({}, t, { g: t.ant.g }); };
  const ra = (await askProfile(engineStation(A), T(rel))).r, rb = (await askProfile(engineStation(B), T(relB))).r;
  if (!ra || !rb) { body.replaceChildren(h('p', { class: 'note', text: 'Point hors de la zone calculée.' })); return; }
  const Ma = Math.min(ra.down, ra.up), Mb = Math.min(rb.down, rb.up), M = Math.min(Ma, Mb), V = verdictOf(M);
  const row = (st, r, Mx, side, lab) => {
    const Vx = verdictOf(Mx);
    return h('button', { type: 'button', class: 'row', onclick: () => showProfile(st, { st: side }) },
      h('span', { class: 'sq', style: `background:rgb(${Vx.c.slice(0, 3)})` }),
      h('span', { class: 't' }, h('b', { text: st.name + ' ↔ relais, ' + lab }), h('small', { text: fr(r.dKm, r.dKm < 10 ? 2 : 1) + ' km · ' + (r.los ? 'visée directe' : 'masqué par le relief') })),
      h('span', { class: 'v big', text: sgn(Mx) + ' dB' }), iEl('right'));
  };
  body.replaceChildren(
    h('div', { class: 'verdict' }, h('span', { class: 'sq', style: `background:rgb(${V.c.slice(0, 3)})` }), h('b', { text: M >= 0 ? 'Relais possible' : 'Relais impossible ici' }), h('span', { text: sgn(M) + ' dB' })),
    h('div', { class: 'list' }, row(A, ra, Ma, rel, 'côté 1'), row(B, rb, Mb, relB, 'côté 2')),
    h('p', { class: 'note', text: 'Marge du sens le plus faible pour chaque liaison. ' + relayName(study().params.relay) + ' : ' + descr1(rel) + ' / ' + descr1(relB) + '. ' + lvTxt(ll.lat, ll.lng) }),
    h('div', { class: 'acts' }, h('button', { type: 'button', class: 'act primary', onclick: () => {
      const S2 = study().stations;
      if (S2.length >= 8) { toast('Huit stations au plus par étude'); return; }
      const n = S2.filter(x => /^Relais/.test(x.name)).length, rs = relayStation(ll, A, n ? 'Relais ' + (n + 1) : 'Relais');
      S2.push(rs); routeInsert(A, B, [rs.id]);
      store.prefs.links = true;
      closeSheet(); endSearch(true); changed(); toast('Relais posé');
    } }, iEl('plus'), 'Poser le relais ici')),
  );
}
/* matériel du relais : station du règlement ou réglage libre des deux côtés */
function relayGear(P) {
  const box = h('div', { style: 'display:flex;flex-direction:column;gap:12px' });
  const draw = () => {
    const R = P.relay;
    box.replaceChildren(
      h('div', { class: 'label', text: 'Matériel du relais' }),
      chips([...Object.entries(RELAYS).map(([k, v]) => [k, v.n]), ['perso', 'Autre']], R.preset || 'perso', k => { if (k !== 'perso') P.relay = relayPreset(k); else R.preset = 'perso'; save(); draw(); }),
      h('p', { class: 'note', text: (RELAYS[R.preset] || { l: 'Chaque côté se règle séparément.' }).l }),
      radioFields(R.a, () => { R.preset = 'perso'; save(); }, false, { title: 'Côté vers la 1re station' }),
      radioFields(R.b, () => { R.preset = 'perso'; save(); }, false, { title: 'Côté vers la 2e station' }),
    );
  };
  draw();
  return [box];
}
/* onglet Relais */
$('tabRelay').addEventListener('click', relaySheet);
function relaySheet() {
  const S = study().stations, P = study().params;
  const kids = [];
  if (S.length < 2) {
    kids.push(h('p', { class: 'note', text: 'Poser au moins deux stations : le départ et l\'arrivée. Les relais se placent ensuite entre les deux, dans l\'ordre du trajet.' }));
    kids.push(...relayGear(P));
    openSheet('Relais', kids, null, true);
    return;
  }
  const T = routeSt();
  kids.push(h('div', { class: 'label', text: 'Trajet de la liaison' }));
  const head = h('div', { class: 'verdict' }, h('b', { text: result ? 'Calcul du trajet…' : 'Calcul en attente' }));
  const box = h('div', { class: 'list' });
  kids.push(head, box);
  const fill = () => {
    if (T.length < 2) { head.replaceChildren(h('b', { text: 'Trajet incomplet' })); box.replaceChildren(h('div', { class: 'row' }, h('span', { class: 't' }, h('small', { text: 'Choisir un départ et une arrivée dans « Modifier le trajet ».' })))); return; }
    if (!links.length || links.some(l => !l.r)) return;
    let w = links[0];
    for (const l of links) if (l.M < w.M) w = l;
    const V = verdictOf(w.M), F = P.fade, nr = T.length - 2;
    head.replaceChildren(h('span', { class: 'sq', style: `background:rgb(${V.c.slice(0, 3)})` }),
      h('b', { text: w.M >= F ? 'La liaison passe' : w.M >= 0 ? 'Elle passe de justesse' : 'La liaison ne passe pas' }), h('span', { text: sgn(w.M) + ' dB' }));
    const rel = x => x.kind === 'relais' && x.b;
    box.replaceChildren(...links.map(l => {
      const Vx = verdictOf(l.M);
      return h('button', { type: 'button', class: 'row', onclick: () => showProfile(l.x, { st: l.y }) },
        h('span', { class: 'sq', style: `background:rgb(${Vx.c.slice(0, 3)})` }),
        h('span', { class: 't' }, h('b', { text: l.a.name + ' → ' + l.b.name }),
          h('small', { text: fr(l.r.dKm, l.r.dKm < 10 ? 2 : 1) + ' km · ' + (l.r.los ? 'visée directe' : 'masqué par le relief') + (l === w && links.length > 1 ? ' · maillon le plus faible' : '') }),
          rel(l.a) || rel(l.b) ? h('small', { text: [rel(l.a) ? 'réémis par le côté 2' : '', rel(l.b) ? 'capté par le côté 1' : ''].filter(Boolean).join(' · ') }) : null),
        h('span', { class: 'v big', text: sgn(l.M) + ' dB' }), iEl('right'));
    }));
    sumEl.textContent = T[0].name + ' → ' + T[T.length - 1].name + (nr ? ' par ' + nr + ' relais' : ', en direct') + '. La marge du trajet est celle du maillon le plus faible : ' + w.a.name + ' → ' + w.b.name + '.';
  };
  const sumEl = h('p', { class: 'note' });
  kids.push(sumEl);
  kids.push(h('div', { class: 'acts' },
    h('button', { type: 'button', class: 'act primary', onclick: routeSheet }, iEl('pen'), 'Modifier le trajet'),
    h('button', { type: 'button', class: 'act', onclick: relayHere }, iEl('target'), 'Relais au réticule')));
  kids.push(h('p', { class: 'note', text: 'Un relais capte avec un poste (côté 1, vers le départ) et réémet avec l\'autre (côté 2, vers l\'arrivée). Chaque maillon doit passer dans les deux sens : la marge indiquée est celle du sens le plus faible.' }));
  kids.push(swRow('Afficher le trajet sur la carte', null, store.prefs.links, v => { store.prefs.links = v; save(); drawLinks(); }));
  linksCb = fill;
  if (result) (links.length ? Promise.resolve() : evalLinks()).then(fill); else fill();

  kids.push(h('div', { class: 'label', text: 'Couverture du réseau' }));
  const netBox = h('div', { style: 'display:flex;flex-direction:column;gap:12px' });
  const drawNet = () => {
    const k = [swRow('Seulement les stations reliées', 'La carte ne montre que la couverture des stations atteintes depuis la station principale, maillon par maillon le long du trajet', P.net.on, v => { P.net.on = v; if (!P.net.main) P.net.main = routeIds()[0] || S[0].id; save(); drawNet(); maybeNet(); updLegend(); })];
    if (P.net.on) {
      k.push(h('div', { class: 'line' }, h('span', null, 'Station principale')));
      k.push(chips(S.map(x => [x.id, x.name]), P.net.main || routeIds()[0] || S[0].id, id => { P.net.main = id; save(); maybeNet(); }));
      k.push(h('div', { class: 'line' }, h('span', null, 'Liaison exigée'), seg([['inc', 'Incertaine'], ['bonne', 'Bonne'], ['sure', 'Sûre']], P.net.need, v => { P.net.need = v; save(); maybeNet(); })));
    }
    netBox.replaceChildren(...k);
  };
  drawNet();
  kids.push(netBox);

  kids.push(h('div', { class: 'label', text: 'Trouver où placer un relais' }));
  /* par défaut : le maillon le plus faible du trajet */
  let A = T[0] || S[0], B = T[T.length - 1] || S[1];
  if (links.length && links.every(l => l.r)) { const w = links.reduce((m, l) => (l.M < m.M ? l : m)); A = w.a; B = w.b; }
  kids.push(h('div', { class: 'line' }, h('span', null, 'Entre')), chips(S.map(x => [x.id, x.name]), A.id, id => { A = S.find(x => x.id === id); }));
  kids.push(h('div', { class: 'line' }, h('span', null, 'et')), chips(S.map(x => [x.id, x.name]), B.id, id => { B = S.find(x => x.id === id); }));
  kids.push(...relayGear(P));
  kids.push(swRow('Accessible en véhicule', 'Seulement les points proches d\'une route', P.access, v => { P.access = v; save(); }));
  kids.push(swRow('Pistes comprises', 'Chemins agricoles et forestiers', P.tracks, v => { P.tracks = v; save(); }));
  kids.push(h('div', { class: 'acts' }, h('button', { type: 'button', class: 'act primary', onclick: () => {
    if (A === B) { toast('Choisir deux stations différentes'); return; }
    startSearch(A, B);
  } }, iEl('search'), 'Chercher l\'emplacement')));
  kids.push(h('p', { class: 'note', text: 'La carte montre où un relais avec ce matériel relie les deux stations, avec les meilleurs points numérotés. Si un seul relais ne suffit pas, une chaîne de deux relais est proposée. Le relais posé prend place dans le trajet entre les deux stations.' }));
  openSheet('Relais', kids, () => { linksCb = null; }, true);
}
/* changement du trajet : maillons recalculés, couverture du réseau suivie */
function routeChanged() {
  save();
  if (result) evalLinks().then(maybeNet);
  else changed();
}
/* éditeur du trajet : ordre des stations, départ et arrivée */
function routeSheet() {
  const st = study(), S = st.stations, ids = routeIds();
  const set = r => { st.route = r; routeChanged(); routeSheet(); };
  const rows = ids.map((id, q) => {
    const x = S.find(o => o.id === id), mid = q > 0 && q < ids.length - 1, single = mid && !(x.kind === 'relais' && x.b);
    const mv = d => { const r = ids.slice(), j = q + d; if (j < 0 || j >= r.length) return; [r[q], r[j]] = [r[j], r[q]]; set(r); };
    const btn = (lab, ic, fn, off) => h('button', { type: 'button', class: 'xbtn', 'aria-label': lab, html: icon(ic), disabled: !!off, style: off ? 'opacity:.3' : '', onclick: fn });
    return h('div', { class: 'row' },
      h('span', { class: 'dot', style: `background:${colorOf(S.indexOf(x))}` }),
      h('span', { class: 't' }, h('b', { text: x.name }), h('small', { class: 'role', text: roleOf(q, ids.length) }), h('small', { text: descr(x) }),
        single ? h('small', { class: 'warn', text: 'Un seul poste : ne peut pas capter et réémettre en même temps' }) : null,
        single ? h('button', { type: 'button', class: 'more', style: 'padding:4px 0 0', text: 'En faire une station relais', onclick: () => { const Pr = relayPreset('m2'); Object.assign(x, Pr.a, { preset: 'm2', kind: 'relais' }); x.b = Pr.b; changed(); routeSheet(); } }) : null),
      btn('Monter', 'up', () => mv(-1), q === 0), btn('Descendre', 'down', () => mv(1), q === ids.length - 1),
      btn('Retirer du trajet', 'close', () => set(ids.filter(o => o !== id))));
  });
  const rest = S.filter(x => !ids.includes(x.id));
  const kids = [
    h('p', { class: 'note', text: 'Du départ à l\'arrivée, dans l\'ordre où l\'information passe. Les stations entre les deux sont les relais.' }),
    h('div', { class: 'list' }, rows.length ? rows : [h('div', { class: 'row' }, h('span', { class: 't' }, h('small', { text: 'Aucune station dans le trajet.' })))]),
  ];
  if (rest.length) {
    kids.push(h('div', { class: 'label', text: 'Ajouter au trajet' }));
    kids.push(h('p', { class: 'note', text: ids.length >= 2 ? 'La station s\'ajoute comme dernier relais, avant l\'arrivée.' : 'La station s\'ajoute à la suite.' }));
    kids.push(chips(rest.map(x => [x.id, x.name]), null, id => { const r = ids.slice(); if (r.length >= 2) r.splice(r.length - 1, 0, id); else r.push(id); set(r); }, true));
  }
  kids.push(h('div', { class: 'acts' },
    h('button', { type: 'button', class: 'act', onclick: () => { closeSheet(); relayHere(); } }, iEl('target'), 'Relais au réticule'),
    h('button', { type: 'button', class: 'act', onclick: () => { const r = ids.slice().reverse(); set(r); } }, iEl('dup'), 'Inverser')));
  if (Array.isArray(st.route)) kids.push(h('div', { class: 'acts' }, h('button', { type: 'button', class: 'act', onclick: () => { st.route = null; routeChanged(); routeSheet(); } }, iEl('list'), 'Revenir à l\'ordre des stations')));
  kids.push(h('div', { class: 'acts' }, h('button', { type: 'button', class: 'act primary', onclick: relaySheet }, iEl('check'), 'Terminé')));
  openSheet('Trajet', kids, null, true);
}
/* nouveau relais au centre de la carte, placé dans le trajet avant l'arrivée */
function relayHere() {
  const st = study(), S = st.stations;
  if (S.length >= 8) { toast('Huit stations au plus par étude'); return; }
  const ids = routeIds(), c = map.getCenter(), n = S.filter(x => x.kind === 'relais').length;
  const rs = relayStation(c, S.find(x => x.id === ids[0]) || S[0] || { f: 50 }, 'Relais ' + (n + 1));
  S.push(rs);
  const r = ids.slice();
  if (r.length >= 2) r.splice(r.length - 1, 0, rs.id); else r.push(rs.id);
  st.route = r;
  closeSheet(); store.prefs.links = true; changed(); toast(rs.name + ' posé au réticule, avant l\'arrivée');
}

/* paramètres du calcul et poste en face */
$('tabParams').addEventListener('click', () => {
  const P = study().params;
  const ch = () => { save(); changed(); };
  const kids = [
    h('div', { class: 'label', text: 'Sens de liaison' }),
    h('div', { class: 'line' }, seg([['down', 'Émission'], ['up', 'Réception'], ['both', 'Les deux']], P.dir, v => { P.dir = v; ch(); })),
    h('p', { class: 'note', text: 'Émission : des stations posées vers le poste en face. Réception : l\'inverse. Les deux : le sens le plus faible décide.' }),
    h('div', { class: 'label', text: 'Rayon de calcul' }),
    chips([[2, '2 km'], [5, '5 km'], [10, '10 km'], [20, '20 km'], [30, '30 km'], [40, '40 km']], P.r, v => { P.r = +v; ch(); }, true),
    h('div', { class: 'label', text: 'Précision' }),
    h('div', { class: 'line' }, seg([['fast', 'Rapide'], ['norm', 'Normale'], ['fine', 'Fine']], P.prec, v => { P.prec = v; ch(); })),
    h('div', { class: 'label', text: 'Poste en face' }),
    h('p', { class: 'note', text: 'Le poste qui se déplace sur le terrain. Ses réglages valent pour toute la carte.' }),
    radioFields(P.c, ch, false),
    h('div', { class: 'label', text: 'Obstacles' }),
    swRow('Bâtiments', 'Hauteurs swisstopo, comme obstacles', P.buildings, v => { P.buildings = v; ch(); }),
    swRow('Forêt', 'Perte forfaitaire pour un poste en forêt', P.forest, v => { P.forest = v; ch(); }),
    numLine('Perte en forêt', 'Par extrémité, antenne sous la canopée', P.forestDb, 'dB', v => { P.forestDb = v; ch(); }, { min: 0, max: 30 }),
    h('div', { class: 'label', text: 'Réserve' }),
    h('div', { class: 'line' }, h('span', null, 'Marge d\'évanouissement', h('small', { text: 'Seuil d\'une liaison « bonne »' })), seg([[5, '5 dB'], [10, '10 dB'], [15, '15 dB']], P.fade, v => { P.fade = +v; ch(); })),
    h('div', { class: 'line' }, h('span', null, 'Courbure (facteur k)', h('small', { text: '4/3 en atmosphère standard' })), seg([[1, '1'], [4 / 3, '4/3'], [2, '2']], P.k, v => { P.k = +v; ch(); })),
    h('div', { class: 'label', text: 'Étalonnage' }),
    h('div', { class: 'list' },
      h('button', { type: 'button', class: 'row', onclick: calibSheet }, iEl('gauge'), h('span', { class: 't' }, h('b', { text: 'Étalonnage terrain' }), h('small', { text: 'Correction ' + sgn(P.corr || 0) + ' dB · ' + (study().obs || []).length + ' essai' + ((study().obs || []).length > 1 ? 's' : '') })), iEl('right')),
      h('button', { type: 'button', class: 'row', onclick: aboutSheet }, iEl('info'), h('span', { class: 't' }, h('b', { text: 'Méthode, données et limites' })), iEl('right'))),
  ];
  openSheet('Paramètres', kids, null, true);
});
function aboutSheet() {
  const p = (t) => h('p', { class: 'note', html: t });
  const rows = ['MA-235', 'HA-235', 'FA-235/t', 'FA-235/m', 'FA-235/m8', 'FzA-235'];
  const tab = h('div', { class: 'tab' }, h('table', null,
    h('tr', null, h('th', { text: 'km' }), ...rows.map(r => h('th', { text: r.replace('-235', '') }))),
    ...TAB_RANGE.map((r, i) => h('tr', null, h('th', { text: rows[i].replace('-235', '') }), ...r.map(v => h('td', { text: String(v) }))))));
  openSheet('Méthode', [
    h('div', { class: 'label', text: 'Données' }),
    p('<b>Relief</b> : modèle de terrain de swisstopo (3d.geo.admin.ch, dérivé de swissALTI3D). <b>Bâtiments, forêt et routes</b> : tuiles vectorielles de la carte de base swisstopo. <b>Altitude des sites</b> : service d\'altitude de geo.admin.ch. Aucune autre source.'),
    h('div', { class: 'label', text: 'Calcul' }),
    p('Rayons tirés depuis chaque station. Pour chaque point : <b>espace libre</b>, plus la combinaison quadratique de la <b>perte de sol</b> (terre plane, hauteurs effectives au-dessus de la droite moyenne du terrain, avec une hauteur minimale d\'onde de sol de 0,62 λ) et de la <b>diffraction</b> par le relief et les bâtiments (Bullington, UIT-R P.526, courbure au facteur k). C\'est le modèle de Blomquist-Ladell, employé pour la planification VHF militaire. Forêt : perte forfaitaire à chaque extrémité placée en forêt.'),
    h('div', { class: 'label', text: 'Étalonnage sur le règlement 58.430' }),
    p('Le matériel SE-235 (antennes, hauteurs, puissances, stations relais) vient du règlement. Les gains efficaces et le seuil de réception (' + SENS + ' dBm) sont ajustés pour retrouver son tableau des portées (ch. 43) : distance où 80 % des emplacements sont atteints, Plateau suisse, mode FHOP. Écart moyen du modèle : 7 %. Gains et câbles sont compris dans le gain efficace.'),
    p('<b>SE-135</b> (règlement 58.440) : 0,2 ou 2 W, portée d\'environ 5 km à 2 W avec l\'antenne fouet MA-135 verticale et déployée, 80 % des emplacements. Le gain de la MA-135 (−2,1 dBi efficace, poste porté) est étalonné sur ces 5 km. Le règlement ne chiffre ni l\'antenne hélicoïdale WA-135 ni le câble HF du ZA-135 : leurs valeurs sont des estimations. Avec le ZA-135, placer la station là où se trouve l\'antenne.'),
    tab,
    p('Les essais de terrain notés en suivi en direct affinent ensuite la carte par une correction commune (Paramètres, Étalonnage terrain).'),
    h('div', { class: 'label', text: 'Relais' }),
    p('Une station relais est faite de deux postes reliés par câble relais (ch. 145) : le côté 1 capte vers le départ, le côté 2 réémet vers l\'arrivée, chacun avec son poste, sa puissance et son antenne. Le trajet va du départ à l\'arrivée par les relais dans l\'ordre ; chaque maillon doit passer dans les deux sens, et la marge du trajet est celle du maillon le plus faible. La recherche d\'emplacement garde les points où les deux liaisons passent, près d\'une route si demandé, et propose une chaîne de deux relais quand un seul ne suffit pas.'),
    p('<b>Marge</b> = puissance + gains − pertes − affaiblissement − seuil + correction terrain. Liaison sûre au-delà de la réserve + 10 dB, bonne au-delà de la réserve, incertaine entre 0 et la réserve.'),
    h('div', { class: 'label', text: 'Limites' }),
    p('Prévision, pas une garantie. Non pris en compte : végétation hors forêt, nature du sol, brouillage, bruit local, corps de l\'opérateur, orientation réelle des antennes. En mode numérique, la liaison chute brusquement à la limite de portée (ch. 42). WA-135 et ZA-135 : valeurs estimées. Un essai de liaison sur le terrain reste la référence.'),
    p('Carte et données © swisstopo, VBS (geo.admin.ch) · Leaflet (BSD-2) · QR Code Generator, Kazuhiko Arase (MIT) · Inter (OFL).'),
  ], null, true);
}

/* fond de carte et affichage */
$('baseBtn').addEventListener('click', () => {
  const pr = store.prefs;
  openSheet('Carte', [
    h('div', { class: 'line' }, h('span', null, 'Fond'), seg([['map', 'Carte'], ['grey', 'Grise'], ['photo', 'Photo']], pr.base, v => { pr.baseSet = true; setBase(v); })),
    h('div', { class: 'line' }, h('span', null, 'Détail', h('small', { text: '+1 échelle : carte plus fine, comme Calque' })), seg([[0, 'Normal'], [1, '+1 échelle']], detail(), v => { pr.detail = +v; save(); setBase(pr.base); })),
    h('div', { class: 'label', text: 'Couverture' }),
    swRow('Afficher la couverture', null, pr.show, v => { pr.show = v; save(); if (covLayer) covLayer.setOpacity(v ? pr.op : 0); legendEl.style.opacity = v ? '' : '.5'; }),
    h('div', { class: 'line' }, h('span', null, 'Opacité'), seg([[0.4, '40 %'], [0.6, '60 %'], [0.8, '80 %']], pr.op, v => { pr.op = +v; save(); if (covLayer && pr.show) covLayer.setOpacity(pr.op); })),
    swRow('Cercles du rayon de calcul', null, pr.circles, v => { pr.circles = v; save(); drawStations(); }),
    h('div', { class: 'label', text: 'Hors ligne' }),
    offlineBox(),
  ]);
});

/* études */
$('studyBtn').addEventListener('click', studySheet);
/* ouverture d'une autre étude : calcul en cours abandonné, couverture, trajet, recherche, suivi et essais de la précédente retirés */
function openStudy(id) {
  store.cur = id; save();
  runId++; pending = null; worker.postMessage({ t: 'cancel', id: runId });
  statusEl.hidden = true;
  endSearch(true); stopLive();
  closeSheet(); closeEdit();
  result = null; clearCov();
  links = []; linksLayer.clearLayers(); spotsLayer.clearLayers(); netActive = null;
  if (tgtMk) { map.removeLayer(tgtMk); tgtMk = null; }
  drawStations(); drawObs(); updName(); updLegend();
  compute();
}
/* renommer l'étude ouverte */
function renameSheet() {
  const f = h('input', { class: 'field', value: study().name, 'aria-label': 'Nom de l\'étude', maxlength: 40, enterkeyhint: 'done' });
  const ok = () => { const v = f.value.trim(); if (v) { study().name = v; save(); updName(); } studySheet(); };
  f.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ok(); } });
  openSheet('Renommer l\'étude', [f, h('div', { class: 'acts' }, h('button', { type: 'button', class: 'act primary', onclick: ok }, iEl('check'), 'Enregistrer'))]);
  setTimeout(() => { f.focus(); f.select(); }, 250);
}
function studySheet() {
  const kids = [
    h('div', { class: 'list' }, store.studies.map(s => h('button', { type: 'button', class: 'row', onclick: () => {
      if (s.id === store.cur) { closeSheet(); return; }
      openStudy(s.id);
      const f = s.stations[0]; if (f) map.setView([f.lat, f.lon], 12);
    } }, h('span', { class: 't' }, h('b', { text: s.name }), h('small', { text: s.stations.length + (s.stations.length > 1 ? ' stations' : ' station') + ' · rayon ' + s.params.r + ' km' })), s.id === store.cur ? h('i', { 'data-i': 'check', class: 'ck', html: icon('check') }) : null))),
    h('div', { class: 'acts' },
      h('button', { type: 'button', class: 'act', onclick: () => {
        const s = { id: uid(), name: 'Étude ' + (store.studies.length + 1), stations: [], params: Object.assign(DEF_PARAMS(), { c: Object.assign({}, study().params.c) }) };
        store.studies.push(s); openStudy(s.id);
        toast('Nouvelle étude');
      } }, iEl('plus'), 'Nouvelle'),
      h('button', { type: 'button', class: 'act', onclick: renameSheet }, iEl('pen'), 'Renommer'),
      h('button', { type: 'button', class: 'act', onclick: () => {
        const c = JSON.parse(JSON.stringify(study())); c.id = uid(); c.name = study().name + ' (copie)'; c.stations.forEach(x => { x.id = uid(); }); c.params.net = Object.assign({}, c.params.net, { main: null });
        if (Array.isArray(c.route)) { const o = study(); c.route = c.route.map(id => { const q = o.stations.findIndex(x => x.id === id); return q >= 0 ? c.stations[q].id : null; }).filter(Boolean); }
        store.studies.push(c); openStudy(c.id); toast('Étude dupliquée');
      } }, iEl('dup'), 'Dupliquer')),
    h('div', { class: 'label', text: 'Partage et Calque' }),
    h('div', { class: 'list' },
      h('button', { type: 'button', class: 'row', onclick: shareSheet }, iEl('share'), h('span', { class: 't' }, h('b', { text: 'Partager par QR code' }), h('small', { text: 'Un lien qui ouvre cette étude sur un autre téléphone' })), iEl('right')),
      h('button', { type: 'button', class: 'row', onclick: exportGeo }, iEl('down2'), h('span', { class: 't' }, h('b', { text: 'Exporter pour Calque' }), h('small', { text: 'Fichier GeoJSON : stations, liaisons, zones hors portée' })), iEl('right')),
      h('button', { type: 'button', class: 'row', onclick: () => fileIn.click() }, iEl('file'), h('span', { class: 't' }, h('b', { text: 'Importer un fichier' }), h('small', { text: 'Export de Portée, ou carte de Calque (GeoJSON)' })), iEl('right'))),
    store.studies.length > 1 ? h('div', { class: 'acts' }, h('button', { type: 'button', class: 'act danger', onclick: () => {
      const i = store.studies.indexOf(study()); store.studies.splice(i, 1); openStudy(store.studies[0].id); toast('Étude supprimée');
    } }, iEl('trash'), 'Supprimer « ' + study().name + ' »')) : null,
  ];
  openSheet('Études', kids);
}
const updName = () => { $('studyName').textContent = study().name; };
updName();

/* recherche de lieux (geo.admin.ch) et saisie de coordonnées */
$('searchBtn').addEventListener('click', () => {
  const f = h('input', { class: 'field search', type: 'search', placeholder: 'Lieu, adresse, coordonnées MN95', 'aria-label': 'Rechercher', enterkeyhint: 'search' });
  const res = h('div', { class: 'list', hidden: true });
  let t = 0, q = 0;
  const go = (lat, lon, z) => { closeSheet(); map.setView([lat, lon], z || 14); };
  f.addEventListener('input', () => {
    clearTimeout(t);
    const v = f.value.trim();
    const c = parseCoord(v);
    if (c) { res.hidden = false; res.replaceChildren(h('button', { type: 'button', class: 'row', onclick: () => go(c[0], c[1], 15) }, iEl('target'), h('span', { class: 't' }, h('b', { text: 'Aller aux coordonnées' }), h('small', { text: lvTxt(c[0], c[1]) })))); return; }
    if (v.length < 2) { res.hidden = true; return; }
    t = setTimeout(async () => {
      const my = ++q;
      try {
        const r = await fetch('https://api3.geo.admin.ch/rest/services/api/SearchServer?type=locations&sr=4326&limit=10&lang=fr&searchText=' + encodeURIComponent(v), { credentials: 'omit', referrerPolicy: 'no-referrer' });
        const j = await r.json();
        if (my !== q) return;
        const items = (j.results || []).filter(x => x.attrs && isFinite(x.attrs.lat) && isFinite(x.attrs.lon));
        res.hidden = false;
        res.replaceChildren(...(items.length ? items.map(x => h('button', { type: 'button', class: 'row', onclick: () => go(x.attrs.lat, x.attrs.lon, x.attrs.origin === 'address' ? 17 : 14) },
          h('span', { class: 't' }, h('b', { text: String(x.attrs.label || '').replace(/<[^>]*>/g, '') }), h('small', { text: lvTxt(x.attrs.lat, x.attrs.lon) })))) : [h('div', { class: 'row' }, h('span', { class: 't' }, h('small', { text: 'Aucun résultat' })))]));
      } catch (e) { res.hidden = false; res.replaceChildren(h('div', { class: 'row' }, h('span', { class: 't' }, h('small', { text: 'Recherche indisponible' })))); }
    }, 250);
  });
  openSheet('Rechercher', [f, res]);
  setTimeout(() => f.focus(), 350);
});
function parseCoord(v) {
  const n = v.replace(/[’']/g, '').match(/-?\d+(?:[.,]\d+)?/g);
  if (!n || n.length !== 2) return null;
  const a = num(n[0]), b = num(n[1]);
  if (a > 2400000 && a < 2900000 && b > 1000000 && b < 1350000) return fromLV95(a, b);
  if (a > 480000 && a < 850000 && b > 60000 && b < 320000) return fromLV95(a + 2000000, b + 1000000);
  if (Math.abs(a) <= 90 && Math.abs(b) <= 180 && /[.,]/.test(v)) return [a, b];
  return null;
}
coordEl.addEventListener('click', () => {
  const c = map.getCenter();
  openSheet('Centre de la carte', [
    h('div', { class: 'list' },
      h('div', { class: 'row' }, h('span', { class: 't' }, h('b', { text: 'MN95' })), h('span', { class: 'v', text: lvTxt(c.lat, c.lng) })),
      h('div', { class: 'row' }, h('span', { class: 't' }, h('b', { text: 'WGS 84' })), h('span', { class: 'v', text: c.lat.toFixed(5) + ', ' + c.lng.toFixed(5) }))),
    h('div', { class: 'acts' }, h('button', { type: 'button', class: 'act', onclick: () => copyText(lvTxt(c.lat, c.lng).replace(/'/g, '')) }, iEl('copy'), 'Copier MN95')),
    h('p', { class: 'note', text: 'Pour aller à des coordonnées, les saisir dans la recherche.' }),
  ]);
});

/* suivi en direct : position GPS, marge vers chaque station, trace colorée */
const liveEl = $('live'), locBtn = $('locBtn');
let live = null;
const lastPos = () => live && live.pos;
locBtn.addEventListener('click', () => { if (live) stopLive(); else startLive(); });
function startLive() {
  if (!navigator.geolocation) { toast('Position indisponible sur cet appareil'); return; }
  live = { watch: null, lock: null, trace: L.layerGroup().addTo(map), me: null, acc: null, pos: null, rows: null, busy: false, pending: false, first: true, last: null };
  locBtn.classList.add('on');
  legendEl.classList.add('min');
  renderLive();
  live.watch = navigator.geolocation.watchPosition(onPos, err => {
    if (!live || (err.code !== 1 && live.pos)) return;
    toast(err.code === 1 ? (window.porteeApp ? 'Accès à la position refusé : l\'autoriser dans Réglages, Portée, Position' : 'Accès à la position refusé : l\'autoriser dans les réglages du navigateur') : 'Position indisponible pour le moment', 5000);
    if (err.code === 1) stopLive();
  }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
  lockScreen();
  toast('Suivi en direct');
}
function stopLive() {
  if (!live) return;
  if (live.watch != null) navigator.geolocation.clearWatch(live.watch);
  try { if (live.lock) live.lock.release(); } catch (e) {}
  for (const l of [live.trace, live.me, live.acc]) if (l) map.removeLayer(l);
  live = null;
  locBtn.classList.remove('on');
  liveEl.hidden = true;
}
async function lockScreen() {
  try { if (live && 'wakeLock' in navigator && document.visibilityState === 'visible') live.lock = await navigator.wakeLock.request('screen'); } catch (e) {}
}
document.addEventListener('visibilitychange', () => { if (live && document.visibilityState === 'visible') lockScreen(); });
function onPos(p) {
  if (!live) return;
  const ll = [p.coords.latitude, p.coords.longitude], acc = p.coords.accuracy || 0;
  live.pos = { lat: ll[0], lon: ll[1], acc, t: Date.now() };
  if (!live.me) {
    live.acc = L.circle(ll, { radius: acc, color: '#0A84FF', weight: 1, fillOpacity: 0.12, interactive: false }).addTo(map);
    live.me = L.marker(ll, { icon: L.divIcon({ className: 'me-dot', iconSize: [18, 18] }), interactive: false, zIndexOffset: 1000 }).addTo(map);
  } else { live.me.setLatLng(ll); live.acc.setLatLng(ll); live.acc.setRadius(acc); }
  if (live.first) { live.first = false; map.setView(ll, Math.max(map.getZoom(), 14)); }
  else if (!map.getBounds().pad(-0.2).contains(ll) && editEl.hidden && !sheet.classList.contains('open')) map.panTo(ll);
  liveRefresh(false);
}
async function liveRefresh(force) {
  if (!live || !live.pos) return;
  if (live.busy) { live.pending = true; return; }
  const P0 = live.pos;
  if (!force && live.last && map.distance([P0.lat, P0.lon], [live.last.lat, live.last.lon]) < 5 && P0.t - live.last.t < 4000) { renderLive(); return; }
  const S = study().stations;
  if (!S.length || !result) { live.rows = null; renderLive(); return; }
  live.busy = true;
  const c = study().params.c, dir = study().params.dir;
  const T = { lat: P0.lat, lon: P0.lon, h: c.h, p: dBm(c.pw), g: c.g, lc: c.lc || 0, sens: c.sens };
  const rows = [];
  for (const s of S) {
    let bestR = null, bestM = null;
    for (const x of sidesOf(s)) {
      const { r } = await askProfile(engineStation(x), T);
      if (!r) continue;
      const M = dir === 'down' ? r.down : dir === 'up' ? r.up : Math.min(r.down, r.up);
      if (bestM == null || M > bestM) { bestM = M; bestR = r; }
    }
    rows.push({ s, i: S.indexOf(s), r: bestR, M: bestM });
  }
  if (!live) return;
  live.rows = rows; live.last = { lat: P0.lat, lon: P0.lon, t: P0.t };
  const best = rows.filter(x => x.r).sort((a, b) => b.M - a.M)[0];
  if (best) {
    const V = verdictOf(best.M);
    L.circleMarker([P0.lat, P0.lon], { radius: 5, color: '#fff', weight: 1.5, fillColor: `rgb(${V.c.slice(0, 3)})`, fillOpacity: 1, interactive: false }).addTo(live.trace);
  }
  live.busy = false;
  renderLive();
  if (live.pending) { live.pending = false; liveRefresh(false); }
}
function renderLive() {
  if (!live) return;
  const P0 = live.pos, kids = [];
  kids.push(h('div', { class: 'lh' }, h('i', { class: 'pulse' }), 'En direct',
    h('em', { class: P0 && P0.acc > 50 ? 'warn' : null, text: P0 ? '± ' + Math.round(P0.acc) + ' m' : 'recherche du GPS…' })));
  if (P0) {
    if (!study().stations.length) kids.push(h('div', { class: 'lr' }, h('span', { class: 'mu', text: 'Aucune station posée' })));
    else if (!result) kids.push(h('div', { class: 'lr' }, h('span', { class: 'mu', text: 'Calcul en cours' })));
    else if (live.rows) {
      const ok = live.rows.filter(x => x.r).sort((a, b) => b.M - a.M);
      if (!ok.length) kids.push(h('div', { class: 'lr' }, h('span', { class: 'mu', text: 'Position hors de la zone calculée' })));
      if (!ok.find(x => x.s.id === live.sel)) live.sel = ok.length ? ok[0].s.id : null;
      for (const x of ok) {
        const V = verdictOf(x.M);
        kids.push(h('button', { type: 'button', class: 'lr' + (x.s.id === live.sel && S1() ? ' on' : ''), onclick: () => { live.sel = x.s.id; renderLive(); showProfile(x.s, { lat: live.pos.lat, lon: live.pos.lon }); } },
          h('span', { class: 'dot', style: `background:${colorOf(x.i)}` }), h('b', { text: x.s.name }),
          h('span', { class: 'mu', text: fr(x.r.dKm, x.r.dKm < 10 ? 1 : 0) + ' km' }),
          h('em', null, h('span', { class: 'sq', style: `background:rgb(${V.c.slice(0, 3)})` }), sgn(x.M, 0) + ' dB')));
      }
      if (ok.length) kids.push(h('div', { class: 'ltest' },
        h('span', { class: 'mu', text: 'Essai' + (S1() ? ' avec ' + (study().stations.find(x => x.id === live.sel) || {}).name : '') }),
        h('button', { type: 'button', class: 'chip ok', text: 'Liaison OK', onclick: () => logTest(true) }),
        h('button', { type: 'button', class: 'chip ko', text: 'Pas de liaison', onclick: () => logTest(false) })));
    }
  }
  liveEl.replaceChildren(...kids);
  liveEl.hidden = false;
}
const S1 = () => study().stations.length > 1;
/* essai de liaison sur le terrain : comparé à la prévision, sert à l'étalonnage */
function logTest(ok) {
  if (!live || !live.pos || !live.rows) return;
  const row = live.rows.find(x => x.s.id === live.sel && x.r);
  if (!row) return;
  const st = study();
  st.obs.push({ t: Date.now(), lat: live.pos.lat, lon: live.pos.lon, sid: row.s.id, ok, M: Math.round((row.M - (st.params.corr || 0)) * 10) / 10 });
  save(); drawObs();
  const agree = (row.M >= 0) === ok;
  toast((ok ? 'Liaison OK notée' : 'Absence de liaison notée') + ' · prévision ' + sgn(row.M, 0) + ' dB' + (agree ? ', conforme' : ', écart') + ' · ' + st.obs.length + ' essai' + (st.obs.length > 1 ? 's' : ''));
}
const obsLayer = L.layerGroup().addTo(map);
function drawObs() {
  obsLayer.clearLayers();
  for (const o of study().obs || []) {
    L.marker([o.lat, o.lon], { icon: L.divIcon({ className: 'obs ' + (o.ok ? 'ok' : 'ko'), html: `<b>${o.ok ? '✓' : '✕'}</b>`, iconSize: [0, 0] }), keyboard: false, zIndexOffset: 400 })
      .on('click', () => calibSheet()).addTo(obsLayer);
  }
}
/* étalonnage : correction qui accorde le mieux prévisions et essais (centre de l'intervalle optimal le plus proche de 0) */
function calibrate(obs) {
  const score = c => obs.filter(o => (o.M + c >= 0) === o.ok).length;
  let bestN = -1;
  const cs = [];
  for (let c = -25; c <= 25.001; c += 0.5) cs.push([Math.round(c * 2) / 2, score(c)]);
  for (const [, n] of cs) bestN = Math.max(bestN, n);
  const runs = [];
  let cur = null;
  for (const [c, n] of cs) { if (n === bestN) { if (!cur) { cur = [c, c]; runs.push(cur); } else cur[1] = c; } else cur = null; }
  runs.sort((a, b) => Math.min(Math.abs(a[0]), Math.abs(a[1]), a[0] <= 0 && a[1] >= 0 ? 0 : 99) - Math.min(Math.abs(b[0]), Math.abs(b[1]), b[0] <= 0 && b[1] >= 0 ? 0 : 99));
  const r = runs[0] || [0, 0];
  const c = r[0] <= 0 && r[1] >= 0 ? 0 : Math.round((r[0] + r[1]) / 2 * 2) / 2;
  return { c, n: bestN, tot: obs.length, now: score(0) };
}
function calibSheet() {
  const st = study(), P = st.params, obs = st.obs || [];
  const kids = [h('p', { class: 'note', text: 'En suivi en direct, « Liaison OK » ou « Pas de liaison » note un essai réel à la position du moment. La correction qui accorde le mieux la carte aux essais s\'ajoute ensuite à toutes les marges.' })];
  const okN = obs.filter(o => o.ok).length;
  kids.push(h('div', { class: 'list' },
    h('div', { class: 'row' }, h('span', { class: 't' }, h('b', { text: 'Essais' })), h('span', { class: 'v', text: obs.length + ' (' + okN + ' OK, ' + (obs.length - okN) + ' sans liaison)' })),
    h('div', { class: 'row' }, h('span', { class: 't' }, h('b', { text: 'Correction appliquée' })), h('span', { class: 'v big', text: sgn(P.corr || 0) + ' dB' }))));
  if (obs.length) {
    const cb = calibrate(obs), pct = n => Math.round(n / obs.length * 100) + ' %';
    const corrNow = P.corr || 0, agreeNow = obs.filter(o => (o.M + corrNow >= 0) === o.ok).length;
    kids.push(h('div', { class: 'list' },
      h('div', { class: 'row' }, h('span', { class: 't' }, h('b', { text: 'Accord avec la carte' }), h('small', { text: 'Avec la correction appliquée' })), h('span', { class: 'v', text: pct(agreeNow) })),
      h('div', { class: 'row' }, h('span', { class: 't' }, h('b', { text: 'Correction proposée' }), h('small', { text: 'Accord ' + pct(cb.n) + (obs.length < 8 ? ', peu d\'essais : à confirmer' : '') })), h('span', { class: 'v big', text: sgn(cb.c) + ' dB' }))));
    kids.push(h('div', { class: 'acts' }, h('button', { type: 'button', class: 'act primary', onclick: () => { P.corr = cb.c; save(); closeSheet(); changed(); toast('Correction ' + sgn(cb.c) + ' dB appliquée'); } }, iEl('check'), 'Appliquer ' + sgn(cb.c) + ' dB')));
    kids.push(h('div', { class: 'label', text: 'Derniers essais' }));
    kids.push(h('div', { class: 'list' }, obs.slice(-12).reverse().map(o => {
      const sn = (st.stations.find(x => x.id === o.sid) || { name: 'station retirée' }).name, agree = (o.M + corrNow >= 0) === o.ok;
      return h('button', { type: 'button', class: 'row sub', onclick: () => { closeSheet(); map.setView([o.lat, o.lon], Math.max(map.getZoom(), 15)); } },
        h('span', { class: 't' }, h('b', { text: (o.ok ? '✓ ' : '✕ ') + sn }), h('small', { text: new Date(o.t).toLocaleString('fr-CH', { dateStyle: 'short', timeStyle: 'short' }) + ' · ' + lvTxt(o.lat, o.lon) })),
        h('span', { class: 'v' + (agree ? '' : ' warn'), text: 'prévu ' + sgn(o.M + corrNow, 0) + ' dB' }));
    })));
  }
  kids.push(h('div', { class: 'acts' },
    h('button', { type: 'button', class: 'act', onclick: () => { P.corr = 0; save(); closeSheet(); changed(); toast('Correction remise à zéro'); } }, 'Correction à zéro'),
    obs.length ? h('button', { type: 'button', class: 'act danger', onclick: () => { st.obs = []; save(); drawObs(); closeSheet(); toast('Essais effacés'); } }, iEl('trash'), 'Effacer') : null));
  openSheet('Étalonnage terrain', kids, null, true);
}

/* échelle de la carte */
const scaleEl = $('scale');
function updScale() {
  const y = map.getSize().y / 2, a = map.containerPointToLatLng([20, y]), b = map.containerPointToLatLng([120, y]);
  const mpp = map.distance(a, b) / 100, max = mpp * 110, pw = 10 ** Math.floor(Math.log10(max)), d = max / pw;
  const nice = (d >= 5 ? 5 : d >= 2 ? 2 : 1) * pw;
  scaleEl.firstChild.textContent = nice >= 1000 ? fr(nice / 1000, nice % 1000 ? 1 : 0) + ' km' : Math.round(nice) + ' m';
  scaleEl.lastChild.style.width = Math.round(nice / mpp) + 'px';
}
map.on('zoomend moveend resize', updScale);
updScale();

/* ================= partage, export, import ================= */
const b64u = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = t => Uint8Array.from(atob(t.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const plainStudy = st => ({ v: 1, n: st.name, p: st.params, r: Array.isArray(st.route) ? routeIds(st).map(id => st.stations.findIndex(x => x.id === id)) : undefined, s: st.stations.map(x => { const o = Object.assign({}, x); delete o.alt; delete o._open; if (o.b) { o.b = Object.assign({}, o.b); delete o.b._open; } return o; }) });
async function packStudy(st) {
  const bytes = new TextEncoder().encode(JSON.stringify(plainStudy(st)));
  try { const z = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()); return 'z' + b64u(z); }
  catch (e) { return 'j' + b64u(bytes); }
}
async function unpackStudy(t) {
  const raw = unb64u(t.slice(1));
  const bytes = t[0] === 'z' ? new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()) : raw;
  return JSON.parse(new TextDecoder().decode(bytes));
}
/* étude reçue : nouvelle étude avec de nouveaux identifiants */
function addStudy(o, name) {
  if (!o || !Array.isArray(o.s)) throw new Error('vide');
  const st = { id: uid(), name: String(name || o.n || 'Étude reçue').slice(0, 40), params: Object.assign(DEF_PARAMS(), o.p || {}), stations: o.s.slice(0, 8).map(x => Object.assign({}, x, { id: uid() })), obs: [] };
  st.params.c = Object.assign(DEF_PARAMS().c, (o.p || {}).c || {});
  if (!st.params.relay || !st.params.relay.a) st.params.relay = relayPreset('m2');
  st.params.net = Object.assign(DEF_PARAMS().net, (o.p || {}).net || {}, { main: null });
  st.stations.forEach(x => { migrateRadio(x); if (x.b) migrateRadio(x.b); if (!isFinite(x.lat) || !isFinite(x.lon)) throw new Error('coord'); });
  if (Array.isArray(o.r)) st.route = o.r.filter(i => st.stations[i]).map(i => st.stations[i].id);
  store.studies.push(st);
  openStudy(st.id);
  if (st.stations.length) map.fitBounds(L.latLngBounds(st.stations.map(x => [x.lat, x.lon])).pad(0.4), { maxZoom: 13 });
  return st;
}
async function shareSheet() {
  const data = await packStudy(study());
  const url = location.origin + location.pathname + '#i=' + data;
  const box = h('div', { class: 'qr' });
  try { const q = qrcode(0, 'L'); q.addData(url, 'Byte'); q.make(); box.innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); }
  catch (e) { box.append(h('p', { class: 'note', text: 'Étude trop grande pour un QR code : partager le lien.' })); }
  openSheet('Partager l\'étude', [
    box,
    h('p', { class: 'note', text: 'Viser ce code avec l\'appareil photo d\'un autre téléphone : l\'étude « ' + study().name + ' » s\'ouvre dans Portée. Les essais de terrain ne sont pas transmis.' }),
    h('div', { class: 'acts' },
      navigator.share ? h('button', { type: 'button', class: 'act primary', onclick: () => navigator.share({ title: 'Portée · ' + study().name, url }).catch(() => {}) }, iEl('share'), 'Envoyer le lien') : null,
      h('button', { type: 'button', class: 'act', onclick: () => copyText(url) }, iEl('copy'), 'Copier le lien')),
  ]);
}
/* lien reçu : #i=… */
async function checkHash() {
  const m = /^#i=([A-Za-z0-9_-]+)$/.exec(location.hash);
  if (!m) return;
  history.replaceState(null, '', location.pathname);
  let o;
  try { o = await unpackStudy(m[1]); } catch (e) { toast('Lien d\'étude illisible'); return; }
  openSheet('Étude reçue', [
    h('p', { class: 'note', text: '« ' + (o.n || 'Étude') + ' » : ' + (o.s || []).length + ' station' + ((o.s || []).length > 1 ? 's' : '') + '. Elle s\'ajoute aux études de cet appareil.' }),
    h('div', { class: 'acts' }, h('button', { type: 'button', class: 'act', onclick: closeSheet }, 'Ignorer'),
      h('button', { type: 'button', class: 'act primary', onclick: () => { try { addStudy(o); toast('Étude importée'); } catch (e) { toast('Étude illisible'); } } }, iEl('check'), 'Importer')),
  ]);
}
window.addEventListener('hashchange', checkHash);

/* zones hors portée en polygones (carrés en marche, contours extérieurs, simplifiés) */
function deadZones() {
  if (!result || search) return [];
  const { nx, ny, mar, nod, bounds } = result, f = Math.max(1, Math.ceil(Math.max(nx, ny) / 260));
  const W = Math.ceil(nx / f), H = Math.ceil(ny / f), PW = W + 2, m = new Uint8Array(PW * (H + 2));
  for (let v = 0; v < H; v++) for (let u = 0; u < W; u++) {
    let dead = 0, comp = 0;
    for (let j = v * f; j < Math.min(ny, (v + 1) * f); j++) for (let i = u * f; i < Math.min(nx, (u + 1) * f); i++) {
      const k = j * nx + i, M = mar[k];
      if (!(M === M) || (nod && nod[k])) continue;
      comp++; if (M < 0) dead++;
    }
    if (comp && dead * 2 > comp) m[(v + 1) * PW + u + 1] = 1;
  }
  const segs = new Map(), key = (x, y) => x * 2 + ',' + y * 2, add = (a, b) => { for (const [p, q] of [[a, b], [b, a]]) { const k = key(...p); if (!segs.has(k)) segs.set(k, []); segs.get(k).push(q); } };
  for (let y = 0; y < H + 1; y++) for (let x = 0; x < PW - 1; x++) {
    const tl = m[y * PW + x], tr = m[y * PW + x + 1], br = m[(y + 1) * PW + x + 1], bl = m[(y + 1) * PW + x], c = tl * 8 + tr * 4 + br * 2 + bl;
    const T = [x + 0.5, y], Rr = [x + 1, y + 0.5], B = [x + 0.5, y + 1], Lf = [x, y + 0.5];
    const tab = { 1: [[Lf, B]], 2: [[B, Rr]], 3: [[Lf, Rr]], 4: [[T, Rr]], 5: [[Lf, T], [B, Rr]], 6: [[T, B]], 7: [[Lf, T]], 8: [[Lf, T]], 9: [[T, B]], 10: [[T, Rr], [Lf, B]], 11: [[T, Rr]], 12: [[Lf, Rr]], 13: [[B, Rr]], 14: [[Lf, B]] }[c];
    if (tab) for (const [a, b] of tab) add(a, b);
  }
  const used = new Set(), rings = [];
  for (const [k0, nb] of segs) {
    if (used.has(k0) || nb.length < 2) continue;
    const ring = [], [sx, sy] = k0.split(',').map(v => +v / 2);
    let cur = [sx, sy], prev = null;
    for (let guard = 0; guard < 200000; guard++) {
      const k = key(...cur);
      if (used.has(k)) break;
      used.add(k); ring.push(cur);
      const opts = segs.get(k) || [], nxt = opts.find(q => !prev || key(...q) !== key(...prev)) || opts[0];
      prev = cur; cur = nxt;
      if (!cur) break;
    }
    if (ring.length >= 4) rings.push(ring);
  }
  const area = r => { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a / 2); };
  const inside = (pt, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[i], b = r[j]; if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  const big = rings.filter(r => area(r) >= 3).sort((a, b) => area(b) - area(a)).slice(0, 300);
  const outer = big.filter(r => big.filter(o => o !== r && area(o) > area(r) && inside(r[0], o)).length % 2 === 0).slice(0, 150);
  const dp = (pts, eps) => {
    if (pts.length < 4) return pts;
    let dm = 0, im = 0; const a = pts[0], b = pts[pts.length - 1];
    for (let i = 1; i < pts.length - 1; i++) { const p = pts[i], d = Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / (Math.hypot(b[0] - a[0], b[1] - a[1]) || 1); if (d > dm) { dm = d; im = i; } }
    return dm > eps ? dp(pts.slice(0, im + 1), eps).slice(0, -1).concat(dp(pts.slice(im), eps)) : [a, b];
  };
  const P0 = L.CRS.EPSG3857.project(L.latLng(bounds[0][0], bounds[0][1])), P1 = L.CRS.EPSG3857.project(L.latLng(bounds[1][0], bounds[1][1]));
  const dx = (P1.x - P0.x) / nx, dy = (P1.y - P0.y) / ny;
  return outer.map(r => {
    const half = Math.floor(r.length / 2), simp = dp(r.slice(0, half + 1), 0.6).slice(0, -1).concat(dp(r.slice(half).concat([r[0]]), 0.6)).slice(0, 1400);
    const ll = simp.map(([x, y]) => { const cx = (x - 1) * f + f / 2, cy = (y - 1) * f + f / 2; const q = L.CRS.EPSG3857.unproject(L.point(P0.x + cx * dx, P1.y - cy * dy)); return [+q.lng.toFixed(6), +q.lat.toFixed(6)]; });
    ll.push(ll[0]);
    return ll;
  });
}
const hexOf = c => '#' + c.slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
async function exportGeo() {
  closeSheet();
  const st = study(), feats = [];
  for (const s of st.stations) feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [+s.lon.toFixed(6), +s.lat.toFixed(6)] },
    properties: { designation: s.name, nom: s.name, type: 'signe', code: 'radio', bibliotheque: '52.003', identite: 'ami', description: descr(s) + ' · ' + fr(s.f, 3) + ' MHz' } });
  for (const l of links) {
    if (!l.r) continue;
    const V = verdictOf(l.M);
    feats.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[+l.a.lon.toFixed(6), +l.a.lat.toFixed(6)], [+l.b.lon.toFixed(6), +l.b.lat.toFixed(6)]] },
      properties: { nom: l.a.name + ' ↔ ' + l.b.name + ' ' + sgn(l.M, 0) + ' dB', type: 'ligne', couleur: hexOf(V.c), description: 'Liaison radio : ' + V.n.toLowerCase() + ', marge du sens le plus faible ' + sgn(l.M) + ' dB' } });
  }
  for (const ring of deadZones()) feats.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] },
    properties: { nom: 'Hors portée', type: 'surface', couleur: '#E0483C', description: 'Zone hors portée radio (Portée, ' + new Date().toLocaleDateString('fr-CH') + ')' } });
  const fc = { type: 'FeatureCollection', name: st.name, portee: plainStudy(st), features: feats };
  const name = (st.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'etude') + '.geojson';
  const blob = new Blob([JSON.stringify(fc)], { type: 'application/geo+json' });
  try {
    const file = new File([blob], name, { type: 'application/geo+json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: st.name }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  toast('Fichier ' + name + ' enregistré');
}
/* import : export de Portée (étude complète) ou carte de Calque (les points deviennent des stations) */
const fileIn = h('input', { type: 'file', accept: '.geojson,.json,application/geo+json,application/json', hidden: true });
document.body.append(fileIn);
fileIn.addEventListener('change', async () => {
  const f = fileIn.files && fileIn.files[0]; fileIn.value = '';
  if (!f) return;
  if (f.size > 12 << 20) { toast('Fichier trop volumineux'); return; }
  let j;
  try { j = JSON.parse(await f.text()); } catch (e) { toast('Fichier illisible'); return; }
  try {
    if (j && j.portee && Array.isArray(j.portee.s)) { addStudy(j.portee, j.portee.n || j.name); toast('Étude importée'); return; }
    const pts = [];
    const walk = g => { if (!g) return; if (g.type === 'FeatureCollection') (g.features || []).forEach(walk); else if (g.type === 'Feature' && g.geometry && g.geometry.type === 'Point') pts.push(g); };
    walk(j);
    if (!pts.length) { toast('Aucun point à reprendre dans ce fichier'); return; }
    const model = study().stations[0] || { radio: 'se235m', pw: 50, ant: 'FAm', h: ANTS.FAm.h, g: ANTS.FAm.g, lc: 0, sens: SENS, f: 50 };
    const s = pts.slice(0, 8).map((p, q) => {
      const pr = p.properties || {}, [lon, lat] = p.geometry.coordinates;
      const name = String(pr.designation || pr.nom || pr.name || 'Station ' + (q + 1)).slice(0, 40);
      return Object.assign({}, model, { id: uid(), name, lat, lon, kind: /relais/i.test(name) ? 'relais' : null, b: /relais/i.test(name) ? relayPreset('m2').b : null, alt: null });
    });
    addStudy({ n: j.name || f.name.replace(/\.[^.]+$/, ''), p: study().params, s });
    toast(s.length + ' point' + (s.length > 1 ? 's' : '') + ' repris comme stations' + (pts.length > 8 ? ' (huit au plus)' : ''));
  } catch (e) { toast('Fichier illisible ou format non reconnu'); }
});

/* ================= hors ligne ================= */
const TILE_CACHE = 'portee-carte-2';
let swReg = null;
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').then(r => { swReg = r; }).catch(() => {});
/* nouveau service worker actif : les tuiles qui avaient échoué sont redemandées */
if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('controllerchange', () => { if (baseLayer) baseLayer.redraw(); });
function offlineBox() {
  const box = h('div', { style: 'display:flex;flex-direction:column;gap:12px' });
  const info = h('p', { class: 'note', text: 'Charge sur l\'appareil la carte et les données de la zone de l\'étude (stations et rayon), pour travailler sans réseau.' });
  const draw = async () => {
    let used = '';
    try { const e = await navigator.storage.estimate(); used = ' Données gardées : ' + fr((e.usage || 0) / 1048576, 0) + ' Mo.'; } catch (e) {}
    info.textContent = 'Charge sur l\'appareil la carte et les données de la zone de l\'étude (stations et rayon), pour travailler sans réseau.' + used + (navigator.serviceWorker && !navigator.serviceWorker.controller ? ' Le mode hors ligne s\'active à la prochaine ouverture de l\'app.' : '');
  };
  draw();
  box.append(info, h('div', { class: 'acts' },
    h('button', { type: 'button', class: 'act primary', onclick: () => { closeSheet(); prepareOffline(); } }, iEl('cloud'), 'Préparer la zone'),
    h('button', { type: 'button', class: 'act', onclick: async () => { try { await caches.delete(TILE_CACHE); await caches.delete('portee-data'); } catch (e) {} draw(); toast('Données hors ligne effacées'); } }, iEl('trash'), 'Vider')));
  return box;
}
const lon2t = (lon, z) => Math.floor((lon + 180) / 360 * 2 ** z);
const lat2t = (lat, z) => { const r = lat * Math.PI / 180; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z); };
async function prepareOffline() {
  const S = study().stations, P = study().params;
  let bb = map.getBounds();
  if (S.length) {
    const b = L.latLngBounds(S.map(s => [s.lat, s.lon])), pad = P.r / 111 + 0.01;
    bb = L.latLngBounds([[b.getSouth() - pad, b.getWest() - pad / Math.cos(b.getCenter().lat * Math.PI / 180)], [b.getNorth() + pad, b.getEast() + pad / Math.cos(b.getCenter().lat * Math.PI / 180)]]);
  }
  const base = BASES[store.prefs.base] || BASES.map, urls = [], dz = detail();
  for (let z = 8 + dz; z <= Math.min(base.max, 16 + dz); z++) {
    const x0 = lon2t(bb.getWest(), z), x1 = lon2t(bb.getEast(), z), y0 = lat2t(bb.getNorth(), z), y1 = lat2t(bb.getSouth(), z);
    if (urls.length + (x1 - x0 + 1) * (y1 - y0 + 1) > 3500) break;
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) urls.push(base.url.replace('{z}', z).replace('{x}', x).replace('{y}', y));
  }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  let cache;
  try { cache = await caches.open(TILE_CACHE); } catch (e) { toast('Stockage indisponible sur cet appareil'); return; }
  let done = 0, fail = 0, i = 0;
  showStatus('Carte hors ligne', 0);
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (i < urls.length) {
      const u = urls[i++];
      try { if (!(await cache.match(u))) { const r = await fetch(u, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' }); if (r.ok) await cache.put(u, r); else fail++; } } catch (e) { fail++; }
      done++;
      if (done % 20 === 0) showStatus('Carte hors ligne', done / urls.length);
    }
  }));
  statusEl.hidden = true;
  toast('Carte gardée : ' + (done - fail) + ' tuiles' + (fail ? ', ' + fail + ' en échec' : '') + '. Relief et bâtiments : gardés à chaque calcul.', 5000);
  if (S.length) compute();
}

/* démarrage */
drawStations();
drawObs();
checkHash();
if (study().stations.length) compute();
else setTimeout(() => toast('Centrer la carte sur un emplacement, puis « Antenne »', 4000), 600);
})();
