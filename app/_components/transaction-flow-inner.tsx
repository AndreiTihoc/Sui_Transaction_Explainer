"use client";

import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GitBranch } from "lucide-react";

interface TransactionFlowInnerProps {
  nodes: any[];
  edges: any[];
}

export default function TransactionFlowInner({ nodes, edges }: TransactionFlowInnerProps) {
  const [flowNodes, , onNodesChange] = useNodesState(nodes);
  const [flowEdges, , onEdgesChange] = useEdgesState(edges);

  return (
    <Card className="bg-[#0a0e1a]/80 border-cyan-500/30 glow-cyan backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-glow-cyan flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-cyan-400" />
          TRANSACTION FLOW DIAGRAM
        </CardTitle>
        <CardDescription className="text-cyan-300/70 font-mono text-xs">
          Professional visualization of blockchain transaction flow
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[600px] w-full rounded-lg overflow-hidden border-2 border-cyan-500/30 bg-[#0f1420]">
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            fitView
            attributionPosition="bottom-left"
            minZoom={0.5}
            maxZoom={1.5}
            defaultEdgeOptions={{
              type: "smoothstep",
              animated: true,
              style: { strokeWidth: 2 },
            }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="#06b6d4"
              style={{ backgroundColor: "#0f1420" }}
            />
            <Controls
              style={{
                background: "rgba(10, 14, 26, 0.9)",
                border: "1px solid rgba(6, 182, 212, 0.3)",
                borderRadius: "8px",
              }}
            />
            <MiniMap
              nodeColor={(node) => {
                if (node.type === "input") return "#06b6d4";
                if (node.type === "output") return "#a855f7";
                return "#10b981";
              }}
              style={{
                background: "rgba(10, 14, 26, 0.9)",
                border: "1px solid rgba(6, 182, 212, 0.3)",
                borderRadius: "8px",
              }}
            />
          </ReactFlow>
        </div>
      </CardContent>
    </Card>
  );
}
