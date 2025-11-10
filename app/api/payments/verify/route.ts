import { NextRequest, NextResponse } from 'next/server'
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { config, isValidNetwork } from '@/lib/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// This endpoint allows verifying a transaction by digest even if initial confirmation failed
export async function POST(req: NextRequest) {
  try {
    const { digest, network, packId, credits, priceInSui } = await req.json()

    if (!digest || !network) {
      return NextResponse.json(
        { error: 'Missing digest or network' },
        { status: 400 }
      )
    }

    if (!isValidNetwork(network)) {
      return NextResponse.json(
        { error: 'Invalid network' },
        { status: 400 }
      )
    }

    // Payments only work on mainnet
    if (network !== 'mainnet') {
      return NextResponse.json(
        { error: 'Payments are only available on Mainnet. Please switch to Mainnet network.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const client = new SuiClient({ url: getFullnodeUrl(network) })

    // Fetch transaction from blockchain
    let tx = null
    try {
      tx = await client.getTransactionBlock({
        digest,
        options: {
          showEffects: true,
          showBalanceChanges: true,
          showObjectChanges: true,
          showInput: true,
        },
      })
    } catch (error: any) {
      return NextResponse.json(
        { 
          error: 'Transaction not found on blockchain',
          details: error.message 
        },
        { status: 404 }
      )
    }

    if (!tx.effects || tx.effects.status.status !== 'success') {
      return NextResponse.json(
        { 
          error: 'Transaction failed on blockchain',
          status: tx.effects?.status?.status,
          errorDetails: tx.effects?.status?.error
        },
        { status: 400 }
      )
    }

    // Find payment to merchant
    const normalizeAddress = (addr: string) => {
      if (!addr) return ''
      return addr.toLowerCase().replace(/^0x/, '')
    }
    
    const merchantAddressNormalized = normalizeAddress(config.merchant.address)
    const balanceChanges = tx.balanceChanges || []
    
    let merchantChange = balanceChanges.find((change: any) => {
      let ownerAddress = ''
      if (typeof change.owner === 'string') {
        ownerAddress = change.owner
      } else if (change.owner && typeof change.owner === 'object') {
        ownerAddress = change.owner.AddressOwner || change.owner.ObjectOwner || Object.values(change.owner)[0] || ''
      }
      const normalizedOwner = normalizeAddress(ownerAddress)
      const coinType = change.coinType || change.coin_type || ''
      const amount = BigInt(change.amount || '0')
      return normalizedOwner === merchantAddressNormalized && 
             coinType === '0x2::sui::SUI' && 
             amount > BigInt(0)
    })

    if (!merchantChange) {
      return NextResponse.json(
        { error: 'Payment to merchant address not found in transaction' },
        { status: 400 }
      )
    }

    const amountMist = BigInt(merchantChange.amount || '0')
    
    // If pack details provided, use them; otherwise try to match by amount
    let finalPackId = packId
    let finalCredits = credits
    let finalPriceInSui = priceInSui

    if (!finalPackId || !finalCredits || !finalPriceInSui) {
      // Try to match by amount
      const amountSui = Number(amountMist) / 1_000_000_000
      const matchingPack = config.pricing.creditPacks.find(
        pack => Math.abs(pack.priceInSui - amountSui) < 0.1
      )
      if (matchingPack) {
        finalPackId = matchingPack.id
        finalCredits = matchingPack.credits
        finalPriceInSui = matchingPack.priceInSui
      } else {
        return NextResponse.json(
          { 
            error: 'Could not determine payment pack. Please provide packId, credits, and priceInSui.',
            amountReceived: amountSui.toString()
          },
          { status: 400 }
        )
      }
    }

    // Check if payment already exists
    const supabaseAdmin = createServiceRoleClient()
    const { data: existingPayment } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('tx_digest', digest)
      .maybeSingle()

    if (existingPayment) {
      // Payment already exists - check if it's for this user
      if (existingPayment.user_id !== session.user.id) {
        return NextResponse.json(
          { error: 'This transaction belongs to another user' },
          { status: 403 }
        )
      }
      
      // If not verified, verify it now
      if (!existingPayment.verified) {
        await supabaseAdmin
          .from('payments')
          .update({ verified: true })
          .eq('id', existingPayment.id)
      }

      // Update credits if not already done
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('credits')
        .eq('id', session.user.id)
        .maybeSingle()

      if (profile) {
        const currentCredits = profile.credits || 0
        const expectedCredits = currentCredits + existingPayment.credits_added
        
        // Only update if credits weren't added yet (safety check)
        if (currentCredits < expectedCredits) {
          await supabaseAdmin
            .from('user_profiles')
            .update({ credits: expectedCredits })
            .eq('id', session.user.id)
        }
      }

      return NextResponse.json({
        success: true,
        payment: existingPayment,
        message: 'Payment verified and credits updated'
      })
    }

    // Create new payment record
    const { data: newPayment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .insert({
        user_id: session.user.id,
        network,
        tx_digest: digest,
        amount_mist: amountMist.toString(),
        verified: true,
        credits_added: finalCredits,
        pack_id: finalPackId,
        receipt_url: `https://suiscan.xyz/${network}/tx/${digest}`,
      })
      .select()
      .single()

    if (paymentError) {
      console.error('Error creating payment:', paymentError)
      return NextResponse.json(
        { error: 'Failed to create payment record: ' + paymentError.message },
        { status: 500 }
      )
    }

    // Update user credits
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('credits')
      .eq('id', session.user.id)
      .maybeSingle()

    if (profile) {
      const currentCredits = profile.credits || 0
      const newCredits = currentCredits + finalCredits

      await supabaseAdmin
        .from('user_profiles')
        .update({ credits: newCredits })
        .eq('id', session.user.id)
    } else {
      // Create profile if it doesn't exist
      await supabaseAdmin
        .from('user_profiles')
        .insert({
          id: session.user.id,
          credits: finalCredits,
          free_explanations_used: 0,
        })
    }

    return NextResponse.json({
      success: true,
      payment: newPayment,
      credits_added: finalCredits,
      total_credits: (profile?.credits || 0) + finalCredits,
      message: 'Payment verified and credits added'
    })
  } catch (error: any) {
    console.error('Payment verification error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

