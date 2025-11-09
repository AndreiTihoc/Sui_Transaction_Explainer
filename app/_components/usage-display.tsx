"use client";

import { Activity, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface UsageDisplayProps {
  used: number;
  limit: number;
}

export function UsageDisplay({ used, limit }: UsageDisplayProps) {
  const remaining = limit - used;
  const percentage = (used / limit) * 100;

  const getColor = () => {
    if (remaining === 0) return "from-red-500 to-pink-600";
    if (remaining <= 2) return "from-yellow-500 to-orange-600";
    return "from-cyan-500 to-blue-600";
  };

  return (
    <Card className="bg-[#0a0e1a]/50 border-cyan-500/30 glow-cyan backdrop-blur-sm">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-cyan-400 animate-pulse-glow" />
            <span className="text-sm font-medium text-cyan-300">Usage Quota</span>
          </div>
          <div className="flex items-center gap-1 text-lg font-bold">
            <span className={`text-glow-cyan ${remaining === 0 ? 'text-red-400' : 'text-cyan-400'}`}>
              {remaining}
            </span>
            <span className="text-muted-foreground text-sm">/ {limit}</span>
          </div>
        </div>

        <div className="relative h-2 bg-[#0f1420] rounded-full overflow-hidden">
          <div
            className={`absolute top-0 left-0 h-full bg-gradient-to-r ${getColor()} transition-all duration-500 glow-cyan`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        <div className="mt-2 flex items-center gap-1 text-xs text-cyan-300/70">
          <Zap className="h-3 w-3" />
          <span>{used} explanations used</span>
        </div>
      </CardContent>
    </Card>
  );
}
