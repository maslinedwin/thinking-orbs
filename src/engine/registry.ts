// Mode key → geometry builder. Kept separate from the presets so tree
// shaking can in principle drop unused modes in custom builds.

import type { ModeKey } from '../presets';
import { buildShatter } from './burst';
import { buildCluster } from './cluster';
import { buildFault } from './fault';
import { buildFunnel, buildVortex } from './flow';
import { buildGraph } from './graph';
import { buildCascade, buildRaster } from './grid';
import { buildHelix } from './helix';
import { buildIgnite } from './ignite';
import { buildGlobe, buildRubik, buildWave } from './lattice';
import { buildMorph } from './morph';
import { buildOrbits } from './orbits';
import { buildDetour, buildFlightpath } from './path';
import { buildPins } from './pins';
import { buildRibbon } from './ribbon';
import { buildAttest } from './ring';
import { buildSonar } from './rings';
import { buildRoute } from './route';
import { buildSeal } from './seal';
import type { ModeBuild } from './types';
import { buildVigil } from './vigil';

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
  shatter: buildShatter,
  fault: buildFault,
  seal: buildSeal,
  flightpath: buildFlightpath,
  detour: buildDetour,
  vigil: buildVigil,
  attest: buildAttest,
  ignite: buildIgnite,
  pins: buildPins
};
