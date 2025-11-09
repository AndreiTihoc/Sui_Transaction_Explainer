"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Package,
  Coins,
  Box,
  RefreshCw,
  Zap
} from "lucide-react";
import type { TransactionFacts } from "@/lib/parse";
import type { SuiNetwork } from "@/lib/sui";

interface AIResponse {
  risk_level: "low" | "medium" | "high";
  summary: string;
  actions: string[];
  transfers: Array<{
    from: string;
    to: string;
    amount: string;
    coinType: string;
  }>;
  objects: {
    created: string[];
    mutated: string[];
    deleted: string[];
  };
  gas_sui: string;
}

interface TransactionResultProps {
  digest: string;
  network: SuiNetwork;
  facts: TransactionFacts;
  ai: AIResponse;
  onReset: () => void;
}

function truncateAddress(address: string, chars = 6): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

function getRiskColor(risk: string): string {
  switch (risk) {
    case "low":
      return "bg-green-500 glow-cyan";
    case "medium":
      return "bg-yellow-500 glow-purple";
    case "high":
      return "bg-red-500 glow-pink";
    default:
      return "bg-gray-500";
  }
}

function getStatusIcon(status: string) {
  if (status === "success") {
    return <CheckCircle2 className="h-5 w-5 text-green-400 animate-pulse-glow" />;
  }
  return <XCircle className="h-5 w-5 text-red-400" />;
}

export function TransactionResult({
  digest,
  network,
  facts,
  ai,
  onReset,
}: TransactionResultProps) {
  const explorerUrl = network === "mainnet"
    ? `https://suiscan.xyz/mainnet/tx/${digest}`
    : `https://suiscan.xyz/testnet/tx/${digest}`;

  return (
    <div className="space-y-6">
      <Card className="bg-[#0a0e1a]/80 border-cyan-500/30 glow-cyan backdrop-blur-xl">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-2xl text-glow-cyan">TRANSACTION DECODED</CardTitle>
              <CardDescription className="font-mono text-xs text-cyan-400/70">
                {truncateAddress(digest, 12)}
              </CardDescription>
            </div>
            <Badge className={`${getRiskColor(ai.risk_level)} text-white font-bold`}>
              {ai.risk_level.toUpperCase()} RISK
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-cyan-500/10 border-cyan-500/30">
            <AlertCircle className="h-4 w-4 text-cyan-400" />
            <AlertDescription className="text-sm leading-relaxed text-cyan-100">
              {ai.summary}
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-cyan-300">Status:</span>
              <div className="flex items-center gap-1">
                {getStatusIcon(facts.status)}
                <span className="capitalize text-cyan-50">{facts.status}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-cyan-300">Network:</span>
              <Badge variant="outline" className="border-cyan-500/50 text-cyan-400 font-mono">
                {network.toUpperCase()}
              </Badge>
            </div>
          </div>

          <div>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300 hover:underline font-mono"
            >
              <Zap className="h-3 w-3" />
              View in Explorer
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>

      {ai.actions.length > 0 && (
        <Card className="bg-[#0a0e1a]/80 border-cyan-500/30 glow-cyan backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-glow-cyan">
              <Package className="h-5 w-5 text-cyan-400" />
              ACTIONS EXECUTED
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {ai.actions.map((action, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm">
                  <span className="text-cyan-400 mt-0.5 font-mono">[{idx + 1}]</span>
                  <span className="text-cyan-50">{action}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="bg-[#0a0e1a]/80 border-cyan-500/30 glow-cyan backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-glow-cyan">
            <Coins className="h-5 w-5 text-cyan-400" />
            TRANSACTION DETAILS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            <div className="flex justify-between items-start">
              <span className="text-sm font-medium text-cyan-300 font-mono">SENDER:</span>
              <code className="text-xs bg-cyan-500/10 border border-cyan-500/30 px-3 py-1 rounded text-cyan-400">
                {truncateAddress(facts.sender, 8)}
              </code>
            </div>

            {facts.recipients.length > 0 && (
              <div className="flex justify-between items-start">
                <span className="text-sm font-medium text-cyan-300 font-mono">RECIPIENTS:</span>
                <div className="flex flex-col items-end gap-1">
                  {facts.recipients.map((recipient, idx) => (
                    <code key={idx} className="text-xs bg-purple-500/10 border border-purple-500/30 px-3 py-1 rounded text-purple-400">
                      {truncateAddress(recipient, 8)}
                    </code>
                  ))}
                </div>
              </div>
            )}

            {facts.moveCall && (
              <div className="flex justify-between items-start">
                <span className="text-sm font-medium text-cyan-300 font-mono">FUNCTION:</span>
                <code className="text-xs bg-cyan-500/10 border border-cyan-500/30 px-3 py-1 rounded max-w-[60%] break-all text-cyan-400">
                  {truncateAddress(facts.moveCall.package, 6)}::
                  {facts.moveCall.module}::
                  {facts.moveCall.function}
                </code>
              </div>
            )}

            <div className="flex justify-between items-start">
              <span className="text-sm font-medium text-cyan-300 font-mono">GAS USED:</span>
              <span className="text-sm font-mono text-cyan-400">{facts.gasUsedSui} SUI</span>
            </div>
          </div>

          {ai.transfers.length > 0 && (
            <>
              <Separator className="bg-cyan-500/20" />
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-cyan-300 font-mono">VALUE TRANSFERS:</h4>
                {ai.transfers.map((transfer, idx) => (
                  <div key={idx} className="text-xs bg-purple-500/10 border border-purple-500/30 p-3 rounded space-y-2">
                    <div className="flex justify-between">
                      <span className="text-purple-300 font-mono">FROM:</span>
                      <code className="text-purple-400">{truncateAddress(transfer.from, 6)}</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-300 font-mono">TO:</span>
                      <code className="text-purple-400">{truncateAddress(transfer.to, 6)}</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-300 font-mono">AMOUNT:</span>
                      <span className="font-bold text-purple-200">{transfer.amount}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {(facts.objectChanges.created.length > 0 ||
        facts.objectChanges.mutated.length > 0 ||
        facts.objectChanges.deleted.length > 0) && (
        <Card className="bg-[#0a0e1a]/80 border-cyan-500/30 glow-cyan backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-glow-cyan">
              <Box className="h-5 w-5 text-cyan-400" />
              OBJECT CHANGES
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {facts.objectChanges.created.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-green-400 mb-2 font-mono">
                  ✓ CREATED ({facts.objectChanges.created.length})
                </h4>
                <div className="space-y-1">
                  {facts.objectChanges.created.slice(0, 3).map((obj, idx) => (
                    <code key={idx} className="block text-xs bg-green-500/10 border border-green-500/30 px-2 py-1 rounded text-green-400">
                      {truncateAddress(obj, 8)}
                    </code>
                  ))}
                  {facts.objectChanges.created.length > 3 && (
                    <span className="text-xs text-green-400/70">
                      +{facts.objectChanges.created.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {facts.objectChanges.mutated.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-yellow-400 mb-2 font-mono">
                  ⚠ MUTATED ({facts.objectChanges.mutated.length})
                </h4>
                <div className="space-y-1">
                  {facts.objectChanges.mutated.slice(0, 3).map((obj, idx) => (
                    <code key={idx} className="block text-xs bg-yellow-500/10 border border-yellow-500/30 px-2 py-1 rounded text-yellow-400">
                      {truncateAddress(obj, 8)}
                    </code>
                  ))}
                  {facts.objectChanges.mutated.length > 3 && (
                    <span className="text-xs text-yellow-400/70">
                      +{facts.objectChanges.mutated.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {facts.objectChanges.deleted.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-red-400 mb-2 font-mono">
                  ✗ DELETED ({facts.objectChanges.deleted.length})
                </h4>
                <div className="space-y-1">
                  {facts.objectChanges.deleted.slice(0, 3).map((obj, idx) => (
                    <code key={idx} className="block text-xs bg-red-500/10 border border-red-500/30 px-2 py-1 rounded text-red-400">
                      {truncateAddress(obj, 8)}
                    </code>
                  ))}
                  {facts.objectChanges.deleted.length > 3 && (
                    <span className="text-xs text-red-400/70">
                      +{facts.objectChanges.deleted.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Button
        onClick={onReset}
        className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-400 hover:to-pink-500 text-white font-bold py-6 glow-purple"
      >
        <RefreshCw className="mr-2 h-5 w-5" />
        ANALYZE ANOTHER TRANSACTION
      </Button>
    </div>
  );
}
