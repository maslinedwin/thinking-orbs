import { describe, expect, it } from 'vitest';
import { A_LEVELS, getLut, L_LEVELS, PALETTES, styleFor } from '../color';
import { DotBuffer } from '../engine/buffer';
import { MODE_BUILDS } from '../engine/registry';
import { ORB_STATES, resolvePreset } from '../presets';
import { renderCanvas2D } from '../render/canvas2d';
import { recCtx } from './stub';

const rgbAt = (lut: { rgb: Uint8Array }, i: number) =>
  [lut.rgb[i * 3], lut.rgb[i * 3 + 1], lut.rgb[i * 3 + 2]] as const;

describe('ramp endpoints', () => {
  it('hits the authored stop colours exactly at 0 and 1', () => {
    const lut = getLut('green', true);
    expect(rgbAt(lut, 0)).toEqual([0x04, 0x23, 0x1a]);
    expect(rgbAt(lut, L_LEVELS - 1)).toEqual([0x9b, 0xf5, 0xce]);
  });

  it('light ramp runs dark→pale, the reverse polarity of use', () => {
    const lut = getLut('green', false);
    expect(rgbAt(lut, 0)).toEqual([0x00, 0x56, 0x3a]);
    expect(rgbAt(lut, L_LEVELS - 1)).toEqual([0xb8, 0xe8, 0xd2]);
  });

  it('is monotonically increasing in luminance', () => {
    for (const name of ['green', 'mono', 'twoTone'] as const) {
      for (const dark of [true, false]) {
        const lut = getLut(name, dark);
        let prev = -1;
        for (let i = 0; i < L_LEVELS; i++) {
          const [r, g, b] = rgbAt(lut, i);
          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          expect(lum, `${name} ${dark ? 'dark' : 'light'} @${i}`).toBeGreaterThanOrEqual(
            prev - 0.5
          );
          prev = lum;
        }
      }
    }
  });
});

describe('mono reproduces upstream grayscale', () => {
  it('is a straight sRGB byte ramp, within quantisation', () => {
    // upstream computed g = round(ink * 255). OkLab-lerping black→white is
    // perceptually even but lands ~29/255 off that curve at the midpoint, so
    // mono must interpolate in sRGB.
    const lut = getLut('mono', true);
    for (let i = 0; i < L_LEVELS; i++) {
      const expected = Math.round((i / (L_LEVELS - 1)) * 255);
      const [r, g, b] = rgbAt(lut, i);
      expect(r).toBe(g);
      expect(g).toBe(b);
      expect(Math.abs(r - expected)).toBeLessThanOrEqual(1);
    }
  });

  it('declares the sRGB interpolation space', () => {
    expect(PALETTES.mono.space).toBe('srgb');
  });
});

describe('green ramp is actually green', () => {
  it('keeps green the dominant channel across the whole dark ramp', () => {
    const lut = getLut('green', true);
    for (let i = 1; i < L_LEVELS; i++) {
      const [r, g, b] = rgbAt(lut, i);
      expect(g, `@${i}`).toBeGreaterThan(r);
      expect(g, `@${i}`).toBeGreaterThan(b);
    }
  });

  it('passes through the brand green mid-ramp', () => {
    const lut = getLut('green', true);
    // #00A86B sits at at:0.55
    const i = Math.round(0.55 * (L_LEVELS - 1));
    const [r, g, b] = rgbAt(lut, i);
    expect(Math.abs(r - 0x00)).toBeLessThanOrEqual(6);
    expect(Math.abs(g - 0xa8)).toBeLessThanOrEqual(6);
    expect(Math.abs(b - 0x6b)).toBeLessThanOrEqual(6);
  });

  it('never emits a grey dot for a green palette', () => {
    const ctx = recCtx();
    const p = resolvePreset('searching', 64);
    const buf = new DotBuffer();
    MODE_BUILDS[p.mode](buf, 64, 1.0 * p.speed, p.opts);
    renderCanvas2D(ctx as unknown as CanvasRenderingContext2D, buf, getLut('green', true), true, {
      rMin: p.opts.rMin
    });
    expect(ctx.styles.length).toBeGreaterThan(0);
    for (const s of ctx.styles) {
      const [r, g] = s.slice(5, -1).split(',').map(Number);
      expect(g).toBeGreaterThanOrEqual(r);
    }
  });
});

describe('style LUT', () => {
  it('memoises: the same bucket returns the identical string instance', () => {
    const lut = getLut('green', true);
    const a = styleFor(lut, 10, 20);
    const b = styleFor(lut, 10, 20);
    expect(a).toBe(b);
  });

  it('reuses one LUT across calls for a built-in palette', () => {
    expect(getLut('green', true)).toBe(getLut('green', true));
    expect(getLut('green', true)).not.toBe(getLut('green', false));
  });

  it('does not rebuild for a caller passing a fresh array each time', () => {
    // a component re-rendering with an inline ramp literal must not thrash
    const mk = () => [
      { at: 0, hex: '#000000' },
      { at: 1, hex: '#00FF88' }
    ];
    expect(getLut('green', true, mk())).toBe(getLut('green', true, mk()));
  });

  it('bounds the number of distinct strings a frame can build', () => {
    const lut = getLut('green', true);
    expect(lut.styles.length).toBeLessThanOrEqual(L_LEVELS * A_LEVELS);
  });
});

describe('renderer', () => {
  it('writes fewer fillStyles than it draws dots (coalescing works)', () => {
    for (const state of ORB_STATES) {
      const ctx = recCtx();
      const p = resolvePreset(state, 64);
      const buf = new DotBuffer();
      MODE_BUILDS[p.mode](buf, 64, 1.0 * p.speed, p.opts);
      renderCanvas2D(ctx as unknown as CanvasRenderingContext2D, buf, getLut('green', true), true, {
        rMin: p.opts.rMin
      });
      expect(ctx.styleWrites, state).toBeLessThanOrEqual(ctx.arcs);
    }
  });

  it('batchPaths issues far fewer fills for the same dots', () => {
    const p = resolvePreset('working', 64);
    const run = (batchPaths: boolean) => {
      const ctx = recCtx();
      const buf = new DotBuffer();
      MODE_BUILDS[p.mode](buf, 64, 1.0 * p.speed, p.opts);
      renderCanvas2D(ctx as unknown as CanvasRenderingContext2D, buf, getLut('green', true), true, {
        rMin: p.opts.rMin,
        batchPaths
      });
      return ctx;
    };
    const plain = run(false);
    const batched = run(true);
    expect(batched.arcs).toBe(plain.arcs);
    expect(batched.fills).toBeLessThan(plain.fills / 2);
  });

  it('fade=0 draws nothing', () => {
    const ctx = recCtx();
    const p = resolvePreset('working', 64);
    const buf = new DotBuffer();
    MODE_BUILDS[p.mode](buf, 64, 1.0, p.opts);
    renderCanvas2D(ctx as unknown as CanvasRenderingContext2D, buf, getLut('green', true), true, {
      fade: 0
    });
    expect(ctx.arcs).toBe(0);
  });

  it('respects rMin', () => {
    const ctx = recCtx();
    const buf = new DotBuffer();
    buf.add(10, 10, 0, 0.01, 0.5, 1);
    renderCanvas2D(ctx as unknown as CanvasRenderingContext2D, buf, getLut('green', true), true, {
      rMin: 0.75
    });
    expect(ctx.ops[0].split(',')[2]).toBe('0.75');
  });
});

describe('dot buffer', () => {
  it('sorts far to near', () => {
    const buf = new DotBuffer();
    buf.add(0, 0, 5, 1, 0.5);
    buf.add(0, 0, -3, 1, 0.5);
    buf.add(0, 0, 1, 1, 0.5);
    buf.sortByZ();
    const zs = buf.order.slice(0, buf.n).map((i) => buf.dots[i].z);
    expect(zs).toEqual([-3, 1, 5]);
  });

  it('reset hides stale dots without shrinking the pool', () => {
    const buf = new DotBuffer();
    for (let i = 0; i < 10; i++) buf.add(i, i, i, 1, 0.5);
    const pooled = buf.dots.length;
    buf.reset();
    expect(buf.n).toBe(0);
    buf.add(1, 1, 1, 1, 0.5);
    expect(buf.n).toBe(1);
    expect(buf.dots.length).toBe(pooled);
  });
});
