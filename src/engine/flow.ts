// Flow modes: particles moving through a shaped volume toward a sink.
//
// `funnel` (queuing) is here; `vortex` (gathering) joins it in batch 2 — both
// are "particles converging on a sink", so they share the silhouette-shell
// helper and the same progress semantics.
//
// This is the first mode to read `progress`. Two distinct behaviours:
//   indeterminate — particles recycle top→bottom forever, reads as "still going"
//   determinate   — `progress` is the fraction that has LANDED, so the pile
//                   height is a real percentage
// The determinate branch is strictly monotonic in `progress`, which matters:
// a payment/ticketing UI that jumps backwards reads as a bug.

import type { DotBuffer } from './buffer';
import { clamp01, hashD, makeProj, radiusScale } from './core';
import type { ModeOpts } from './profiles';
import type { ModeBuild } from './types';

type Proj = (x: number, y: number, z: number) => [number, number, number];

/** Hourglass radius at height y ∈ [-1, 1]; `waist` is the pinch at y = 0. */
function hourglassR(y: number, waist: number): number {
  return waist + (1 - waist) * Math.abs(y);
}

/** The dotted silhouette, so the shape reads even when few particles are in it. */
function shell(out: DotBuffer, o: ModeOpts, pt: Proj, rs: number, waist: number): void {
  const shellN = Math.max(4, Math.round(o.shellN ?? 22));
  const rings = Math.max(2, Math.round(o.shellRings ?? 7));
  for (let ri = 0; ri < rings; ri++) {
    const y = -1 + (2 * ri) / (rings - 1);
    const rr = hourglassR(y, waist);
    // fewer dots where the shape is narrow, so spacing stays even
    const n = Math.max(3, Math.round(shellN * rr));
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2;
      const [px, py, z] = pt(Math.cos(ang) * rr, y, Math.sin(ang) * rr);
      const depth = (z + 1) / 2;
      out.add(
        px,
        py,
        z,
        // the shell recedes by ink, not by being translucent
        ((o.rShell ?? 0.85) + (o.rDepth ?? 1.5) * depth) * rs,
        (o.inkShell ?? 0.66) - 0.34 * depth,
        o.shellA ?? 0.88
      );
    }
  }
}

export const buildFunnel: ModeBuild = (out, size, t, o, progress) => {
  const cx = size / 2;
  const cy = size / 2;
  const R = (size / 2) * 0.8;
  const pt = makeProj(t * (o.spin ?? 0.2), 0.3, cx, cy, R);
  const rs = radiusScale(size, o.rsPow ?? 0.6);
  const waist = o.waist ?? 0.16;

  shell(out, o, pt, rs, waist);

  const partN = Math.max(2, Math.round(o.partN ?? 60));
  const rPart = o.rPart ?? 1.45;
  const rDepth = o.rDepth ?? 1.5;

  const addPart = (x: number, y: number, zz: number, hot: number) => {
    const [px, py, z] = pt(x, y, zz);
    const depth = (z + 1) / 2;
    out.add(
      px,
      py,
      z + 0.02,
      (rPart + rDepth * depth + (o.rHot ?? 0.5) * hot) * rs,
      (o.inkPart ?? 0.26) - 0.2 * depth - 0.12 * hot,
      1
    );
  };

  if (progress === undefined) {
    // --- indeterminate: an endless fall -----------------------------
    for (let i = 0; i < partN; i++) {
      const phase = hashD(i, 1.9);
      const p = (t * (o.flowRate ?? 0.5) + phase) % 1;
      // accelerate into the waist, decelerate out of it — an hourglass
      // doesn't drain linearly
      const y = 1 - 2 * p;
      const squeeze = 1 - Math.exp(-((y * y) / 0.08));
      const rr = hourglassR(y, waist) * (0.25 + 0.7 * hashD(i, 5.1)) * squeeze;
      const ang = hashD(i, 8.3) * Math.PI * 2 + t * 0.8;
      // hottest as it threads the waist
      addPart(Math.cos(ang) * rr, y, Math.sin(ang) * rr, 1 - Math.min(1, Math.abs(y) / 0.3));
    }
    return;
  }

  // --- determinate: `progress` of them have landed -------------------
  const p = clamp01(progress);
  const landed = Math.round(p * partN);

  for (let i = 0; i < partN; i++) {
    const ang = hashD(i, 8.3) * Math.PI * 2;
    const jitter = 0.3 + 0.65 * hashD(i, 5.1);

    if (i < landed) {
      // piled in the lower cone, filling from the bottom up
      const fill = landed > 1 ? i / landed : 0;
      const y = -1 + fill * 0.85;
      const rr = hourglassR(y, waist) * jitter;
      addPart(Math.cos(ang) * rr, y, Math.sin(ang) * rr, 0);
    } else {
      // still queued in the upper chamber, drifting slowly
      const remain = partN - landed;
      const fill = remain > 1 ? (i - landed) / remain : 0;
      const y = 1 - fill * 0.8;
      const rr = hourglassR(y, waist) * jitter;
      const a = ang + t * 0.35;
      addPart(Math.cos(a) * rr, y, Math.sin(a) * rr, 0);
    }
  }

  // one particle actively threading the waist while there's work left
  if (p < 1) {
    const y = 0.32 * Math.cos(t * 3.4);
    const rr = hourglassR(y, waist) * 0.3;
    addPart(rr, y, 0, 1);
  }
};
