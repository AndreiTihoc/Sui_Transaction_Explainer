"use client"

import { useState, useEffect } from 'react'
import { Check, Zap, Wallet, Receipt } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PayWithSui } from './pay-with-sui'
import { PaymentReceipts } from './payment-receipts'
import { ConnectButton } from '@mysten/dapp-kit'
import { config } from '@/lib/config'
import { supabase } from '@/lib/supabase'

interface PricingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userCredits: number
  onSuccess?: () => void
}

export function PricingModal({ open, onOpenChange, userCredits, onSuccess }: PricingModalProps) {
  const [selectedPack, setSelectedPack] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('buy')
  const [userId, setUserId] = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id || null)
    })
  }, [open])

  const handleSuccess = () => {
    setSelectedPack(null)
    setRefreshTrigger(prev => prev + 1) // Trigger refresh of receipts
    if (onSuccess) {
      onSuccess()
      // Don't close modal immediately, let user see the receipt
      setTimeout(() => {
        setActiveTab('receipts')
      }, 1000)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-5xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 [&>div]:overflow-visible">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl">Buy Credits</DialogTitle>
          <DialogDescription className="text-slate-400 text-sm sm:text-base">
            Each explanation costs 1 credit. Connect your wallet to purchase credits.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4">
          <div className="text-sm text-slate-400 mb-2">Current Credits</div>
          <div className="text-2xl font-bold text-cyan-400">{userCredits}</div>
        </div>

        <div className="mb-4 relative z-50">
          <ConnectButton />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-slate-800/50 border border-slate-700">
            <TabsTrigger value="buy" className="data-[state=active]:bg-cyan-500 data-[state=active]:text-white">
              <Zap className="h-4 w-4 mr-2" />
              Buy Credits
            </TabsTrigger>
            <TabsTrigger value="receipts" className="data-[state=active]:bg-cyan-500 data-[state=active]:text-white">
              <Receipt className="h-4 w-4 mr-2" />
              Receipts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="buy" className="mt-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {config.pricing.creditPacks.map((pack) => (
            <Card
              key={pack.id}
              className={`bg-slate-800/50 border-slate-700 relative ${
                selectedPack === pack.id ? 'border-cyan-500 ring-2 ring-cyan-500/50' : ''
              }`}
            >
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl text-white flex items-center justify-between">
                  {pack.name}
                  {pack.id === 'pro' && (
                    <Badge className="bg-cyan-500 text-white text-xs">
                      <Zap className="w-3 h-3 mr-1" />
                      Popular
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-slate-400">
                  <span className="text-2xl sm:text-3xl font-bold text-white">{pack.priceInSui} SUI</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6 pt-0">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Check className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                    <div className="text-white">
                      <span className="font-semibold">{pack.credits} Credits</span>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">
                    {pack.credits} explanations
                  </div>
                </div>

                {selectedPack === pack.id ? (
                  <div className="space-y-3">
                    <PayWithSui
                      packId={pack.id}
                      credits={pack.credits}
                      priceInSui={pack.priceInSui}
                      onSuccess={handleSuccess}
                    />
                    <Button
                      variant="ghost"
                      onClick={() => setSelectedPack(null)}
                      className="w-full text-slate-400"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() => setSelectedPack(pack.id)}
                    className="w-full bg-cyan-500 hover:bg-cyan-600 text-white"
                  >
                    Select Pack
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
          </TabsContent>

          <TabsContent value="receipts" className="mt-4">
            {userId ? (
              <PaymentReceipts userId={userId} refreshTrigger={refreshTrigger} />
            ) : (
              <div className="text-sm text-slate-400 text-center py-4">
                Please sign in to view your receipts
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="mt-6 p-4 bg-slate-800/30 rounded-lg border border-slate-700">
          <div className="text-sm text-slate-400">
            <div className="font-semibold text-white mb-2">Payment Information</div>
            <ul className="space-y-1 text-xs">
              <li>• Payment is processed via SUI blockchain transfer</li>
              <li>• Each explanation costs 1 credit</li>
              <li>• Payments are verified on-chain automatically</li>
              <li>• Non-custodial: your wallet, your keys</li>
              <li>• Transaction receipt will be saved as a SuiScan link</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

