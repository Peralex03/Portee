/* Étalonnage des antennes SE-235 sur le tableau des portées du règlement 58.430 (ch. 43) :
   portée = distance où 80 % des emplacements sont atteints, terrain de référence (Plateau suisse), mode FHOP.
   Relief synthétique de type Plateau (collines, Δh ≈ 90 m) et forêt (≈ 28 %), lancer de rayons du moteur,
   puis ajustement d'un gain efficace par antenne (moindres carrés), seuil de réception commun. */
'use strict';
const E = require('../src/engine.js');

/* ---- tableau du règlement (km), symétrique ---- */
const ANT = ['MA', 'HA', 'FAt', 'FAm', 'FAm8', 'FzA'];
const H = { MA: 1.8, HA: 2.5, FAt: 6.0, FAm: 7.8, FAm8: 9.8, FzA: 3.0 };     /* centre électrique, d'après les hauteurs totales du ch. 95 à 97 */
const PW = { MA: 37, HA: 37, FAt: 37, FAm: 47, FAm8: 47, FzA: 47 };          /* 5 W portable, 50 W véhicule (LV-235) */
const TAB = [
  [6, 7, 8, 9, 10, 6],
  [7, 8, 9, 10, 11, 7],
  [8, 9, 12, 13, 14, 10],
  [9, 10, 13, 22, 23, 15],
  [10, 11, 14, 23, 24, 16],
  [6, 7, 10, 15, 16, 11],
];

/* ---- relief synthétique ---- */
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function valueNoise(nx, ny, cellsPer, R) {
  const gx = Math.ceil(nx / cellsPer) + 3, gy = Math.ceil(ny / cellsPer) + 3, L = new Float32Array(gx * gy);
  for (let i = 0; i < L.length; i++) L[i] = R() * 2 - 1;
  const out = new Float32Array(nx * ny), sm = t => t * t * (3 - 2 * t);
  for (let j = 0; j < ny; j++) {
    const fy = j / cellsPer, y0 = Math.floor(fy), ty = sm(fy - y0);
    for (let i = 0; i < nx; i++) {
      const fx = i / cellsPer, x0 = Math.floor(fx), tx = sm(fx - x0), k = y0 * gx + x0;
      const a = L[k] + (L[k + 1] - L[k]) * tx, b = L[k + gx] + (L[k + gx + 1] - L[k + gx]) * tx;
      out[j * nx + i] = a + (b - a) * ty;
    }
  }
  return out;
}
function plateau(G, seed, dhTarget) {
  const R = rng(seed), { nx, ny, g } = G, N = nx * ny, ter = new Float32Array(N);
  for (const [lamKm, amp] of [[24, 1], [12, 0.75], [6, 0.55], [3, 0.38], [1.5, 0.22], [0.75, 0.12], [0.35, 0.05]]) {
    const n = valueNoise(nx, ny, Math.max(2, lamKm * 1000 / g), R);
    for (let k = 0; k < N; k++) ter[k] += amp * n[k];
  }
  /* Δh : écart interdécile des écarts à la droite des moindres carrés, profils de 20 km */
  const dh = () => {
    const vals = [];
    for (let t = 0; t < 300; t++) {
      const x0 = R() * nx * 0.6 + nx * 0.2, y0 = R() * ny * 0.6 + ny * 0.2, th = R() * 2 * Math.PI, n = Math.floor(20000 / g);
      const p = [];
      for (let k = 0; k < n; k++) { const x = Math.round(x0 + Math.cos(th) * k), y = Math.round(y0 + Math.sin(th) * k); if (x < 0 || y < 0 || x >= nx || y >= ny) break; p.push(ter[y * nx + x]); }
      if (p.length < 50) continue;
      let sx = 0, sy = 0, sxx = 0, sxy = 0; const m = p.length;
      p.forEach((v, i) => { sx += i; sy += v; sxx += i * i; sxy += i * v; });
      const b = (m * sxy - sx * sy) / (m * sxx - sx * sx), a = (sy - b * sx) / m;
      const dev = p.slice(Math.floor(m * 0.1), Math.floor(m * 0.9)).map((v, i) => v - (a + b * (i + Math.floor(m * 0.1)))).sort((u, w) => u - w);
      vals.push(dev[Math.floor(dev.length * 0.9)] - dev[Math.floor(dev.length * 0.1)]);
    }
    vals.sort((u, w) => u - w); return vals[vals.length >> 1];
  };
  const s = dhTarget / dh();
  for (let k = 0; k < N; k++) { ter[k] *= s; G.ter[k] = 550 + ter[k]; }
  /* forêt : taches */
  const f = valueNoise(nx, ny, 1500 / g, R), f2 = valueNoise(nx, ny, 400 / g, R), fv = new Float32Array(N);
  for (let k = 0; k < N; k++) fv[k] = f[k] + 0.5 * f2[k];
  const sorted = Array.from(fv).sort((u, w) => u - w), thr = sorted[Math.floor(N * 0.72)];
  for (let k = 0; k < N; k++) G.fo[k] = fv[k] > thr ? 1 : 0;
  return dh() ;
}

/* ---- pertes au 80e centile selon la distance ---- */
const P = { f: 50, k: 4 / 3, forest: true, forestDb: 6, r: 30 };
const bins = 0.5, nb = Math.ceil(30 / bins);
function l80Curves(hA, hB, sites) {
  const all = Array.from({ length: nb }, () => []);
  for (const { G, S } of sites) {
    const c = E.castStation(G, Object.assign({}, S, { h: hA }), Object.assign({}, P, { hr: hB }));
    for (let a = 0; a < c.nR; a += 2) for (let k = 2; k <= c.nS; k++) {
      const L = c.Lr[a * (c.nS + 1) + k];
      if (L === L) { const b = Math.floor(k * c.stepKm / bins); if (b < nb) all[b].push(L); }
    }
  }
  return all.map(v => { v.sort((u, w) => u - w); return v.length ? v[Math.floor(v.length * 0.8)] : NaN; });
}
const at = (curve, dKm) => { const x = dKm / bins - 0.5, i = Math.max(0, Math.min(nb - 2, Math.floor(x))), t = x - i; return curve[i] + (curve[i + 1] - curve[i]) * t; };

/* ---- sites : plusieurs reliefs, stations hors forêt ---- */
const sites = [];
const DH = +(process.argv[2] || 90);
for (let s = 0; s < 3; s++) {
  const lat = 46.8, lon = 7.2;
  const G = E.makeGrid([{ lat, lon }], 31, 75);
  const dh = plateau(G, 1234 + s * 77, DH);
  for (let q = 0; q < 2; q++) {
    let S;
    for (let t = 0; t < 50; t++) {
      const dlat = (q - 0.5) * 0.01 * (t + 1) / 50, la = lat + dlat, lo = lon + (s - 1) * 0.004;
      const i = Math.round(E.gx(G, lo)), j = Math.round(E.gy(G, la));
      if (!G.fo[j * G.nx + i]) { S = { lat: la, lon: lo }; break; }
    }
    sites.push({ G, S: Object.assign({ p: 37, lc: 0, sens: -110, ant: { g: 0 } }, S || { lat, lon }) });
  }
  if (s === 0) console.error('relief : Δh médian ≈', dh.toFixed(0), 'm, grille', G.nx + '×' + G.ny);
}

/* ---- budgets requis pour chaque paire ---- */
const rows = [];
const t0 = Date.now();
for (let a = 0; a < 6; a++) for (let b = a; b < 6; b++) {
  const A = ANT[a], B = ANT[b];
  const curve = l80Curves(H[A], H[B], sites);
  rows.push({ a, b, d: TAB[a][b], curve, Lreq: at(curve, TAB[a][b]), pw: Math.min(PW[A], PW[B]) });
}
console.error('lancers :', ((Date.now() - t0) / 1000).toFixed(0), 's');

/* ---- moindres carrés : pw + g_a + g_b - S = L80(d) ---- */
const S0 = -110;
let g = new Array(6).fill(0);
for (let it = 0; it < 2000; it++) {
  for (let i = 0; i < 6; i++) {
    let num = 0, den = 0;
    for (const r of rows) {
      const ci = (r.a === i ? 1 : 0) + (r.b === i ? 1 : 0);
      if (!ci) continue;
      const other = (r.a === i ? 0 : g[r.a]) + (r.b === i ? 0 : g[r.b]);
      num += ci * (r.Lreq - r.pw + S0 - other); den += ci * ci;
    }
    g[i] = num / den;
  }
}
/* décalage : téléantenne portable FA-235/t (dipôle, 20 m de câble) ramenée à 0 dBi efficace */
const shift = -g[2];
g = g.map(v => v + shift);
const S = S0 + 2 * shift;
/* contrôle : portée du modèle pour chaque paire */
let err = [];
const out = [];
for (const r of rows) {
  const budget = r.pw + g[r.a] + g[r.b] - S;
  let dm = NaN;
  for (let x = 0.5; x < 29.5; x += 0.05) if (at(r.curve, x) > budget) { dm = x; break; }
  err.push(Math.abs(Math.log(dm / r.d)));
  out.push(`${ANT[r.a].padEnd(5)}${ANT[r.b].padEnd(5)} règlement ${String(r.d).padStart(2)} km  modèle ${dm.toFixed(1).padStart(5)} km`);
}
console.log(out.join('\n'));
console.log('gains efficaces (dBi) :', ANT.map((n, i) => `${n} ${g[i].toFixed(1)}`).join(', '));
console.log('seuil de réception étalonné :', S.toFixed(1), 'dBm');
console.log('écart moyen :', (100 * (Math.exp(err.reduce((u, w) => u + w, 0) / err.length) - 1)).toFixed(0), '%, max', (100 * (Math.exp(Math.max(...err)) - 1)).toFixed(0), '%');
console.log(JSON.stringify({ g: Object.fromEntries(ANT.map((n, i) => [n, +g[i].toFixed(1)])), S: +S.toFixed(1), dh: DH }));

/* ---- SE-135 (règlement 58.440) : 2 W, antenne fouet MA-135, portée d'environ 5 km (80 % des emplacements) ----
   Poste porté sur le corps : centre électrique de l'antenne estimé à 1,5 m. Même seuil de réception que le SE-235. */
{
  const h135 = 1.5, c135 = l80Curves(h135, h135, sites);
  const g135 = (at(c135, 5) - 33 + S) / 2;
  let dm = NaN;
  for (let x = 0.5; x < 29.5; x += 0.05) if (at(c135, x) > 33 + 2 * g135 - S) { dm = x; break; }
  /* SE-135 ↔ SE-235 portable (MA-235, 5 W) : contrôle, portée limitée par le sens le plus faible (2 W) */
  const cx = l80Curves(h135, H.MA, sites);
  let dx = NaN;
  for (let x = 0.5; x < 29.5; x += 0.05) if (at(cx, x) > 33 + g135 + g[0] - S) { dx = x; break; }
  console.log(`SE-135 MA-135 : gain efficace ${g135.toFixed(1)} dBi (portée du modèle ${dm.toFixed(1)} km), avec un SE-235/t MA-235 : ${dx.toFixed(1)} km`);
}
