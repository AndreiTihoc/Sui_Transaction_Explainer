import { NextRequest, NextResponse } from 'next/server'
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { config, isValidNetwork, getCreditPackById } from '@/lib/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { digest, network } = await req.json()

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

    const client = new SuiClient({ url: getFullnodeUrl(network) })

    // Retry logic: transaction might not be immediately available on RPC
    let tx = null
    let lastError = null
    const maxRetries = 5
    const baseDelay = 1000 // 1 second

    for (let attempt = 0; attempt < maxRetries; attempt++) {
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
        break // Success, exit retry loop
      } catch (error: any) {
        lastError = error
        // If transaction not found and we have retries left, wait and retry
        if (error.message?.includes('Could not find') || error.message?.includes('not found')) {
          if (attempt < maxRetries - 1) {
            const delay = baseDelay * Math.pow(2, attempt) // Exponential backoff
            console.log(`Transaction not yet available, retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`)
            await new Promise(resolve => setTimeout(resolve, delay))
            continue
          }
        }
        // For other errors, throw immediately
        throw error
      }
    }

    if (!tx) {
      console.error('Failed to fetch transaction after retries:', lastError)
      return NextResponse.json(
        { 
          error: 'Transaction not yet available on the network. Please wait a few seconds and refresh, or check SuiScan directly.',
          digest,
          suiscanUrl: `https://suiscan.xyz/${network}/tx/${digest}`
        },
        { status: 404 }
      )
    }

    if (!tx.effects || tx.effects.status.status !== 'success') {
      return NextResponse.json(
        { error: 'Transaction failed or not found' },
        { status: 400 }
      )
    }

    // Normalize merchant address (remove 0x prefix if present, ensure lowercase)
    const normalizeAddress = (addr: string) => {
      if (!addr) return ''
      return addr.toLowerCase().replace(/^0x/, '')
    }
    
    const merchantAddressNormalized = normalizeAddress(config.merchant.address)
    
    // Log transaction structure for debugging
    console.log('Transaction structure:', {
      hasBalanceChanges: !!tx.balanceChanges,
      balanceChangesType: Array.isArray(tx.balanceChanges) ? 'array' : typeof tx.balanceChanges,
      hasObjectChanges: !!tx.objectChanges,
      objectChangesType: Array.isArray(tx.objectChanges) ? 'array' : typeof tx.objectChanges,
      hasEffects: !!tx.effects,
      hasInput: !!tx.transaction,
      merchantAddress: config.merchant.address,
      merchantAddressNormalized
    })
    
    // Log transaction input to see what was sent
    if (tx.transaction) {
      console.log('Transaction input:', JSON.stringify(tx.transaction, null, 2))
    }
    
    // Log balance changes for debugging
    const balanceChanges = tx.balanceChanges || []
    console.log('Balance changes:', JSON.stringify(balanceChanges, null, 2))
    console.log('Looking for merchant address:', config.merchant.address, 'normalized:', merchantAddressNormalized)
    
    // Find balance change to merchant address
    // Owner can be a string or an object like { AddressOwner: "0x..." }
    // Note: In Sui, balance changes can be positive (recipient) or negative (sender)
    // For a payment TO the merchant, we should see a POSITIVE amount for the merchant
    let merchantChange = balanceChanges.find((change: any) => {
      let ownerAddress = ''
      
      // Handle different owner formats
      if (typeof change.owner === 'string') {
        ownerAddress = change.owner
      } else if (change.owner && typeof change.owner === 'object') {
        // Could be { AddressOwner: "0x..." } or similar
        ownerAddress = change.owner.AddressOwner || change.owner.ObjectOwner || Object.values(change.owner)[0] || ''
      }
      
      const normalizedOwner = normalizeAddress(ownerAddress)
      const coinType = change.coinType || change.coin_type || ''
      const amount = change.amount || '0'
      const amountBigInt = BigInt(amount)
      
      // Check if this is the merchant address with SUI coin type
      const isMerchantAddress = normalizedOwner === merchantAddressNormalized
      const isSuiCoin = coinType === '0x2::sui::SUI'
      // For payment TO merchant, amount should be POSITIVE
      // But we'll also check if there's any change (positive) for the merchant
      const isPositiveAmount = amountBigInt > BigInt(0)
      
      console.log('Checking change:', {
        owner: ownerAddress,
        normalizedOwner,
        coinType,
        amount,
        amountBigInt: amountBigInt.toString(),
        isMerchantAddress,
        isSuiCoin,
        isPositiveAmount,
        matches: isMerchantAddress && isSuiCoin && isPositiveAmount
      })
      
      return isMerchantAddress && isSuiCoin && isPositiveAmount
    })
    
    // If not found with positive amount, check if merchant address appears at all
    // (might be a different transaction structure)
    if (!merchantChange) {
      console.log('No positive balance change found for merchant, checking all changes...')
      const merchantAddressInChanges = balanceChanges.some((change: any) => {
        let ownerAddress = ''
        if (typeof change.owner === 'string') {
          ownerAddress = change.owner
        } else if (change.owner && typeof change.owner === 'object') {
          ownerAddress = change.owner.AddressOwner || change.owner.ObjectOwner || Object.values(change.owner)[0] || ''
        }
        return normalizeAddress(ownerAddress) === merchantAddressNormalized
      })
      
      if (merchantAddressInChanges) {
        console.log('Merchant address found in balance changes but with non-positive amount. Checking transaction structure...')
        // Maybe the transaction structure is different - check all balance changes
        // and see if there's a corresponding positive change elsewhere
        const allPositiveChanges = balanceChanges.filter((change: any) => {
          const amount = BigInt(change.amount || '0')
          return amount > BigInt(0) && (change.coinType || change.coin_type) === '0x2::sui::SUI'
        })
        console.log('All positive SUI balance changes:', allPositiveChanges)
        
        // Check if there are any positive balance changes that might be the actual payment
        // The amount should match one of the credit pack prices
        const matchingPack = config.pricing.creditPacks.find(pack => {
          const requiredMist = Math.floor(pack.priceInSui * 1_000_000_000)
          return allPositiveChanges.some((change: any) => {
            const amount = BigInt(change.amount || '0')
            const amountNum = Number(amount)
            // Check if amount is close to required amount (within 10% tolerance)
            return amountNum >= requiredMist * 0.9 && amountNum <= requiredMist * 1.1
          })
        })
        
        if (matchingPack) {
          const requiredMist = Math.floor(matchingPack.priceInSui * 1_000_000_000)
          const positivePaymentChange = allPositiveChanges.find((change: any) => {
            const amount = BigInt(change.amount || '0')
            const amountNum = Number(amount)
            return amountNum >= requiredMist * 0.9 && amountNum <= requiredMist * 1.1
          })
          
          if (positivePaymentChange) {
            // Found a positive change with the right amount - check if it's to merchant
            let ownerAddress = ''
            if (typeof positivePaymentChange.owner === 'string') {
              ownerAddress = positivePaymentChange.owner
            } else if (positivePaymentChange.owner && typeof positivePaymentChange.owner === 'object') {
              const owner = positivePaymentChange.owner as any
              ownerAddress = owner.AddressOwner || owner.ObjectOwner || Object.values(owner)[0] || ''
            }
            const normalizedOwner = normalizeAddress(ownerAddress)
            
            if (normalizedOwner === merchantAddressNormalized) {
              merchantChange = positivePaymentChange
              console.log('Found payment in positive balance changes:', merchantChange)
            } else {
              console.log('Found positive payment but to different address:', normalizedOwner, 'expected:', merchantAddressNormalized)
            }
          }
        }
      }
    }
    
    // If not found in balanceChanges, try objectChanges as fallback to find the recipient
    if (!merchantChange && tx.objectChanges) {
      console.log('Trying objectChanges as fallback...')
      const objectChanges = Array.isArray(tx.objectChanges) ? tx.objectChanges : []
      console.log('Object changes:', JSON.stringify(objectChanges, null, 2))
      
      // Look for created or transferred objects to merchant address
      const matchingObjectChange = objectChanges.find((change: any) => {
        if (change.type !== 'created' && change.type !== 'transferred') return false
        
        let recipientAddress = ''
        if (change.type === 'transferred') {
          recipientAddress = change.recipient || ''
        } else if (change.type === 'created') {
          const owner = change.owner
          if (typeof owner === 'string') {
            recipientAddress = owner
          } else if (owner && typeof owner === 'object') {
            recipientAddress = owner.AddressOwner || owner.ObjectOwner || Object.values(owner)[0] || ''
          }
        }
        
        const normalizedRecipient = normalizeAddress(recipientAddress)
        // Extract coin type from objectType (format: "0x2::coin::Coin<0x2::sui::SUI>")
        const objectType = change.objectType || ''
        const isSuiCoin = objectType.includes('0x2::sui::SUI') || objectType.includes('coin::Coin<0x2::sui::SUI>')
        
        console.log('Checking object change:', {
          type: change.type,
          recipient: recipientAddress,
          normalizedRecipient,
          objectType,
          isSuiCoin,
          matches: normalizedRecipient === merchantAddressNormalized && isSuiCoin
        })
        
        return normalizedRecipient === merchantAddressNormalized && isSuiCoin
      })
      
      // If found in objectChanges, try to find corresponding balance change
      if (matchingObjectChange) {
        console.log('Found matching object change, looking for corresponding balance change...')
        const correspondingBalanceChange = balanceChanges.find((bc: any) => {
          let ownerAddress = ''
          if (typeof bc.owner === 'string') {
            ownerAddress = bc.owner
          } else if (bc.owner && typeof bc.owner === 'object') {
            ownerAddress = bc.owner.AddressOwner || bc.owner.ObjectOwner || Object.values(bc.owner)[0] || ''
          }
          const normalizedOwner = normalizeAddress(ownerAddress)
          const amount = BigInt(bc.amount || '0')
          // Only use positive balance changes (actual payments, not gas)
          return normalizedOwner === merchantAddressNormalized && amount > BigInt(0)
        })
        
        if (correspondingBalanceChange) {
          merchantChange = correspondingBalanceChange
          console.log('Found corresponding positive balance change:', merchantChange)
        } else {
          // If we found the transfer but no positive balance change, use transaction inputs
          console.log('No positive balance change found, will use transaction inputs to get payment amount')
          // We'll handle this in the transaction inputs check below
        }
      }
    }

    // If still not found (or found object change but no positive balance), check transaction inputs
    // Sometimes the balance changes don't show the recipient clearly, or only show negative (gas)
    if (!merchantChange && tx.transaction) {
      console.log('Payment not found in balance changes or objectChanges, checking transaction inputs...')
      const txData = tx.transaction as any
      
      // Check transaction inputs for the merchant address
      // The structure is: tx.transaction.data.transaction.inputs
      const inputs = txData.data?.transaction?.inputs || txData.data?.inputs || []
      console.log('Transaction inputs:', JSON.stringify(inputs, null, 2))
      
      if (inputs.length > 0) {
        let foundMerchantAddress = false
        let paymentAmount = 0
        
        // First, check if merchant address is in inputs
        for (const input of inputs) {
          if (input.type === 'pure' && input.valueType === 'address') {
            const inputAddr = typeof input.value === 'string' ? input.value : input.value?.Address || input.value?.address || ''
            if (normalizeAddress(inputAddr) === merchantAddressNormalized) {
              foundMerchantAddress = true
              console.log('Found merchant address in transaction inputs!')
              break
            }
          }
        }
        
        // If merchant address found, get the payment amount from inputs
        if (foundMerchantAddress) {
          // Look for u64 input that matches a credit pack price
          for (const pack of config.pricing.creditPacks) {
            const requiredMist = Math.floor(pack.priceInSui * 1_000_000_000)
            for (const input of inputs) {
              if (input.type === 'pure' && input.valueType === 'u64') {
                const amountValue = typeof input.value === 'string' 
                  ? (input.value.startsWith('0x') ? parseInt(input.value, 16) : parseInt(input.value, 10))
                  : typeof input.value === 'number'
                  ? input.value
                  : parseInt(String(input.value), 10)
                
                // Check if this amount is close to expected payment (within 10% tolerance)
                if (amountValue > 0 && amountValue >= requiredMist * 0.9 && amountValue <= requiredMist * 1.1) {
                  paymentAmount = amountValue
                  console.log('Found payment amount in inputs:', paymentAmount)
                  break
                }
              }
            }
            if (paymentAmount > 0) break
          }
          
          if (paymentAmount > 0) {
            merchantChange = {
              owner: { AddressOwner: config.merchant.address },
              coinType: '0x2::sui::SUI',
              amount: String(paymentAmount)
            } as any
            console.log('Using transaction input verification, payment amount:', paymentAmount)
          }
        }
      }
      
      // Also check transaction commands for TransferObjects
      if (!merchantChange) {
        const transactions = txData.data?.transaction?.transactions || txData.data?.transactions || []
        console.log('Transaction commands:', JSON.stringify(transactions, null, 2))
        
        for (const cmd of transactions) {
          if (cmd.TransferObjects) {
            const recipients = cmd.TransferObjects[1]
            if (Array.isArray(recipients)) {
              for (const recipient of recipients) {
                if (recipient && typeof recipient === 'object') {
                  const recipientAddr = recipient.Address || recipient.address || ''
                  if (normalizeAddress(recipientAddr) === merchantAddressNormalized) {
                    console.log('Found merchant address in TransferObjects command')
                    // Find matching pack by checking all packs
                    const matchingPack = config.pricing.creditPacks.find(pack => {
                      const requiredMist = Math.floor(pack.priceInSui * 1_000_000_000)
                      // Check inputs for this amount
                      const allInputs = txData.data?.transaction?.inputs || txData.data?.inputs || []
                      return allInputs.some((input: any) => {
                        if (input.type === 'pure' && input.valueType === 'u64') {
                          const amountValue = typeof input.value === 'string' 
                            ? (input.value.startsWith('0x') ? parseInt(input.value, 16) : parseInt(input.value, 10))
                            : typeof input.value === 'number'
                            ? input.value
                            : parseInt(String(input.value), 10)
                          return amountValue >= requiredMist * 0.9 && amountValue <= requiredMist * 1.1
                        }
                        return false
                      })
                    })
                    
                    if (matchingPack) {
                      const requiredMist = Math.floor(matchingPack.priceInSui * 1_000_000_000)
                      merchantChange = {
                        owner: { AddressOwner: config.merchant.address },
                        coinType: '0x2::sui::SUI',
                        amount: String(requiredMist)
                      } as any
                      console.log('Using transaction command verification, payment amount:', requiredMist)
                      break
                    }
                  }
                } else if (typeof recipient === 'string') {
                  if (normalizeAddress(recipient) === merchantAddressNormalized) {
                    console.log('Found merchant address in TransferObjects command (string)')
                    // Similar logic as above
                    const matchingPack = config.pricing.creditPacks.find(pack => {
                      const requiredMist = Math.floor(pack.priceInSui * 1_000_000_000)
                      const allInputs = txData.data?.transaction?.inputs || txData.data?.inputs || []
                      return allInputs.some((input: any) => {
                        if (input.type === 'pure' && input.valueType === 'u64') {
                          const amountValue = typeof input.value === 'string' 
                            ? (input.value.startsWith('0x') ? parseInt(input.value, 16) : parseInt(input.value, 10))
                            : typeof input.value === 'number'
                            ? input.value
                            : parseInt(String(input.value), 10)
                          return amountValue >= requiredMist * 0.9 && amountValue <= requiredMist * 1.1
                        }
                        return false
                      })
                    })
                    
                    if (matchingPack) {
                      const requiredMist = Math.floor(matchingPack.priceInSui * 1_000_000_000)
                      merchantChange = {
                        owner: { AddressOwner: config.merchant.address },
                        coinType: '0x2::sui::SUI',
                        amount: String(requiredMist)
                      } as any
                      console.log('Using transaction command verification, payment amount:', requiredMist)
                      break
                    }
                  }
                } else if (typeof recipient === 'object' && recipient.Input !== undefined) {
                  // Might be a reference to an input index
                  const inputIndex = recipient.Input
                  const allInputs = txData.data?.transaction?.inputs || txData.data?.inputs || []
                  if (allInputs[inputIndex]) {
                    const input = allInputs[inputIndex]
                    if (input.type === 'pure' && input.valueType === 'address') {
                      const inputAddr = typeof input.value === 'string' ? input.value : input.value?.Address || ''
                      if (normalizeAddress(inputAddr) === merchantAddressNormalized) {
                        console.log('Found merchant address via input reference in TransferObjects')
                        // Find matching pack
                        const matchingPack = config.pricing.creditPacks.find(pack => {
                          const requiredMist = Math.floor(pack.priceInSui * 1_000_000_000)
                          return allInputs.some((input: any) => {
                            if (input.type === 'pure' && input.valueType === 'u64') {
                              const amountValue = typeof input.value === 'string' 
                                ? (input.value.startsWith('0x') ? parseInt(input.value, 16) : parseInt(input.value, 10))
                                : typeof input.value === 'number'
                                ? input.value
                                : parseInt(String(input.value), 10)
                              return amountValue >= requiredMist * 0.9 && amountValue <= requiredMist * 1.1
                            }
                            return false
                          })
                        })
                        
                        if (matchingPack) {
                          const requiredMist = Math.floor(matchingPack.priceInSui * 1_000_000_000)
                          merchantChange = {
                            owner: { AddressOwner: config.merchant.address },
                            coinType: '0x2::sui::SUI',
                            amount: String(requiredMist)
                          } as any
                          console.log('Using transaction input reference verification, payment amount:', requiredMist)
                          break
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    if (!merchantChange) {
      console.error('Merchant payment not found. Balance changes:', balanceChanges)
      console.error('Merchant address expected:', config.merchant.address)
      console.error('Transaction input:', JSON.stringify(tx.transaction, null, 2))
      return NextResponse.json(
        { 
          error: 'Payment not found to merchant address',
          debug: {
            merchantAddress: config.merchant.address,
            balanceChangesCount: balanceChanges.length,
            balanceChanges: balanceChanges.map((bc: any) => ({
              owner: bc.owner,
              coinType: bc.coinType || bc.coin_type,
              amount: bc.amount
            })),
            hasObjectChanges: !!tx.objectChanges,
            objectChangesCount: Array.isArray(tx.objectChanges) ? tx.objectChanges.length : 0
          }
        },
        { status: 400 }
      )
    }

    const amountMist = BigInt(merchantChange.amount || '0')
    const amountSui = Number(amountMist) / 1_000_000_000
    
    console.log('Payment found:', {
      amountMist: amountMist.toString(),
      amountSui: amountSui.toString(),
      merchantChange
    })
    
    // Match payment amount to a pack (with 10% tolerance)
    const matchingPack = config.pricing.creditPacks.find(
      pack => {
        const diff = Math.abs(pack.priceInSui - amountSui)
        const tolerance = pack.priceInSui * 0.1
        return diff <= tolerance
      }
    )
    
    if (!matchingPack) {
      return NextResponse.json(
        { 
          error: `Payment amount ${amountSui.toFixed(4)} SUI doesn't match any credit pack. Expected: ${config.pricing.creditPacks.map(p => `${p.priceInSui} SUI`).join(', ')}`,
          received: amountSui.toString(),
          digest,
          suiscanUrl: `https://suiscan.xyz/${network}/tx/${digest}`
        },
        { status: 400 }
      )
    }
    
    const packId = matchingPack.id
    const credits = matchingPack.credits
    const priceInSui = matchingPack.priceInSui
    const requiredMist = BigInt(Math.floor(priceInSui * 1_000_000_000))
    
    if (amountMist < requiredMist) {
      return NextResponse.json(
        { error: 'Insufficient payment amount' },
        { status: 400 }
      )
    }

    // Now check for session - transaction is verified, but we need session to credit user
    // Build a per-request Supabase client that can refresh and set cookies on the response
    const supabaseResponse = NextResponse.next()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return req.cookies.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            supabaseResponse.cookies.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            supabaseResponse.cookies.set({ name, value: '', ...options, maxAge: 0 })
          },
        },
      }
    )

    // Helper to merge any refreshed Supabase cookies into our JSON responses
    const withSupabaseCookies = (response: NextResponse) => {
      const refreshed = supabaseResponse.cookies.getAll()
      for (const c of refreshed) {
        response.cookies.set(c)
      }
      return response
    }
    
    // Use Supabase's built-in methods to get session or user, supporting both cookies and Authorization header
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || ''
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : undefined
    const { data: { user }, error: userError } = accessToken
      ? await supabase.auth.getUser(accessToken)
      : await supabase.auth.getUser()

    const finalUserId = session?.user?.id || user?.id
    const userEmail = session?.user?.email || user?.email || null

    // Log session check for debugging
    console.log('Session check:', {
      hasSession: !!session,
      hasUser: !!user,
      finalUserId: finalUserId,
      sessionError: sessionError?.message,
      userError: userError?.message
    })
    
    if (!finalUserId) {
      // Transaction is verified but no session - return success but indicate user needs to sign in
      console.warn('Transaction verified but no session found. User may need to refresh or sign in again.')
      return withSupabaseCookies(NextResponse.json({
        success: true,
        verified: true,
        message: 'Transaction verified on-chain. Sign in again or refresh to claim credits.',
        credits_added: credits,
        receipt_url: `https://suiscan.xyz/${network}/tx/${digest}`,
        requires_auth: true,
      }))
    }

    // Use service role client for payment operations (bypasses RLS)
    const supabaseAdmin = createServiceRoleClient()
    
    // First, ensure user profile exists (create if it doesn't)
    // Note: Profile creation requires user to exist in auth.users (foreign key constraint)
    const { data: existingProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id, credits')
      .eq('id', finalUserId)
      .maybeSingle()
    
    if (!existingProfile) {
      console.log('User profile does not exist, attempting to create it...')
      
      // Try to verify user exists in auth.users by getting user info
      // If user doesn't exist in auth.users, we can't create profile (foreign key constraint)
      let userExists = false
      let authUserEmail: string | null = null
      
      try {
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(finalUserId)
        userExists = !!authUser?.user && !authError
        authUserEmail = authUser?.user?.email || null
        
        if (userExists) {
          console.log('User exists in auth.users, creating profile...', { email: authUserEmail })
        } else {
          console.log('User does not exist in auth.users:', authError?.message)
        }
      } catch (e: any) {
        console.log('Could not verify user in auth.users:', e?.message || e)
        // If we can't verify via admin API, try to create profile anyway
        // The foreign key constraint will catch it if user doesn't exist
        userExists = true
      }
      
      // Try to create profile - if user doesn't exist, foreign key will fail
      const profileEmail = userEmail || `user-${finalUserId}@example.com`
      
      const { error: createProfileError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          id: finalUserId,
          email: profileEmail,
          credits: 0,
          free_explanations_used: 0,
        })
      
      if (createProfileError) {
        // If it's a foreign key error, user doesn't exist in auth.users
        if (createProfileError.code === '23503') {
          console.error('User does not exist in auth.users. Cannot create profile.')
          console.error('User ID from cookie:', finalUserId)
          return withSupabaseCookies(NextResponse.json(
            { 
              error: 'User account not found in authentication system. Please sign out and sign in again.',
              details: 'Your session cookie references a user that no longer exists. Please refresh your session.',
              requires_reauth: true
            },
            { status: 404 }
          ))
        }
        console.error('Error creating user profile:', createProfileError)
        return withSupabaseCookies(NextResponse.json(
          { error: 'Failed to create user profile: ' + createProfileError.message },
          { status: 500 }
        ))
      }
      console.log('User profile created successfully')
    }
    
    // Check if payment already exists
    const { data: existingPayment } = await supabaseAdmin
      .from('payments')
      .select('id, verified, user_id')
      .eq('tx_digest', digest)
      .maybeSingle()

    if (existingPayment) {
      // Payment already exists - check if it's for this user and verified
      if (existingPayment.user_id !== finalUserId) {
        return withSupabaseCookies(NextResponse.json(
          { error: 'This transaction was already used by another user' },
          { status: 400 }
        ))
      }
      if (!existingPayment.verified) {
        // Update to verified if it wasn't before
        await supabaseAdmin
          .from('payments')
          .update({ verified: true })
          .eq('id', existingPayment.id)
      }
      console.log('Payment already exists, proceeding to update credits...')
    } else {
      // Insert new payment record
      const { error: paymentError } = await supabaseAdmin.from('payments').insert({
        user_id: finalUserId,
        network,
        tx_digest: digest,
        amount_mist: amountMist.toString(),
        verified: true,
        credits_added: credits,
        pack_id: packId,
        receipt_url: `https://suiscan.xyz/${network}/tx/${digest}`,
      })

      if (paymentError) {
        console.error('Error inserting payment:', paymentError)
        return withSupabaseCookies(NextResponse.json(
          { error: 'Failed to record payment: ' + paymentError.message },
          { status: 500 }
        ))
      }
      console.log('Payment record inserted successfully')
    }

    // Get current profile to update credits
    const { data: profile, error: profileFetchError } = await supabaseAdmin
      .from('user_profiles')
      .select('credits')
      .eq('id', finalUserId)
      .maybeSingle()

    if (profileFetchError) {
      console.error('Error fetching profile:', profileFetchError)
      return withSupabaseCookies(NextResponse.json(
        { error: 'Failed to fetch profile: ' + profileFetchError.message },
        { status: 500 }
      ))
    }

    let totalCredits = credits
    if (!profile) {
      // Create profile if it doesn't exist
      const { error: createError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          id: finalUserId,
          credits: credits,
          free_explanations_used: 0,
        })

      if (createError) {
        console.error('Error creating profile:', createError)
        return withSupabaseCookies(NextResponse.json(
          { error: 'Failed to create profile: ' + createError.message },
          { status: 500 }
        ))
      }
    } else {
      // Update credits
      const currentCredits = profile.credits || 0
      totalCredits = currentCredits + credits

      const { error: profileUpdateError, data: updatedProfile } = await supabaseAdmin
        .from('user_profiles')
        .update({
          credits: totalCredits
        })
        .eq('id', finalUserId)
        .select('credits')
        .single()

      if (profileUpdateError) {
        console.error('Error updating profile:', profileUpdateError)
        console.error('Profile update error details:', JSON.stringify(profileUpdateError, null, 2))
        return withSupabaseCookies(NextResponse.json(
          { 
            error: 'Payment recorded but failed to update credits. Please contact support.',
            details: profileUpdateError.message
          },
          { status: 500 }
        ))
      }

      if (!updatedProfile) {
        console.error('Profile update returned no data')
        return withSupabaseCookies(NextResponse.json(
          { error: 'Profile update completed but no data returned. Please refresh.' },
          { status: 500 }
        ))
      }
    }

    console.log('Payment confirmed and credits updated:', {
      userId: finalUserId,
      txDigest: digest,
      creditsAdded: credits,
      totalCredits: totalCredits
    })

    return withSupabaseCookies(NextResponse.json({
      success: true,
      credits_added: credits,
      total_credits: totalCredits,
      receipt_url: `https://suiscan.xyz/${network}/tx/${digest}`,
    }))
  } catch (error: any) {
    console.error('Payment confirmation error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

