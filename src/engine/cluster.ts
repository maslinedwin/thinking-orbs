// Cluster: one field splits into groups, weighs them, then re-merges — the
// "comparing" state. Reads as sorting options into buckets and picking one.
//
// Dots keep their position WITHIN their group across the split, so the motion
// reads as a field partitioning rather than dots teleporting into piles. During
// the hold one group brightens — that's what turns "splitting" into
// "comparing", since a split alone doesn't imply a judgement.

import { fibDir, hashD, makeProj, radiusScale, smoothE } from './core';
import type { ModeBuild } from './types';

// one full cycle: apart, judge, back together, breathe
const SPLIT = 0.7;
const HOLD = 0.85;
const MERGE = 0.7;
const REST = 0.35;
const CYC = SPLIT + HOLD + MERGE + REST;

export const buildCluster: ModeBuild = (out, size, t, o) => {
  const cx = size / 2;
  const cy = size / 2;
  const R = (size / 2) * 0.84;
  const pt = makeProj(t * (o.spin ?? 0.2), 0.34, cx, cy, R);
  const rs = radiusScale(size, o.rsPow ?? 0.6);

  const dotN = Math.max(4, Math.round(o.dotN ?? 150));
  const groups = Math.max(2, Math.round(o.groups ?? 3));
  const spread = o.spread ?? 0.62;

  const tc = t % CYC;
  let apart: number;
  if (tc < SPLIT) apart = smoothE(tc / SPLIT);
  else if (tc < SPLIT + HOLD) apart = 1;
  else if (tc < SPLIT + HOLD + MERGE) apart = 1 - smoothE((tc - SPLIT - HOLD) / MERGE);
  else apart = 0;

  // which group wins this round — deterministic per cycle, no stored state
  const cycle = Math.floor(t / CYC);
  const winner = Math.floor(hashD(cycle, 6.1) * groups) % groups;
  // the verdict only lands once the groups are actually apart
  const verdict = apart > 0.85 ? (apart - 0.85) / 0.15 : 0;

  for (let i = 0; i < dotN; i++) {
    const home = fibDir(i, dotN);
    const g = i % groups;

    // group centres ride a ring in the xz plane, tilted a little in y
    const ga = (g / groups) * Math.PI * 2;
    const gx = Math.cos(ga) * spread;
    const gz = Math.sin(ga) * spread;
    const gy = (hashD(g, 2.2) - 0.5) * 0.3 * spread;

    // shrink toward the group centre as we pull apart, so each group reads as
    // its own small sphere rather than a smeared cloud
    const shrink = 1 - 0.52 * apart;
    const x = home[0] * shrink + gx * apart;
    const y = home[1] * shrink + gy * apart;
    const z0 = home[2] * shrink + gz * apart;

    const [px, py, z] = pt(x, y, z0);
    const depth = (z + 1) / 2;
    const won = g === winner ? verdict : 0;

    out.add(
      px,
      py,
      z,
      ((o.rBase ?? 0.7) + (o.rDepth ?? 1.7) * depth + (o.rWinner ?? 0.8) * won) * rs,
      (o.inkFar ?? 0.66) - (o.inkSpan ?? 0.54) * depth - (o.inkWinner ?? 0.22) * won,
      o.dotA ?? 0.95
    );
  }
};
