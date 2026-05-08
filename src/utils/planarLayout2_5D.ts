export type LayoutGraph3D = {
  n: number;
  edges: [number, number][];
  positions: [number, number, number][];
};

function segCross2D(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): boolean {
  const d1 = (dx-cx)*(ay-cy) - (dy-cy)*(ax-cx);
  const d2 = (dx-cx)*(by-cy) - (dy-cy)*(bx-cx);
  const d3 = (bx-ax)*(cy-ay) - (by-ay)*(cx-ax);
  const d4 = (bx-ax)*(dy-ay) - (by-ay)*(dx-ax);
  return (d1 > 0) !== (d2 > 0) && (d3 > 0) !== (d4 > 0);
}

function findCrossingVertices(
  edges: [number, number][],
  pos: [number, number, number][],
): Set<number> {
  const verts = new Set<number>();
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const [a, b] = edges[i];
      const [c, d] = edges[j];
      if (a === c || a === d || b === c || b === d) continue;
      if (segCross2D(
        pos[a][0], pos[a][1], pos[b][0], pos[b][1],
        pos[c][0], pos[c][1], pos[d][0], pos[d][1],
      )) {
        verts.add(a); verts.add(b); verts.add(c); verts.add(d);
      }
    }
  }
  return verts;
}

/**
 * 2.5D layout: start with 2D, elevate only vertices involved in crossings.
 * A strong "stay flat" force pulls all vertices toward z=0.
 * Only crossing-involved vertices are given initial z offset to escape.
 */
export function optimizeLayout2_5D(
  input: LayoutGraph3D,
  iterations = 200,
): LayoutGraph3D {
  const { n, edges } = input;
  if (n < 2) return { ...input };

  const pos: [number, number, number][] = input.positions.map(
    ([x, y, z]) => [x, y, z],
  );

  // Scale xy to working area
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pos) {
    minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
    minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
  }
  const side = Math.max(maxX - minX, maxY - minY, 1);
  for (let i = 0; i < n; i++) {
    pos[i][0] = ((pos[i][0] - minX) / side) * 80 + 10;
    pos[i][1] = ((pos[i][1] - minY) / side) * 80 + 10;
    pos[i][2] = 0;
  }

  // First: run 2D optimization (xy only)
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const [u, v] of edges) {
    adj[u].push(v);
    adj[v].push(u);
  }
  const k = Math.sqrt((100 * 100) / Math.max(n, 2));
  const k2 = k * k;

  for (let it = 0; it < Math.floor(iterations * 0.6); it++) {
    const t = 1 - it / iterations;
    const step = k * 0.35 * t;
    if (step < 1e-8) break;
    const disp: [number, number][] = Array.from({ length: n }, () => [0, 0]);

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = pos[i][0] - pos[j][0];
        const dy = pos[i][1] - pos[j][1];
        const d = Math.max(Math.hypot(dx, dy), 1e-6);
        const f = k2 / (d * d);
        disp[i][0] += (dx/d)*f; disp[i][1] += (dy/d)*f;
        disp[j][0] -= (dx/d)*f; disp[j][1] -= (dy/d)*f;
      }
    }
    for (const [u, v] of edges) {
      const dx = pos[u][0] - pos[v][0];
      const dy = pos[u][1] - pos[v][1];
      const d = Math.max(Math.hypot(dx, dy), 1e-6);
      const stretch = Math.max(d / k, 1);
      const f = (d - k) * stretch;
      disp[u][0] -= (dx/d)*f; disp[u][1] -= (dy/d)*f;
      disp[v][0] += (dx/d)*f; disp[v][1] += (dy/d)*f;
    }
    for (let i = 0; i < n; i++) {
      const dx = 50 - pos[i][0], dy = 50 - pos[i][1];
      const d = Math.max(Math.hypot(dx, dy), 1e-6);
      disp[i][0] += (dx/d)*k*0.05; disp[i][1] += (dy/d)*k*0.05;
    }
    for (let v = 0; v < n; v++) {
      let dx = disp[v][0], dy = disp[v][1];
      const d = Math.hypot(dx, dy);
      if (d < 1e-10) continue;
      if (d > step) { dx *= step/d; dy *= step/d; }
      pos[v][0] = Math.max(2, Math.min(98, pos[v][0] + dx));
      pos[v][1] = Math.max(2, Math.min(98, pos[v][1] + dy));
    }
  }

  // Detect crossings after 2D optimization
  const crossVerts = findCrossingVertices(edges, pos);
  if (crossVerts.size === 0) {
    return { n, edges, positions: pos };
  }

  // Pick minimum vertices to elevate: for each crossing pair, elevate
  // the vertex with highest degree (most likely to resolve multiple crossings)
  const elevateSet = new Set<number>();
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const [a, b] = edges[i];
      const [c, d] = edges[j];
      if (a === c || a === d || b === c || b === d) continue;
      if (segCross2D(
        pos[a][0], pos[a][1], pos[b][0], pos[b][1],
        pos[c][0], pos[c][1], pos[d][0], pos[d][1],
      )) {
        // Elevate the vertex with fewest edges (least disruption)
        const counts = [a, b, c, d].map(v => [v, adj[v].length] as const);
        counts.sort((x, y) => x[1] - y[1]);
        elevateSet.add(counts[0][0]);
      }
    }
  }


  if (elevateSet.size === 0) {
    return { n, edges, positions: pos };
  }

  // Set z offsets for elevated vertices (fixed, not optimized further)
  const zStep = k * 0.5;
  let zIdx = 0;
  for (const v of elevateSet) {
    zIdx++;
    pos[v][2] = zStep * zIdx * (zIdx % 2 === 0 ? -1 : 1);
  }

  return { n, edges, positions: pos };
}
