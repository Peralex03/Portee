/* Portée : moteur de calcul (Web Worker).
   Données : relief swisstopo (maillage quantized-mesh de 3d.geo.admin.ch), bâtiments et forêt des tuiles vectorielles
   swisstopo (vectortiles.geo.admin.ch). Rien d'autre n'est demandé à un serveur.
   Modèle : Blomquist-Ladell (espace libre + combinaison quadratique de la perte de sol en terre plane, avec hauteurs
   effectives, et de la diffraction), diffraction selon Bullington (UIT-R P.526), courbure terrestre au facteur k,
   perte forfaitaire pour un poste en forêt. Grille alignée sur la projection de la carte (Web Mercator). */
'use strict';

const RE = 6378137, D2R = Math.PI / 180, RK = 6371;
const mercX = lon => RE * lon * D2R;
const mercY = lat => RE * Math.log(Math.tan(Math.PI / 4 + lat * D2R / 2));
const lonOf = X => X / RE / D2R;
const latOf = Y => (2 * Math.atan(Math.exp(Y / RE)) - Math.PI / 2) / D2R;

/* ---------------- lecture des formats ---------------- */

const zz16 = v => (v >> 1) ^ (-(v & 1));

/* quantized-mesh-1.0 : en-tête de 88 octets, sommets u/v/h (zigzag + delta), triangles (marque des hautes eaux) */
function decodeQM(buf) {
  const dv = new DataView(buf);
  if (buf.byteLength < 96) throw new Error('tuile de relief vide');
  const minH = dv.getFloat32(24, true), maxH = dv.getFloat32(28, true);
  let p = 88;
  const n = dv.getUint32(p, true); p += 4;
  if (!n || buf.byteLength < p + 6 * n) throw new Error('tuile de relief illisible');
  const u = new Uint16Array(n), v = new Uint16Array(n), hq = new Uint16Array(n);
  let a = 0;
  for (let i = 0; i < n; i++, p += 2) { a = (a + zz16(dv.getUint16(p, true))) & 0xffff; u[i] = a; }
  a = 0;
  for (let i = 0; i < n; i++, p += 2) { a = (a + zz16(dv.getUint16(p, true))) & 0xffff; v[i] = a; }
  a = 0;
  for (let i = 0; i < n; i++, p += 2) { a = (a + zz16(dv.getUint16(p, true))) & 0xffff; hq[i] = a; }
  const big = n > 65536;
  if (big) { if (p % 4) p += 4 - (p % 4); } else if (p % 2) p++;
  const tc = dv.getUint32(p, true); p += 4;
  const idx = new Uint32Array(tc * 3);
  let hi = 0;
  for (let i = 0; i < tc * 3; i++) {
    const c = big ? dv.getUint32(p, true) : dv.getUint16(p, true);
    p += big ? 4 : 2;
    idx[i] = hi - c;
    if (c === 0) hi++;
  }
  const h = new Float32Array(n), dh = (maxH - minH) / 32767;
  for (let i = 0; i < n; i++) h[i] = minH + hq[i] * dh;
  return { n, u, v, h, idx, tc };
}

/* Mapbox Vector Tile (protobuf) : seules les couches demandées sont lues ; polygones en anneaux [x0,y0,x1,y1,...] */
const td = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;
class Pbf {
  constructor(buf) { this.b = new Uint8Array(buf); this.p = 0; this.dv = new DataView(buf); }
  varint() {
    let v = 0, s = 1, b;
    do { b = this.b[this.p++]; v += (b & 0x7f) * s; s *= 128; } while (b >= 0x80);
    return v;
  }
  str() { const l = this.varint(), s = td.decode(this.b.subarray(this.p, this.p + l)); this.p += l; return s; }
  skip(w) {
    if (w === 0) this.varint();
    else if (w === 1) this.p += 8;
    else if (w === 2) { const l = this.varint(); this.p += l; }
    else if (w === 5) this.p += 4;
    else throw new Error('protobuf : type ' + w);
  }
}
const zzv = n => (n % 2 === 1 ? -(n + 1) / 2 : n / 2);

function mvtValue(pb, end) {
  let v = null;
  while (pb.p < end) {
    const t = pb.varint(), f = Math.floor(t / 8), w = t & 7;
    if (f === 1) v = pb.str();
    else if (f === 2) { v = pb.dv.getFloat32(pb.p, true); pb.p += 4; }
    else if (f === 3) { v = pb.dv.getFloat64(pb.p, true); pb.p += 8; }
    else if (f === 4 || f === 5) v = pb.varint();
    else if (f === 6) v = zzv(pb.varint());
    else if (f === 7) v = !!pb.varint();
    else pb.skip(w);
  }
  pb.p = end;
  return v;
}

function decodeMVT(buf, want) {
  const pb = new Pbf(buf), out = {};
  const end0 = pb.b.length;
  while (pb.p < end0) {
    const t = pb.varint(), f = Math.floor(t / 8), w = t & 7;
    if (f === 3 && w === 2) {
      const l = pb.varint(), end = pb.p + l;
      let name = '', ext = 4096;
      const keys = [], vals = [], feats = [];
      while (pb.p < end) {
        const t2 = pb.varint(), f2 = Math.floor(t2 / 8), w2 = t2 & 7;
        if (f2 === 1) name = pb.str();
        else if (f2 === 2) { const l2 = pb.varint(); feats.push([pb.p, pb.p + l2]); pb.p += l2; }
        else if (f2 === 3) keys.push(pb.str());
        else if (f2 === 4) { const l2 = pb.varint(); vals.push(mvtValue(pb, pb.p + l2)); }
        else if (f2 === 5) ext = pb.varint();
        else pb.skip(w2);
      }
      pb.p = end;
      if (want.indexOf(name) < 0) continue;
      const list = [];
      for (const [s, e] of feats) {
        pb.p = s;
        let type = 0, tags = null, geom = null;
        while (pb.p < e) {
          const t3 = pb.varint(), f3 = Math.floor(t3 / 8), w3 = t3 & 7;
          if (f3 === 2 && w3 === 2) { const l3 = pb.varint(), e3 = pb.p + l3; tags = []; while (pb.p < e3) tags.push(pb.varint()); }
          else if (f3 === 3) type = pb.varint();
          else if (f3 === 4 && w3 === 2) { const l3 = pb.varint(), e3 = pb.p + l3; geom = []; while (pb.p < e3) geom.push(pb.varint()); }
          else pb.skip(w3);
        }
        if (type !== 3 || !geom) continue;
        const props = {};
        if (tags) for (let i = 0; i + 1 < tags.length; i += 2) props[keys[tags[i]]] = vals[tags[i + 1]];
        const rings = [];
        let x = 0, y = 0, ring = null, i = 0;
        while (i < geom.length) {
          const c = geom[i++], cmd = c & 7, cnt = c >> 3;
          if (cmd === 1) { for (let k = 0; k < cnt; k++) { x += zzv(geom[i++]); y += zzv(geom[i++]); ring = [x, y]; rings.push(ring); } }
          else if (cmd === 2) { for (let k = 0; k < cnt; k++) { x += zzv(geom[i++]); y += zzv(geom[i++]); if (ring) ring.push(x, y); } }
          /* 7 : fermeture, l'anneau est refermé au remplissage */
        }
        list.push({ props, rings });
      }
      out[name] = { ext, feats: list };
      pb.p = end;
    } else pb.skip(w);
  }
  return out;
}

async function gunzipIfNeeded(b) {
  const u = new Uint8Array(b, 0, Math.min(2, b.byteLength));
  if (u.length === 2 && u[0] === 0x1f && u[1] === 0x8b && typeof DecompressionStream !== 'undefined') {
    const s = new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'));
    return await new Response(s).arrayBuffer();
  }
  return b;
}

/* ---------------- grille ---------------- */

/* grille commune à toutes les stations : cellules carrées en Web Mercator, de g mètres au sol à la latitude moyenne */
function makeGrid(stations, rKm, gWanted) {
  let lat0 = 0;
  for (const s of stations) lat0 += s.lat / stations.length;
  const c0 = Math.cos(lat0 * D2R);
  let g = gWanted, gm, X0, X1, Yt, Yb, nx, ny;
  for (;;) {
    gm = g / c0;
    X0 = Infinity; X1 = -Infinity; Yt = -Infinity; Yb = Infinity;
    for (const s of stations) {
      const X = mercX(s.lon), Y = mercY(s.lat), rm = rKm * 1000 / Math.cos(s.lat * D2R);
      X0 = Math.min(X0, X - rm); X1 = Math.max(X1, X + rm); Yt = Math.max(Yt, Y + rm); Yb = Math.min(Yb, Y - rm);
    }
    X0 -= 2 * gm; X1 += 2 * gm; Yt += 2 * gm; Yb -= 2 * gm;
    nx = Math.ceil((X1 - X0) / gm); ny = Math.ceil((Yt - Yb) / gm);
    if (nx * ny <= 2.6e6) break;
    g *= 1.25;
  }
  const N = nx * ny;
  return { g, gm, c0, lat0, X0, Y0: Yt, nx, ny, ter: new Float32Array(N).fill(NaN), bld: new Float32Array(N), fo: new Uint8Array(N) };
}
const gx = (G, lon) => (mercX(lon) - G.X0) / G.gm - 0.5;
const gy = (G, lat) => (G.Y0 - mercY(lat)) / G.gm - 0.5;
function gridBounds(G) {
  return [[latOf(G.Y0 - G.ny * G.gm), lonOf(G.X0)], [latOf(G.Y0), lonOf(G.X0 + G.nx * G.gm)]];
}

/* triangles du maillage vers la grille : interpolation barycentrique au centre des cellules */
function rasterMesh(G, m, west, south, deg) {
  const { nx, ny, ter } = G, n = m.n, fx = new Float64Array(n), fy = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    fx[i] = gx(G, west + m.u[i] / 32767 * deg);
    fy[i] = gy(G, south + m.v[i] / 32767 * deg);
  }
  const I = m.idx, H = m.h, e = -1e-7;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    const ax = fx[a], ay = fy[a], bx = fx[b], by = fy[b], cx = fx[c], cy = fy[c];
    const i0 = Math.max(0, Math.ceil(Math.min(ax, bx, cx))), i1 = Math.min(nx - 1, Math.floor(Math.max(ax, bx, cx)));
    const j0 = Math.max(0, Math.ceil(Math.min(ay, by, cy))), j1 = Math.min(ny - 1, Math.floor(Math.max(ay, by, cy)));
    if (i0 > i1 || j0 > j1) continue;
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(area) < 1e-12) continue;
    const ha = H[a], hb = H[b], hc = H[c];
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const w0 = ((bx - i) * (cy - j) - (by - j) * (cx - i)) / area;
        if (w0 < e) continue;
        const w1 = ((cx - i) * (ay - j) - (cy - j) * (ax - i)) / area;
        if (w1 < e) continue;
        const w2 = 1 - w0 - w1;
        if (w2 < e) continue;
        ter[j * nx + i] = w0 * ha + w1 * hb + w2 * hc;
      }
    }
  }
}

/* remplissage pair-impair d'un polygone (anneaux en coordonnées de grille), fn(index) pour chaque cellule couverte */
function fillPoly(G, rings, fn) {
  const { nx, ny } = G;
  let y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity;
  for (const r of rings) for (let k = 0; k < r.length; k += 2) { const x = r[k], y = r[k + 1]; if (y < y0) y0 = y; if (y > y1) y1 = y; if (x < x0) x0 = x; if (x > x1) x1 = x; }
  if (x1 < 0 || y1 < 0 || x0 > nx - 1 || y0 > ny - 1) return -1;
  const j0 = Math.max(0, Math.ceil(y0)), j1 = Math.min(ny - 1, Math.floor(y1));
  const xs = [];
  let cnt = 0;
  for (let j = j0; j <= j1; j++) {
    xs.length = 0;
    for (const r of rings) {
      const m = r.length;
      for (let k = 0; k < m; k += 2) {
        const xa = r[k], ya = r[k + 1], q = (k + 2) % m, xb = r[q], yb = r[q + 1];
        if ((ya <= j && yb > j) || (yb <= j && ya > j)) xs.push(xa + (j - ya) / (yb - ya) * (xb - xa));
      }
    }
    if (xs.length < 2) continue;
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.max(0, Math.ceil(xs[k])), i1 = Math.min(nx - 1, Math.ceil(xs[k + 1]) - 1);
      for (let i = i0; i <= i1; i++) { fn(j * nx + i); cnt++; }
    }
  }
  /* bâtiment plus petit qu'une cellule : la cellule de son centre */
  if (!cnt) {
    const ci = Math.round((x0 + x1) / 2), cj = Math.round((y0 + y1) / 2);
    if (ci >= 0 && cj >= 0 && ci < nx && cj < ny) { fn(cj * nx + ci); cnt = 1; }
  }
  return cnt;
}

function rasterVT(G, layers, z, x, y, opt) {
  const T = 2 * Math.PI * RE / 2 ** z, W = -Math.PI * RE + x * T, Nn = Math.PI * RE - y * T;
  const conv = (ext, ring) => {
    const o = new Float64Array(ring.length);
    for (let k = 0; k < ring.length; k += 2) {
      o[k] = (W + ring[k] / ext * T - G.X0) / G.gm - 0.5;
      o[k + 1] = (G.Y0 - (Nn - ring[k + 1] / ext * T)) / G.gm - 0.5;
    }
    return o;
  };
  if (opt.buildings && layers.building) {
    const L = layers.building;
    for (const f of L.feats) {
      let hgt = +f.props.render_height;
      if (!isFinite(hgt) || hgt <= 0) hgt = 8;
      hgt = Math.min(hgt, 250);
      fillPoly(G, f.rings.map(r => conv(L.ext, r)), k => { if (G.bld[k] < hgt) G.bld[k] = hgt; });
    }
  }
  if (opt.forest && layers.landcover) {
    const L = layers.landcover;
    for (const f of L.feats) {
      const sc = f.props.subclass;
      if (sc !== 'forest' && sc !== 'loose_forest') continue;
      /* pas de cellule « centre » pour la forêt : seules les cellules réellement couvertes comptent */
      fillPolyNoCentre(G, f.rings.map(r => conv(L.ext, r)), k => { G.fo[k] = 1; });
    }
  }
}
function fillPolyNoCentre(G, rings, fn) {
  const { nx, ny } = G;
  let y0 = Infinity, y1 = -Infinity;
  for (const r of rings) for (let k = 1; k < r.length; k += 2) { if (r[k] < y0) y0 = r[k]; if (r[k] > y1) y1 = r[k]; }
  const j0 = Math.max(0, Math.ceil(y0)), j1 = Math.min(ny - 1, Math.floor(y1));
  const xs = [];
  for (let j = j0; j <= j1; j++) {
    xs.length = 0;
    for (const r of rings) {
      const m = r.length;
      for (let k = 0; k < m; k += 2) {
        const xa = r[k], ya = r[k + 1], q = (k + 2) % m, xb = r[q], yb = r[q + 1];
        if ((ya <= j && yb > j) || (yb <= j && ya > j)) xs.push(xa + (j - ya) / (yb - ya) * (xb - xa));
      }
    }
    if (xs.length < 2) continue;
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.max(0, Math.ceil(xs[k])), i1 = Math.min(nx - 1, Math.ceil(xs[k + 1]) - 1);
      for (let i = i0; i <= i1; i++) fn(j * nx + i);
    }
  }
}

/* cellules sans altitude (hors couverture) : valeur de la cellule connue la plus proche (parcours en largeur), et repérées */
function fillHoles(G) {
  const { nx, ny, ter } = G, N = nx * ny;
  const nod = new Uint8Array(N), q = new Int32Array(N);
  let miss = 0, qh = 0, qt = 0;
  for (let k = 0; k < N; k++) if (!(ter[k] === ter[k])) { nod[k] = 1; miss++; }
  if (!miss || miss === N) return { miss, nod };
  for (let k = 0; k < N; k++) {
    if (nod[k]) continue;
    const i = k % nx;
    if ((i > 0 && nod[k - 1]) || (i < nx - 1 && nod[k + 1]) || (k >= nx && nod[k - nx]) || (k < N - nx && nod[k + nx])) q[qt++] = k;
  }
  const seen = new Uint8Array(N);
  for (let k = 0; k < N; k++) if (!nod[k]) seen[k] = 1;
  while (qh < qt) {
    const k = q[qh++], i = k % nx, v = ter[k];
    const nb = [i > 0 ? k - 1 : -1, i < nx - 1 ? k + 1 : -1, k >= nx ? k - nx : -1, k < N - nx ? k + nx : -1];
    for (const t of nb) if (t >= 0 && !seen[t]) { seen[t] = 1; ter[t] = v; q[qt++] = t; }
  }
  return { miss, nod };
}

function bil(G, A, x, y) {
  const { nx, ny } = G;
  if (x < 0 || y < 0 || x > nx - 1 || y > ny - 1) return NaN;
  const i = Math.min(nx - 2, Math.floor(x)), j = Math.min(ny - 2, Math.floor(y)), fx = x - i, fy = y - j, k = j * nx + i;
  return (A[k] * (1 - fx) + A[k + 1] * fx) * (1 - fy) + (A[k + nx] * (1 - fx) + A[k + nx + 1] * fx) * fy;
}
const near = (G, A, x, y) => {
  const i = Math.round(x), j = Math.round(y);
  return i < 0 || j < 0 || i >= G.nx || j >= G.ny ? 0 : A[j * G.nx + i];
};

/* ---------------- propagation ---------------- */

const J = v => (v > -0.78 ? 6.9 + 20 * Math.log10(Math.sqrt((v - 0.1) * (v - 0.1) + 1) + v - 0.1) : 0);
const FOREST_H = 15; /* au-dessus de cette hauteur d'antenne, le poste est au-dessus de la canopée */

/* affaiblissement d'un trajet : d[] (km), ter[] (sol, m), obs[] (sol + bâtiments, m), fo[] (forêt) de l'émetteur
   (indice 0) au récepteur (indice n) ; détail complet pour le profil */
function pathLoss(d, ter, obs, fo, n, ht, hr, P) {
  const dk = d[n], hts = ter[0] + ht, hrs = ter[n] + hr, C = 500 / (P.k * RK), lam = 299.792458 / P.f;
  let Stim = -Infinity, iT = -1;
  for (let i = 1; i < n; i++) { const s = (obs[i] + C * d[i] * (dk - d[i]) - hts) / d[i]; if (s > Stim) { Stim = s; iT = i; } }
  const Str = (hrs - hts) / dk;
  let Luc = 0, v = -Infinity, edge = -1, los = true, db = 0, hb = 0;
  if (n > 1) {
    if (Stim < Str) {
      for (let i = 1; i < n; i++) {
        const H = obs[i] + C * d[i] * (dk - d[i]) - (hts * (dk - d[i]) + hrs * d[i]) / dk;
        const vi = H * Math.sqrt(0.002 * dk / (lam * d[i] * (dk - d[i])));
        if (vi > v) { v = vi; edge = i; }
      }
      Luc = J(v);
    } else {
      los = false;
      let Srim = -Infinity;
      for (let i = 1; i < n; i++) { const s = (obs[i] + C * d[i] * (dk - d[i]) - hrs) / (dk - d[i]); if (s > Srim) Srim = s; }
      db = (hrs - hts + Srim * dk) / (Stim + Srim);
      v = (hts + Stim * db - (hts * (dk - db) + hrs * db) / dk) * Math.sqrt(0.002 * dk / (lam * db * (dk - db)));
      Luc = J(v);
      hb = hts + Stim * db;
      edge = iT;
    }
  }
  const Lb = Luc > 0 ? Luc + (1 - Math.exp(-Luc / 6)) * (10 + 0.02 * dk) : 0;
  /* hauteurs effectives : au-dessus de la droite des moindres carrés du sol */
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i <= n; i++) { sx += d[i]; sy += ter[i]; sxx += d[i] * d[i]; sxy += d[i] * ter[i]; }
  const m = n + 1, den = m * sxx - sx * sx, b = den > 1e-12 ? (m * sxy - sx * sy) / den : 0, a = (sy - b * sx) / m;
  const he1 = ht + Math.max(0, ter[0] - a), he2 = hr + Math.max(0, ter[n] - (a + b * dk));
  const Lfs = 32.45 + 20 * Math.log10(P.f) + 20 * Math.log10(Math.max(dk, 1e-3));
  const Lpe = 40 * Math.log10(Math.max(dk * 1000, 1)) - 20 * Math.log10(he1 * he2);
  const Fpe = Math.max(0, Lpe - Lfs);
  const Lfo = (P.forest && fo[0] && ht < FOREST_H ? P.forestDb : 0) + (P.forest && fo[n] && hr < FOREST_H ? P.forestDb : 0);
  const L = Lfs + Math.sqrt(Fpe * Fpe + Lb * Lb) + Lfo;
  return { L, Lfs, Fpe, Lb, Luc, v, edge, los, db, hb, he1, he2, Lfo, hts, hrs, C, lam };
}

/* lancer de rayons depuis une station : pertes pour chaque pas de chaque rayon, O(n²) par rayon (Bullington exact) */
function castStation(G, S, P, onProg, st = 1) {
  const sx = gx(G, S.lon), sy = gy(G, S.lat);
  const stepKm = G.gm * Math.cos(S.lat * D2R) * st / 1000;
  const nS = Math.max(4, Math.ceil(P.r / stepKm));
  const nR = Math.min(4096, Math.max(64, Math.ceil(2 * Math.PI * nS)));
  const Lr = new Float32Array(nR * (nS + 1)).fill(NaN);
  const d = new Float64Array(nS + 1), ter = new Float64Array(nS + 1), obs = new Float64Array(nS + 1), fo = new Uint8Array(nS + 1);
  const f = S.f || P.f, ht = S.h, hr = P.hr, C = 500 / (P.k * RK), lam = 299.792458 / f, log10f = 20 * Math.log10(f);
  const t0 = bil(G, G.ter, sx, sy);
  if (!(t0 === t0)) throw new Error('station hors des données de relief');
  const hts = t0 + ht, fo0 = near(G, G.fo, sx, sy);
  const foTx = P.forest && fo0 && ht < FOREST_H ? P.forestDb : 0, foRxOK = P.forest && hr < FOREST_H;
  for (let k = 0; k <= nS; k++) d[k] = k * stepKm;
  let tick = Date.now();
  for (let a = 0; a < nR; a++) {
    const th = 2 * Math.PI * a / nR, cs = Math.cos(th), sn = Math.sin(th);
    ter[0] = t0; obs[0] = t0; fo[0] = fo0;
    let n = 0;
    for (let k = 1; k <= nS; k++) {
      const x = sx + k * st * cs, y = sy - k * st * sn, t = bil(G, G.ter, x, y);
      if (!(t === t)) break;
      ter[k] = t; obs[k] = t + near(G, G.bld, x, y); fo[k] = near(G, G.fo, x, y); n = k;
    }
    const base = a * (nS + 1);
    Lr[base] = 0;
    let mT = -Infinity, sx_ = d[0], sy_ = ter[0], sxx = 0, sxy = 0;
    for (let k = 1; k <= n; k++) {
      const dk = d[k], hrs = ter[k] + hr;
      if (k > 1) { const i = k - 1, s = (obs[i] - C * d[i] * d[i] - hts) / d[i]; if (s > mT) mT = s; }
      sx_ += dk; sy_ += ter[k]; sxx += dk * dk; sxy += dk * ter[k];
      const Stim = mT + C * dk, Str = (hrs - hts) / dk;
      let Luc = 0;
      if (k > 1) {
        if (Stim < Str) {
          let v = -Infinity;
          const q = 0.002 * dk / lam, inv = 1 / dk;
          for (let i = 1; i < k; i++) {
            const di = d[i], dd = dk - di;
            const H = obs[i] + C * di * dd - (hts * dd + hrs * di) * inv;
            const vi = H * Math.sqrt(q / (di * dd));
            if (vi > v) v = vi;
          }
          Luc = J(v);
        } else {
          let Srim = -Infinity;
          for (let i = 1; i < k; i++) { const di = d[i], s = (obs[i] + C * di * (dk - di) - hrs) / (dk - di); if (s > Srim) Srim = s; }
          const db = (hrs - hts + Srim * dk) / (Stim + Srim);
          const v = (hts + Stim * db - (hts * (dk - db) + hrs * db) / dk) * Math.sqrt(0.002 * dk / (lam * db * (dk - db)));
          Luc = J(v);
        }
      }
      const Lb = Luc > 0 ? Luc + (1 - Math.exp(-Luc / 6)) * (10 + 0.02 * dk) : 0;
      const m = k + 1, den = m * sxx - sx_ * sx_, b = den > 1e-12 ? (m * sxy - sx_ * sy_) / den : 0, aa = (sy_ - b * sx_) / m;
      const he1 = ht + Math.max(0, t0 - aa), he2 = hr + Math.max(0, ter[k] - (aa + b * dk));
      const Lfs = 32.45 + log10f + 20 * Math.log10(dk);
      const Fpe = Math.max(0, 40 * Math.log10(dk * 1000) - 20 * Math.log10(he1 * he2) - Lfs);
      Lr[base + k] = Lfs + Math.sqrt(Fpe * Fpe + Lb * Lb) + foTx + (foRxOK && fo[k] ? P.forestDb : 0);
    }
    if (onProg && Date.now() - tick > 120) { tick = Date.now(); onProg(a / nR); }
  }
  return { sx, sy, nS, nR, Lr, stepKm, t0, st };
}

/* gain d'antenne selon l'azimut (antenne directive : lobe simple, rapport avant-arrière 20 dB) */
function gainAt(A, bearing) {
  if (!A.dir) return A.g;
  let dth = Math.abs(((bearing - A.az) % 360 + 540) % 360 - 180);
  return A.g - Math.min(12 * (dth / A.bw) ** 2, 20);
}

/* marges sur la grille : meilleure station en chaque cellule */
function composite(G, casts, stations, P) {
  const { nx, ny } = G, N = nx * ny;
  const mar = new Float32Array(N).fill(NaN), best = new Uint8Array(N).fill(255);
  const stats = stations.map(() => ({ tot: 0, sure: 0, bonne: 0, inc: 0, hors: 0, far: 0 }));
  const R2D = 180 / Math.PI;
  casts.forEach((c, si) => {
    const S = stations[si], st = c.st || 1, nS = c.nS, rc = nS * st, rc2 = rc * rc;
    const j0 = Math.max(0, Math.floor(c.sy - rc)), j1 = Math.min(ny - 1, Math.ceil(c.sy + rc));
    const i0 = Math.max(0, Math.floor(c.sx - rc)), i1 = Math.min(nx - 1, Math.ceil(c.sx + rc));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const dx = i - c.sx, dy = c.sy - j, r2 = dx * dx + dy * dy;
        if (r2 > rc2) continue;
        const k = j * nx + i, rr = Math.sqrt(r2);
        let L;
        const th = Math.atan2(dy, dx);
        let af = th / (2 * Math.PI) * c.nR; if (af < 0) af += c.nR;
        const a0 = Math.floor(af) % c.nR, a1 = (a0 + 1) % c.nR, wa = af - Math.floor(af);
        const kf = rr / st, k0 = Math.min(nS - 1, Math.floor(kf)), wk = Math.min(1, kf - k0);
        const p = (a, kk) => c.Lr[a * (nS + 1) + kk];
        const l00 = p(a0, k0), l01 = p(a0, k0 + 1), l10 = p(a1, k0), l11 = p(a1, k0 + 1);
        const la = l00 + (l01 - l00) * wk, lb = l10 + (l11 - l10) * wk;
        L = la === la && lb === lb ? la + (lb - la) * wa : la === la ? la : lb;
        if (!(L === L)) continue;
        const bearing = ((90 - th * R2D) % 360 + 360) % 360;
        const gS = gainAt(S.ant, bearing);
        const down = S.p + gS - S.lc - L + P.c.g - P.c.lc - P.c.sens;
        const up = P.c.p + P.c.g - P.c.lc - L + gS - S.lc - S.sens;
        const M = P.dir === 'down' ? down : P.dir === 'up' ? up : Math.min(down, up);
        const so = stats[si];
        so.tot++;
        if (M >= P.fade + 10) so.sure++; else if (M >= P.fade) so.bonne++; else if (M >= 0) so.inc++; else so.hors++;
        if (M >= 0 && rr > so.far) so.far = rr;
        if (!(mar[k] >= M)) { mar[k] = M; best[k] = si; }
      }
    }
  });
  stats.forEach((s, i) => { s.far *= casts[i].stepKm / (casts[i].st || 1); });
  return { mar, best, stats };
}

/* ---------------- données ---------------- */

const TER_BASE = 'https://3d.geo.admin.ch/ch.swisstopo.terrain.3d/v1/';
const VT_URL = (z, x, y) => `https://vectortiles${(x + y) % 5}.geo.admin.ch/tiles/ch.swisstopo.base.vt/v1.0.0/${z}/${x}/${y}.pbf`;
let terTpl = null;
const cacheQM = new Map(), cacheVT = new Map();

async function fetchBuf(url, accept) {
  const o = { credentials: 'omit', referrerPolicy: 'no-referrer', mode: 'cors' };
  if (accept) o.headers = { Accept: accept };
  const r = await fetch(url, o);
  if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
  return gunzipIfNeeded(await r.arrayBuffer());
}
async function terrainTemplate() {
  if (terTpl) return terTpl;
  try {
    const r = await fetch(TER_BASE + 'layer.json', { credentials: 'omit', referrerPolicy: 'no-referrer' });
    const j = await r.json();
    const t = j.tiles && j.tiles[0];
    if (t) terTpl = TER_BASE + t.replace('{version}', j.version || '1');
  } catch (e) {}
  if (!terTpl) terTpl = TER_BASE + '20250101/{z}/{x}/{y}.terrain?v=1.43646.0';
  return terTpl;
}
const QM_ACCEPT = 'application/vnd.quantized-mesh,application/octet-stream;q=0.9,*/*;q=0.01';
async function getMesh(z, x, y) {
  const key = z + '/' + x + '/' + y;
  if (cacheQM.has(key)) return cacheQM.get(key);
  const pr = (async () => {
    try {
      const tpl = await terrainTemplate();
      const buf = await fetchBuf(tpl.replace('{z}', z).replace('{x}', x).replace('{y}', y), QM_ACCEPT);
      const m = decodeQM(buf);
      m.z = z; m.x = x; m.y = y;
      return m;
    } catch (e) {
      if (e && e.status === undefined && !(e instanceof RangeError) && !/illisible|vide/.test(e.message)) throw e;
      if (z <= 7) return null;
      return getMesh(z - 1, x >> 1, y >> 1);
    }
  })();
  cacheQM.set(key, pr);
  pr.catch(() => cacheQM.delete(key));
  return pr;
}
async function getVT(z, x, y) {
  const key = z + '/' + x + '/' + y;
  if (cacheVT.has(key)) return cacheVT.get(key);
  const pr = (async () => {
    try { return decodeMVT(await fetchBuf(VT_URL(z, x, y)), ['building', 'landcover']); }
    catch (e) { if (e && e.status) return {}; throw e; }
  })();
  cacheVT.set(key, pr);
  pr.catch(() => cacheVT.delete(key));
  return pr;
}
async function pool(items, n, fn, onDone) {
  let i = 0, done = 0;
  const out = new Array(items.length);
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); done++; if (onDone) onDone(done, items.length); }
  }));
  return out;
}

/* ---------------- déroulement ---------------- */

let G = null, LAST = null, cur = 0;
const post = (m, tr) => (typeof postMessage === 'function' ? postMessage(m, tr || []) : null);
const stale = id => { if (id !== cur) throw new Error('stale'); };

async function run(m) {
  const id = m.id, P = m.P, stations = m.stations;
  cur = id;
  const prog = (phase, f) => post({ t: 'prog', id, phase, f });
  const nTarget = { fast: 180, norm: 280, fine: 420 }[P.prec] || 280;
  const g = Math.max(10, P.r * 1000 / nTarget);
  const Gn = makeGrid(stations, P.r, g);
  /* relief : niveau du maillage selon la taille des cellules */
  const lvl = Math.max(9, Math.min(15, Math.round(Math.log2(1.5 * 77067 / Gn.g))));
  const deg = 180 / 2 ** lvl;
  const [[s, w], [nn, e]] = gridBounds(Gn);
  const tx0 = Math.floor((w + 180) / deg), tx1 = Math.floor((e + 180) / deg);
  const ty0 = Math.floor((s + 90) / deg), ty1 = Math.floor((nn + 90) / deg);
  const tiles = [];
  for (let x = tx0; x <= tx1; x++) for (let y = ty0; y <= ty1; y++) tiles.push([x, y]);
  prog('Relief', 0);
  const meshes = await pool(tiles, 8, ([x, y]) => getMesh(lvl, x, y), (dn, tot) => prog('Relief', dn / tot));
  stale(id);
  const seen = new Set(), list = [];
  for (const mm of meshes) if (mm && !seen.has(mm)) { seen.add(mm); list.push(mm); }
  list.sort((p, q) => p.z - q.z);
  for (const mm of list) { const dg = 180 / 2 ** mm.z; rasterMesh(Gn, mm, -180 + mm.x * dg, -90 + mm.y * dg, dg); }
  const holes = fillHoles(Gn);
  if (holes.miss === Gn.nx * Gn.ny) throw new Error('Aucune donnée de relief pour cette zone.');
  /* bâtiments et forêt */
  if (P.buildings || P.forest) {
    const zv = Gn.g <= 22 ? 14 : Gn.g <= 50 ? 13 : 12;
    const n2 = 2 ** zv, T = 2 * Math.PI * RE / n2;
    const X1 = Gn.X0 + Gn.nx * Gn.gm, Yb = Gn.Y0 - Gn.ny * Gn.gm;
    const vx0 = Math.floor((Gn.X0 + Math.PI * RE) / T), vx1 = Math.floor((X1 + Math.PI * RE) / T);
    const vy0 = Math.floor((Math.PI * RE - Gn.Y0) / T), vy1 = Math.floor((Math.PI * RE - Yb) / T);
    const vt = [];
    for (let x = vx0; x <= vx1; x++) for (let y = vy0; y <= vy1; y++) vt.push([x, y]);
    prog('Bâtiments et forêt', 0);
    let failed = 0;
    const lay = await pool(vt, 8, async ([x, y]) => { try { return await getVT(zv, x, y); } catch (e) { failed++; return {}; } }, (dn, tot) => prog('Bâtiments et forêt', dn / tot));
    stale(id);
    lay.forEach((L, q) => rasterVT(Gn, L, zv, vt[q][0], vt[q][1], { buildings: P.buildings, forest: P.forest }));
    Gn.vtFailed = failed;
  }
  Gn.nod = holes.miss ? holes.nod : null;
  G = Gn;
  /* propagation */
  const casts = [];
  for (let si = 0; si < stations.length; si++) {
    const S = stations[si];
    casts.push(castStation(G, S, P, f => prog('Calcul ' + (stations.length > 1 ? (si + 1) + '/' + stations.length : ''), (si + f) / stations.length)));
    await new Promise(r => setTimeout(r, 0));
    stale(id);
  }
  const C = composite(G, casts, stations, P);
  LAST = { P, stations, casts };
  let bmax = 0, nb = 0, nf = 0;
  for (let k = 0; k < G.bld.length; k++) { if (G.bld[k] > 0) nb++; if (G.fo[k]) nf++; if (G.bld[k] > bmax) bmax = G.bld[k]; }
  return {
    t: 'done', id, nx: G.nx, ny: G.ny, bounds: gridBounds(G), g: G.g, mar: C.mar, best: C.best, stats: C.stats,
    nod: holes.miss ? holes.nod : null, lvl, cells: { bld: nb, fo: nf }, vtFailed: G.vtFailed || 0,
    t0: casts.map(c => c.t0),
  };
}

/* aperçu pendant le déplacement d'une antenne : même grille, seule la station déplacée est recalculée, pas de 2 cellules */
function preview(m) {
  if (!G || !LAST || LAST.casts.length !== m.stations.length || LAST.P.r !== m.P.r || LAST.P.buildings !== m.P.buildings || LAST.P.forest !== m.P.forest) return { t: 'skip', id: m.id };
  const S = m.stations[m.idx];
  const x = gx(G, S.lon), y = gy(G, S.lat);
  if (x < 0 || y < 0 || x > G.nx - 1 || y > G.ny - 1) return { t: 'skip', id: m.id };
  cur = m.id;
  const casts = LAST.casts.slice();
  casts[m.idx] = castStation(G, S, m.P, null, 2);
  const C = composite(G, casts, m.stations, m.P);
  return { t: 'done', id: m.id, preview: true, nx: G.nx, ny: G.ny, bounds: gridBounds(G), g: G.g, mar: C.mar, best: C.best, stats: C.stats,
    nod: G.nod ? G.nod.slice() : null, cells: null, vtFailed: 0, t0: casts.map(c => c.t0) };
}

/* profil entre une station et un point (ou une autre station) */
function profile(m) {
  if (!G || !LAST) throw new Error('Aucun calcul disponible.');
  const P = LAST.P, S = m.S, T = m.T;
  const x0 = gx(G, S.lon), y0 = gy(G, S.lat), x1 = gx(G, T.lon), y1 = gy(G, T.lat);
  const len = Math.hypot(x1 - x0, y1 - y0);
  const out = (x, y) => x < 0 || y < 0 || x > G.nx - 1 || y > G.ny - 1;
  if (out(x0, y0) || out(x1, y1)) throw new Error('Point hors de la zone calculée.');
  const n = Math.max(2, Math.ceil(len * 2));
  const latm = (S.lat + T.lat) / 2, dKm = len * G.gm * Math.cos(latm * D2R) / 1000;
  const d = new Float64Array(n + 1), ter = new Float64Array(n + 1), obs = new Float64Array(n + 1), fo = new Uint8Array(n + 1);
  for (let k = 0; k <= n; k++) {
    const f = k / n, x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f;
    d[k] = dKm * f; ter[k] = bil(G, G.ter, x, y);
    obs[k] = ter[k] + (k > 0 && k < n ? near(G, G.bld, x, y) : 0);
    fo[k] = near(G, G.fo, x, y);
  }
  const Pp = Object.assign({}, P, { hr: T.h, f: S.f || P.f });
  const r = pathLoss(d, ter, obs, fo, n, S.h, T.h, Pp);
  const brg = Math.atan2(x1 - x0, -(y1 - y0)) * 180 / Math.PI;
  const bearing = (brg + 360) % 360;
  const gS = gainAt(S.ant, bearing), gT = T.ant ? gainAt(T.ant, (bearing + 180) % 360) : T.g;
  const down = S.p + gS - S.lc - r.L + gT - T.lc - T.sens;
  const up = T.p + gT - T.lc - r.L + gS - S.lc - S.sens;
  return {
    t: 'profile', id: m.id, n, d: Array.from(d), ter: Array.from(ter), obs: Array.from(obs), fo: Array.from(fo),
    L: r.L, Lfs: r.Lfs, Fpe: r.Fpe, Lb: r.Lb, Luc: r.Luc, v: r.v, edge: r.edge, los: r.los, db: r.db, hb: r.hb,
    he1: r.he1, he2: r.he2, Lfo: r.Lfo, hts: r.hts, hrs: r.hrs, C: r.C, lam: r.lam, dKm, bearing,
    down, up, rxDown: S.p + gS - S.lc - r.L + gT - T.lc, rxUp: T.p + gT - T.lc - r.L + gS - S.lc,
  };
}

if (typeof self !== 'undefined' && typeof self.addEventListener === 'function' && typeof document === 'undefined') {
  self.addEventListener('message', async e => {
    const m = e.data;
    if (m.t === 'run') {
      try {
        const r = await run(m);
        const tr = [r.mar.buffer, r.best.buffer];
        if (r.nod) tr.push(r.nod.buffer);
        post(r, tr);
      } catch (err) {
        if (err && err.message === 'stale') return;
        post({ t: 'err', id: m.id, msg: (err && err.message) || String(err), net: err instanceof TypeError });
      }
    } else if (m.t === 'preview') {
      try {
        const r = preview(m);
        post(r, r.t === 'done' ? [r.mar.buffer, r.best.buffer].concat(r.nod ? [r.nod.buffer] : []) : []);
      } catch (err) { post({ t: 'skip', id: m.id }); }
    } else if (m.t === 'profile') {
      try { post(profile(m)); } catch (err) { post({ t: 'err', id: m.id, kind: 'profile', msg: err.message }); }
    }
  });
}

if (typeof module !== 'undefined') module.exports = { decodeQM, decodeMVT, makeGrid, rasterMesh, rasterVT, fillPoly, fillHoles, castStation, composite, pathLoss, gainAt, J, mercX, mercY, lonOf, latOf, gx, gy, gridBounds, bil, setG: (g, l) => { G = g; LAST = l; }, profile, run, preview, getG: () => G };
