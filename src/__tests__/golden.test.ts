// Golden-frame tests: lock the geometry of every state at several sizes and
// times. If a preset tuning or an engine formula shifts, these fail.

import { describe, expect, it } from 'vitest';
import { getLut } from '../color';
import { DotBuffer } from '../engine/buffer';
import { MODE_BUILDS } from '../engine/registry';
import { ORB_STATES, resolvePreset } from '../presets';
import { renderCanvas2D } from '../render/canvas2d';
import type { OrbState } from '../types';
import { digest, recCtx } from './stub';

function frame(state: OrbState, size: number, t: number, dark = true, palette = 'green' as const) {
  const ctx = recCtx();
  const p = resolvePreset(state, size);
  const buf = new DotBuffer();
  MODE_BUILDS[p.mode](buf, size, t * p.speed, p.opts);
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
