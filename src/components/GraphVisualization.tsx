import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Graph3DVisualization } from "./Graph3DVisualization.tsx";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { ParsedGraph } from "../types.ts";
import type { OptimizedDirectedEdge } from "../types.ts";
import { CircleNode } from "./CircleNode.tsx";
import { optimizeLayout } from "../utils/planarLayout.ts";

type GraphVisualizationProps = {
  parsedGraph: ParsedGraph | null;
  directedEdges: OptimizedDirectedEdge[] | null;
  hasDrawn: boolean;
};

const NODE_WIDTH = 40;
const NODE_HEIGHT = 40;

const nodeTypes = { circle: CircleNode };


function buildNodesAndEdges(
  graph: ParsedGraph,
  directedEdges: OptimizedDirectedEdge[] | null,
  existingNodes: Node[] | null
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = graph.vertices.map((v) => ({
    id: String(v),
    type: "circle",
    position: { x: 0, y: 0 },
    data: { label: String(v) },
  }));

  let layoutedNodes: Node[];
  if (graph.positions) {
    layoutedNodes = nodes.map((node) => ({
      ...node,
      position: {
        x: (graph.positions![Number(node.id)]?.x ?? 0) - NODE_WIDTH / 2,
        y: (graph.positions![Number(node.id)]?.y ?? 0) - NODE_HEIGHT / 2,
      },
    }));
  } else {
    // Apply force-directed layout for manually entered graphs
    const n = graph.vertices.length;
    const vertexToIdx = new Map(graph.vertices.map((v, i) => [v, i]));
    const edges0: [number, number][] = graph.edges.map(([u, v]) => [
      vertexToIdx.get(u) ?? 0,
      vertexToIdx.get(v) ?? 0,
    ]);
    // Circle initial positions
    const initPos: [number, number][] = graph.vertices.map((_, i) => [
      50 + 40 * Math.cos((2 * Math.PI * i) / n),
      50 + 40 * Math.sin((2 * Math.PI * i) / n),
    ]);
    const laid = optimizeLayout({ n, edges: edges0, positions: initPos });
    const SCALE = 6;
    layoutedNodes = nodes.map((node, i) => ({
      ...node,
      position: {
        x: laid.positions[i][0] * SCALE - NODE_WIDTH / 2,
        y: laid.positions[i][1] * SCALE - NODE_HEIGHT / 2,
      },
    }));
  }

  const existingIds = new Set(existingNodes?.map((n) => n.id) ?? []);
  const sameGraph =
    existingNodes &&
    existingNodes.length === layoutedNodes.length &&
    layoutedNodes.every((n) => existingIds.has(n.id));

  const nodesToUse = sameGraph
    ? layoutedNodes.map((n) => {
        const existing = existingNodes!.find((e) => e.id === n.id);
        return {
          ...n,
          position: existing?.position ?? n.position,
        };
      })
    : layoutedNodes;

  const posMap = new Map<string, { x: number; y: number }>();
  nodesToUse.forEach((n) => {
    posMap.set(n.id, {
      x: n.position.x + NODE_WIDTH / 2,
      y: n.position.y + NODE_HEIGHT / 2,
    });
  });

  const addEdge = (
    id: string,
    source: string,
    target: string,
    opts: Partial<Edge>
  ): Edge => ({ ...opts, id, source, target, type: "straight" }) as Edge;

  const edges: Edge[] = [];

  if (directedEdges && directedEdges.length > 0) {
    for (const [u, v] of graph.edges) {
      edges.push(
        addEdge(`bg-${u}-${v}`, String(u), String(v), {
          type: "default",
          markerEnd: undefined,
          markerStart: undefined,
          style: { stroke: "var(--edge-bg)", strokeWidth: 1 },
          zIndex: 0,
        })
      );
    }
    for (const e of directedEdges) {
      edges.push(
        addEdge(`dir-${e._from}-${e.to}`, String(e._from), String(e.to), {
          type: "default",
          animated: true,
          className: "edge-directed-animated",
          markerEnd: { type: MarkerType.ArrowClosed, color: "#dc2626" },
          style: {
            stroke: "#dc2626",
            strokeWidth: 3,
            strokeDasharray: "8 4",
          },
          zIndex: 1,
        })
      );
    }
  } else {
    for (const [u, v] of graph.edges) {
      edges.push(
        addEdge(`undir-${u}-${v}`, String(u), String(v), {
          type: "default",
          markerEnd: undefined,
          markerStart: undefined,
          style: { stroke: "var(--edge-undir)", strokeWidth: 2 },
        })
      );
    }
  }

  return { nodes: nodesToUse, edges };
}

export function GraphVisualization({
  parsedGraph,
  directedEdges,
  hasDrawn,
}: GraphVisualizationProps) {
  const { t } = useTranslation();
  const { nodes: initialNodes, edges: initialEdges } = parsedGraph
    ? buildNodesAndEdges(parsedGraph, directedEdges, null)
    : { nodes: [], edges: [] };

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  useEffect(() => {
    if (parsedGraph) {
      const { nodes: n, edges: e } = buildNodesAndEdges(
        parsedGraph,
        directedEdges,
        nodesRef.current
      );
      setNodes(n);
      setEdges(e);
    }
  }, [parsedGraph, directedEdges]);

  const [view3D, setView3D] = useState(false);

  if (!hasDrawn) {
    return (
      <div className="graph-placeholder">
        <p>{t("graphVisualization.placeholder")}</p>
      </div>
    );
  }

  if (!parsedGraph) {
    return null;
  }

  return (
    <div className="graph-viz" style={{ position: "relative" }}>
      <button
        onClick={() => setView3D(!view3D)}
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          zIndex: 10,
          padding: "6px 14px",
          borderRadius: 6,
          border: "1px solid var(--border-input, #555)",
          background: "var(--btn-secondary-bg, #222)",
          color: "var(--text, #fff)",
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        {view3D ? "2D" : "3D"}
      </button>
      {view3D ? (
        <Graph3DVisualization
          parsedGraph={parsedGraph}
          directedEdges={directedEdges}
        />
      ) : (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.01}
          maxZoom={100}
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      )}
    </div>
  );
}
