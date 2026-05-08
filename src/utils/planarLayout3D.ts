export type LayoutGraph3D = {
  n: number;
  edges: [number, number][];
  positions: [number, number, number][];
};

export function optimizeLayout3D(
  input: LayoutGraph3D,
  iterations = 200,
): LayoutGraph3D {
  const { n, edges } = input;
  if (n < 2) return { ...input };

  const pos: [number, number, number][] = input.positions.map(
    ([x, y, z]) => [x, y, z],
  );

  // Scale to working area [0, 100]^3
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  for (const p of pos) {
    for (let d = 0; d < 3; d++) {
      min[d] = Math.min(min[d], p[d]);
      max[d] = Math.max(max[d], p[d]);
    }
  }
  const side = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2], 1);
  for (let i = 0; i < n; i++) {
    for (let d = 0; d < 3; d++) {
      pos[i][d] = ((pos[i][d] - min[d]) / side) * 80 + 10;
    }
  }

  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const [u, v] of edges) {
    adj[u].push(v);
    adj[v].push(u);
  }

  const k = Math.cbrt((100 * 100 * 100) / Math.max(n, 2));
  const k2 = k * k;

  for (let it = 0; it < iterations; it++) {
    const t = 1 - it / iterations;
    const step = k * 0.3 * t;
    if (step < 1e-8) break;

    const disp: [number, number, number][] = Array.from(
      { length: n },
      () => [0, 0, 0],
    );

    // Force 1: pair repulsion k²/d
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = pos[i][0] - pos[j][0];
        const dy = pos[i][1] - pos[j][1];
        const dz = pos[i][2] - pos[j][2];
        const d = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 1e-6);
        const f = k2 / (d * d);
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        const fz = (dz / d) * f;
        disp[i][0] += fx; disp[i][1] += fy; disp[i][2] += fz;
        disp[j][0] -= fx; disp[j][1] -= fy; disp[j][2] -= fz;
      }
    }

    // Force 2: edge spring (Hooke toward k)
    for (const [u, v] of edges) {
      const dx = pos[u][0] - pos[v][0];
      const dy = pos[u][1] - pos[v][1];
      const dz = pos[u][2] - pos[v][2];
      const d = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 1e-6);
      const stretch = Math.max(d / k, 1);
      const f = (d - k) * stretch;
      const fx = (dx / d) * f;
      const fy = (dy / d) * f;
      const fz = (dz / d) * f;
      disp[u][0] -= fx; disp[u][1] -= fy; disp[u][2] -= fz;
      disp[v][0] += fx; disp[v][1] += fy; disp[v][2] += fz;
    }

    // Force 3: center pull
    const cx = 50, cy = 50, cz = 50;
    for (let i = 0; i < n; i++) {
      const dx = cx - pos[i][0];
      const dy = cy - pos[i][1];
      const dz = cz - pos[i][2];
      const d = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 1e-6);
      disp[i][0] += (dx / d) * k * 0.05;
      disp[i][1] += (dy / d) * k * 0.05;
      disp[i][2] += (dz / d) * k * 0.05;
    }

    // Apply
    let maxDisp = 0;
    for (let v = 0; v < n; v++) {
      let dx = disp[v][0], dy = disp[v][1], dz = disp[v][2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < 1e-10) continue;
      if (d > step) {
        const s = step / d;
        dx *= s; dy *= s; dz *= s;
      }
      pos[v][0] = Math.max(2, Math.min(98, pos[v][0] + dx));
      pos[v][1] = Math.max(2, Math.min(98, pos[v][1] + dy));
      pos[v][2] = Math.max(2, Math.min(98, pos[v][2] + dz));
      const moved = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (moved > maxDisp) maxDisp = moved;
    }

    if (maxDisp < k * 1e-3) break;
  }

  return { n, edges, positions: pos };
}
