// Seal: a loose field converges into a precise ring, snaps tight, and holds —
// the "committing" state.
//
// This is the irreversible beat, not the deliberating one. `booking` (rubik)
// turns bands until something clicks into place; a reservation is not a ticket,
// and issuing one is a commit that can't be walked back. So the motion is
// convergence to an exact form followed by stillness: an overshoot, a snap, and
// then nothing moves at all. Stillness is the point.
//
// Flat (z ≈ 0) so it reads as a stamp rather than another sphere.

import { hashD, radiusScale, smoothE } from './core';
import type { ModeBuild } from './types';

const GATHER = 0.75;
const SNAP = 0.18;
const HOLD = 1.05;
const CYC = GATHER + SNAP + HOLD;

export const buildSeal: ModeBuild = (out, size, t, o) => {
  const cx = size / 2;
  const cy = size / 2;
  const R = (size / 2) * (o.reach ?? 0.9);
  const rs = radiusScale(size, o.rsPow ?? 0.6);

  const tc = t % CYC;
  // `close` 0 = scattered wide, 1 = locked on the ring
  let close: number;
  let lock = 0;
  if (tc < GATHER) {
    close = smoothE(tc / GATHER);
  } else if (tc < GATHER + SNAP) {
    // a small overshoot inward, then settle — this is the snap
    const x = (tc - GATHER) / SNAP;
    close = 1 + (o.overshoot ?? 0.055) * Math.sin(x * Math.PI);
    lock = x;
  } else {
    close = 1;
    lock = 1;
  }

  const dotN = Math.max(8, Math.round(o.dotN ?? 104));
  const ringR = o.ringR ?? 0.72;
  const scatter = o.scatter ?? 0.42;
  const rBase = o.rBase ?? 1.15;

  for (let i = 0; i < dotN; i++) {
    const a = (i / dotN) * Math.PI * 2;
    // each dot drifts in from its own offset, so the gather isn't a rigid
    // contraction of a perfect circle
    const rOff = (hashD(i, 1.7) - 0.5) * 2 * scatter;
    const aOff = (hashD(i, 5.3) - 0.5) * (o.spreadA ?? 0.5);
    const rad = ringR * close + rOff * (1 - close);
    const ang = a + aOff * (1 - close);

    out.add(
      cx + Math.cos(ang) * rad * R,
      cy + Math.sin(ang) * rad * R,
      0,
      (rBase + (o.rLock ?? 0.55) * lock) * rs,
      // dark and loose while gathering, bright and exact once locked
      (o.inkLoose ?? 0.66) - (o.inkLoose ?? 0.66 - 0.1) * close,
      o.dotA ?? 0.95
    );
  }

  // the impression at the centre, which only exists once the seal has landed
  if (lock > 0.02) {
    const coreN = Math.max(1, Math.round(o.coreN ?? 16));
    for (let i = 0; i < coreN; i++) {
      // a small tight spiral so the core reads as a mark, not a blob
      const f = coreN > 1 ? i / (coreN - 1) : 0;
      const a = f * Math.PI * 3.2;
      const rad = (o.coreR ?? 0.26) * f * R;
      out.add(
        cx + Math.cos(a) * rad,
        cy + Math.sin(a) * rad,
        1,
        (o.rCore ?? 1.2) * rs * lock,
        0.1,
        lock
      );
    }
  }
};
