"use client";

import dynamic from "next/dynamic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GitBranch } from "lucide-react";
import type { Node, Edge } from "@xyflow/react";

const TransactionFlowInner = dynamic(
  () => import("./transaction-flow-inner").then((mod) => mod.TransactionFlowInner),
  {
    ssr: false,
    loading: () => (
      <Card className="bg-[#0a0e1a]/80 border-cyan-500/30 glow-cyan backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-glow-cyan flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-cyan-400" />
            TRANSACTION FLOW DIAGRAM
          </CardTitle>
          <CardDescription className="text-cyan-300/70 font-mono text-xs">
            Loading visualization...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[600px] w-full rounded-lg overflow-hidden border-2 border-cyan-500/30 bg-[#0f1420] flex items-center justify-center">
            <div className="text-cyan-400 font-mono animate-pulse">
              Initializing flow diagram...
            </div>
          </div>
        </CardContent>
      </Card>
    ),
  }
);

interface TransactionFlowProps {
  nodes: Node[];
  edges: Edge[];
}

export function TransactionFlow({ nodes, edges }: TransactionFlowProps) {
  return <TransactionFlowInner nodes={nodes} edges={edges} />;
}
