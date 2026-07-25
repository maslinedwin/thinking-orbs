// React Native entry point: `import { ThinkingOrb } from '@nowah/orbs/native'`
//
// Everything except the renderer and the component shell is shared with the web
// build — same engine, same 29 presets, same size interpolation, same ramps.

export { A_LEVELS, getLut, L_LEVELS, PALETTES, type RampLut } from '../color';
export { sharedClock, subscribe as subscribeFrames } from '../driver';
export { DotBuffer } from '../engine/buffer';
export { MODE_BUILDS } from '../engine/registry';
export type { Dot, ModeBuild } from '../engine/types';
export {
  MAX_SIZE,
  MIN_SIZE,
  type ModeKey,
  ORB_STATES,
  PROGRESS_MODES,
  type Resolved,
  resolvePreset,
  STATE_TO_MODE
} from '../presets';
export { renderSkia, type SkiaRenderOpts } from '../render/skia';
// the shared, platform-neutral surface
export type { OrbSize, OrbState, OrbTheme, Palette, PaletteName, Ramp, Stop } from '../types';
export { ThinkingOrb, type ThinkingOrbNativeProps } from './ThinkingOrb';
export { useReducedMotion, useResolvedDark } from './theme';
