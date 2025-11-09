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
  RefreshCw
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
      return "bg-green-500";
    case "medium":
      return "bg-yellow-500";
    case "high":
      return "bg-red-500";
    default:
      return "bg-gray-500";
  }
}

function getStatusIcon(status: string) {
  if (status === "success") {
    return <CheckCircle2 className="h-5 w-5 text-green-500" />;
  }
  return <XCircle className="h-5 w-5 text-red-500" />;
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
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle>Transaction Summary</CardTitle>
              <CardDescription className="font-mono text-xs">
                {truncateAddress(digest, 12)}
              </CardDescription>
            </div>
            <Badge className={getRiskColor(ai.risk_level)}>
              {ai.risk_level.toUpperCase()} RISK
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm leading-relaxed">
              {ai.summary}
            </AlertDescription>
          </Alert>

          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">Status:</span>
            <div className="flex items-center gap-1">
              {getStatusIcon(facts.status)}
              <span className="capitalize">{facts.status}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">Network:</span>
            <Badge variant="outline">{network}</Badge>
          </div>

          <div>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 hover:underline"
            >
              View in Explorer
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>

      {ai.actions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {ai.actions.map((action, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <span className="text-muted-foreground mt-0.5">•</span>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Transaction Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            <div className="flex justify-between items-start">
              <span className="text-sm font-medium text-muted-foreground">Sender</span>
              <code className="text-xs bg-muted px-2 py-1 rounded">
                {truncateAddress(facts.sender, 8)}
              </code>
            </div>

            {facts.recipients.length > 0 && (
              <div className="flex justify-between items-start">
                <span className="text-sm font-medium text-muted-foreground">Recipients</span>
                <div className="flex flex-col items-end gap-1">
                  {facts.recipients.map((recipient, idx) => (
                    <code key={idx} className="text-xs bg-muted px-2 py-1 rounded">
                      {truncateAddress(recipient, 8)}
                    </code>
                  ))}
                </div>
              </div>
            )}

            {facts.moveCall && (
              <div className="flex justify-between items-start">
                <span className="text-sm font-medium text-muted-foreground">Function Call</span>
                <code className="text-xs bg-muted px-2 py-1 rounded max-w-[60%] break-all">
                  {truncateAddress(facts.moveCall.package, 6)}::
                  {facts.moveCall.module}::
                  {facts.moveCall.function}
                </code>
              </div>
            )}

            <div className="flex justify-between items-start">
              <span className="text-sm font-medium text-muted-foreground">Gas Used</span>
              <span className="text-sm font-mono">{facts.gasUsedSui} SUI</span>
            </div>
          </div>

          {ai.transfers.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Transfers</h4>
                {ai.transfers.map((transfer, idx) => (
                  <div key={idx} className="text-xs bg-muted p-3 rounded space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">From:</span>
                      <code>{truncateAddress(transfer.from, 6)}</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">To:</span>
                      <code>{truncateAddress(transfer.to, 6)}</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount:</span>
                      <span className="font-medium">{transfer.amount}</span>
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Box className="h-5 w-5" />
              Object Changes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {facts.objectChanges.created.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-green-600 mb-2">
                  Created ({facts.objectChanges.created.length})
                </h4>
                <div className="space-y-1">
                  {facts.objectChanges.created.slice(0, 3).map((obj, idx) => (
                    <code key={idx} className="block text-xs bg-muted px-2 py-1 rounded">
                      {truncateAddress(obj, 8)}
                    </code>
                  ))}
                  {facts.objectChanges.created.length > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{facts.objectChanges.created.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {facts.objectChanges.mutated.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-yellow-600 mb-2">
                  Mutated ({facts.objectChanges.mutated.length})
                </h4>
                <div className="space-y-1">
                  {facts.objectChanges.mutated.slice(0, 3).map((obj, idx) => (
                    <code key={idx} className="block text-xs bg-muted px-2 py-1 rounded">
                      {truncateAddress(obj, 8)}
                    </code>
                  ))}
                  {facts.objectChanges.mutated.length > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{facts.objectChanges.mutated.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {facts.objectChanges.deleted.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-red-600 mb-2">
                  Deleted ({facts.objectChanges.deleted.length})
                </h4>
                <div className="space-y-1">
                  {facts.objectChanges.deleted.slice(0, 3).map((obj, idx) => (
                    <code key={idx} className="block text-xs bg-muted px-2 py-1 rounded">
                      {truncateAddress(obj, 8)}
                    </code>
                  ))}
                  {facts.objectChanges.deleted.length > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{facts.objectChanges.deleted.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Button onClick={onReset} variant="outline" className="w-full">
        <RefreshCw className="mr-2 h-4 w-4" />
        Explain Another Transaction
      </Button>
    </div>
  );
}
