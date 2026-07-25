// An orb driven directly through the exported power-user surface —
// MODE_BUILDS + DotBuffer + renderCanvas2D + subscribeFrames — instead of via
// <ThinkingOrb>. The tuning panel needs to override raw engine opts, which the
// component intentionally doesn't expose; doing it this way also proves the
// power-user surface is actually usable outside React's component.

import {
  DotBuffer,
  getLut,
  MODE_BUILDS,
  type ModeKey,
  type Palette,
  type PaletteName,
  type Ramp,
  renderCanvas2D,
  subscribeFrames
} from '@nowah/orbs';
import { useEffect, useRef } from 'react';

export function RawOrb({
  mode,
  opts,
  speed,
  size,
  dark,
  palette,
  ramp,
  paused = false
}: {
  mode: ModeKey;
  opts: Record<string, number | undefined>;
  speed: number;
  size: number;
  dark: boolean;
  palette: PaletteName | Palette;
  ramp?: Ramp;
  paused?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const live = useRef({ mode, opts, speed, dark, palette, ramp, paused });
  live.current = { mode, opts, speed, dark, palette, ramp, paused };
  const t = useRef(0);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const buf = new DotBuffer();

    const paint = () => {
      const l = live.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      buf.reset();
      MODE_BUILDS[l.mode](buf, size, t.current * l.speed, l.opts);
      renderCanvas2D(ctx, buf, getLut(l.palette, l.dark, l.ramp), l.dark, { rMin: l.opts.rMin });
    };

    paint();
    return subscribeFrames((dt) => {
      if (!live.current.paused) t.current += dt;
      paint();
    });
  }, [size]);

  return <canvas ref={ref} style={{ width: size, height: size, display: 'block' }} />;
}
