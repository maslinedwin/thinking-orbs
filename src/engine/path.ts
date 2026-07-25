// Arc modes: a bowed route across the frame with something happening along it.
//
// `flightpath` (progressing) reports position on a KNOWN route — distinct from
// `route`/connecting, which discovers and re-picks endpoints every cycle.
// `detour` (diverting) puts two routes in play: the original breaks and is
// abandoned, an alternative forks in from the break.
//
// These are FLAT bowed arcs, not great circles on a sphere. The first cut used
// `slerp` between Fibonacci-lattice points, which put the arc in one small
// region of the frame and let the path and its own ground track collapse into a
// single indistinct swoosh. A flat arc spanning corner to corner is both more
// legible and the canonical route-progress read.

import type { DotBuffer } from './buffer';
import { clamp01, hashD, radiusScale, smoothE } from './core';
import type { ModeOpts } from './profiles';
import type { ModeBuild } from './types';

type P2 = readonly [number, number];

/** Route endpoints in unit coords, y up. Chosen to span the frame. */
const A: P2 = [-0.78, -0.3];
const B: P2 = [0.78, 0.26];
/** The alternative destination — clearly separated from B. */
const C: P2 = [0.66, -0.56];

/** Point on a bowed arc from `a` to `b`; `bow` lifts it perpendicular. */
function bowed(a: P2, b: P2, bow: number, f: number): [number, number] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  // perpendicular, normalised
  const nx = -dy / len;
  const ny = dx / len;
  const lift = bow * Math.sin(f * Math.PI);
  return [a[0] + dx * f + nx * lift, a[1] + dy * f + ny * lift];
}

/**
 * Lay dots along a bowed arc. `lit(f)` gives 0–1 presence; below 0.03 is
 * skipped. Presence drives INK, not alpha — a translucent route reads washed
 * out beside the opaque field modes.
 */
function arc(
  out: DotBuffer,
  o: ModeOpts,
  cx: number,
  cy: number,
  R: number,
  rs: number,
  a: P2,
  b: P2,
  bow: number,
  n: number,
  lit: (f: number) => number,
  rBase: number
): void {
  const inkFar = o.inkFar ?? 0.7;
  const inkNear = o.inkNear ?? 0.08;
  for (let i = 0; i < n; i++) {
    const f = n > 1 ? i / (n - 1) : 0;
    const on = lit(f);
    if (on < 0.03) continue;
    const [x, y] = bowed(a, b, bow, f);
    out.add(
      cx + x * R,
      cy - y * R,
      on > 0.5 ? 1 : 0,
      (rBase + (o.rLit ?? 1.25) * on) * rs,
      inkFar - (inkFar - inkNear) * on,
      o.dotA ?? 0.95
    );
  }
}

/** An endpoint marker: a small ring, so it reads as a place not a blob. */
function marker(
  out: DotBuffer,
  o: ModeOpts,
  cx: number,
  cy: number,
  R: number,
  rs: number,
  p: P2,
  on: number
): void {
  if (on < 0.05) return;
  const n = Math.max(4, Math.round(o.markN ?? 8));
  const rad = (o.markR ?? 0.075) * R;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.add(
      cx + p[0] * R + Math.cos(a) * rad,
      cy - p[1] * R + Math.sin(a) * rad,
      2,
      (o.rEnd ?? 1.15) * rs,
      0.66 - 0.58 * on,
      1
    );
  }
}

// --- flightpath: a marker advances along a known route — progressing ----

export const buildFlightpath: ModeBuild = (out, size, t, o, progress) => {
  const cx = size / 2;
  const cy = size / 2;
  const R = (size / 2) * (o.reach ?? 0.92);
  const rs = radiusScale(size, o.rsPow ?? 0.6);

  let p: number;
  if (progress === undefined) {
    const cyc = (t / (o.period ?? 2.4)) % 1;
    p = smoothE(Math.min(1, cyc / 0.84));
  } else {
    p = clamp01(progress);
  }

  const arcN = Math.max(6, Math.round(o.arcN ?? 62));
  const head = o.headWidth ?? 0.1;
  const bow = o.bow ?? 0.3;

  // the ground track: the straight chord beneath the arc. It reads as altitude
  // and gives the mode body an arc alone can't hold.
  arc(out, o, cx, cy, R, rs, A, B, 0, arcN, () => o.trackOn ?? 0.3, o.rTrack ?? 0.8);

  // the flown route: laid down behind the marker, faint ahead of it
  arc(
    out,
    o,
    cx,
    cy,
    R,
    rs,
    A,
    B,
    bow,
    arcN,
    (f) => {
      const flown = f <= p ? 1 : (o.aheadOn ?? 0.24);
      const d = (f - p) / head;
      return Math.max(flown, Math.exp(-d * d));
    },
    o.rArc ?? 1.25
  );

  marker(out, o, cx, cy, R, rs, A, 1);
  marker(out, o, cx, cy, R, rs, B, p >= 0.995 ? 1 : 0.45);
};

// --- detour: the route breaks and an alternative forks in — diverting ---

const BREAK_AT = 0.52;

export const buildDetour: ModeBuild = (out, size, t, o) => {
  const cx = size / 2;
  const cy = size / 2;
  const R = (size / 2) * (o.reach ?? 0.92);
  const rs = radiusScale(size, o.rsPow ?? 0.6);

  const HOLD = 0.5;
  const BREAK = 0.45;
  const FORK = 0.8;
  const SETTLE = 0.75;
  const CYC = HOLD + BREAK + FORK + SETTLE;
  const tc = t % CYC;

  let broken = 0;
  let forked = 0;
  if (tc < HOLD) {
    // intact
  } else if (tc < HOLD + BREAK) {
    broken = smoothE((tc - HOLD) / BREAK);
  } else if (tc < HOLD + BREAK + FORK) {
    broken = 1;
    forked = smoothE((tc - HOLD - BREAK) / FORK);
  } else {
    broken = 1;
    forked = 1;
  }

  const arcN = Math.max(6, Math.round(o.arcN ?? 58));
  const gap = o.gap ?? 0.13;
  const bow = o.bow ?? 0.3;

  // the original route: a gap opens at the break, everything past it goes out,
  // and the surviving stub recedes as it's abandoned
  arc(
    out,
    o,
    cx,
    cy,
    R,
    rs,
    A,
    B,
    bow,
    arcN,
    (f) => {
      const base = 1 - 0.55 * broken;
      if (f < BREAK_AT - gap) return base;
      if (f > BREAK_AT) return base * (1 - broken);
      const d = Math.abs(f - BREAK_AT) / gap;
      return base * (1 - (d < 1 ? broken : 0));
    },
    o.rArc ?? 1.2
  );

  // the alternative, drawn outward from the break point
  const branch = bowed(A, B, bow, BREAK_AT - gap);
  arc(
    out,
    o,
    cx,
    cy,
    R,
    rs,
    branch as P2,
    C,
    o.bowAlt ?? -0.26,
    arcN,
    (f) => {
      const drawn = f <= forked ? 1 : 0;
      const d = (f - forked) / 0.09;
      return Math.max(drawn, forked > 0 && forked < 1 ? Math.exp(-d * d) : 0);
    },
    o.rArc ?? 1.2
  );

  marker(out, o, cx, cy, R, rs, A, 1);
  marker(out, o, cx, cy, R, rs, B, 1 - 0.85 * broken);
  marker(out, o, cx, cy, R, rs, C, forked);

  // debris at the break, so the failure has a beat rather than just vanishing
  if (broken > 0.05 && forked < 1) {
    const debris = Math.max(0, Math.round(o.debris ?? 10));
    const [bx, by] = bowed(A, B, bow, BREAK_AT);
    for (let i = 0; i < debris; i++) {
      const spread = (o.debrisSpread ?? 0.2) * broken * (0.3 + hashD(i, 2.8));
      const a = hashD(i, 4.1) * Math.PI * 2;
      out.add(
        cx + (bx + Math.cos(a) * spread) * R,
        cy - (by + Math.sin(a) * spread) * R,
        3,
        (o.rDebris ?? 1.0) * rs,
        0.3,
        0.95 * (1 - forked)
      );
    }
  }
};
