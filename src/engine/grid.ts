// Grid modes: flat row-major lattices with a progressive reveal.
//
// `raster` (reading) is here; `cascade` (drafting) joins it in batch 2.
//
// A square silhouette rather than a sphere, which is most of why it reads as a
// different thing at a glance — every other mode so far is round. Flat, so
// z carries nothing and ink does all the work: dots ahead of the sweep are
// faint, dots behind are mid ("already read"), dots in the sweep band are hot.
// That three-tier ink split is what makes progress legible without motion.

import { clamp01, hashD, radiusScale } from './core';
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

// --- Cascade: dots fill in line by line, wrapping — drafting ------------
//
// Distinct from `raster` in the way that matters: raster sweeps a band over a
// grid that is always fully present, whereas cascade REVEALS — cells ahead of
// the write head aren't drawn at all. Rows also get ragged right edges from a
// per-row hash, so it reads as prose being written rather than a block filling.

export const buildCascade: ModeBuild = (out, size, t, o, progress) => {
  const cols = Math.max(2, Math.round(o.cols ?? 14));
  const rows = Math.max(2, Math.round(o.rows ?? 9));
  const rs = radiusScale(size, o.rsPow ?? 0.6);

  const inset = (o.inset ?? 0.12) * size;
  const w = size - inset * 2;
  const h = size - inset * 2;
  const stepX = cols > 1 ? w / (cols - 1) : 0;
  const stepY = rows > 1 ? h / (rows - 1) : 0;

  // ragged line lengths — a full rectangle reads as a grid, not as text
  const ragged = o.ragged ?? 0.42;
  const lineLen = (r: number) => Math.max(2, Math.round(cols * (1 - ragged * hashD(r, 4.4))));

  let total = 0;
  for (let r = 0; r < rows; r++) total += lineLen(r);

  // How much of the page is written, 0-1.
  //
  // This mode draws NOTHING ahead of the head, so a fraction of zero renders a
  // completely empty orb. Two guards, because a loading indicator must never
  // look blank or blink:
  //   - the indeterminate cycle starts at `floorFrac` rather than 0, so it
  //     reads as continuing to write rather than popping from an empty page
  //   - the cell count is floored outright, which also covers `progress={0}`
  let frac: number;
  if (progress === undefined) {
    const cyc = (t / (o.period ?? 2.6)) % 1;
    const hold = o.holdFrac ?? 0.22;
    const floorFrac = o.floorFrac ?? 0.14;
    frac = floorFrac + (1 - floorFrac) * Math.min(1, cyc / (1 - hold));
  } else {
    frac = clamp01(progress);
  }
  const written = Math.max(o.minCells ?? 7, frac * total);

  const rBase = o.rBase ?? 1.55;
  const rHead = o.rHead ?? 1.5;
  const inkWritten = o.inkWritten ?? 0.5;
  const inkHead = o.inkHead ?? 0.06;

  let idx = 0;
  for (let r = 0; r < rows; r++) {
    const len = lineLen(r);
    for (let c = 0; c < len; c++, idx++) {
      const behind = written - idx;
      // nothing ahead of the head is drawn — that's the reveal
      if (behind <= 0) continue;
      // the newest few cells are hot, fading back to written ink
      const hot = behind < 2.5 ? 1 - behind / 2.5 : 0;
      out.add(
        inset + c * stepX,
        inset + r * stepY,
        hot > 0.4 ? 1 : 0,
        (rBase + rHead * hot) * rs,
        inkWritten - (inkWritten - inkHead) * hot,
        o.dotA ?? 0.95
      );
    }
  }
};
