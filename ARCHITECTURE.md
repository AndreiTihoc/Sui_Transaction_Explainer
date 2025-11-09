# Architecture Overview

This document provides a technical overview of the Sui Transaction Explainer application architecture.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client (Browser)                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Next.js App (React Components)                        │ │
│  │  - Transaction Form                                    │ │
│  │  - Transaction Result Display                          │ │
│  │  - Transaction Visualization                           │ │
│  └────────────────┬───────────────────────────────────────┘ │
└────────────────────┼───────────────────────────────────────┘
                     │ HTTP POST
                     │ /api/explain
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                      Next.js API Route                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Server-Side Processing                                │ │
│  │  1. Rate Limiting (IP-based)                           │ │
│  │  2. Input Validation & Normalization                   │ │
│  │  3. Sui RPC Call                                       │ │
│  │  4. Transaction Parsing                                │ │
│  │  5. AI Analysis                                        │ │
│  │  6. Response Formatting                                │ │
│  └──────────┬──────────────────────┬──────────────────────┘ │
└─────────────┼──────────────────────┼──────────────────────┘
              │                      │
              │ JSON-RPC             │ REST API
              ▼                      ▼
┌──────────────────────┐  ┌──────────────────────┐
│   Sui RPC Node       │  │  Google Gemini AI    │
│   (Mainnet/Testnet)  │  │  (2.5 Flash)         │
└──────────────────────┘  └──────────────────────┘
```

## Component Architecture

### Frontend Components (`app/`)

#### Main Page (`app/page.tsx`)
- **Purpose**: Entry point and state orchestration
- **Responsibilities**:
  - Manage application state (loading, error, result)
  - Handle form submission
  - Coordinate API calls
  - Display results or errors
- **State Management**: React hooks (useState)

#### Transaction Form (`app/_components/transaction-form.tsx`)
- **Purpose**: User input interface
- **Features**:
  - Network selector (mainnet/testnet)
  - Digest/URL input field
  - Submit button with loading state
  - Client-side validation
- **Props**: `{ onSubmit, isLoading }`

#### Transaction Result (`app/_components/transaction-result.tsx`)
- **Purpose**: Display parsed transaction details
- **Sections**:
  - Summary card with risk badge
  - Action list
  - Transaction details (sender, recipients, gas)
  - Transfer information
  - Object changes (created, mutated, deleted)
  - Reset button
- **Props**: `{ digest, network, facts, ai, onReset }`

#### Transaction Visualization (`app/_components/transaction-viz.tsx`)
- **Purpose**: Visual representation of value flow
- **Implementation**: SVG-based diagram
- **Shows**:
  - Sender node
  - Recipient nodes
  - Transfer arrows with amounts
- **Props**: `{ sender, recipients, transfers }`

### Backend API (`app/api/explain/route.ts`)

#### Request Flow

1. **Rate Limiting**
   - Check IP address against rate limit map
   - Allow: 10 requests per 60-second window
   - Return 429 if exceeded

2. **Input Validation**
   - Validate required fields
   - Normalize digest (extract from URL if needed)
   - Validate format

3. **Sui RPC Call**
   ```typescript
   suiClient.getTransactionBlock({
     digest,
     options: {
       showEffects: true,
       showEvents: true,
       showBalanceChanges: true,
       showInput: true,
       showObjectChanges: true,
     }
   })
   ```

4. **Transaction Parsing**
   - Extract sender, recipients, gas costs
   - Parse Move calls (package::module::function)
   - Identify object changes
   - Format balance changes

5. **AI Analysis**
   - Construct prompt with transaction data
   - Call Gemini 2.5 Flash with JSON response mode
   - Parse AI response

6. **Response**
   ```json
   {
     "digest": "...",
     "network": "mainnet",
     "facts": { /* parsed data */ },
     "ai": { /* AI analysis */ }
   }
   ```

### Library Utilities (`lib/`)

#### Sui Client (`lib/sui.ts`)
```typescript
getSuiClient(network): SuiClient
formatSuiAmount(amount): string
extractDigestFromUrl(input): string
```

**Key Functions**:
- Create network-specific Sui clients
- Format SUI amounts (9 decimals)
- Extract digests from various Explorer URLs

#### AI Client (`lib/ai.ts`)
```typescript
getAIClient(): GoogleGenerativeAI
getAIModel(): GenerativeModel
```

**Features**:
- Server-only Gemini client initialization
- Reusable model configuration
- System prompt for transaction analysis

#### Transaction Parser (`lib/parse.ts`)
```typescript
parseTransactionData(tx): TransactionFacts
```

**Extracts**:
- Basic info (digest, sender, status, timestamp)
- Gas calculation (computation + storage - rebate)
- Balance changes with owner identification
- Move call details (package, module, function)
- Recipients list
- Object changes (created, mutated, deleted)
- Events

#### Rate Limiter (`lib/rate-limiter.ts`)
```typescript
checkRateLimit(identifier): { allowed, remaining, resetTime }
```

**Implementation**:
- In-memory Map for rate limit tracking
- Sliding window algorithm
- Automatic cleanup of expired entries
- IP-based identification

## Data Models

### TransactionFacts
```typescript
{
  digest: string
  sender: string
  checkpoint?: string
  timestampMs?: string
  status: string
  gasUsedSui: string
  balanceChanges: Array<{
    owner: string
    coinType: string
    amount: string
  }>
  moveCall?: {
    package: string
    module: string
    function: string
  }
  recipients: string[]
  objectChanges: {
    created: string[]
    mutated: string[]
    deleted: string[]
  }
  events: Array<{
    type: string
    sender?: string
  }>
}
```

### AIResponse
```typescript
{
  risk_level: "low" | "medium" | "high"
  summary: string
  actions: string[]
  transfers: Array<{
    from: string
    to: string
    amount: string
    coinType: string
  }>
  objects: {
    created: string[]
    mutated: string[]
    deleted: string[]
  }
  gas_sui: string
}
```

## Security Considerations

### Server-Side Only Operations
- All API keys stored in server environment
- AI calls never exposed to client
- Rate limiting enforced server-side

### Input Validation
- Digest format validation
- Network selection validation
- SQL injection prevention (no DB queries)
- XSS prevention (React auto-escaping)

### Rate Limiting
- IP-based tracking
- 10 requests per minute
- Prevents API abuse
- Automatic cleanup

### Error Handling
- Graceful degradation
- User-friendly error messages
- No sensitive information in errors
- Proper HTTP status codes

## Performance Optimizations

### Client-Side
- Component-level code splitting
- Lazy loading of results
- Minimal state updates
- Optimized re-renders

### Server-Side
- Efficient JSON parsing
- Minimal data transformation
- Parallel processing where possible
- No unnecessary API calls

### Network
- Compressed responses
- Minimal payload sizes
- Proper HTTP caching headers
- CDN-ready static assets

## Scalability Considerations

### Current Limitations
- In-memory rate limiting (single instance)
- No request caching
- Synchronous processing
- No queue system

### Future Improvements
1. **Distributed Rate Limiting**: Redis or similar
2. **Response Caching**: Cache frequent transactions
3. **Queue System**: Background processing for AI calls
4. **Database**: Store transaction analyses
5. **CDN**: Static asset optimization
6. **Load Balancing**: Multiple server instances

## Monitoring & Observability

### Recommended Metrics
- API response times
- Error rates by type
- Rate limit hits
- AI API latency
- Sui RPC latency

### Logging
- Structured logs
- Error stack traces
- Request IDs for tracing
- Performance metrics

## Deployment Architecture

```
                    ┌─────────────┐
                    │     CDN     │
                    │  (Static)   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   Vercel    │
                    │  Edge Fns   │
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐
    │ Sui RPC   │   │ Gemini AI │   │  Logging  │
    │  Nodes    │   │    API    │   │  Service  │
    └───────────┘   └───────────┘   └───────────┘
```

### Recommended Platforms
- **Vercel**: Optimal for Next.js (recommended)
- **Netlify**: Good alternative
- **Railway**: Simple deployment
- **AWS Amplify**: Enterprise option
- **Self-hosted**: Full control

## Technology Choices

### Why Next.js?
- Server-side rendering capability
- API routes for backend logic
- Excellent TypeScript support
- Production-ready out of the box
- Great developer experience

### Why Sui SDK?
- Official TypeScript support
- Well-documented API
- Active maintenance
- Type-safe operations

### Why Gemini 2.5 Flash?
- Fast response times
- JSON output mode
- Cost-effective
- High quality explanations
- Free tier available

### Why shadcn/ui?
- Customizable components
- Accessibility built-in
- Tailwind CSS integration
- Modern design
- Copy-paste approach (no dependencies)

## Development Workflow

1. **Local Development**: `npm run dev`
2. **Type Checking**: `npm run typecheck`
3. **Linting**: `npm run lint`
4. **Building**: `npm run build`
5. **Testing**: Manual testing (no automated tests yet)
6. **Deployment**: Push to main branch (Vercel auto-deploys)

## Future Enhancements

### Short Term
- Add request/response caching
- Implement proper logging
- Add analytics tracking
- Improve error messages

### Medium Term
- Multi-language support
- Transaction comparison
- History tracking
- Export functionality

### Long Term
- Real-time notifications
- Advanced visualizations
- Batch processing
- Custom AI fine-tuning
