// Colour surface: the built-in palettes and the ramp→LUT machinery, for
// consumers building their own ramps or matching the orbs elsewhere.
export { A_LEVELS, getLut, L_LEVELS, PALETTES, type RampLut, styleFor } from './color';
export { sharedClock, subscribe as subscribeFrames } from './driver';
export { DotBuffer } from './engine/buffer';
export { MODE_BUILDS } from './engine/registry';
export type { Dot, ModeBuild } from './engine/types';
// Power-user surface: resolved presets + the raw geometry builders and the
// canvas renderer, for consumers driving their own canvas outside React.
export {
  MAX_SIZE,
  MIN_SIZE,
  type ModeKey,
  ORB_STATES,
  type Resolved,
  resolvePreset,
  STATE_TO_MODE
} from './presets';
export { type RenderOpts, renderCanvas2D } from './render/canvas2d';
export { ThinkingOrb } from './ThinkingOrb';
export type {
  OrbSize,
  OrbState,
  OrbTheme,
  Palette,
  PaletteName,
  Ramp,
  Stop,
  ThinkingOrbProps
} from './types';
