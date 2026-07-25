// Mode key → geometry builder. Kept separate from the presets so tree
// shaking can in principle drop unused modes in custom builds.

import type { ModeKey } from '../presets';
import { buildShatter } from './burst';
import { buildCluster } from './cluster';
import { buildFunnel, buildVortex } from './flow';
import { buildGraph } from './graph';
import { buildCascade, buildRaster } from './grid';
import { buildHelix } from './helix';
import { buildGlobe, buildRubik, buildWave } from './lattice';
import { buildMorph } from './morph';
import { buildOrbits } from './orbits';
import { buildRibbon } from './ribbon';
import { buildSonar } from './rings';
import { buildRoute } from './route';
import type { ModeBuild } from './types';

export const MODE_BUILDS: Record<ModeKey, ModeBuild> = {
  orbits: buildOrbits,
  globe: buildGlobe,
  rubik: buildRubik,
  wave: buildWave,
  ribbon: buildRibbon,
  morph: buildMorph,
  route: buildRoute,
  sonar: buildSonar,
  graph: buildGraph,
  funnel: buildFunnel,
  raster: buildRaster,
  vortex: buildVortex,
  helix: buildHelix,
  cluster: buildCluster,
  cascade: buildCascade,
  shatter: buildShatter
};
