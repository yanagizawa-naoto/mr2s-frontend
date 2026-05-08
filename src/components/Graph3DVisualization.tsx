import { Canvas } from "@react-three/fiber";
import { OrbitControls, Line, Text } from "@react-three/drei";
import type { ParsedGraph, OptimizedDirectedEdge } from "../types";
import { optimizeLayout2_5D } from "../utils/planarLayout2_5D";
import { useMemo } from "react";

type Graph3DVisualizationProps = {
  parsedGraph: ParsedGraph;
  directedEdges: OptimizedDirectedEdge[] | null;
};

const NODE_RADIUS = 2;
const SCALE = 6;

function GraphNode({
  position,
  label,
}: {
  position: [number, number, number];
  label: string;
}) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[NODE_RADIUS, 24, 24]} />
        <meshStandardMaterial color="#4a90d9" roughness={0.3} metalness={0.1} />
      </mesh>
      <Text
        position={[0, NODE_RADIUS + 1.5, 0]}
        fontSize={2.5}
        color="white"
        anchorX="center"
        anchorY="bottom"
      >
        {label}
      </Text>
    </group>
  );
}

function GraphEdge({
  start,
  end,
  color = "#999999",
  lineWidth = 1.5,
}: {
  start: [number, number, number];
  end: [number, number, number];
  color?: string;
  lineWidth?: number;
}) {
  return <Line points={[start, end]} color={color} lineWidth={lineWidth} />;
}

function DirectedEdge({
  start,
  end,
}: {
  start: [number, number, number];
  end: [number, number, number];
}) {
  const mid: [number, number, number] = [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
    (start[2] + end[2]) / 2,
  ];
  return (
    <>
      <Line points={[start, end]} color="#dc2626" lineWidth={3} />
      <mesh position={mid}>
        <coneGeometry args={[1, 3, 8]} />
        <meshStandardMaterial color="#dc2626" />
      </mesh>
    </>
  );
}

export function Graph3DVisualization({
  parsedGraph,
  directedEdges,
}: Graph3DVisualizationProps) {
  const layout = useMemo(() => {
    const n = parsedGraph.vertices.length;
    const vertexToIdx = new Map(
      parsedGraph.vertices.map((v, i) => [v, i]),
    );
    const edges0: [number, number][] = parsedGraph.edges.map(([u, v]) => [
      vertexToIdx.get(u) ?? 0,
      vertexToIdx.get(v) ?? 0,
    ]);

    // Circle initial positions on xy plane (z=0)
    const initPos: [number, number, number][] = parsedGraph.vertices.map(
      (_, i) => [
        50 + 40 * Math.cos((2 * Math.PI * i) / n),
        50 + 40 * Math.sin((2 * Math.PI * i) / n),
        0,
      ],
    );

    const result = optimizeLayout2_5D({ n, edges: edges0, positions: initPos });

    // Center around origin for Three.js
    let cx = 0, cy = 0, cz = 0;
    for (const p of result.positions) {
      cx += p[0]; cy += p[1]; cz += p[2];
    }
    cx /= n; cy /= n; cz /= n;

    // Three.js: y=上。レイアウト: x,y=平面, z=高さ
    // マッピング: Three.x = layout.x, Three.y = layout.z(高さ), Three.z = layout.y
    return {
      positions: result.positions.map(
        (p) =>
          [
            (p[0] - cx) * (SCALE / 10),
            (p[2] - cz) * (SCALE / 10),
            (p[1] - cy) * (SCALE / 10),
          ] as [number, number, number],
      ),
      edges: edges0,
      vertexToIdx,
    };
  }, [parsedGraph]);

  const directedSet = useMemo(() => {
    if (!directedEdges) return null;
    const set = new Set<string>();
    for (const e of directedEdges) {
      set.add(`${e._from}-${e.to}`);
    }
    return set;
  }, [directedEdges]);

  return (
    <div style={{ width: "100%", height: "100%", minHeight: 500 }}>
      <Canvas camera={{ position: [0, 80, 60], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[50, 100, 50]} intensity={0.8} />
        <hemisphereLight args={[0xffffff, 0x444444, 0.4]} />

        {/* Nodes */}
        {parsedGraph.vertices.map((v, i) => (
          <GraphNode
            key={v}
            position={layout.positions[i]}
            label={String(v)}
          />
        ))}

        {/* Undirected edges */}
        {layout.edges.map(([u, v], i) => {
          const fromV = parsedGraph.vertices[u];
          const toV = parsedGraph.vertices[v];
          const isDirected =
            directedSet?.has(`${fromV}-${toV}`) ||
            directedSet?.has(`${toV}-${fromV}`);
          if (isDirected) return null;
          return (
            <GraphEdge
              key={`e-${i}`}
              start={layout.positions[u]}
              end={layout.positions[v]}
            />
          );
        })}

        {/* Directed edges */}
        {directedEdges?.map((e, i) => {
          const ui = layout.vertexToIdx.get(e._from);
          const vi = layout.vertexToIdx.get(e.to);
          if (ui === undefined || vi === undefined) return null;
          return (
            <DirectedEdge
              key={`d-${i}`}
              start={layout.positions[ui]}
              end={layout.positions[vi]}
            />
          );
        })}

        <OrbitControls enableDamping dampingFactor={0.1} />
        <gridHelper args={[100, 10, "#444444", "#222222"]} />
      </Canvas>
    </div>
  );
}
