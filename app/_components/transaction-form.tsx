"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Loader2, Hexagon } from "lucide-react";
import type { SuiNetwork } from "@/lib/sui";

interface TransactionFormProps {
  onSubmit: (digest: string, network: SuiNetwork) => void;
  isLoading: boolean;
}

export function TransactionForm({ onSubmit, isLoading }: TransactionFormProps) {
  const [digest, setDigest] = useState("");
  const [network, setNetwork] = useState<SuiNetwork>("mainnet");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (digest.trim()) {
      onSubmit(digest.trim(), network);
    }
  };

  return (
    <Card className="w-full bg-[#0a0e1a]/80 border-cyan-500/30 glow-cyan backdrop-blur-xl scan-line">
      <CardHeader className="relative">
        <div className="absolute top-4 right-4">
          <Hexagon className="h-8 w-8 text-cyan-400/20 animate-pulse-glow" />
        </div>
        <CardTitle className="text-2xl font-bold text-glow-cyan flex items-center gap-2">
          <span className="text-cyan-400">&gt;_</span>
          Analyze Transaction
        </CardTitle>
        <CardDescription className="text-cyan-300/70">
          Input transaction digest or explorer URL to decode blockchain data
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="network" className="text-cyan-300 font-mono text-sm">
              [NETWORK SELECTION]
            </Label>
            <Select
              value={network}
              onValueChange={(value) => setNetwork(value as SuiNetwork)}
              disabled={isLoading}
            >
              <SelectTrigger
                id="network"
                className="bg-[#0f1420] border-cyan-500/30 text-cyan-50 hover:border-cyan-400 focus:ring-cyan-400/50 glow-cyan font-mono"
              >
                <SelectValue placeholder="Select network" />
              </SelectTrigger>
              <SelectContent className="bg-[#0f1420] border-cyan-500/30">
                <SelectItem value="mainnet" className="text-cyan-50 focus:bg-cyan-500/20 focus:text-cyan-50">
                  MAINNET
                </SelectItem>
                <SelectItem value="testnet" className="text-cyan-50 focus:bg-cyan-500/20 focus:text-cyan-50">
                  TESTNET
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="digest" className="text-cyan-300 font-mono text-sm">
              [TX DIGEST / EXPLORER URL]
            </Label>
            <Input
              id="digest"
              placeholder="0x... or https://suiscan.xyz/..."
              value={digest}
              onChange={(e) => setDigest(e.target.value)}
              disabled={isLoading}
              className="bg-[#0f1420] border-cyan-500/30 text-cyan-50 placeholder:text-cyan-700 hover:border-cyan-400 focus:border-cyan-400 focus:ring-cyan-400/50 glow-cyan font-mono"
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:via-blue-500 hover:to-purple-500 text-white font-bold text-lg py-6 glow-cyan"
            disabled={isLoading || !digest.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ANALYZING...
              </>
            ) : (
              <>
                <Search className="mr-2 h-5 w-5" />
                INITIATE ANALYSIS
              </>
            )}
          </Button>

          {isLoading && (
            <div className="text-center">
              <div className="inline-flex items-center gap-2 text-xs text-cyan-400/70 font-mono">
                <span className="animate-pulse">▸</span>
                <span>Connecting to blockchain nodes...</span>
              </div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
