// Shatter: a sphere bursts outward, hangs scattered, then snaps back — the
// "retrying" state, and with `settle: 0` the "error" state too.
//
// `settle` is what makes one painter serve both:
//   settle 1 — the field reassembles, so it loops as "trying again"
//   settle 0 — it never comes back; pair with `once` and it bursts and holds,
//              which is the terminal error read
// That's why `error` needed a painter rather than a re-tuning: no amount of
// preset twiddling on an existing mode expresses "and then it stays broken".
//
// Dots sit on a Fibonacci lattice rather than the lat/long field the sphere
// modes use — evenly spread reads better once scattered, and it keeps the calm
// phase visually distinct from `searching` and friends.

import { fibDir, hashD, makeProj, radiusScale, smoothE } from './core';
import type { ModeBuild } from './types';

const CALM = 0.3;
const BLOW = 0.5;
const HANG = 0.55;
const BACK = 0.65;

/** Cycle length in mode-time. Shorter when the field never reassembles. */
export function shatterCycle(settle: number): number {
  return settle > 0 ? CALM + BLOW + HANG + BACK : CALM + BLOW + HANG;
}

export const buildShatter: ModeBuild = (out, size, t, o) => {
  const cx = size / 2;
  const cy = size / 2;
  // Deliberately small: the burst has to expand INSIDE the frame. At 0.78 the
  // outermost dots reached 2.1x the half-size, so most of the field was clipped
  // off-canvas during the scattered phase — the mode computed ~190 dots and
  // threw most of them away, which is why it read as a few sparse specks.
  const R = (size / 2) * (o.reach ?? 0.44);
  const rs = radiusScale(size, o.rsPow ?? 0.6);

  const settle = o.settle ?? 1;
  const cyc = shatterCycle(settle);
  const tc = t % cyc;

  // how far out the field has flown, 0 = intact, 1 = fully scattered
  let out01: number;
  let flash = 0;
  if (tc < CALM) {
    out01 = 0;
  } else if (tc < CALM + BLOW) {
    const x = (tc - CALM) / BLOW;
    // ease-OUT: the burst is violent at the start and coasts
    out01 = 1 - (1 - x) ** 3;
    flash = 1 - x;
  } else if (tc < CALM + BLOW + HANG || settle <= 0) {
    out01 = 1;
  } else {
    out01 = 1 - smoothE((tc - CALM - BLOW - HANG) / BACK);
  }

  // the whole field tumbles a little more the further out it is
  const pt = makeProj(t * (o.spin ?? 0.18) + out01 * 0.6, 0.32 + out01 * 0.1, cx, cy, R);

  const dotN = Math.max(4, Math.round(o.dotN ?? 150));
  const blast = o.blast ?? 0.95;
  const rDepth = o.rDepth ?? 1.7;

  // `fall` is what separates error from retrying. Without it the two are the
  // same painter differing only in TIMING, so mid-burst they're indistinguishable
  // — and a terminal failure should differ in kind, not merely in duration.
  // With fall > 0 the field sags downward under gravity and dies out instead of
  // radiating symmetrically: collapse rather than energy.
  const fall = o.fall ?? 0;
  const sag = fall * out01 * out01;

  // settle 0 loops back to intact, which is a hard cut. Fading the tail of the
  // cycle turns that into a deliberate beat rather than a glitch.
  let tail = 1;
  if (settle <= 0) {
    const fadeFrom = CALM + BLOW + HANG * 0.45;
    if (tc > fadeFrom) tail = Math.max(0, 1 - (tc - fadeFrom) / (HANG * 0.55));
  }

  for (let i = 0; i < dotN; i++) {
    const d = fibDir(i, dotN);
    // per-dot speed spread, so the shell doesn't expand as one rigid bubble
    // tighter spread than before so the maximum excursion is predictable and
    // can be kept just inside the frame
    const speed = 0.55 + 0.6 * hashD(i, 9.4);
    const scale = 1 + blast * out01 * speed;

    const [px, py, z] = pt(d[0] * scale, d[1] * scale - sag * speed, d[2] * scale);
    const depth = (z + 1) / 2;

    // flung dots shrink and darken with distance — they read as receding, and
    // it keeps the scattered state from looking like confetti
    const far = 1 / (1 + (o.farK ?? 0.45) * blast * out01 * speed);

    out.add(
      px,
      py,
      z,
      ((o.rBase ?? 1.0) + rDepth * depth) * far * (1 + (o.rFlash ?? 0.7) * flash) * rs,
      (o.inkFar ?? 0.66) - (o.inkSpan ?? 0.54) * depth + (o.inkOut ?? 0.2) * out01 - 0.16 * flash,
      (o.dotA ?? 1) * tail
    );
  }
};
