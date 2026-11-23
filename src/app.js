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
/* Postes : SE-x35 = famille PR4G (Thomson-CSF, fabriquée par Ascom), 30 à 87,975 MHz.
   SE-235 portable 0,5 ou 5 W ; avec l'amplificateur de véhicule LV-235 jusqu'à 50 W ; SE-135 petit portable 1 W.
   Sensibilité et gains d'antenne : valeurs typiques de la catégorie, à remplacer par celles du règlement 58.430. */
const RADIOS = {
  se235p: { n: 'SE-235 portable', pw: [0.5, 5], d: 5, ant: 'marche', band: [30, 87.975] },
  se235v: { n: 'SE-235 véhicule', sub: 'Amplificateur LV-235', pw: [0.5, 5, 50], d: 50, ant: 'veh', band: [30, 87.975] },
  se135: { n: 'SE-135', pw: [1], d: 1, ant: 'marche', band: [30, 87.975] },
  autre: { n: 'Autre poste', pw: null, d: 5, ant: 'veh', band: null },
};
const ANTS = {
  marche: { n: 'Marche', l: 'Antenne de marche (fouet court)', g: -6, h: 1.8 },
  haute: { n: 'Haute', l: 'Antenne haute (fouet long)', g: -2, h: 2.5 },
  veh: { n: 'Véhicule', l: 'Antenne de véhicule', g: 0, h: 3 },
  mat: { n: 'Mât', l: 'Antenne sur mât', g: 2, h: 10 },
  dir: { n: 'Directive', l: 'Antenne directive', g: 6, h: 8, dir: true },
};
const SENS = -113;
const COLORS = ['#0A84FF', '#FF9F0A', '#BF5AF2', '#FF375F', '#64D2FF', '#FFD60A', '#5E5CE6', '#AC8E68'];
const BASES = {
  grey: { url: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-grau/default/current/3857/{z}/{x}/{y}.jpeg', max: 18, tag: 'Carte grise' },
  map: { url: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg', max: 18, tag: 'Carte nationale' },
  photo: { url: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg', max: 19, tag: 'Photo aérienne' },
};
const DEF_PARAMS = () => ({
  dir: 'both', r: 10, prec: 'norm', buildings: true, forest: true, forestDb: 6, fade: 10, k: 4 / 3,
  c: { radio: 'se235p', pw: 5, ant: 'marche', h: 1.8, g: -6, lc: 0, sens: SENS },
  relay: { radio: 'se235v', pw: 50, ant: 'mat', h: 10, g: 2, lc: 1, sens: SENS },
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
store.prefs = Object.assign({ base: 'grey', op: 0.6, show: true, circles: true, links: true }, store.prefs || {});
for (const s of store.studies) s.params = Object.assign(DEF_PARAMS(), s.params || {}, { c: Object.assign(DEF_PARAMS().c, (s.params || {}).c || {}) });
const study = () => store.studies.find(s => s.id === store.cur) || store.studies[0];
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} };

/* ================= carte ================= */
const st0 = study().stations[0];
const map = L.map('map', { zoomControl: false, attributionControl: false, minZoom: 7, maxZoom: 19, zoomSnap: 0.5,
  maxBounds: [[44.8, 4.2], [48.6, 12.2]], maxBoundsViscosity: 0.8 })
  .setView(st0 ? [st0.lat, st0.lon] : (store.view ? store.view.c : [46.8, 8.2]), st0 ? 12 : (store.view ? store.view.z : 8));
let baseLayer = null;
function setBase(k) {
  const b = BASES[k] || BASES.grey;
  store.prefs.base = BASES[k] ? k : 'grey';
  if (baseLayer) map.removeLayer(baseLayer);
  baseLayer = L.tileLayer(b.url, { maxNativeZoom: b.max, maxZoom: 19, keepBuffer: 3, referrerPolicy: 'no-referrer' }).addTo(map);
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
        const mm = markers.get(s.id); if (mm && mm.ci) mm.ci.setLatLng(p);
        dragPreview(st);
      });
      mk.on('dragend', () => { const st = study().stations.find(x => x.id === s.id); if (!st) return; const p = mk.getLatLng(); st.lat = p.lat; st.lon = p.lng; st.alt = null; pv.st = null; changed(); if (selId === st.id) openEdit(st.id); });
      m = { mk, ci: null }; markers.set(s.id, m);
    }
    m.mk.setLatLng([s.lat, s.lon]);
    m.mk.setIcon(stIcon(s, i, selId === s.id));
    const r = study().params.r * 1000;
    if (store.prefs.circles) {
      if (!m.ci) m.ci = L.circle([s.lat, s.lon], { radius: r, color: colorOf(i), weight: 1.5, dashArray: '5 6', fill: false, interactive: false }).addTo(map);
      m.ci.setLatLng([s.lat, s.lon]); m.ci.setRadius(r); m.ci.setStyle({ color: colorOf(i) });
    } else if (m.ci) { map.removeLayer(m.ci); m.ci = null; }
  });
}

/* ================= éditeur de station (tiroir non modal) ================= */
const editEl = $('edit');
function closeEdit() {
  if (editEl.hidden) return;
  editEl.hidden = true; document.body.classList.remove('editing');
  const was = selId; selId = null;
  if (was) drawStations();
}
function radioFields(o, onChange, withFreq) {
  /* o : station ou poste en face (radio, pw, ant, h, g, lc, sens [, f, az, bw]) */
  const box = h('div', { style: 'display:flex;flex-direction:column;gap:12px' });
  const draw = () => {
    const R = RADIOS[o.radio] || RADIOS.autre, A = ANTS[o.ant] || ANTS.veh;
    const kids = [];
    kids.push(h('div', { class: 'label', text: 'Poste' }));
    kids.push(chips(Object.entries(RADIOS).map(([k, v]) => [k, v.n]), o.radio, k => {
      o.radio = k; const R2 = RADIOS[k];
      if (R2.pw && R2.pw.indexOf(o.pw) < 0) o.pw = R2.d;
      if (R2.ant && o.ant !== R2.ant && !(k === 'se235v' && (o.ant === 'mat' || o.ant === 'dir'))) { o.ant = R2.ant; o.g = ANTS[o.ant].g; o.h = ANTS[o.ant].h; }
      onChange(); draw();
    }));
    if (R.sub) kids.push(h('p', { class: 'note', text: R.sub }));
    kids.push(h('div', { class: 'label', text: 'Puissance' }));
    if (R.pw) kids.push(h('div', { class: 'line' }, seg(R.pw.map(w => [w, wTxt(w)]), o.pw, w => { o.pw = +w; onChange(); })));
    else kids.push(numLine('Puissance d\'émission', null, o.pw, 'W', v => { o.pw = v; onChange(); }, { min: 0.01, max: 1000, dec: 1 }));
    kids.push(h('div', { class: 'label', text: 'Antenne' }));
    kids.push(chips(Object.entries(ANTS).map(([k, v]) => [k, v.n]), o.ant, k => {
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
      numLine('Gain d\'antenne', 'Valeur typique, à ajuster', o.g, 'dBi', v => { o.g = v; onChange(); }, { min: -30, max: 30 }),
      numLine('Pertes de câble', null, o.lc, 'dB', v => { o.lc = v; onChange(); }, { min: 0, max: 30 }),
      numLine('Sensibilité du récepteur', 'Typique en VHF tactique : −113 dBm', o.sens, 'dBm', v => { o.sens = v; onChange(); }, { min: -150, max: -50 }),
    );
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
    radioFields(s, () => { save(); drawStations(); changed(); }, true),
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
function pickLink(s) {
  const S = study().stations.filter(x => x.id !== s.id);
  openSheet('Liaison depuis ' + s.name, h('div', { class: 'list' }, S.map(t => h('button', { type: 'button', class: 'row', onclick: () => { closeSheet(); showProfile(s, { st: t }); } },
    h('span', { class: 'dot', style: `background:${colorOf(study().stations.indexOf(t))}` }), h('span', { class: 't' }, h('b', { text: t.name }), h('small', { text: descr(t) })), iEl('right')))));
}
const descr = s => `${(RADIOS[s.radio] || RADIOS.autre).n} · ${wTxt(s.pw)} · ${(ANTS[s.ant] || ANTS.veh).n.toLowerCase()} ${fr(s.h, s.h % 1 ? 1 : 0)} m`;

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
  const s = prev ? Object.assign({}, prev, { id: uid(), name: 'Station ' + (S.length + 1), lat: c.lat, lon: c.lng, alt: null, _open: false })
    : { id: uid(), name: 'Station 1', lat: c.lat, lon: c.lng, radio: 'se235v', pw: 50, ant: 'mat', h: 10, g: ANTS.mat.g, lc: 1, sens: SENS, f: 50, az: 0, bw: 60 };
  S.push(s);
  changed();
  openEdit(s.id);
});

/* ================= calcul ================= */
const worker = new Worker(URL.createObjectURL(new Blob([document.getElementById('engine').textContent], { type: 'text/javascript' })));
let runId = 0, result = null, covLayer = null, covUrl = null, runT = 0, pending = null;
const statusEl = $('status');
function changed() {
  if (search) endSearch(true);
  save(); drawStations();
  clearTimeout(runT); runT = setTimeout(compute, 450);
}
function engineStation(s) {
  const A = ANTS[s.ant] || ANTS.veh;
  return { lat: s.lat, lon: s.lon, h: s.h, p: dBm(s.pw), lc: s.lc || 0, sens: s.sens, f: s.f, ant: { g: s.g, dir: !!A.dir, az: s.az || 0, bw: s.bw || 60 } };
}
function engineParams() {
  const P = study().params, c = P.c;
  const S = study().stations;
  return { dir: P.dir, r: P.r, prec: P.prec, buildings: P.buildings, forest: P.forest, forestDb: P.forestDb, fade: P.fade, k: P.k, f: 50,
    hr: c.h, c: { p: dBm(c.pw), g: c.g, lc: c.lc || 0, sens: c.sens },
    active: P.net.on && netActive && netActive.length === S.length ? netActive : null };
}
/* aperçu pendant le glisser : une requête à la fois, la dernière position gagne */
const pv = { busy: false, st: null };
function dragPreview(st) {
  pv.st = st;
  if (pv.busy || !result) return;
  const S = study().stations, idx = S.indexOf(st);
  if (idx < 0) return;
  pv.busy = true; pv.sent = st;
  clearTimeout(runT);
  runId++;
  worker.postMessage({ t: 'preview', id: runId, stations: S.map(engineStation), P: engineParams(), idx });
}
function compute() {
  const S = study().stations;
  if (!S.length) { clearCov(); result = null; updLegend(); return; }
  runId++;
  pending = { id: runId, t0: Date.now() };
  showStatus('Préparation', 0);
  worker.postMessage({ t: 'run', id: runId, stations: S.map(engineStation), P: engineParams() });
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
    if (search) return;
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
function clearCov() { if (covLayer) { map.removeLayer(covLayer); covLayer = null; } if (covUrl) { URL.revokeObjectURL(covUrl); covUrl = null; } }
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
  cv.toBlob(b => {
    clearCov();
    covUrl = URL.createObjectURL(b);
    covLayer = L.imageOverlay(covUrl, result.bounds, { opacity: store.prefs.show ? store.prefs.op : 0, interactive: false, className: 'cov' }).addTo(map);
  });
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
  if (i >= 0 && j >= 0 && i < nx && j < ny && best[j * nx + i] !== 255) si = best[j * nx + i];
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
  const off = s.alt != null && result && result.t0 ? s.alt - result.t0[study().stations.indexOf(s)] : 0;
  const out = [];
  out.push(h('div', { class: 'verdict' }, h('span', { class: 'sq', style: `background:rgba(${V.c.slice(0, 3)},1)` }), h('b', { text: V.n }), h('span', { text: sgn(M) + ' dB' })));
  out.push(profileSvg(r, off, colorOf(study().stations.indexOf(s))));
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
      const stt = !search && result && result.stats[i];
      const cov = stt && stt.tot ? Math.round((stt.sure + stt.bonne) / stt.tot * 100) + ' % en liaison bonne ou sûre' : 'calcul en attente';
      return h('button', { type: 'button', class: 'row', onclick: () => { closeSheet(); map.setView([s.lat, s.lon], Math.max(map.getZoom(), 12)); openEdit(s.id); } },
        h('span', { class: 'dot', style: `background:${colorOf(i)}` }), h('span', { class: 't' }, h('b', { text: s.name }), h('small', { text: descr(s) }), h('small', { text: cov })), iEl('right'));
    })));
    if (S.length > 1) kids.push(h('p', { class: 'note', text: 'Liaisons entre stations et réseau : onglet Relais.' }));
  }
  kids.push(h('p', { class: 'note', html: 'Toucher la carte affiche le profil depuis la station qui dessert le mieux ce point. Les stations se déplacent en les faisant glisser.' }));
  openSheet('Stations', kids);
});
/* ================= relais ================= */
/* liaisons entre stations (les deux sens : la plus faible marge compte), tracées sur la carte */
let links = [], linksP = null, linkAgain = false, netActive = null, search = null;
const linksLayer = L.layerGroup().addTo(map);
const needMin = () => { const P = study().params, F = P.fade; return P.net.need === 'sure' ? F + 10 : P.net.need === 'bonne' ? F : 0; };
function evalLinks() {
  if (linksP) { linkAgain = true; return linksP; }
  linksP = (async () => {
    await null; /* le drapeau « en cours » est posé avant la première reprise */
    do {
      linkAgain = false;
      const S = study().stations.slice();
      const out = [];
      if (result && !search && S.length > 1) {
        for (let a = 0; a < S.length; a++) for (let b = a + 1; b < S.length; b++) {
          const A = S[a], B = S[b], t = engineStation(B);
          const { r } = await askProfile(engineStation(A), Object.assign({}, t, { g: t.ant.g }));
          out.push({ a: A, b: B, r, M: r ? Math.min(r.down, r.up) : null });
        }
      }
      links = out;
      drawLinks();
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
    L.marker([(l.a.lat + l.b.lat) / 2, (l.a.lon + l.b.lon) / 2], { icon: L.divIcon({ className: 'lnk', html: `<b style="border-color:${col}">${lab}</b>`, iconSize: [0, 0] }), keyboard: false, zIndexOffset: 300 })
      .on('click', () => showProfile(l.a, { st: l.b })).addTo(linksLayer);
  }
}
/* stations reliées à la station principale, de proche en proche */
function netActiveFrom() {
  const S = study().stations, P = study().params;
  if (!P.net.on || S.length < 2) return null;
  let main = S.findIndex(s => s.id === P.net.main);
  if (main < 0) main = 0;
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
    worker.postMessage({ t: 'recomp', id: runId, stations: study().stations.map(engineStation), P: engineParams() });
  }
}
/* recherche de l'emplacement d'un relais entre deux stations : les deux liaisons doivent passer */
const modeEl = $('modebar');
function startSearch(a, b) {
  const R = study().params.relay;
  closeSheet(); closeEdit();
  search = { a: a.id, b: b.id };
  document.body.classList.add('searching');
  linksLayer.clearLayers();
  modeEl.replaceChildren(h('span', null, 'Emplacement du relais', h('small', { text: 'Toucher la carte pour le détail' })),
    h('button', { type: 'button', class: 'chip', text: 'Terminer', onclick: () => endSearch() }));
  modeEl.hidden = false;
  clearTimeout(runT);
  runId++;
  const Pe = Object.assign(engineParams(), { dir: 'both', combine: 'min', active: null, hr: R.h, c: { p: dBm(R.pw), g: R.g, lc: R.lc || 0, sens: R.sens } });
  showStatus('Préparation', 0);
  worker.postMessage({ t: 'run', id: runId, stations: [a, b].map(engineStation), P: Pe });
  const bb = L.latLngBounds([[a.lat, a.lon], [b.lat, b.lon]]);
  map.fitBounds(bb.pad(0.35), { maxZoom: 14 });
}
function endSearch(silent) {
  if (!search) return;
  search = null;
  document.body.classList.remove('searching');
  modeEl.hidden = true;
  if (tgtMk) { map.removeLayer(tgtMk); tgtMk = null; }
  if (!silent) compute();
}
const relayObj = (ll, from) => Object.assign({}, study().params.relay, { id: 'relais', name: 'Relais', lat: ll.lat, lon: ll.lng, f: from.f, az: 0, bw: 60 });
async function relayTap(ll) {
  const S = study().stations, A = S.find(x => x.id === search.a), B = S.find(x => x.id === search.b);
  if (!A || !B) { endSearch(); return; }
  const rel = relayObj(ll, A), t = engineStation(rel);
  if (tgtMk) map.removeLayer(tgtMk);
  tgtMk = L.marker(ll, { icon: L.divIcon({ className: 'tgt', html: '<i></i>', iconSize: [36, 36], iconAnchor: [18, 18] }), interactive: false }).addTo(map);
  const body = h('div', { style: 'display:flex;flex-direction:column;gap:12px' }, h('p', { class: 'note', text: 'Calcul des deux liaisons…' }));
  openSheet('Relais ici', body);
  const T = Object.assign({}, t, { g: t.ant.g });
  const [ra, rb] = [(await askProfile(engineStation(A), T)).r, (await askProfile(engineStation(B), T)).r];
  if (!ra || !rb) { body.replaceChildren(h('p', { class: 'note', text: 'Point hors de la zone calculée.' })); return; }
  const Ma = Math.min(ra.down, ra.up), Mb = Math.min(rb.down, rb.up), M = Math.min(Ma, Mb), V = verdictOf(M);
  const row = (st, r, Mx) => {
    const Vx = verdictOf(Mx);
    return h('button', { type: 'button', class: 'row', onclick: () => showProfile(st, { st: relayObj(ll, A) }) },
      h('span', { class: 'sq', style: `background:rgb(${Vx.c.slice(0, 3)})` }),
      h('span', { class: 't' }, h('b', { text: st.name + ' ↔ relais' }), h('small', { text: fr(r.dKm, r.dKm < 10 ? 2 : 1) + ' km · ' + (r.los ? 'visée directe' : 'masqué par le relief') })),
      h('span', { class: 'v big', text: sgn(Mx) + ' dB' }), iEl('right'));
  };
  body.replaceChildren(
    h('div', { class: 'verdict' }, h('span', { class: 'sq', style: `background:rgb(${V.c.slice(0, 3)})` }), h('b', { text: M >= 0 ? 'Relais possible' : 'Relais impossible ici' }), h('span', { text: sgn(M) + ' dB' })),
    h('div', { class: 'list' }, row(A, ra, Ma), row(B, rb, Mb)),
    h('p', { class: 'note', text: 'Marge du sens le plus faible pour chaque liaison. Relais : ' + descr(study().params.relay) + '. ' + lvTxt(ll.lat, ll.lng) }),
    h('div', { class: 'acts' }, h('button', { type: 'button', class: 'act primary', onclick: () => {
      const S2 = study().stations;
      if (S2.length >= 8) { toast('Huit stations au plus par étude'); return; }
      const n = S2.filter(x => /^Relais/.test(x.name)).length;
      S2.push(Object.assign(relayObj(ll, A), { id: uid(), name: n ? 'Relais ' + (n + 1) : 'Relais' }));
      store.prefs.links = true;
      closeSheet(); endSearch(true); changed(); toast('Relais posé');
    } }, iEl('plus'), 'Poser le relais ici')),
  );
}
/* onglet Relais */
$('tabRelay').addEventListener('click', relaySheet);
function relaySheet() {
  const S = study().stations, P = study().params;
  const kids = [];
  if (S.length < 2) {
    kids.push(h('p', { class: 'note', text: 'Poser au moins deux stations pour voir si elles se relient, puis chercher où placer un relais entre elles.' }));
    kids.push(h('div', { class: 'label', text: 'Matériel du relais' }), radioFields(P.relay, save, false));
    openSheet('Relais', kids, null, true);
    return;
  }
  kids.push(h('div', { class: 'label', text: 'Liaisons' }));
  const box = h('div', { class: 'list' }, h('div', { class: 'row' }, h('span', { class: 't' }, h('small', { text: result ? 'Calcul des liaisons…' : 'Calcul en attente' }))));
  kids.push(box);
  const fill = () => {
    if (!links.length) return;
    box.replaceChildren(...links.map(l => {
      const V = l.r ? verdictOf(l.M) : null;
      return h('button', { type: 'button', class: 'row', onclick: () => showProfile(l.a, { st: l.b }) },
        h('span', { class: 'sq', style: `background:${V ? `rgb(${V.c.slice(0, 3)})` : '#8E8E93'}` }),
        h('span', { class: 't' }, h('b', { text: l.a.name + ' ↔ ' + l.b.name }), h('small', { text: (l.r ? fr(l.r.dKm, 1) + ' km · ' + (l.r.los ? 'visée directe' : 'masqué par le relief') : 'hors de la zone calculée') })),
        h('span', { class: 'v big', text: l.r ? sgn(l.M) + ' dB' : '-' }), iEl('right'));
    }));
  };
  if (result) (links.length ? Promise.resolve() : evalLinks()).then(fill);
  kids.push(h('p', { class: 'note', text: 'Une liaison de relais doit passer dans les deux sens : la marge indiquée est celle du sens le plus faible.' }));
  kids.push(swRow('Afficher les liaisons sur la carte', null, store.prefs.links, v => { store.prefs.links = v; save(); drawLinks(); }));
  kids.push(h('div', { class: 'label', text: 'Couverture du réseau' }));
  const netBox = h('div', { style: 'display:flex;flex-direction:column;gap:12px' });
  const drawNet = () => {
    const k = [swRow('Seulement les stations reliées', 'La carte ne montre que la couverture des stations reliées à la station principale', P.net.on, v => { P.net.on = v; if (!P.net.main) P.net.main = S[0].id; save(); drawNet(); maybeNet(); updLegend(); })];
    if (P.net.on) {
      k.push(h('div', { class: 'line' }, h('span', null, 'Station principale')));
      k.push(chips(S.map(x => [x.id, x.name]), P.net.main || S[0].id, id => { P.net.main = id; save(); maybeNet(); }));
      k.push(h('div', { class: 'line' }, h('span', null, 'Liaison exigée'), seg([['inc', 'Incertaine'], ['bonne', 'Bonne'], ['sure', 'Sûre']], P.net.need, v => { P.net.need = v; save(); maybeNet(); })));
    }
    netBox.replaceChildren(...k);
  };
  drawNet();
  kids.push(netBox);
  kids.push(h('div', { class: 'label', text: 'Trouver où placer un relais' }));
  let A = S[0], B = S[1];
  kids.push(h('div', { class: 'line' }, h('span', null, 'Entre')), chips(S.map(x => [x.id, x.name]), A.id, id => { A = S.find(x => x.id === id); }));
  kids.push(h('div', { class: 'line' }, h('span', null, 'et')), chips(S.map(x => [x.id, x.name]), B.id, id => { B = S.find(x => x.id === id); }));
  kids.push(h('div', { class: 'label', text: 'Matériel du relais' }), radioFields(P.relay, save, false));
  kids.push(h('div', { class: 'acts' }, h('button', { type: 'button', class: 'act primary', onclick: () => {
    if (A === B) { toast('Choisir deux stations différentes'); return; }
    startSearch(A, B);
  } }, iEl('search'), 'Chercher l\'emplacement')));
  kids.push(h('p', { class: 'note', text: 'La carte montre alors où un relais avec ce matériel relie les deux stations. Toucher un point pour le détail et poser le relais.' }));
  openSheet('Relais', kids, null, true);
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
    h('button', { type: 'button', class: 'row', style: 'background:var(--card);border-radius:12px', onclick: aboutSheet }, iEl('info'), h('span', { class: 't' }, h('b', { text: 'Méthode, données et limites' })), iEl('right')),
  ];
  openSheet('Paramètres', kids, null, true);
});
function aboutSheet() {
  const p = (t) => h('p', { class: 'note', html: t });
  openSheet('Méthode', [
    h('div', { class: 'label', text: 'Données' }),
    p('<b>Relief</b> : modèle de terrain de swisstopo (3d.geo.admin.ch, dérivé de swissALTI3D), lu au niveau de détail adapté à la taille des cellules. <b>Bâtiments et forêt</b> : tuiles vectorielles de la carte de base swisstopo (hauteur de rendu des bâtiments, surfaces de forêt). <b>Altitude des sites</b> : service d\'altitude de geo.admin.ch. Aucune autre source.'),
    h('div', { class: 'label', text: 'Calcul' }),
    p('Rayons tirés depuis chaque station, un pas par cellule. Pour chaque point : <b>espace libre</b>, plus la combinaison quadratique de la <b>perte de sol</b> (terre plane, hauteurs effectives au-dessus de la droite moyenne du terrain) et de la <b>diffraction</b> par le relief et les bâtiments (méthode de Bullington, UIT-R P.526, avec courbure terrestre au facteur k). Cette combinaison est celle du modèle de Blomquist-Ladell, employé pour la planification VHF militaire. Forêt : perte forfaitaire à chaque extrémité placée en forêt.'),
    p('<b>Marge</b> = puissance + gains − pertes de câble − affaiblissement − sensibilité. Liaison sûre au-delà de la réserve + 10 dB, bonne au-delà de la réserve, incertaine entre 0 et la réserve.'),
    h('div', { class: 'label', text: 'Limites' }),
    p('Prévision, pas une garantie. Non pris en compte : végétation hors forêt, sol humide ou sec, brouillage, bruit local, modes numériques et saut de fréquence (qui demandent souvent quelques dB de plus), corps de l\'opérateur, orientation réelle des antennes. Les gains d\'antenne et la sensibilité proposés sont des valeurs typiques : les remplacer par celles du règlement 58.430 « Système radio SE-235 ». Un essai de liaison sur le terrain reste la référence.'),
    p('Carte et données © swisstopo, VBS (geo.admin.ch) · Leaflet (BSD-2) · Inter (OFL).'),
  ], null, true);
}

/* fond de carte et affichage */
$('baseBtn').addEventListener('click', () => {
  const pr = store.prefs;
  openSheet('Carte', [
    h('div', { class: 'list' }, Object.entries(BASES).map(([k, b]) => h('button', { type: 'button', class: 'row', onclick: () => { setBase(k); closeSheet(); } },
      h('span', { class: 't' }, h('b', { text: b.tag })), pr.base === k ? h('i', { 'data-i': 'check', class: 'ck', html: icon('check') }) : null))),
    h('div', { class: 'label', text: 'Couverture' }),
    swRow('Afficher la couverture', null, pr.show, v => { pr.show = v; save(); if (covLayer) covLayer.setOpacity(v ? pr.op : 0); legendEl.style.opacity = v ? '' : '.5'; }),
    h('div', { class: 'line' }, h('span', null, 'Opacité'), seg([[0.4, '40 %'], [0.6, '60 %'], [0.8, '80 %']], pr.op, v => { pr.op = +v; save(); if (covLayer && pr.show) covLayer.setOpacity(pr.op); })),
    swRow('Cercles du rayon de calcul', null, pr.circles, v => { pr.circles = v; save(); drawStations(); }),
  ]);
});

/* études */
$('studyBtn').addEventListener('click', studySheet);
function studySheet() {
  const kids = [
    h('div', { class: 'list' }, store.studies.map(s => h('button', { type: 'button', class: 'row', onclick: () => {
      store.cur = s.id; save(); closeSheet(); closeEdit(); result = null; clearCov(); drawStations(); updName(); updLegend();
      const f = s.stations[0]; if (f) map.setView([f.lat, f.lon], 12);
      compute();
    } }, h('span', { class: 't' }, h('b', { text: s.name }), h('small', { text: s.stations.length + (s.stations.length > 1 ? ' stations' : ' station') + ' · rayon ' + s.params.r + ' km' })), s.id === store.cur ? h('i', { 'data-i': 'check', class: 'ck', html: icon('check') }) : null))),
    h('div', { class: 'acts' },
      h('button', { type: 'button', class: 'act', onclick: () => {
        const s = { id: uid(), name: 'Étude ' + (store.studies.length + 1), stations: [], params: Object.assign(DEF_PARAMS(), { c: Object.assign({}, study().params.c) }) };
        store.studies.push(s); store.cur = s.id; save(); closeSheet(); closeEdit(); result = null; clearCov(); drawStations(); updName(); updLegend();
        toast('Nouvelle étude');
      } }, iEl('plus'), 'Nouvelle'),
      h('button', { type: 'button', class: 'act', onclick: () => {
        const c = JSON.parse(JSON.stringify(study())); c.id = uid(); c.name = study().name + ' (copie)'; c.stations.forEach(x => { x.id = uid(); });
        store.studies.push(c); store.cur = c.id; save(); closeSheet(); drawStations(); updName(); compute(); toast('Étude dupliquée');
      } }, iEl('dup'), 'Dupliquer')),
    h('div', { class: 'label', text: 'Étude ouverte' }),
    (() => { const f = h('input', { class: 'field', value: study().name, 'aria-label': 'Nom de l\'étude', maxlength: 40 }); f.addEventListener('change', () => { study().name = f.value.trim() || study().name; save(); updName(); }); return f; })(),
    store.studies.length > 1 ? h('div', { class: 'acts' }, h('button', { type: 'button', class: 'act danger', onclick: () => {
      const i = store.studies.indexOf(study()); store.studies.splice(i, 1); store.cur = store.studies[0].id; save(); closeSheet(); closeEdit(); result = null; clearCov(); drawStations(); updName(); compute(); toast('Étude supprimée');
    } }, iEl('trash'), 'Supprimer l\'étude')) : null,
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
    toast(err.code === 1 ? 'Accès à la position refusé : l\'autoriser dans les réglages du navigateur' : 'Position indisponible pour le moment', 5000);
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
    const { r } = await askProfile(engineStation(s), T);
    rows.push({ s, i: S.indexOf(s), r, M: r ? (dir === 'down' ? r.down : dir === 'up' ? r.up : Math.min(r.down, r.up)) : null });
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
      for (const x of ok) {
        const V = verdictOf(x.M);
        kids.push(h('div', { class: 'lr' }, h('span', { class: 'dot', style: `background:${colorOf(x.i)}` }), h('b', { text: x.s.name }),
          h('span', { class: 'mu', text: fr(x.r.dKm, x.r.dKm < 10 ? 1 : 0) + ' km' }),
          h('em', null, h('span', { class: 'sq', style: `background:rgb(${V.c.slice(0, 3)})` }), sgn(x.M, 0) + ' dB')));
      }
    }
  }
  liveEl.replaceChildren(...kids);
  liveEl.hidden = false;
}
liveEl.addEventListener('click', () => {
  if (!live || !live.pos || !live.rows) return;
  const best = live.rows.filter(x => x.r).sort((a, b) => b.M - a.M)[0];
  if (best) showProfile(best.s, { lat: live.pos.lat, lon: live.pos.lon });
});

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

/* démarrage */
drawStations();
if (study().stations.length) compute();
else setTimeout(() => toast('Centrer la carte sur un emplacement, puis « Antenne »', 4000), 600);
})();
