// Morph: a dotted outline cycling circle → triangle → square → circle —
// the "shaping" state. Each shape is a continuous closed path
// parameterised by arc length (top-centre start, clockwise). Every
// frame the engine blends the two neighbouring paths, then lays the
// dots EVENLY along the blended outline — spacing stays uniform at
// every instant of the morph, holds and transitions alike. Plain
// circle fills only: no canvas/SVG filters, fully cross-browser.

import type { ModeBuild } from './types';

type Path = (f: number) => [number, number];

function smoothE(x: number): number {
  return x * x * (3 - 2 * x);
}

function polyPath(verts: ReadonlyArray<readonly [number, number]>): Path {
  const V = verts.length;
  const L: number[] = [];
  let total = 0;
  for (let i = 0; i < V; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % V];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    L.push(l);
    total += l;
  }
  return (f) => {
    let target = f * total;
    let i = 0;
    while (target > L[i] && i < V - 1) {
      target -= L[i];
      i++;
    }
    const a = verts[i];
    const b = verts[(i + 1) % V];
    const ff = L[i] ? Math.min(1, target / L[i]) : 0;
    return [a[0] + (b[0] - a[0]) * ff, a[1] + (b[1] - a[1]) * ff];
  };
}

const CIRCLE: Path = (f) => {
  const a = -Math.PI / 2 + f * 2 * Math.PI;
  return [Math.cos(a) * 0.24, Math.sin(a) * 0.24];
};
const TRIANGLE = polyPath([
  [0.0, -0.26],
  [0.24, 0.16],
  [-0.24, 0.16]
]);
// 5-vertex walk so the path STARTS at top-centre like the other shapes
const SQUARE = polyPath([
  [0, -0.2],
  [0.2, -0.2],
  [0.2, 0.2],
  [-0.2, 0.2],
  [-0.2, -0.2]
]);
const CYCLE: Path[] = [CIRCLE, TRIANGLE, SQUARE];

// low floor keeps sparse outlines possible while never degenerating
function morphN(d: number): number {
  return Math.max(6, Math.round(34 * d));
}

const HOLD = 1.4;
const MORPH = 0.9;
const SEG = HOLD + MORPH;

// Outline sampling is a pure function of (shape pair, morph amount, spread).
// Upstream rebuilt a 160-point path plus its arc-length table every frame; the
// blend only changes when `m` does, so quantising `m` lets consecutive frames
// reuse the work. 1/512 of a morph is far below a pixel of movement.
const M = 160;
const ptsX = new Float64Array(M);
const ptsY = new Float64Array(M);
const segLen = new Float64Array(M);
let cacheKey = '';
let cacheTotal = 0;

function measure(k: number, m: number, sprd: number, K: number): number {
  const mq = Math.round(m * 512) / 512;
  const key = `${k}|${mq}|${sprd}`;
  if (key === cacheKey) return cacheTotal;

  const pA = CYCLE[k];
  const pB = CYCLE[(k + 1) % K];
  for (let i = 0; i < M; i++) {
    const f = i / M;
    const a = pA(f);
    const b = pB(f);
    ptsX[i] = (a[0] + (b[0] - a[0]) * mq) * sprd;
    ptsY[i] = (a[1] + (b[1] - a[1]) * mq) * sprd;
  }
  let total = 0;
  for (let i = 0; i < M; i++) {
    const j = (i + 1) % M;
    const l = Math.hypot(ptsX[j] - ptsX[i], ptsY[j] - ptsY[i]);
    segLen[i] = l;
    total += l;
  }
  cacheKey = key;
  cacheTotal = total;
  return total;
}

export const buildMorph: ModeBuild = (out, size, t, o) => {
  const K = CYCLE.length;
  const tc = t % (SEG * K);
  const k = Math.floor(tc / SEG);
  const local = tc - k * SEG;
  const m = local > HOLD ? smoothE((local - HOLD) / MORPH) : 0;
  const sprd = o.spread ?? 1;

  const total = measure(k, m, sprd, K);

  // dot radius depends ONLY on rDot (the size knob); the count sets the
  // gaps. Formed shapes breathe a little (uniform pulse).
  const n = morphN(o.iconD ?? 1);
  const re = (o.rDot ?? 0.021) * 1.35 * sprd;
  const pulse = 1 + 0.02 * Math.sin(local * 3.1);

  const c2 = size / 2;
  const r = Math.max(0.35, re * size);
  let seg = 0;
  let acc = 0;
  for (let k2 = 0; k2 < n; k2++) {
    const target = (k2 / n) * total;
    while (acc + segLen[seg] < target && seg < M - 1) {
      acc += segLen[seg];
      seg++;
    }
    const j = (seg + 1) % M;
    const f = segLen[seg] ? Math.min(1, (target - acc) / segLen[seg]) : 0;
    const x = (ptsX[seg] + (ptsX[j] - ptsX[seg]) * f) * pulse;
    const y = (ptsY[seg] + (ptsY[j] - ptsY[seg]) * f) * pulse;
    out.add(c2 + x * size, c2 + y * size, 0, r, 0.1);
  }
};
