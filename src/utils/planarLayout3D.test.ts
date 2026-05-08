import { describe, it, expect } from "vitest";
import { optimizeLayout3D, type LayoutGraph3D } from "./planarLayout3D";

function makeTetrahedron(): LayoutGraph3D {
  // K4 in 3D — all 4 vertices connected, crossing-free in 3D
  return {
    n: 4,
    edges: [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]],
    positions: [[0,0,0],[10,0,0],[5,8,0],[5,4,7]],
  };
}

function makeK5(): LayoutGraph3D {
  // K5 — non-planar, but crossing-free in 3D
  return {
    n: 5,
    edges: [[0,1],[0,2],[0,3],[0,4],[1,2],[1,3],[1,4],[2,3],[2,4],[3,4]],
    positions: [[0,0,0],[10,0,0],[5,8,0],[5,4,7],[3,3,3]],
  };
}

function minPairDist3D(g: LayoutGraph3D): number {
  let min = Infinity;
  for (let i = 0; i < g.n; i++) {
    for (let j = i + 1; j < g.n; j++) {
      const dx = g.positions[i][0] - g.positions[j][0];
      const dy = g.positions[i][1] - g.positions[j][1];
      const dz = g.positions[i][2] - g.positions[j][2];
      min = Math.min(min, Math.sqrt(dx*dx + dy*dy + dz*dz));
    }
  }
  return min;
}

describe("optimizeLayout3D", () => {
  it("returns correct number of nodes", () => {
    const result = optimizeLayout3D(makeTetrahedron());
    expect(result.positions.length).toBe(4);
    expect(result.positions[0].length).toBe(3);
  });

  it("preserves edges and node count", () => {
    const g = makeTetrahedron();
    const result = optimizeLayout3D(g);
    expect(result.n).toBe(g.n);
    expect(result.edges).toEqual(g.edges);
  });

  it("keeps vertices separated for K4", () => {
    const result = optimizeLayout3D(makeTetrahedron());
    expect(minPairDist3D(result)).toBeGreaterThan(0.5);
  });

  it("keeps vertices separated for K5 (non-planar)", () => {
    const result = optimizeLayout3D(makeK5());
    expect(minPairDist3D(result)).toBeGreaterThan(0.5);
  });

  it("spreads vertices in 3D (not flat)", () => {
    const result = optimizeLayout3D(makeK5());
    // Check that z coordinates are not all the same (actually 3D)
    const zValues = result.positions.map(p => p[2]);
    const zRange = Math.max(...zValues) - Math.min(...zValues);
    expect(zRange).toBeGreaterThan(1);
  });

  it("handles 2-node graph", () => {
    const g: LayoutGraph3D = {
      n: 2,
      edges: [[0, 1]],
      positions: [[0,0,0],[5,0,0]],
    };
    const result = optimizeLayout3D(g);
    expect(result.positions.length).toBe(2);
    expect(minPairDist3D(result)).toBeGreaterThan(0.1);
  });
});
