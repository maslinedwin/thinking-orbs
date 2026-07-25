// Pins: scattered noise resolves into discrete map pins, which are then chained
// into an ordered route — the "plotting" state.
//
// This is the reel→itinerary shape. `import_places_from_link` watches a video,
// resolves each place it finds to map coordinates, then sequences those places
// into days — so the motion has two beats: DISCOVER N points, then ORDER them.
// Nothing else in the set does that. `connecting` links exactly two known
// points; `reasoning`'s constellation already exists rather than being found.
//
// Laid out on a flat plane rather than a sphere, because the subject is a map.

import { hashD, radiusScale, smoothE } from './core';
import type { ModeBuild } from './types';

const NOISE = 0.22;
const CRYSTAL = 0.62;
const LINK = 0.8;
const HOLD = 1.5;
const CYC = NOISE + CRYSTAL + LINK + HOLD;

export const buildPins: ModeBuild = (out, size, t, o) => {
  const cx = size / 2;
  const cy = size / 2;
  const R = (size / 2) * (o.reach ?? 0.82);
  const rs = radiusScale(size, o.rsPow ?? 0.6);

  const pinN = Math.max(2, Math.round(o.pinN ?? 6));
  const perPin = Math.max(2, Math.round(o.perPin ?? 8));

  const tc = t % CYC;
  let formed = 0;
  let linked = 0;
  if (tc < NOISE) {
    // still noise
  } else if (tc < NOISE + CRYSTAL) {
    formed = smoothE((tc - NOISE) / CRYSTAL);
  } else if (tc < NOISE + CRYSTAL + LINK) {
    formed = 1;
    linked = (tc - NOISE - CRYSTAL) / LINK;
  } else {
    formed = 1;
    linked = 1;
  }

  /** Pin `k`'s position on the plane, spread but deterministic. */
  const pinAt = (k: number): [number, number] => {
    // a jittered ring keeps them clearly separate at 20px, where a purely
    // random scatter can drop two pins on top of each other
    const a = (k / pinN) * Math.PI * 2 + (hashD(k, 3.1) - 0.5) * 0.7;
    const rad = (o.pinRing ?? 0.62) * (0.62 + 0.38 * hashD(k, 6.7));
    return [Math.cos(a) * rad, Math.sin(a) * rad];
  };

  // --- the pins themselves ------------------------------------------
  for (let k = 0; k < pinN; k++) {
    const [tx, ty] = pinAt(k);
    // a pin is resolved once the sequencing has reached it
    const reached = Math.max(0, Math.min(1, linked * pinN - k));

    for (let i = 0; i < perPin; i++) {
      const idx = k * perPin + i;
      // noise position: anywhere on the plane
      const nx = (hashD(idx, 1.9) - 0.5) * 1.7;
      const ny = (hashD(idx, 4.4) - 0.5) * 1.7;
      // formed position: a small ring, so the pin reads as a marker rather
      // than a blob of overlapping dots
      const ca = (i / perPin) * Math.PI * 2;
      const cr = o.clusterR ?? 0.1;
      const fx = tx + Math.cos(ca) * cr;
      const fy = ty + Math.sin(ca) * cr;

      const x = nx + (fx - nx) * formed;
      const y = ny + (fy - ny) * formed;

      out.add(
        cx + x * R,
        cy + y * R,
        reached > 0.5 ? 1 : 0,
        ((o.rDot ?? 0.85) + (o.rPin ?? 0.75) * formed + (o.rReached ?? 0.45) * reached) * rs,
        // noise is dark, a resolved pin is bright — ink carries it, not alpha
        (o.inkNoise ?? 0.7) -
          (o.inkNoise ?? 0.7 - 0.24) * formed -
          (o.inkReached ?? 0.16) * reached,
        o.dotA ?? 0.95
      );
    }
  }

  // --- the route linking them in order ------------------------------
  if (linked > 0) {
    const segDots = Math.max(2, Math.round(o.segDots ?? 6));
    for (let k = 0; k < pinN - 1; k++) {
      const [ax, ay] = pinAt(k);
      const [bx, by] = pinAt(k + 1);
      // how much of this leg is drawn
      const leg = Math.max(0, Math.min(1, linked * pinN - k));
      for (let i = 1; i <= segDots; i++) {
        const f = i / (segDots + 1);
        if (f > leg) continue;
        out.add(
          cx + (ax + (bx - ax) * f) * R,
          cy + (ay + (by - ay) * f) * R,
          0,
          (o.rLink ?? 0.6) * rs,
          o.inkLink ?? 0.42,
          o.linkA ?? 0.9
        );
      }
    }
  }
};
