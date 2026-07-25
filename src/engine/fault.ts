// Fault: the field breaks apart and reassembles into a dotted X, then holds —
// the "error" state.
//
// Why a distinct mode rather than a variant of `shatter`: sharing shatter's
// painter made error differ from retrying only in TIMING, so mid-burst they
// were indistinguishable. Tinting it red would have fixed that instantly, but
// this library is deliberately single-hue — the whole depth language is one
// ramp — so the difference has to be structural instead. An X is unambiguous
// without colour and still legible at 20px, and it's in keeping with `morph`
// already trading in literal primitives (circle, triangle, square).
//
// The projection deliberately has NO tilt and its yaw dies out as the X forms:
// a tilted X skews into a lopsided cross, and motion stopping is itself part of
// the error read.

import { fibDir, hashD, makeProj, radiusScale, smoothE } from './core';
import type { ModeBuild } from './types';

const CALM = 0.25;
const BREAK = 0.35;
const FORM = 0.6;
const HOLD = 0.85;

/**
 * Cycle length. `once` clamps here, which lands exactly as the X finishes
 * forming so the final held frame is the X rather than the reset sphere.
 */
export const faultCycle = (): number => CALM + BREAK + FORM;

/** Full loop, including the hold before it resets. */
const LOOP = CALM + BREAK + FORM + HOLD;

export const buildFault: ModeBuild = (out, size, t, o) => {
  const cx = size / 2;
  const cy = size / 2;
  const R = (size / 2) * (o.reach ?? 0.6);
  const rs = radiusScale(size, o.rsPow ?? 0.6);

  const tc = t % LOOP;

  // `broken` = how far flung; `formed` = how far onto the X
  let broken = 0;
  let formed = 0;
  if (tc < CALM) {
    broken = 0;
  } else if (tc < CALM + BREAK) {
    const x = (tc - CALM) / BREAK;
    broken = 1 - (1 - x) ** 3; // violent, then coasting
  } else if (tc < CALM + BREAK + FORM) {
    broken = 1;
    formed = smoothE((tc - CALM - BREAK) / FORM);
  } else {
    broken = 1;
    formed = 1;
  }

  // rotation dies as the X resolves — stillness is part of the read
  const pt = makeProj(t * (o.spin ?? 0.35) * (1 - formed), 0, cx, cy, R);

  const dotN = Math.max(6, Math.round(o.dotN ?? 34));
  const blast = o.blast ?? 1.5;
  const arm = o.arm ?? 0.82;
  const perStroke = Math.ceil(dotN / 2);

  for (let i = 0; i < dotN; i++) {
    const home = fibDir(i, dotN);
    const speed = 0.6 + 0.8 * hashD(i, 9.4);

    // flung outward along its own direction
    const bs = 1 + blast * broken * speed;
    const sx = home[0] * bs;
    const sy = home[1] * bs;
    const sz = home[2] * bs;

    // its slot on one of the two strokes, flat in the xy plane so the X reads
    // square-on rather than as a skewed cross.
    //
    // `arm` is in FRAME half-size units and divided back out by `reach`, so the
    // X's size is independent of the sphere's. Coupled, they fought each other:
    // `reach` has to stay small to keep the burst inside the canvas, which was
    // also shrinking the X to about half the frame.
    const stroke = i % 2;
    const idx = (i - stroke) / 2;
    const f = perStroke > 1 ? idx / (perStroke - 1) : 0.5;
    const span = arm / (o.reach ?? 0.6);
    const along = -span + 2 * span * f;
    const tx = along;
    const ty = stroke === 0 ? along : -along;

    const x = sx + (tx - sx) * formed;
    const y = sy + (ty - sy) * formed;
    const z = sz + (0 - sz) * formed;

    const [px, py, pz] = pt(x, y, z);
    const depth = (pz + 1) / 2;

    // the X is flat, so once formed there's no depth left to shade — ink
    // crossfades to a single flat value instead of a depth ramp
    const depthInk = (o.inkFar ?? 0.66) - (o.inkSpan ?? 0.54) * depth;
    const flatInk = o.inkX ?? 0.1;

    out.add(
      px,
      py,
      pz,
      ((o.rBase ?? 0.9) + (o.rDepth ?? 1.6) * depth * (1 - formed) + (o.rX ?? 1.5) * formed) * rs,
      depthInk + (flatInk - depthInk) * formed,
      o.dotA ?? 1
    );
  }
};
