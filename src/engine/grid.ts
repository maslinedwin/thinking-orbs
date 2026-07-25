// Grid modes: flat row-major lattices with a progressive reveal.
//
// `raster` (reading) is here; `cascade` (drafting) joins it in batch 2.
//
// A square silhouette rather than a sphere, which is most of why it reads as a
// different thing at a glance — every other mode so far is round. Flat, so
// z carries nothing and ink does all the work: dots ahead of the sweep are
// faint, dots behind are mid ("already read"), dots in the sweep band are hot.
// That three-tier ink split is what makes progress legible without motion.

import { clamp01, radiusScale } from './core';
import type { ModeBuild } from './types';

export const buildRaster: ModeBuild = (out, size, t, o, progress) => {
  const cols = Math.max(2, Math.round(o.cols ?? 12));
  const rows = Math.max(2, Math.round(o.rows ?? 12));
  const rs = radiusScale(size, o.rsPow ?? 0.6);

  const inset = (o.inset ?? 0.13) * size;
  const w = size - inset * 2;
  const h = size - inset * 2;
  const stepX = cols > 1 ? w / (cols - 1) : 0;
  const stepY = rows > 1 ? h / (rows - 1) : 0;

  // Sweep position in rows. Determinate: straight from `progress`.
  // Indeterminate: loops, with a pause at the end so the reset reads as
  // "starting the next page" rather than a glitch.
  let sweep: number;
  if (progress === undefined) {
    const period = o.period ?? 1.35;
    const cyc = (t / period) % 1;
    sweep = Math.min(1, cyc / 0.86) * rows;
  } else {
    sweep = clamp01(progress) * rows;
  }

  const band = o.band ?? 1.4;
  // the in-row cursor only runs when the sweep is clock-driven
  const cursor = progress === undefined ? ((t * (o.cursorRate ?? 4.2)) % 1) * cols : cols;

  // Unread rows recede via INK, not alpha — a translucent grid reads as a faint
  // texture rather than a solid mark. inkAhead matches the sphere modes' far-dot
  // value (0.62-ish) so the dimmest dots here are as substantial as theirs.
  const rBase = o.rBase ?? 1.6;
  const rActive = o.rActive ?? 1.7;
  const inkAhead = o.inkAhead ?? 0.62;
  const inkRead = o.inkRead ?? 0.36;
  const inkActive = o.inkActive ?? 0.06;

  for (let ry = 0; ry < rows; ry++) {
    const dist = ry - sweep;
    // how strongly this row is in the sweep band
    const inBand = Math.exp(-((dist / band) * (dist / band)));
    const read = dist < 0;

    for (let cxi = 0; cxi < cols; cxi++) {
      // within the active row, the cursor leads left→right
      const atCursor = inBand > 0.35 && Math.abs(cxi - cursor) < 1.2 ? 1 : 0;
      const hot = Math.max(inBand * (cxi <= cursor ? 1 : 0.35), atCursor);

      const ink = read ? inkRead : inkAhead;
      out.add(
        inset + cxi * stepX,
        inset + ry * stepY,
        // tiny z bias so the painter's fillStyle runs stay long
        hot > 0.4 ? 1 : 0,
        (rBase + rActive * hot) * rs,
        ink - (ink - inkActive) * hot,
        (o.baseA ?? 0.9) + (1 - (o.baseA ?? 0.9)) * Math.max(read ? 0.5 : 0, hot)
      );
    }
  }
};
