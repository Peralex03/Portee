/* tests du moteur : formats (encodage synthétique puis décodage), propagation, performances */
'use strict';
const E = require('../src/engine.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('ÉCHEC', m); } else console.log('ok  ', m); };
const near = (a, b, t) => Math.abs(a - b) <= t;

/* ---------- quantized-mesh synthétique ---------- */
function encodeQM(verts, tris, minH, maxH) {
  const n = verts.length, big = n > 65536;
  let size = 88 + 4 + 6 * n;
  if (big && size % 4) size += 4 - (size % 4);
  size += 4 + tris.length * 3 * (big ? 4 : 2) + 64;
  const buf = new ArrayBuffer(size), dv = new DataView(buf);
  dv.setFloat32(24, minH, true); dv.setFloat32(28, maxH, true);
  let p = 88;
  dv.setUint32(p, n, true); p += 4;
  const zz = v => ((v << 1) ^ (v >> 31)) & 0xffff;
  for (const key of ['u', 'v', 'h']) {
    let prev = 0;
    for (const vt of verts) { const val = key === 'h' ? Math.round((vt.h - minH) / (maxH - minH) * 32767) : vt[key]; dv.setUint16(p, zz(val - prev), true); prev = val; p += 2; }
  }
  if (big) { if (p % 4) p += 4 - (p % 4); }
  dv.setUint32(p, tris.length, true); p += 4;
  let hi = 0;
  for (const t of tris) for (const ix of t) {
    const code = hi - ix;
    if (big) dv.setUint32(p, code, true); else dv.setUint16(p, code, true);
    p += big ? 4 : 2;
    if (code === 0) hi++;
  }
  return buf.slice(0, p);
}
/* maillage régulier 9×9 sommets numérotés dans l'ordre d'apparition (contrainte des hautes eaux) */
function gridMesh(fn) {
  const N = 9, verts = [], idOf = new Map(), tris = [];
  const vid = (i, j) => {
    const k = i + ',' + j;
    if (!idOf.has(k)) { idOf.set(k, verts.length); const u = Math.round(i / (N - 1) * 32767), v = Math.round(j / (N - 1) * 32767); verts.push({ u, v, h: fn(u / 32767, v / 32767) }); }
    return idOf.get(k);
  };
  const order = [];
  for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) { order.push([[i, j], [i + 1, j], [i, j + 1]]); order.push([[i + 1, j], [i + 1, j + 1], [i, j + 1]]); }
  for (const t of order) tris.push(t.map(([i, j]) => vid(i, j)));
  return { verts, tris };
}
{
  const plane = (x, y) => 400 + 120 * x - 60 * y;
  const { verts, tris } = gridMesh(plane);
  const buf = encodeQM(verts, tris, 300, 600);
  const m = E.decodeQM(buf);
  ok(m.n === verts.length && m.tc === tris.length, 'quantized-mesh : nombre de sommets et triangles');
  let idxOk = true;
  for (let t = 0; t < tris.length; t++) for (let q = 0; q < 3; q++) if (m.idx[t * 3 + q] !== tris[t][q]) idxOk = false;
  ok(idxOk, 'quantized-mesh : indices (marque des hautes eaux)');
  ok(near(m.h[10], verts[10].h, 0.02), 'quantized-mesh : hauteurs');
  /* tuile géographique niveau 13 autour de Genève, grille couvrant la tuile */
  const z = 13, deg = 180 / 2 ** z, x = Math.floor((6.14 + 180) / deg), y = Math.floor((46.2 + 90) / deg);
  const west = -180 + x * deg, south = -90 + y * deg;
  const G = E.makeGrid([{ lat: south + deg / 2, lon: west + deg / 2 }], 0.8, 20);
  E.rasterMesh(G, m, west, south, deg);
  let maxErr = 0, cnt = 0;
  for (let j = 0; j < G.ny; j++) for (let i = 0; i < G.nx; i++) {
    const k = j * G.nx + i, t = G.ter[k];
    if (!(t === t)) continue;
    const X = G.X0 + (i + 0.5) * G.gm, Y = G.Y0 - (j + 0.5) * G.gm;
    const lon = E.lonOf(X), lat = E.latOf(Y), fx = (lon - west) / deg, fy = (lat - south) / deg;
    maxErr = Math.max(maxErr, Math.abs(t - plane(fx, fy))); cnt++;
  }
  ok(cnt > 1000 && maxErr < 0.6, `quantized-mesh : rastérisation d'un plan (${cnt} cellules, écart max ${maxErr.toFixed(3)} m)`);
}

/* ---------- MVT synthétique ---------- */
function pbfWriter() {
  const b = [];
  const varint = v => { while (v >= 128) { b.push((v % 128) | 128); v = Math.floor(v / 128); } b.push(v); };
  return { b, varint };
}
function bytesOf(fn) { const w = pbfWriter(); fn(w); return w.b; }
const lenField = (w, f, bytes) => { w.varint(f * 8 + 2); w.varint(bytes.length); w.b.push(...bytes); };
const strBytes = s => Array.from(Buffer.from(s, 'utf8'));
const zzE = n => (n << 1) ^ (n >> 31);
function encodeMVT(layers) {
  return Uint8Array.from(bytesOf(w => {
    for (const L of layers) {
      lenField(w, 3, bytesOf(lw => {
        lenField(lw, 1, strBytes(L.name));
        for (const f of L.feats) {
          lenField(lw, 2, bytesOf(fw => {
            lenField(fw, 2, bytesOf(tw => { for (const t of f.tags) tw.varint(t); }));
            fw.varint(3 * 8); fw.varint(3);
            lenField(fw, 4, bytesOf(gw => {
              let cx = 0, cy = 0;
              for (const ring of f.rings) {
                gw.varint((1 << 3) | 1); gw.varint(zzE(ring[0][0] - cx)); gw.varint(zzE(ring[0][1] - cy)); cx = ring[0][0]; cy = ring[0][1];
                gw.varint(((ring.length - 1) << 3) | 2);
                for (let k = 1; k < ring.length; k++) { gw.varint(zzE(ring[k][0] - cx)); gw.varint(zzE(ring[k][1] - cy)); cx = ring[k][0]; cy = ring[k][1]; }
                gw.varint((1 << 3) | 7);
              }
            }));
          }));
        }
        for (const k of L.keys) lenField(lw, 3, strBytes(k));
        for (const v of L.vals) lenField(lw, 4, bytesOf(vw => {
          if (typeof v === 'string') lenField(vw, 1, strBytes(v));
          else { vw.varint(3 * 8 + 1); const db = Buffer.alloc(8); db.writeDoubleLE(v); vw.b.push(...db); }
        }));
        lw.varint(5 * 8); lw.varint(4096);
        lw.varint(15 * 8); lw.varint(2);
      }));
    }
  })).buffer;
}
{
  const buf = encodeMVT([
    { name: 'building', keys: ['render_height', 'class'], vals: [21.5, 'house'], feats: [
      { tags: [0, 0, 1, 1], rings: [[[1000, 1000], [1400, 1000], [1400, 1400], [1000, 1400]]] },
    ] },
    { name: 'landcover', keys: ['class', 'subclass'], vals: ['wood', 'forest'], feats: [
      { tags: [0, 0, 1, 1], rings: [[[2000, 2000], [3500, 2000], [3500, 3500], [2000, 3500]], [[2500, 2500], [2500, 3000], [3000, 3000], [3000, 2500]]] },
    ] },
    { name: 'transportation', keys: [], vals: [], feats: [] },
  ]);
  const L = E.decodeMVT(buf, ['building', 'landcover']);
  ok(L.building && L.building.feats.length === 1 && L.building.feats[0].props.render_height === 21.5, 'MVT : couche bâtiments et hauteur');
  ok(L.landcover && L.landcover.feats[0].rings.length === 2 && L.landcover.feats[0].props.subclass === 'forest', 'MVT : forêt avec trou');
  ok(!L.transportation, 'MVT : couche non demandée ignorée');
  /* tuile z14 sur Genève, grille de 10 m */
  const z = 14, n = 2 ** z, tx = Math.floor((6.14 + 180) / 360 * n);
  const latR = 46.2 * Math.PI / 180, ty = Math.floor((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2 * n);
  const T = 2 * Math.PI * 6378137 / n, Wm = -Math.PI * 6378137 + tx * T, Nm = Math.PI * 6378137 - ty * T;
  const cLat = E.latOf(Nm - T / 2), cLon = E.lonOf(Wm + T / 2);
  const G = E.makeGrid([{ lat: cLat, lon: cLon }], 1.6, 10);
  E.rasterVT(G, L, z, tx, ty, { buildings: true, forest: true });
  let nb = 0, nf = 0, hmax = 0;
  for (let k = 0; k < G.bld.length; k++) { if (G.bld[k] > 0) nb++; if (G.fo[k]) nf++; hmax = Math.max(hmax, G.bld[k]); }
  const cellM2 = 100, bArea = (400 / 4096 * T * Math.cos(latR)) ** 2, fArea = ((1500 / 4096) ** 2 - (500 / 4096) ** 2) * (T * Math.cos(latR)) ** 2;
  ok(hmax === 21.5 && near(nb * cellM2, bArea, bArea * 0.15), `MVT : bâtiment rastérisé (${nb} cellules, attendu ≈ ${(bArea / cellM2).toFixed(0)})`);
  ok(near(nf * cellM2, fArea, fArea * 0.08), `MVT : forêt avec trou rastérisée (${nf} cellules, attendu ≈ ${(fArea / cellM2).toFixed(0)})`);
}

/* ---------- routes (lignes MVT) et accès ---------- */
{
  const lineMVT = (feats) => Uint8Array.from(bytesOf(w => {
    lenField(w, 3, bytesOf(lw => {
      lenField(lw, 1, strBytes('transportation'));
      for (const f of feats) lenField(lw, 2, bytesOf(fw => {
        lenField(fw, 2, bytesOf(tw => { tw.varint(0); tw.varint(f.cls); }));
        fw.varint(3 * 8); fw.varint(2);
        lenField(fw, 4, bytesOf(gw => {
          let cx = 0, cy = 0;
          gw.varint((1 << 3) | 1); gw.varint(zzE(f.pts[0][0])); gw.varint(zzE(f.pts[0][1])); cx = f.pts[0][0]; cy = f.pts[0][1];
          gw.varint(((f.pts.length - 1) << 3) | 2);
          for (let k = 1; k < f.pts.length; k++) { gw.varint(zzE(f.pts[k][0] - cx)); gw.varint(zzE(f.pts[k][1] - cy)); cx = f.pts[k][0]; cy = f.pts[k][1]; }
        }));
      }));
      lenField(lw, 3, strBytes('class'));
      for (const v of ['minor', 'path', 'track']) lenField(lw, 4, bytesOf(vw => lenField(vw, 1, strBytes(v))));
      lw.varint(5 * 8); lw.varint(4096);
    }));
  })).buffer;
  const buf = lineMVT([{ cls: 0, pts: [[0, 2048], [4096, 2048]] }, { cls: 1, pts: [[2048, 0], [2048, 4096]] }, { cls: 2, pts: [[0, 0], [4096, 4096]] }]);
  const L = E.decodeMVT(buf, ['transportation']);
  ok(L.transportation && L.transportation.feats.length === 3 && L.transportation.feats[0].type === 2, 'MVT : lignes de routes lues');
  const z = 14, n = 2 ** z, tx = Math.floor((6.14 + 180) / 360 * n), latR = 46.2 * Math.PI / 180, ty = Math.floor((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2 * n);
  const T = 2 * Math.PI * 6378137 / n, Wm = -Math.PI * 6378137 + tx * T, Nm = Math.PI * 6378137 - ty * T;
  const G = E.makeGrid([{ lat: E.latOf(Nm - T / 2), lon: E.lonOf(Wm + T / 2) }], 1.2, 20);
  E.rasterRoads(G, L.transportation, z, tx, ty, false);
  let nr = 0; for (const v of G.road) nr += v;
  const G2 = E.makeGrid([{ lat: E.latOf(Nm - T / 2), lon: E.lonOf(Wm + T / 2) }], 1.2, 20);
  E.rasterRoads(G2, L.transportation, z, tx, ty, true);
  let nr2 = 0; for (const v of G2.road) nr2 += v;
  const acc = E.accessMask(G); let na = 0; for (const v of acc) na += v;
  const tileCells = T * Math.cos(latR) / 20;
  ok(Math.abs(nr - tileCells) < tileCells * 0.15 && nr2 > nr * 1.3 && na > nr * 2.5, `routes : chemin pédestre exclu, piste en option (${nr} / ${nr2} cellules), bande d'accès ${na}`);
}

/* ---------- propagation ---------- */
function flatGrid(lat, lon, rKm, g, fn) {
  const G = E.makeGrid([{ lat, lon }], rKm, g);
  for (let j = 0; j < G.ny; j++) for (let i = 0; i < G.nx; i++) {
    const X = G.X0 + (i + 0.5) * G.gm, Y = G.Y0 - (j + 0.5) * G.gm;
    G.ter[j * G.nx + i] = fn ? fn(E.lonOf(X), E.latOf(Y), i, j, G) : 400;
  }
  return G;
}
const P0 = { f: 50, k: 4 / 3, r: 12, hr: 2, forest: true, forestDb: 6, buildings: true, dir: 'down', fade: 10, prec: 'norm',
  c: { p: 37, g: 0, lc: 0, sens: -113 } };
const S0 = { lat: 46.5, lon: 6.6, h: 2, p: 37, lc: 0, sens: -113, ant: { g: 0, dir: false } };
{
  /* terre plane, 2 m / 2 m, 50 MHz, 10 km : Lfs 86,4 ; hauteurs effectives √(2² + h0²), h0 = 0,62 λ ≈ 3,7 m ; terre plane 135 */
  const n = 400, d = new Float64Array(n + 1), ter = new Float64Array(n + 1).fill(400), fo = new Uint8Array(n + 1);
  for (let k = 0; k <= n; k++) d[k] = 10 * k / n;
  const r = E.pathLoss(d, ter, ter, fo, n, 2, 2, P0);
  ok(near(r.Lfs, 86.43, 0.05), `espace libre 10 km 50 MHz : ${r.Lfs.toFixed(2)} dB`);
  ok(near(r.Fpe, 48.6, 0.2), `excès terre plane (hauteur effective minimale) : ${r.Fpe.toFixed(2)} dB`);
  ok(r.L > 133 && r.L < 140, `perte totale terre plane : ${r.L.toFixed(1)} dB (diffraction ${r.Lb.toFixed(1)})`);
  const marg = 37 - r.L + 113;
  console.log('     marge SE-235 5 W ↔ 5 W à 10 km, terrain plat, antennes 0 dBi, seuil −113 :', marg.toFixed(1), 'dB');
  /* arête unique : v connu */
  const ter2 = Float64Array.from(ter); ter2[200] = 400 + 60;
  const r2 = E.pathLoss(d, ter2, ter2, fo, n, 2, 2, Object.assign({}, P0, { k: 1e9 }));
  const lam = 299.792458 / 50, H = 60 - 2, vth = H * Math.sqrt(2 * 10000 / (lam * 5000 * 5000));
  ok(near(r2.v, vth, 0.01) && !r2.los, `arête unique : v = ${r2.v.toFixed(3)} (théorie ${vth.toFixed(3)}), J = ${r2.Luc.toFixed(1)} dB`);
  ok(r2.L > r.L && r2.Lb > r.Lb + 5, `arête de 60 m : diffraction ${r2.Lb.toFixed(1)} dB, perte ${r2.L.toFixed(1)} dB (sol bas : l'arête ajoute peu, comme le modèle à 4 rayons)`);
  /* mât sur une colline : la hauteur effective fait baisser la perte de sol */
  const ter3 = Float64Array.from(ter); for (let k = 0; k <= 40; k++) ter3[k] = 400 + 150 * (1 - k / 40);
  const r3 = E.pathLoss(d, ter3, ter3, fo, n, 10, 2, P0);
  ok(r3.he1 > 100 && r3.L < r.L - 15, `station sur colline : h eff ${r3.he1.toFixed(0)} m, perte ${r3.L.toFixed(1)} dB`);
  /* forêt au récepteur */
  const fo2 = new Uint8Array(n + 1); fo2[n] = 1;
  const r4 = E.pathLoss(d, ter, ter, fo2, n, 2, 2, P0);
  ok(near(r4.L - r.L, 6, 1e-9), 'forêt au récepteur : +6 dB');
}
{
  /* cohérence lancer de rayons / profil sur un relief ondulé */
  const G = flatGrid(46.5, 6.6, 12, 40, (lon, lat) => 500 + 80 * Math.sin(lon * 90) * Math.cos(lat * 70) + 30 * Math.sin(lat * 400));
  const t0 = Date.now();
  const c = E.castStation(G, S0, P0);
  const ms = Date.now() - t0;
  ok(c.nR > 1500 && c.nS > 250, `lancer : ${c.nR} rayons × ${c.nS} pas en ${ms} ms`);
  const comp = E.composite(G, [c], [S0], P0);
  const st = comp.stats[0];
  ok(st.tot > 0 && st.sure + st.bonne + st.inc + st.hors === st.tot, `couverture : ${st.tot} cellules, sûre ${st.sure}, bonne ${st.bonne}, incertaine ${st.inc}, hors ${st.hors}, portée max ${st.far.toFixed(1)} km`);
  /* un rayon le long de l'axe est (a = 0) comparé au profil direct */
  E.setG(G, { P: P0, stations: [S0], casts: [c] });
  const k = 150, sx = c.sx + k, sy = c.sy;
  const X = G.X0 + (sx + 0.5) * G.gm, Y = G.Y0 - (sy + 0.5) * G.gm;
  const T = { lat: E.latOf(Y), lon: E.lonOf(X), h: 2, p: 37, g: 0, lc: 0, sens: -113 };
  const pr = E.profile({ S: S0, T });
  const Lray = c.Lr[0 * (c.nS + 1) + k];
  ok(near(pr.L, Lray, 2.5), `rayon / profil direct au même point : ${Lray.toFixed(1)} / ${pr.L.toFixed(1)} dB`);
  ok(near(pr.down, 37 + 113 - pr.L, 1e-6), 'bilan descendant cohérent');
  /* sens de liaison : 50 W en face, 5 W ici */
  const Pb = Object.assign({}, P0, { dir: 'both', c: { p: 47, g: 0, lc: 0, sens: -113 } });
  const S1 = Object.assign({}, S0, { p: 37 });
  const cb = E.composite(G, [c], [S1], Pb), cd = E.composite(G, [c], [S1], Object.assign({}, Pb, { dir: 'down' })), cu = E.composite(G, [c], [S1], Object.assign({}, Pb, { dir: 'up' }));
  let okDir = true;
  for (let q = 0; q < cb.mar.length; q += 97) { const a = cb.mar[q]; if (a === a && !near(a, Math.min(cd.mar[q], cu.mar[q]), 1e-4)) okDir = false; }
  ok(okDir, 'sens « les deux » = minimum des deux sens');
  /* aperçu au pas de 2 cellules : proche du calcul complet */
  const c2 = E.castStation(G, S0, P0, null, 2);
  const cf = E.composite(G, [c], [S0], P0), cp = E.composite(G, [c2], [S0], P0);
  let sd = 0, nd = 0;
  for (let q = 0; q < cf.mar.length; q += 13) { const a = cf.mar[q], b = cp.mar[q]; if (a === a && b === b) { sd += Math.abs(a - b); nd++; } }
  ok(nd > 1000 && sd / nd < 2.5, `aperçu au pas de 2 : écart moyen ${(sd / nd).toFixed(2)} dB sur ${nd} points`);
  const tp = Date.now(); E.castStation(G, S0, P0, null, 2); console.log('     aperçu :', Date.now() - tp, 'ms');
  /* recherche de relais : deux stations, les deux liaisons exigées ; station inactive ignorée */
  const S2 = Object.assign({}, S0, { lon: S0.lon + 0.08 });
  const cB = E.castStation(G, S2, P0);
  const cmin = E.composite(G, [c, cB], [S0, S2], Object.assign({}, P0, { combine: 'min' }));
  const cA = E.composite(G, [c], [S0], P0), cBo = E.composite(G, [cB], [S2], P0);
  let okMin = true, nboth = 0;
  for (let q = 0; q < cmin.mar.length; q += 31) {
    const a = cA.mar[q], b = cBo.mar[q], m = cmin.mar[q];
    if (a === a && b === b) { nboth++; if (!near(m, Math.min(a, b), 1e-4)) okMin = false; } else if (m === m) okMin = false;
  }
  ok(okMin && nboth > 500, `relais : marge = plus faible des deux liaisons (${nboth} points couverts par les deux)`);
  const cAct = E.composite(G, [c, cB], [S0, S2], Object.assign({}, P0, { active: [true, false] }));
  let okAct = true;
  for (let q = 0; q < cAct.mar.length; q += 31) { const a = cAct.mar[q], b = cA.mar[q]; if ((a === a) !== (b === b) || (a === a && !near(a, b, 1e-4))) okAct = false; }
  ok(okAct, 'réseau : une station non reliée ne compte pas dans la couverture');
  /* antenne directive : gain avant / arrière */
  const A = { g: 6, dir: true, az: 90, bw: 60 };
  ok(E.gainAt(A, 90) === 6 && E.gainAt(A, 270) === -14 && near(E.gainAt(A, 120), 3, 1e-9), 'antenne directive : avant 6, arrière −14, à 30° 3 dBi');
}
{
  /* chaîne de relais : deux crêtes, A et B à 25 km ; un seul relais ne suffit pas, deux oui */
  const lat = 46.6, lon0 = 7.0;
  const G = flatGrid(lat, lon0 + 14 / 76.6, 14, 40, (lon) => {
    const x = (lon - lon0) * 76.6; /* km */
    return 500 + 320 * Math.exp(-(((x - 8) / 0.6) ** 2)) + 320 * Math.exp(-(((x - 20) / 0.6) ** 2));
  });
  const rel = { h: 3, p: 37, g: 0, lc: 0, sens: -102 };
  const A = { lat, lon: lon0 + 2 / 76.6, h: 2, p: 37, lc: 0, sens: -102, f: 50, ant: { g: 0 }, cpt: rel };
  const B = { lat, lon: lon0 + 26 / 76.6, h: 2, p: 37, lc: 0, sens: -102, f: 50, ant: { g: 0 }, cpt: rel };
  const P = Object.assign({}, P0, { r: 13, combine: 'min', dir: 'both', need: 10, rel: { a: rel, b: rel } });
  const cA = E.castStation(G, A, P), cB = E.castStation(G, B, P);
  E.setG(G, { P, stations: [A, B], casts: [cA, cB] });
  const C = E.composite(G, [cA, cB], [A, B], P);
  const sp = E.bestSpots(C.mar, 3, 0.6);
  const ch = E.findChain([cA, cB], [A, B], P);
  const x1 = ch && ch.r1 ? (ch.r1.lon - lon0) * 76.6 : NaN, x2 = ch && ch.r2 ? (ch.r2.lon - lon0) * 76.6 : NaN;
  ok(sp.length && sp[0].M < 10 && ch && ch.M >= 10, `chaîne : un relais seul ${sp.length ? sp[0].M.toFixed(1) : '-'} dB, deux relais ${ch && ch.M != null ? ch.M.toFixed(1) : '-'} dB (R1 à ${x1.toFixed(1)} km, R2 à ${x2.toFixed(1)} km)`);
}
{
  /* abords : un immeuble de 15 m collé à l'antenne (10 à 40 m) doit masquer la direction qu'il occupe */
  const lat = 46.2, lon = 6.14, S = Object.assign({}, S0, { lat, lon });
  const G = flatGrid(lat, lon, 2, 36, () => 400);
  const c = Math.cos(lat * Math.PI / 180), gm = E.NF_G / c, X = E.mercX(lon), Y = E.mercY(lat), rm = 600 / c, nx = Math.ceil(2 * rm / gm);
  const NF = { X0: X - rm, Y0: Y + rm, gm, nx, ny: nx, bld: new Float32Array(nx * nx), fo: new Uint8Array(nx * nx) };
  NF.sx = (X - NF.X0) / gm - 0.5; NF.sy = (NF.Y0 - Y) / gm - 0.5;
  for (let j = Math.round(NF.sy) - 4; j <= Math.round(NF.sy) + 4; j++) for (let i = Math.round(NF.sx) + 3; i <= Math.round(NF.sx) + 10; i++) NF.bld[j * nx + i] = 15;
  const Pn = Object.assign({}, P0, { r: 2, forest: false });
  const at = (cst, deg, km) => cst.Lr[(Math.round(deg / 360 * cst.nR) % cst.nR) * (cst.nS + 1) + Math.round(km / cst.stepKm)];
  const sans = E.castStation(G, S, Pn), avec = E.castStation(G, Object.assign({}, S, { nf: NF }), Pn);
  const dE = at(avec, 0, 0.3) - at(sans, 0, 0.3), dW = at(avec, 180, 0.3) - at(sans, 180, 0.3);
  ok(dE > 8 && Math.abs(dW) < 0.01, `immeuble collé à l'antenne : +${dE.toFixed(1)} dB derrière lui à 300 m, ${dW.toFixed(1)} dB de l'autre côté`);
  /* antenne dans l'immeuble (sur le toit) : son propre bâtiment est ignoré */
  NF.sx += 6;
  const toit = E.castStation(G, Object.assign({}, S, { nf: NF }), Pn);
  ok(Math.abs(at(toit, 0, 0.3) - at(sans, 0, 0.3)) < 0.01, 'antenne dans son propre bâtiment : pas masquée par lui');
}
{
  /* performance : 20 km, précision normale */
  const g = 20000 / 280;
  const G = flatGrid(46.8, 7.2, 20, g, (lon, lat) => 700 + 300 * Math.sin(lon * 60) * Math.cos(lat * 50));
  const t0 = Date.now();
  const c = E.castStation(G, Object.assign({}, S0, { lat: 46.8, lon: 7.2 }), Object.assign({}, P0, { r: 20 }));
  const t1 = Date.now();
  E.composite(G, [c], [S0], P0);
  console.log(`     20 km, grille ${G.nx}×${G.ny} : lancer ${t1 - t0} ms, composition ${Date.now() - t1} ms`);
}
console.log(fails ? `\n${fails} échec(s)` : '\ntous les tests passent');
process.exit(fails ? 1 : 0);
