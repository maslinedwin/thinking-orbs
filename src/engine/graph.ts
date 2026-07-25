// Graph: an activation hops node-to-node across a fixed constellation, leaving
// a decaying trail — the "reasoning" state. Reads as a chain of thought.
//
// Nodes sit at Fibonacci-lattice points so they're evenly spread however many
// there are. The walk follows nearest-neighbour edges rather than teleporting
// to random nodes, which is what makes it read as traversal.
//
// Both the adjacency table and the walk are precomputed and cached per node
// count. The walk is deliberately CYCLIC with a fixed period: deriving the
// current node by replaying the walk from step 0 would be O(t) and grow without
// bound, so instead the sequence is a fixed-length loop indexed by step modulo
// its period. Still fully deterministic, still no per-instance state.

import { fibDir, hashD, makeProj, radiusScale, slerp } from './core';
import type { ModeBuild } from './types';

const NEIGHBOURS = 3;
const PERIOD = 24;

interface Constellation {
  nodes: Array<[number, number, number]>;
  /** NEIGHBOURS nearest node indices per node. */
  adj: number[][];
  /** Deduplicated undirected edges, as [from, to] node index pairs. */
  edges: Array<[number, number]>;
  /** Cyclic walk of length PERIOD, as node indices. */
  walk: number[];
}

const cache = new Map<number, Constellation>();

function constellation(n: number): Constellation {
  const hit = cache.get(n);
  if (hit) return hit;

  const nodes: Array<[number, number, number]> = [];
  for (let i = 0; i < n; i++) nodes.push(fibDir(i, n));

  const adj: number[][] = [];
  for (let i = 0; i < n; i++) {
    // rank every other node by angular closeness, keep the nearest few
    const scored: Array<[number, number]> = [];
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const d = nodes[i][0] * nodes[j][0] + nodes[i][1] * nodes[j][1] + nodes[i][2] * nodes[j][2];
      scored.push([j, d]);
    }
    scored.sort((a, b) => b[1] - a[1]);
    adj.push(scored.slice(0, Math.min(NEIGHBOURS, scored.length)).map((s) => s[0]));
  }

  // undirected edge set, deduplicated — these get drawn as dotted chains, both
  // because a constellation with no visible edges reads as scattered dots
  // rather than a graph, and because the nodes alone can't fill the frame
  const seen = new Set<string>();
  const edges: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    for (const j of adj[i]) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push([i, j]);
    }
  }

  const walk: number[] = [0];
  for (let s = 1; s < PERIOD; s++) {
    const from = walk[s - 1];
    const opts = adj[from];
    let next = opts[Math.floor(hashD(s, 3.3) * opts.length) % opts.length];
    // avoid immediately bouncing back where we came from
    if (s > 1 && next === walk[s - 2] && opts.length > 1) {
      next = opts[(opts.indexOf(next) + 1) % opts.length];
    }
    walk.push(next);
  }

  const built = { nodes, adj, edges, walk };
  cache.set(n, built);
  return built;
}

export const buildGraph: ModeBuild = (out, size, t, o) => {
  const cx = size / 2;
  const cy = size / 2;
  const R = (size / 2) * 0.84;
  const pt = makeProj(t * (o.spin ?? 0.16), 0.34, cx, cy, R);
  const rs = radiusScale(size, o.rsPow ?? 0.6);

  const n = Math.max(4, Math.round(o.nodeN ?? 22));
  const { nodes, edges, walk } = constellation(n);

  const step = Math.floor(t);
  const local = t - step;
  const cur = walk[step % PERIOD];
  const nxt = walk[(step + 1) % PERIOD];
  const trail = Math.max(1, Math.round(o.trail ?? 4));

  // --- the edge lattice, as dotted chains ----------------------------
  // Held back by ink rather than alpha, matching the sphere modes.
  const seg = Math.max(2, Math.round(o.edgeSeg ?? 5));
  for (const [i, j] of edges) {
    const active = (i === cur && j === nxt) || (j === cur && i === nxt) ? 1 : 0;
    for (let s = 1; s < seg; s++) {
      const f = s / seg;
      const [ux, uy, uz] = slerp(nodes[i], nodes[j], f);
      const [px, py, z] = pt(ux, uy, uz);
      const depth = (z + 1) / 2;
      out.add(
        px,
        py,
        z,
        ((o.rEdge ?? 0.5) + (o.rDepth ?? 1.1) * depth * 0.5 + (o.rEdgeHot ?? 0.5) * active) * rs,
        (o.inkEdge ?? 0.66) - 0.24 * depth - (o.inkEdgeHot ?? 0.3) * active,
        o.edgeA ?? 0.85
      );
    }
  }

  // --- nodes, glowing by how recently they were visited --------------
  for (let i = 0; i < n; i++) {
    const [px, py, z] = pt(nodes[i][0], nodes[i][1], nodes[i][2]);
    const depth = (z + 1) / 2;

    // how many steps back was this node last hit?
    let age = -1;
    for (let k = 0; k < trail; k++) {
      if (walk[(step - k + PERIOD * 2) % PERIOD] === i) {
        age = k;
        break;
      }
    }
    const glow = age < 0 ? 0 : 1 - age / trail;

    out.add(
      px,
      py,
      z,
      ((o.rNode ?? 1.35) + (o.rDepth ?? 1.1) * depth + (o.rGlow ?? 1.9) * glow) * rs,
      (o.inkNode ?? 0.5) - 0.34 * depth - (o.inkGlow ?? 0.44) * glow,
      (o.nodeA ?? 0.92) + (1 - (o.nodeA ?? 0.92)) * glow
    );
  }

  // --- the activation travelling along the current edge --------------
  const edgeDots = Math.max(2, Math.round(o.edgeN ?? 5));
  for (let k = 0; k < edgeDots; k++) {
    // a short comet: the head is at `local`, the tail trails behind it
    const f = local - (k / edgeDots) * (o.cometLen ?? 0.32);
    if (f < 0 || f > 1) continue;
    const [ux, uy, uz] = slerp(nodes[cur], nodes[nxt], f);
    const [px, py, z] = pt(ux, uy, uz);
    const depth = (z + 1) / 2;
    const fade = 1 - k / edgeDots;
    out.add(
      px,
      py,
      z + 0.01,
      ((o.rTravel ?? 1.3) + (o.rDepth ?? 1.1) * depth) * fade * rs,
      0.1 - 0.06 * depth,
      fade
    );
  }
};
