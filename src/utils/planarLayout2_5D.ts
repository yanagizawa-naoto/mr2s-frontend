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

  // Give crossing vertices initial z offset
  let zOffset = k * 0.5;
  for (const v of crossVerts) {
    pos[v][2] = zOffset;
    zOffset = -zOffset + (zOffset > 0 ? 0 : k * 0.3);
  }

  // 3D optimization with z-gravity (pull toward z=0)
  const zGravity = 0.3;
  for (let it = 0; it < Math.floor(iterations * 0.4); it++) {
    const t = 1 - it / iterations;
    const step = k * 0.25 * t;
    if (step < 1e-8) break;

    const disp: [number, number, number][] = Array.from(
      { length: n }, () => [0, 0, 0],
    );

    // 3D repulsion
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = pos[i][0]-pos[j][0];
        const dy = pos[i][1]-pos[j][1];
        const dz = pos[i][2]-pos[j][2];
        const d = Math.max(Math.sqrt(dx*dx+dy*dy+dz*dz), 1e-6);
        const f = k2 / (d * d);
        disp[i][0] += (dx/d)*f; disp[i][1] += (dy/d)*f; disp[i][2] += (dz/d)*f;
        disp[j][0] -= (dx/d)*f; disp[j][1] -= (dy/d)*f; disp[j][2] -= (dz/d)*f;
      }
    }

    // 3D spring
    for (const [u, v] of edges) {
      const dx = pos[u][0]-pos[v][0];
      const dy = pos[u][1]-pos[v][1];
      const dz = pos[u][2]-pos[v][2];
      const d = Math.max(Math.sqrt(dx*dx+dy*dy+dz*dz), 1e-6);
      const stretch = Math.max(d / k, 1);
      const f = (d - k) * stretch;
      disp[u][0] -= (dx/d)*f; disp[u][1] -= (dy/d)*f; disp[u][2] -= (dz/d)*f;
      disp[v][0] += (dx/d)*f; disp[v][1] += (dy/d)*f; disp[v][2] += (dz/d)*f;
    }

    // z-gravity: pull toward z=0
    for (let i = 0; i < n; i++) {
      disp[i][2] -= pos[i][2] * zGravity;
    }

    // xy center pull
    for (let i = 0; i < n; i++) {
      const dx = 50 - pos[i][0], dy = 50 - pos[i][1];
      const d = Math.max(Math.hypot(dx, dy), 1e-6);
      disp[i][0] += (dx/d)*k*0.05;
      disp[i][1] += (dy/d)*k*0.05;
    }

    // Apply
    for (let v = 0; v < n; v++) {
      let dx = disp[v][0], dy = disp[v][1], dz = disp[v][2];
      const d = Math.sqrt(dx*dx+dy*dy+dz*dz);
      if (d < 1e-10) continue;
      if (d > step) { const s = step/d; dx *= s; dy *= s; dz *= s; }
      pos[v][0] = Math.max(2, Math.min(98, pos[v][0] + dx));
      pos[v][1] = Math.max(2, Math.min(98, pos[v][1] + dy));
      pos[v][2] += dz;
    }
  }

  return { n, edges, positions: pos };
}
