// Perf readout.
//
// fps is measured off the real shared rAF driver. Dot counts and fillStyle
// writes are measured by running the same engine call into a recording stub,
// which is exact rather than estimated — and lets the panel show the upstream
// per-dot cost side by side with what the coalescing renderer actually does.

import {
  DotBuffer,
  getLut,
  MODE_BUILDS,
  type OrbState,
  type Palette,
  type PaletteName,
  type Ramp,
  renderCanvas2D,
  resolvePreset,
  subscribeFrames
} from '@nowah/orbs';
import { useEffect, useMemo, useState } from 'react';

function measure(
  state: OrbState,
  size: number,
  dark: boolean,
  palette: PaletteName | Palette,
  ramp: Ramp | undefined,
  batchPaths: boolean
) {
  let arcs = 0;
  let fills = 0;
  let writes = 0;
  const ctx = {
    setTransform() {},
    clearRect() {},
    beginPath() {},
    moveTo() {},
    fill() {
      fills++;
    },
    arc() {
      arcs++;
    },
    _s: '',
    get fillStyle() {
      return this._s;
    },
    set fillStyle(v: string) {
      writes++;
      this._s = v;
    }
  };
  const p = resolvePreset(state, size);
  const buf = new DotBuffer();
  // average over a few phases — dot counts are constant but writes are not
  const N = 12;
  for (let i = 0; i < N; i++) {
    buf.reset();
    MODE_BUILDS[p.mode](buf, size, (1 + i * 0.17) * p.speed, p.opts);
    renderCanvas2D(
      ctx as unknown as CanvasRenderingContext2D,
      buf,
      getLut(palette, dark, ramp),
      dark,
      {
        rMin: p.opts.rMin,
        batchPaths
      }
    );
  }
  return {
    dots: Math.round(arcs / N),
    fills: Math.round(fills / N),
    writes: Math.round(writes / N)
  };
}

function useFps(): number {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    let frames = 0;
    let acc = 0;
    return subscribeFrames((dt) => {
      frames++;
      acc += dt;
      if (acc >= 0.5) {
        setFps(Math.round(frames / acc));
        frames = 0;
        acc = 0;
      }
    });
  }, []);
  return fps;
}

export function PerfHud({
  state,
  size,
  dark,
  palette,
  ramp,
  batchPaths
}: {
  state: OrbState;
  size: number;
  dark: boolean;
  palette: PaletteName | Palette;
  ramp?: Ramp;
  batchPaths: boolean;
}) {
  const fps = useFps();
  const m = useMemo(
    () => measure(state, size, dark, palette, ramp, batchPaths),
    [state, size, dark, palette, ramp, batchPaths]
  );

  return (
    <div className="wb-card">
      <h2>
        Performance — {state} @{size}px
      </h2>
      <div className="wb-stats">
        <div className="wb-stat">
          <span>page fps</span>
          <b>{fps || '—'}</b>
        </div>
        <div className="wb-stat">
          <span>dots / frame</span>
          <b>{m.dots.toLocaleString()}</b>
        </div>
        <div className="wb-stat">
          <span>fillStyle writes</span>
          <b>
            {m.writes}
            <em>was {m.dots}</em>
          </b>
        </div>
        <div className="wb-stat">
          <span>fill() calls</span>
          <b>
            {m.fills}
            <em>was {m.dots}</em>
          </b>
        </div>
        <div className="wb-stat">
          <span>strings built / sec</span>
          <b>
            0<em>was {(m.dots * 60).toLocaleString()}</em>
          </b>
        </div>
      </div>
      <p className="wb-note">
        Upstream built a fresh <code>rgba()</code> template string for every dot on every frame —{' '}
        {(m.dots * 60).toLocaleString()}/sec for this config. Every distinct string is now built
        once and cached in the ramp LUT, so the steady-state allocation rate is zero; the remaining{' '}
        <b>{m.writes}</b> writes are assignments of already-cached strings. Turn on{' '}
        <b>batch paths</b> to also collapse <code>fill()</code> calls.
      </p>
    </div>
  );
}
