"use client"

import { useState, useEffect } from 'react'
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClient, useSuiClientContext } from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

interface PayWithSuiProps {
  packId: string
  credits: number
  priceInSui: number
  onSuccess?: () => void
}

export function PayWithSui({ packId, credits, priceInSui, onSuccess }: PayWithSuiProps) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [txDigest, setTxDigest] = useState('')
  const [network, setNetwork] = useState('mainnet')
  const [isSignedIn, setIsSignedIn] = useState(false)
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction()
  const currentAccount = useCurrentAccount()
  const suiClient = useSuiClient()
  const { network: providerNetwork, config } = useSuiClientContext()
  
  // Payments only work on mainnet
  const currentNetwork = 'mainnet'
  const isMainnet =
    providerNetwork === 'mainnet' ||
    (typeof config?.url === 'string' && config.url.includes('mainnet'))

  // Check if user is signed in
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsSignedIn(!!session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSignedIn(!!session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handlePay = async () => {
    if (!currentAccount) {
      setMessage('Please connect your wallet first')
      return
    }

    // Payments only work on mainnet
    if (!isMainnet) {
      setMessage('Payments are only available on Mainnet. Please switch your wallet to Mainnet network.')
      return
    }

    // Check if user is signed in before proceeding
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setMessage('Please sign in to your account first. Your payment will be credited to your account after you sign in.')
      return
    }

    setLoading(true)
    setMessage('')
    setTxDigest('')

    try {
      const configRes = await fetch('/api/config')
      const config = await configRes.json()

      const amountMist = BigInt(Math.floor(priceInSui * 1_000_000_000))

      const tx = new Transaction()
      const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountMist)])
      tx.transferObjects([coin], tx.pure.address(config.merchantAddress))

      const result = await signAndExecute({
        transaction: tx,
      })

      setTxDigest(result.digest)
      setNetwork(currentNetwork)
      setMessage('Transaction submitted! Waiting for confirmation...')

      // Wait 5 seconds for transaction to propagate on the network
      await new Promise(resolve => setTimeout(resolve, 5000))

      // Include the Supabase session access token so the API can authenticate even if cookies aren't present
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (currentSession?.access_token) {
        headers.Authorization = `Bearer ${currentSession.access_token}`
      }

      const confirmRes = await fetch('/api/payments/confirm', {
        method: 'POST',
        headers,
        credentials: 'include', // Include cookies for session
        cache: 'no-store',
        body: JSON.stringify({
          digest: result.digest,
          network: currentNetwork,
        }),
      })

      const confirmData = await confirmRes.json()

      if (!confirmRes.ok) {
        // If transaction exists but confirmation failed, show helpful message
        if (confirmData.suiscanUrl) {
          setMessage(`Transaction submitted! However, confirmation is pending. Your transaction is on-chain. Please wait a moment and refresh, or check the transaction on SuiScan.`)
        } else {
          throw new Error(confirmData.error || 'Payment confirmation failed')
        }
      } else {
        // Check if transaction was verified but requires authentication
        if (confirmData.requires_auth) {
          setMessage(`Transaction verified on blockchain! ${confirmData.message || 'Please sign in to receive your credits.'}`)
        } else {
          setMessage(`Payment successful! You've received ${confirmData.credits_added || credits} credits.`)
          setTimeout(() => {
            if (onSuccess) onSuccess()
          }, 500)
        }
      }
    } catch (err: any) {
      // Check for specific error types
      let errorMsg = err.message || 'An unexpected error occurred'
      
      // Handle insufficient balance errors
      if (errorMsg.includes('InsufficientCoinBalance') || errorMsg.includes('insufficient')) {
        errorMsg = `Insufficient balance. Please ensure you have enough SUI to cover the payment amount plus gas fees (approximately 0.001-0.01 SUI).`
      }
      // Handle transaction execution errors
      else if (errorMsg.includes('Execution failed') || errorMsg.includes('Transaction failed')) {
        errorMsg = 'Transaction failed. Please check your wallet balance and try again.'
      }
      
      setMessage(`Error: ${errorMsg}`)
    } finally {
      setLoading(false)
    }
  }

  const suiscanUrl = txDigest
    ? `https://suiscan.xyz/${network}/tx/${txDigest}`
    : ''

  return (
    <div className="space-y-4">
      {!isMainnet && (
        <div className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 p-2 rounded space-y-1">
          <div className="font-semibold mb-1">⚠️ Mainnet Required</div>
          <div>Payments are only available on Mainnet. Please switch your wallet to Mainnet network to proceed.</div>
        </div>
      )}
      <Button
        onClick={handlePay}
        disabled={loading || !currentAccount || !isMainnet}
        className="w-full bg-cyan-500 hover:bg-cyan-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Processing...' : `Pay ${priceInSui} SUI`}
      </Button>

      {message && (
        <div className={`text-sm p-3 rounded space-y-2 ${
          message.includes('Error') || message.includes('pending')
            ? 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/20'
            : message.includes('successful')
            ? 'text-green-400 bg-green-500/10 border border-green-500/20'
            : 'text-red-400 bg-red-500/10 border border-red-500/20'
        }`}>
          <div>{message}</div>
          {suiscanUrl && (
            <a
              href={suiscanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1 text-cyan-400 hover:text-cyan-300 text-xs"
            >
              <span>View transaction on SuiScan</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {message.includes('pending') && txDigest && (
            <Button
              onClick={async () => {
                setLoading(true)
                try {
                  const { data: { session: retrySession } } = await supabase.auth.getSession()
                  const retryHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
                  if (retrySession?.access_token) {
                    retryHeaders.Authorization = `Bearer ${retrySession.access_token}`
                  }
                  const retryRes = await fetch('/api/payments/confirm', {
                    method: 'POST',
                    headers: retryHeaders,
                    credentials: 'include', // REQUIRED so sb-* cookies are sent
                    cache: 'no-store',
                    body: JSON.stringify({
                      digest: txDigest,
                      network: currentNetwork,
                    }),
                  })
                  const retryData = await retryRes.json()
                  if (retryRes.ok) {
                    setMessage(`Payment successful! You've received ${retryData.credits_added || credits} credits.`)
                    if (onSuccess) onSuccess()
                  } else {
                    setMessage(retryData.error || 'Still pending. Please wait a bit longer.')
                  }
                } catch (err: any) {
                  setMessage(`Error: ${err.message}`)
                } finally {
                  setLoading(false)
                }
              }}
              variant="outline"
              size="sm"
              className="mt-2 text-xs"
            >
              Retry Confirmation
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

