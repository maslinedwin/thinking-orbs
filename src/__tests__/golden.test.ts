// Golden-frame tests: lock the geometry of every state at several sizes and
// times. If a preset tuning or an engine formula shifts, these fail.

import { describe, expect, it } from 'vitest';
import { getLut } from '../color';
import { DotBuffer } from '../engine/buffer';
import { shatterCycle } from '../engine/burst';
import { faultCycle } from '../engine/fault';
import { MODE_BUILDS } from '../engine/registry';
import { ORB_STATES, resolvePreset } from '../presets';
import { renderCanvas2D } from '../render/canvas2d';
import type { OrbState } from '../types';
import { digest, recCtx } from './stub';

function frame(
  state: OrbState,
  size: number,
  t: number,
  dark = true,
  palette = 'green' as const,
  progress?: number
) {
  const ctx = recCtx();
  const p = resolvePreset(state, size);
  const buf = new DotBuffer();
  MODE_BUILDS[p.mode](buf, size, t * p.speed, p.opts, progress);
  renderCanvas2D(ctx as unknown as CanvasRenderingContext2D, buf, getLut(palette, dark), dark, {
    rMin: p.opts.rMin
  });
  return ctx;
}

const TIMES = [0.0, 0.6, 1.234, 3.7];

describe('golden frames', () => {
  for (const state of ORB_STATES) {
    for (const size of [20, 32, 64]) {
      it(`${state} @${size}`, () => {
        const sig = TIMES.map((t) => {
          const c = frame(state, size, t);
          return `${c.arcs}:${digest(c.ops)}`;
        });
        expect(sig).toMatchSnapshot();
      });
    }
  }
});

describe('no state renders a degenerate frame', () => {
  // 20px is the pass/fail bar for legibility — a mode that collapses to a
  // handful of dots there reads as dirt, not an indicator
  it.each(ORB_STATES)('%s has enough dots at every size', (state) => {
    for (const size of [20, 32, 64]) {
      for (const t of TIMES) {
        expect(frame(state, size, t).arcs, `${state}@${size} t=${t}`).toBeGreaterThanOrEqual(6);
      }
    }
  });

  it.each(ORB_STATES)('%s emits only finite coordinates', (state) => {
    for (const size of [20, 64]) {
      for (const op of frame(state, size, 1.4).ops) {
        const [x, y, r] = op.split(',');
        for (const v of [x, y, r]) {
          expect(Number.isFinite(Number(v)), `${state}: ${op}`).toBe(true);
        }
      }
    }
  });
});

describe('error resolves into an X', () => {
  /** Dot positions at a given point in error's cycle, in unit canvas coords. */
  const dotsAt = (frac: number) => {
    const p = resolvePreset('error', 64);
    const buf = new DotBuffer();
    MODE_BUILDS[p.mode](buf, 64, frac * faultCycle(), p.opts);
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < buf.n; i++) pts.push([buf.dots[i].x / 64, buf.dots[i].y / 64]);
    return pts;
  };

  it('lands its dots on the two diagonals once formed', () => {
    // On a centred X every dot satisfies |dx| ≈ |dy|. That's a strong, cheap
    // assertion that the shape genuinely formed rather than merely settling.
    const pts = dotsAt(1);
    expect(pts.length).toBeGreaterThan(6);
    let onDiagonal = 0;
    for (const [x, y] of pts) {
      const dx = Math.abs(x - 0.5);
      const dy = Math.abs(y - 0.5);
      if (Math.abs(dx - dy) < 0.03) onDiagonal++;
    }
    expect(onDiagonal / pts.length).toBeGreaterThan(0.9);
  });

  it('is NOT an X while still intact or mid-break', () => {
    for (const frac of [0.05, 0.45]) {
      const pts = dotsAt(frac);
      let onDiagonal = 0;
      for (const [x, y] of pts) {
        if (Math.abs(Math.abs(x - 0.5) - Math.abs(y - 0.5)) < 0.03) onDiagonal++;
      }
      expect(onDiagonal / pts.length, `frac ${frac}`).toBeLessThan(0.6);
    }
  });

  it('reads differently from retrying at every point in the cycle', () => {
    // the failure this replaces: as a shatter variant the two were
    // indistinguishable mid-burst
    for (const frac of [0.1, 0.4, 0.7, 1]) {
      const e = digest(frame('error', 64, frac * faultCycle()).ops);
      const r = digest(frame('retrying', 64, frac * shatterCycle(1)).ops);
      expect(e, `frac ${frac}`).not.toBe(r);
    }
  });

  it('holds its final frame once clamped by `once`', () => {
    const p = resolvePreset('error', 64);
    const clamped = (p.cycle as number) / p.speed;
    expect(digest(frame('error', 64, clamped).ops)).toBe(digest(frame('error', 64, clamped).ops));
  });
});

describe('progress', () => {
  const PROGRESS_STATES: OrbState[] = ['queuing', 'reading', 'gathering', 'drafting'];

  it.each(PROGRESS_STATES)('%s renders a distinct frame at each step', (state) => {
    const digs = [0, 0.25, 0.5, 0.75, 1].map((p) =>
      digest(frame(state, 64, 1, true, 'green', p).ops)
    );
    expect(new Set(digs).size).toBe(digs.length);
  });

  it.each(PROGRESS_STATES)('%s clamps out-of-range progress instead of throwing', (state) => {
    const at0 = digest(frame(state, 64, 1, true, 'green', 0).ops);
    const at1 = digest(frame(state, 64, 1, true, 'green', 1).ops);
    expect(digest(frame(state, 64, 1, true, 'green', -5).ops)).toBe(at0);
    expect(digest(frame(state, 64, 1, true, 'green', 1.7).ops)).toBe(at1);
    // NaN must clamp to 0, not propagate into every coordinate — a naive
    // `v < 0 ? 0 : v > 1 ? 1 : v` passes NaN straight through
    expect(digest(frame(state, 64, 1, true, 'green', Number.NaN).ops)).toBe(at0);
  });

  it('states whose mode ignores progress are unaffected by it', () => {
    for (const state of ORB_STATES) {
      if (PROGRESS_STATES.includes(state)) continue;
      const without = digest(frame(state, 64, 1).ops);
      const with50 = digest(frame(state, 64, 1, true, 'green', 0.5).ops);
      expect(with50, `${state} leaked progress`).toBe(without);
    }
  });
});

describe('determinism', () => {
  it('same inputs produce byte-identical frames', () => {
    for (const state of ORB_STATES) {
      const a = frame(state, 64, 1.5);
      const b = frame(state, 64, 1.5);
      expect(digest(a.ops)).toBe(digest(b.ops));
    }
  });

  it('a fresh buffer and a reused buffer agree', () => {
    // the pooled buffer keeps stale entries past `n`; reset() must hide them
    const p = resolvePreset('composing', 64);
    const shared = new DotBuffer();

    const run = (buf: DotBuffer, t: number) => {
      const ctx = recCtx();
      buf.reset();
      MODE_BUILDS[p.mode](buf, 64, t * p.speed, p.opts);
      renderCanvas2D(ctx as unknown as CanvasRenderingContext2D, buf, getLut('green', true), true, {
        rMin: p.opts.rMin
      });
      return digest(ctx.ops);
    };

    // prime the pool with a big frame, then a small one, then compare the
    // small one against a virgin buffer
    run(shared, 1.0);
    const reused = run(shared, 2.0);
    const fresh = run(new DotBuffer(), 2.0);
    expect(reused).toBe(fresh);
  });
});
