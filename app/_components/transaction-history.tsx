"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, ExternalLink, AlertCircle } from "lucide-react";
import type { TransactionExplanation } from "@/lib/supabase";
import { formatDistanceToNow } from "date-fns";

interface TransactionHistoryProps {
  history: TransactionExplanation[];
  onSelectTransaction: (item: TransactionExplanation) => void;
}

function truncateDigest(digest: string): string {
  if (digest.length <= 16) return digest;
  return `${digest.slice(0, 8)}...${digest.slice(-8)}`;
}

function getRiskColor(risk?: string): string {
  switch (risk) {
    case "low":
      return "bg-green-500/20 text-green-400 border-green-500/50";
    case "medium":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50";
    case "high":
      return "bg-red-500/20 text-red-400 border-red-500/50";
    default:
      return "bg-gray-500/20 text-gray-400 border-gray-500/50";
  }
}

export function TransactionHistory({ history, onSelectTransaction }: TransactionHistoryProps) {
  if (history.length === 0) {
    return (
      <Card className="bg-[#0a0e1a]/80 border-cyan-500/30 glow-cyan backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-glow-cyan flex items-center gap-2">
            <Clock className="h-5 w-5 text-cyan-400" />
            TRANSACTION HISTORY
          </CardTitle>
          <CardDescription className="text-cyan-300/70 font-mono text-xs">
            Your analyzed transactions will appear here
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-12 w-12 text-cyan-400/30 mb-3" />
            <p className="text-cyan-300/50 text-sm font-mono">No transaction history yet</p>
            <p className="text-cyan-300/30 text-xs font-mono mt-1">
              Analyze your first transaction to get started
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#0a0e1a]/80 border-cyan-500/30 glow-cyan backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-glow-cyan flex items-center gap-2">
          <Clock className="h-5 w-5 text-cyan-400" />
          TRANSACTION HISTORY
        </CardTitle>
        <CardDescription className="text-cyan-300/70 font-mono text-xs">
          Click on any transaction to view details
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {history.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelectTransaction(item)}
                className="w-full text-left transition-all hover:scale-[1.02]"
              >
                <div className="bg-cyan-500/5 border border-cyan-500/30 rounded-lg p-4 hover:bg-cyan-500/10 hover:border-cyan-500/50 transition-all">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <code className="text-sm font-mono text-cyan-400 block truncate">
                        {truncateDigest(item.digest)}
                      </code>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          variant="outline"
                          className="text-xs font-mono border-cyan-500/50 text-cyan-400"
                        >
                          {item.network?.toUpperCase() || "UNKNOWN"}
                        </Badge>
                        {item.risk_level && (
                          <Badge
                            variant="outline"
                            className={`text-xs font-mono ${getRiskColor(item.risk_level)}`}
                          >
                            {item.risk_level.toUpperCase()}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-cyan-400/50 flex-shrink-0" />
                  </div>

                  {item.summary && (
                    <p className="text-xs text-cyan-300/70 line-clamp-2 mb-2">
                      {item.summary}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-cyan-400/50 font-mono">
                      {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    </span>
                    <span className="text-cyan-400/70 font-mono hover:text-cyan-300">
                      View Details →
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
