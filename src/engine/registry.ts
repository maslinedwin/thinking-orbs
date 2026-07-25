// Mode key → geometry builder. Kept separate from the presets so tree
// shaking can in principle drop unused modes in custom builds.

import type { ModeKey } from '../presets';
import { buildGlobe, buildRubik, buildWave } from './lattice';
import { buildMorph } from './morph';
import { buildOrbits } from './orbits';
import { buildRibbon } from './ribbon';
import type { ModeBuild } from './types';

export const MODE_BUILDS: Record<ModeKey, ModeBuild> = {
  orbits: buildOrbits,
  globe: buildGlobe,
  rubik: buildRubik,
  wave: buildWave,
  ribbon: buildRibbon,
  morph: buildMorph
};
