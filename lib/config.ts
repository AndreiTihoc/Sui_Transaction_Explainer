export const config = {
  merchant: {
    address: process.env.MERCHANT_SUI_ADDRESS || '0x0000000000000000000000000000000000000000000000000000000000000000',
  },
  networks: {
    allowed: (process.env.ALLOWED_NETWORKS || 'mainnet,testnet').split(','),
    default: process.env.NEXT_PUBLIC_DEFAULT_NETWORK || process.env.SUI_DEFAULT_NETWORK || 'mainnet',
  },
  pricing: {
    creditPacks: [
      {
        id: 'basic',
        name: 'Basic',
        credits: 10,
        priceInSui: 1,
      },
      {
        id: 'starter',
        name: 'Starter',
        credits: 30,
        priceInSui: 3,
      },
      {
        id: 'pro',
        name: 'Pro',
        credits: 70,
        priceInSui: 6,
      },
      {
        id: 'max',
        name: 'Max',
        credits: 100,
        priceInSui: 8,
      },
    ],
    freeExplanations: 5,
    costPerExplanation: 1, // 1 credit per explanation
  },
} as const

export type NetworkType = 'mainnet' | 'testnet'

export function isValidNetwork(network: string): network is NetworkType {
  return config.networks.allowed.includes(network)
}

export function getCreditPackById(id: string) {
  return config.pricing.creditPacks.find(pack => pack.id === id)
}

