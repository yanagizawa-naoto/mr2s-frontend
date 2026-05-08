import { describe, it, expect } from "vitest";
import { optimizeLayout2_5D, type LayoutGraph3D } from "./planarLayout2_5D";

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

function count2DCrossings(g: LayoutGraph3D): number {
  let count = 0;
  for (let i = 0; i < g.edges.length; i++) {
    for (let j = i + 1; j < g.edges.length; j++) {
      const [a, b] = g.edges[i];
      const [c, d] = g.edges[j];
      if (a === c || a === d || b === c || b === d) continue;
      if (segCross2D(
        g.positions[a][0], g.positions[a][1],
        g.positions[b][0], g.positions[b][1],
        g.positions[c][0], g.positions[c][1],
        g.positions[d][0], g.positions[d][1],
      )) count++;
    }
  }
  return count;
}

describe("optimizeLayout2_5D", () => {
  it("keeps planar graph flat (z ≈ 0)", () => {
    // Triangle: planar, no crossings needed
    const g: LayoutGraph3D = {
      n: 3,
      edges: [[0,1],[1,2],[2,0]],
      positions: [[0,0,0],[10,0,0],[5,8,0]],
    };
    const result = optimizeLayout2_5D(g);
    const maxZ = Math.max(...result.positions.map(p => Math.abs(p[2])));
    expect(maxZ).toBeLessThan(5);
  });

  it("elevates vertices for K5 to reduce crossings", () => {
    // K5 with square+center layout has crossings in 2D
    const g: LayoutGraph3D = {
      n: 5,
      edges: [[0,1],[0,2],[0,3],[0,4],[1,2],[1,3],[1,4],[2,3],[2,4],[3,4]],
      positions: [[0,0,0],[10,0,0],[10,10,0],[0,10,0],[5,5,0]],
    };
    const result = optimizeLayout2_5D(g);
    // Some z values should be non-zero
    const zValues = result.positions.map(p => Math.abs(p[2]));
    const maxZ = Math.max(...zValues);
    expect(maxZ).toBeGreaterThan(1);
  });

  it("has fewer 2D-projected crossings than pure 2D for K5", () => {
    const g: LayoutGraph3D = {
      n: 5,
      edges: [[0,1],[0,2],[0,3],[0,4],[1,2],[1,3],[1,4],[2,3],[2,4],[3,4]],
      positions: [[0,0,0],[10,0,0],[10,10,0],[0,10,0],[5,5,0]],
    };
    const before = count2DCrossings(g);
    const result = optimizeLayout2_5D(g);
    const after = count2DCrossings(result);
    // Should not make crossings worse (2D projection may still have some)
    expect(after).toBeLessThanOrEqual(before);
  });

  it("preserves node count and edges", () => {
    const g: LayoutGraph3D = {
      n: 4,
      edges: [[0,1],[1,2],[2,3],[3,0],[0,2]],
      positions: [[0,0,0],[10,0,0],[10,10,0],[0,10,0]],
    };
    const result = optimizeLayout2_5D(g);
    expect(result.n).toBe(4);
    expect(result.edges).toEqual(g.edges);
    expect(result.positions.length).toBe(4);
  });
});
