"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Zap } from "lucide-react";

interface Transfer {
  from: string;
  to: string;
  amount: string;
  coinType: string;
}

interface TransactionVizProps {
  sender: string;
  recipients: string[];
  transfers: Transfer[];
}

function truncateAddress(address: string, chars = 6): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function TransactionViz({ sender, recipients, transfers }: TransactionVizProps) {
  if (recipients.length === 0 && transfers.length === 0) {
    return null;
  }

  const displayRecipients = recipients.length > 0 ? recipients : transfers.map(t => t.to);
  const uniqueRecipients = Array.from(new Set(displayRecipients));

  return (
    <Card className="bg-[#0a0e1a]/80 border-cyan-500/30 glow-cyan backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-glow-cyan flex items-center gap-2">
          <Zap className="h-5 w-5 text-cyan-400" />
          VALUE FLOW VISUALIZATION
        </CardTitle>
        <CardDescription className="text-cyan-300/70 font-mono text-xs">
           Mapping of transaction pathways
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6 py-4">
          <div className="flex items-center justify-center">
            <div className="bg-gradient-to-r from-cyan-500/20 to-blue-600/20 px-6 py-3 rounded-lg border-2 border-cyan-500 glow-cyan">
              <div className="text-xs text-cyan-400 mb-1 font-mono">[ORIGIN]</div>
              <code className="text-sm font-mono text-cyan-50 font-bold">{truncateAddress(sender, 8)}</code>
            </div>
          </div>

          <div className="flex flex-col items-center gap-4">
            {uniqueRecipients.map((recipient, idx) => {
              const relevantTransfers = transfers.filter(t => t.to === recipient);
              const hasTransferInfo = relevantTransfers.length > 0;

              return (
                <div key={idx} className="w-full flex items-center gap-4">
                  <div className="flex-1 flex items-center justify-end gap-3">
                    <div className="flex-1 h-0.5 bg-gradient-to-r from-cyan-500/50 to-purple-500/50 glow-cyan" />
                    <ArrowRight className="h-6 w-6 text-purple-400 animate-pulse-glow" />
                    {hasTransferInfo && (
                      <div className="text-right">
                        {relevantTransfers.map((t, tIdx) => (
                          <div key={tIdx} className="text-xs text-purple-300 font-mono font-bold">
                            {t.amount}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="bg-gradient-to-r from-purple-500/20 to-pink-600/20 px-6 py-3 rounded-lg border-2 border-purple-500 glow-purple min-w-[200px]">
                    <div className="text-xs text-purple-400 mb-1 font-mono">[TARGET-{idx + 1}]</div>
                    <code className="text-sm font-mono text-purple-50 font-bold">{truncateAddress(recipient, 8)}</code>
                  </div>
                </div>
              );
            })}
          </div>

          {transfers.length > 0 && (
            <div className="mt-6 pt-4 border-t border-cyan-500/20">
              <div className="text-xs text-cyan-400/70 text-center font-mono">
                <Zap className="inline h-3 w-3 mr-1" />
                TOTAL TRANSFERS: {transfers.length}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
