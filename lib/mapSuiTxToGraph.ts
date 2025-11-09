import type { TransactionFacts } from "./parse";

export interface FlowNode {
  id: string;
  position: { x: number; y: number };
  data: { label: string };
  type?: string;
  style?: any;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
  style?: any;
}

export interface TransactionGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

interface AIResponse {
  actions: string[];
  transfers: Array<{
    from: string;
    to: string;
    amount: string;
    coinType: string;
  }>;
}

function truncateAddress(address: string, chars = 6): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function mapSuiTxToGraph(
  facts: TransactionFacts,
  ai: AIResponse
): TransactionGraph {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  let yPosition = 0;
  const nodeSpacing = 120;
  const horizontalSpacing = 300;

  nodes.push({
    id: "sender",
    position: { x: 0, y: yPosition },
    data: { label: `Sender\n${truncateAddress(facts.sender, 6)}` },
    type: "input",
    style: {
      background: "linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)",
      color: "#fff",
      border: "2px solid #06b6d4",
      borderRadius: "8px",
      padding: "16px",
      fontWeight: "bold",
      fontSize: "14px",
      boxShadow: "0 0 20px rgba(6, 182, 212, 0.5)",
      minWidth: "180px",
      textAlign: "center",
    },
  });

  if (ai.transfers.length > 0) {
    ai.transfers.forEach((transfer, idx) => {
      const recipientId = `recipient-${idx}`;
      const edgeId = `transfer-${idx}`;

      const recipientExists = nodes.find(n => n.id === recipientId);
      if (!recipientExists) {
        nodes.push({
          id: recipientId,
          position: { x: horizontalSpacing, y: yPosition + idx * nodeSpacing },
          data: { label: `Recipient\n${truncateAddress(transfer.to, 6)}` },
          type: "output",
          style: {
            background: "linear-gradient(135deg, #a855f7 0%, #ec4899 100%)",
            color: "#fff",
            border: "2px solid #a855f7",
            borderRadius: "8px",
            padding: "16px",
            fontWeight: "bold",
            fontSize: "14px",
            boxShadow: "0 0 20px rgba(168, 85, 247, 0.5)",
            minWidth: "180px",
            textAlign: "center",
          },
        });
      }

      edges.push({
        id: edgeId,
        source: "sender",
        target: recipientId,
        label: `Transfer\n${transfer.amount}`,
        animated: true,
        style: { stroke: "#06b6d4", strokeWidth: 2 },
      });
    });
    yPosition += ai.transfers.length * nodeSpacing;
  } else if (facts.recipients.length > 0) {
    facts.recipients.forEach((recipient, idx) => {
      const recipientId = `recipient-${idx}`;

      nodes.push({
        id: recipientId,
        position: { x: horizontalSpacing, y: idx * nodeSpacing },
        data: { label: `Recipient\n${truncateAddress(recipient, 6)}` },
        type: "output",
        style: {
          background: "linear-gradient(135deg, #a855f7 0%, #ec4899 100%)",
          color: "#fff",
          border: "2px solid #a855f7",
          borderRadius: "8px",
          padding: "16px",
          fontWeight: "bold",
          fontSize: "14px",
          boxShadow: "0 0 20px rgba(168, 85, 247, 0.5)",
          minWidth: "180px",
          textAlign: "center",
        },
      });

      edges.push({
        id: `edge-recipient-${idx}`,
        source: "sender",
        target: recipientId,
        label: "Transaction",
        animated: true,
        style: { stroke: "#06b6d4", strokeWidth: 2 },
      });
    });
    yPosition += facts.recipients.length * nodeSpacing;
  }

  if (facts.moveCall) {
    const callId = "move-call";
    yPosition += 50;

    nodes.push({
      id: callId,
      position: { x: horizontalSpacing / 2, y: yPosition },
      data: {
        label: `Function Call\n${facts.moveCall.module}::${facts.moveCall.function}`,
      },
      style: {
        background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        color: "#fff",
        border: "2px solid #10b981",
        borderRadius: "8px",
        padding: "16px",
        fontWeight: "bold",
        fontSize: "14px",
        boxShadow: "0 0 20px rgba(16, 185, 129, 0.5)",
        minWidth: "200px",
        textAlign: "center",
      },
    });

    edges.push({
      id: "edge-move-call",
      source: "sender",
      target: callId,
      label: "Executes",
      animated: true,
      style: { stroke: "#10b981", strokeWidth: 2 },
    });
    yPosition += nodeSpacing;
  }

  if (facts.objectChanges.created.length > 0) {
    yPosition += 50;
    const createCount = Math.min(facts.objectChanges.created.length, 3);

    facts.objectChanges.created.slice(0, 3).forEach((obj, idx) => {
      const objId = `created-${idx}`;

      nodes.push({
        id: objId,
        position: { x: horizontalSpacing * 1.5, y: yPosition + idx * 80 },
        data: { label: `Created Object\n${truncateAddress(obj, 6)}` },
        style: {
          background: "linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)",
          color: "#fff",
          border: "2px solid #22d3ee",
          borderRadius: "8px",
          padding: "12px",
          fontWeight: "bold",
          fontSize: "12px",
          boxShadow: "0 0 15px rgba(34, 211, 238, 0.4)",
          minWidth: "150px",
          textAlign: "center",
        },
      });

      edges.push({
        id: `edge-created-${idx}`,
        source: "sender",
        target: objId,
        label: "Created",
        animated: false,
        style: { stroke: "#22d3ee", strokeWidth: 1.5, strokeDasharray: "5,5" },
      });
    });

    yPosition += createCount * 80;
  }

  if (facts.objectChanges.mutated.length > 0) {
    yPosition += 50;
    const mutateCount = Math.min(facts.objectChanges.mutated.length, 2);

    facts.objectChanges.mutated.slice(0, 2).forEach((obj, idx) => {
      const objId = `mutated-${idx}`;

      nodes.push({
        id: objId,
        position: { x: horizontalSpacing * 1.5, y: yPosition + idx * 80 },
        data: { label: `Mutated Object\n${truncateAddress(obj, 6)}` },
        style: {
          background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
          color: "#fff",
          border: "2px solid #f59e0b",
          borderRadius: "8px",
          padding: "12px",
          fontWeight: "bold",
          fontSize: "12px",
          boxShadow: "0 0 15px rgba(245, 158, 11, 0.4)",
          minWidth: "150px",
          textAlign: "center",
        },
      });

      edges.push({
        id: `edge-mutated-${idx}`,
        source: "sender",
        target: objId,
        label: "Modified",
        animated: false,
        style: { stroke: "#f59e0b", strokeWidth: 1.5, strokeDasharray: "5,5" },
      });
    });
  }

  return { nodes, edges };
}
