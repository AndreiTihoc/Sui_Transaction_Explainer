import { NextResponse } from 'next/server'
import { config } from '@/lib/config'

export async function GET() {
  return NextResponse.json({
    merchantAddress: config.merchant.address,
    networks: config.networks,
    pricing: config.pricing,
  })
}

