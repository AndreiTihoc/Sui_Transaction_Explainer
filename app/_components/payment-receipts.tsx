"use client"

import { useState, useEffect } from 'react'
import { ExternalLink, CheckCircle, Clock, XCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getUserPaymentHistory, type PaymentReceipt } from '@/lib/supabase'
import { config } from '@/lib/config'

interface PaymentReceiptsProps {
  userId: string
  refreshTrigger?: number
}

export function PaymentReceipts({ userId, refreshTrigger }: PaymentReceiptsProps) {
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReceipts()
  }, [userId, refreshTrigger])

  const loadReceipts = async () => {
    try {
      const data = await getUserPaymentHistory(userId, 20)
      setReceipts(data)
    } catch (err) {
      console.error('Failed to load receipts:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const formatAmount = (mist: string) => {
    const sui = Number(mist) / 1_000_000_000
    return `${sui.toFixed(4)} SUI`
  }

  const getPackName = (packId: string) => {
    const pack = config.pricing.creditPacks.find(p => p.id === packId)
    return pack?.name || packId.toUpperCase()
  }

  if (loading) {
    return (
      <div className="text-sm text-slate-400 text-center py-4">
        Loading receipts...
      </div>
    )
  }

  if (receipts.length === 0) {
    return (
      <div className="text-sm text-slate-400 text-center py-4">
        No payment receipts yet. Purchase credits to see your receipts here.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-white mb-2">Payment History</div>
      {receipts.map((receipt) => (
        <Card key={receipt.id} className="bg-slate-800/50 border-slate-700">
          <CardHeader className="p-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-white">
                {getPackName(receipt.pack_id)} - {receipt.credits_added} Credits
              </CardTitle>
              <Badge 
                variant={receipt.verified ? "default" : "secondary"}
                className={receipt.verified ? "bg-green-500/20 text-green-400 border-green-500/50" : "bg-yellow-500/20 text-yellow-400 border-yellow-500/50"}
              >
                {receipt.verified ? (
                  <>
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Verified
                  </>
                ) : (
                  <>
                    <Clock className="w-3 h-3 mr-1" />
                    Pending
                  </>
                )}
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-400">
              {formatDate(receipt.created_at)} • {formatAmount(receipt.amount_mist)} • {receipt.network}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-400 font-mono">
                {receipt.tx_digest.slice(0, 20)}...
              </div>
              <a
                href={receipt.receipt_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 text-cyan-400 hover:text-cyan-300 text-xs"
              >
                <span>View on SuiScan</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

