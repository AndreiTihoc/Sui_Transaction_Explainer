"use client";

import { useState, useEffect } from "react";
import { supabase, getUserCredits, useExplanation, refundExplanation, saveExplanation, getUserTransactionHistory, type TransactionExplanation } from "@/lib/supabase";
import { TransactionForm } from "./_components/transaction-form";
import { TransactionResult } from "./_components/transaction-result";
import { TransactionFlow } from "./_components/transaction-flow-wrapper";
import { TransactionHistory } from "./_components/transaction-history";
import { AuthModal } from "./_components/auth-modal";
import { PricingModal } from "./_components/pricing-modal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, LogOut, Zap, Shield, History, CreditCard } from "lucide-react";
import type { SuiNetwork } from "@/lib/sui";
import type { TransactionFacts } from "@/lib/parse";
import { mapSuiTxToGraph } from "@/lib/mapSuiTxToGraph";
import { config } from "@/lib/config";

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

interface ExplainResponse {
  digest: string;
  network: SuiNetwork;
  facts: TransactionFacts;
  ai: AIResponse;
}

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [credits, setCredits] = useState(0);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExplainResponse | null>(null);
  const [history, setHistory] = useState<TransactionExplanation[]>([]);
  const [activeTab, setActiveTab] = useState("analyze");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      if (session?.user) {
        loadCredits(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setUser(session?.user || null);
        if (session?.user) {
          await loadCredits(session.user.id);
        } else {
          setCredits(0);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadCredits = async (userId: string) => {
    try {
      const userCredits = await getUserCredits(userId);
      setCredits(userCredits);
      const historyData = await getUserTransactionHistory(userId, 20);
      setHistory(historyData);
    } catch (err) {
      console.error("Failed to load credits:", err);
    }
  };

  const handleSubmit = async (digest: string, network: SuiNetwork) => {
    if (!user) {
      setShowAuthModal(true);
      setError("Please sign in to analyze transactions");
      return;
    }

    // Check if user has credits or free explanations
    if (credits <= 0) {
      setShowPricingModal(true);
      setError("You've used all your free explanations. Please purchase credits to continue.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    let explanationUsed = { usedFree: false, usedCredit: false };
    
    try {
      // Use a credit or free explanation before making the API call
      explanationUsed = await useExplanation(user.id);

      const response = await fetch("/api/explain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ digest, network }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to explain transaction");
        // Refund the credit if API call failed
        await refundExplanation(user.id, explanationUsed.usedFree, explanationUsed.usedCredit);
        await loadCredits(user.id);
        return;
      }

      setResult(data);
      await saveExplanation(
        user.id,
        digest,
        network,
        data.ai.summary,
        data.ai.risk_level,
        data.facts,
        data.ai
      );
      await loadCredits(user.id);
      setActiveTab("analyze");
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
      // Refund the credit if there was an error
      if (explanationUsed.usedFree || explanationUsed.usedCredit) {
        try {
          await refundExplanation(user.id, explanationUsed.usedFree, explanationUsed.usedCredit);
        } catch (refundErr) {
          console.error("Failed to refund explanation:", refundErr);
        }
      }
      await loadCredits(user.id);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setCredits(0);
    setResult(null);
    setError(null);
    setHistory([]);
  };

  const handleSelectHistoryItem = (item: TransactionExplanation) => {
    if (item.facts && item.ai_response) {
      setResult({
        digest: item.digest,
        network: item.network as SuiNetwork,
        facts: item.facts,
        ai: item.ai_response,
      });
      setActiveTab("analyze");
      setError(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0e1a] grid-bg relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-purple-500/5 pointer-events-none" />

      <div className="container mx-auto px-4 py-8 max-w-5xl relative z-10">
        <header className="text-center mb-8 space-y-4">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Shield className="h-12 w-12 text-cyan-400 animate-pulse-glow" />
            <h1 className="text-5xl font-bold tracking-tight text-glow-cyan">
              SUI TX DECODER
            </h1>
          </div>
          <p className="text-cyan-300/70 text-lg font-mono">
            &gt; Blockchain transaction analysis powered by AI
          </p>

          <div className="flex items-center justify-center gap-4 pt-4">
            {user ? (
              <>
                <div className="flex items-center gap-2 text-sm text-cyan-400 font-mono bg-cyan-500/10 px-4 py-2 rounded border border-cyan-500/30">
                  <Zap className="h-4 w-4" />
                  <span>{user.email}</span>
                </div>
                <Button
                  onClick={handleSignOut}
                  variant="outline"
                  size="sm"
                  className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </>
            ) : (
              <Button
                onClick={() => setShowAuthModal(true)}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 glow-cyan"
              >
                <Shield className="h-4 w-4 mr-2" />
                Sign In to Start
              </Button>
            )}
          </div>
        </header>

        {user && (
          <div className="mb-6 flex items-center justify-center gap-4">
            <div className="flex items-center gap-2 text-sm text-cyan-400 font-mono bg-cyan-500/10 px-4 py-2 rounded border border-cyan-500/30">
              <Zap className="h-4 w-4" />
              <span>Credits: {credits}</span>
            </div>
            <Button
              onClick={() => setShowPricingModal(true)}
              variant="outline"
              size="sm"
              className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Buy Credits
            </Button>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 bg-cyan-500/10 border border-cyan-500/30">
            <TabsTrigger
              value="analyze"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-blue-600 data-[state=active]:text-white font-mono"
            >
              <Zap className="h-4 w-4 mr-2" />
              ANALYZE
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-600 data-[state=active]:text-white font-mono"
            >
              <History className="h-4 w-4 mr-2" />
              HISTORY ({history.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analyze" className="space-y-6">
            {!result && <TransactionForm onSubmit={handleSubmit} isLoading={isLoading} />}

            {error && (
              <Alert variant="destructive" className="bg-red-900/20 border-red-500/50 glow-pink">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="font-mono">ERROR</AlertTitle>
                <AlertDescription className="font-mono text-sm">{error}</AlertDescription>
              </Alert>
            )}

            {result && (
              <>
                <TransactionResult
                  digest={result.digest}
                  network={result.network}
                  facts={result.facts}
                  ai={result.ai}
                  onReset={handleReset}
                />
                <TransactionFlow
                  nodes={mapSuiTxToGraph(result.facts, result.ai).nodes}
                  edges={mapSuiTxToGraph(result.facts, result.ai).edges}
                />
              </>
            )}
          </TabsContent>

          <TabsContent value="history">
            <TransactionHistory
              history={history}
              onSelectTransaction={handleSelectHistoryItem}
            />
          </TabsContent>
        </Tabs>

        <footer className="mt-16 text-center space-y-2">
          <div className="text-xs text-cyan-400/50 font-mono">
            <p>[ POWERED BY SUI BLOCKCHAIN ]</p>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-cyan-400/30 font-mono">
            <Zap className="h-3 w-3 animate-pulse-glow" />
            <span>SECURE • FAST • DECENTRALIZED</span>
            <Zap className="h-3 w-3 animate-pulse-glow" />
          </div>
        </footer>
      </div>

      <AuthModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        onSuccess={() => {
          setError(null);
        }}
      />

      <PricingModal
        open={showPricingModal}
        onOpenChange={setShowPricingModal}
        userCredits={credits}
        onSuccess={() => {
          if (user) {
            loadCredits(user.id);
          }
          setError(null);
        }}
      />
    </div>
  );
}
