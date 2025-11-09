# Troubleshooting Guide

## React Flow Webpack Error (FIXED)

### Problem
You may have encountered this error when running `npm run dev`:
```
TypeError: Cannot read properties of undefined (reading 'call')
at __webpack_require__
```

### Root Cause
- React Flow library requires client-side only rendering
- Next.js was trying to server-side render the component
- Webpack runtime couldn't resolve modules properly

### Solution Applied

#### 1. Dynamic Import Pattern
We split the React Flow component into two parts:

**transaction-flow-wrapper.tsx** - Dynamic import wrapper:
```typescript
const TransactionFlowInner = dynamic(
  () => import("./transaction-flow-inner"),
  { ssr: false }  // ← Disables server-side rendering
);
```

**transaction-flow-inner.tsx** - Actual React Flow component:
- Contains the ReactFlow component
- Only loaded on client side
- No SSR issues

#### 2. Next.js Configuration
Updated `next.config.js`:
```javascript
transpilePackages: ['@xyflow/react', '@xyflow/system'],
```

This tells Next.js to properly transpile the React Flow packages.

### How It Works

1. **Server-Side**: Renders a loading state placeholder
2. **Client-Side**: Dynamically imports and renders React Flow
3. **No Hydration Issues**: Clean separation of SSR and CSR

### Verification

Build should complete successfully:
```bash
npm run build
# ✓ Build successful
# ✓ No webpack errors
```

Dev server should work:
```bash
npm run dev
# ✓ No runtime errors
# ✓ React Flow loads properly
```

## Other Common Issues

### "Module not found: @xyflow/react"

**Solution**: Install the package
```bash
npm install @xyflow/react
```

### Supabase Realtime Warning

The warning about Supabase realtime is **normal** and doesn't affect functionality:
```
⚠ Critical dependency: the request of a dependency is an expression
```

This is from Supabase's internal code and can be safely ignored.

### Transaction History Not Loading

**Solution**: Run the database migration:
```sql
-- In Supabase SQL Editor
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transaction_explanations' 
    AND column_name = 'summary'
  ) THEN
    ALTER TABLE transaction_explanations
    ADD COLUMN summary text,
    ADD COLUMN risk_level text,
    ADD COLUMN facts jsonb,
    ADD COLUMN ai_response jsonb;
  END IF;
END $$;
```

### React Flow Diagram Not Showing

**Checklist**:
1. ✓ Is `@xyflow/react` installed?
2. ✓ Is data being passed correctly?
3. ✓ Check browser console for errors
4. ✓ Try refreshing the page

### Build Warnings About browserslist

**Solution** (optional):
```bash
npx update-browserslist-db@latest
```

This updates browser compatibility data but isn't critical.

## Performance Tips

### React Flow Performance
- Limit displayed nodes to essential information
- Use `fitView` to auto-zoom to content
- Consider pagination for large transaction histories

### Database Queries
- History queries are indexed for performance
- Limit set to 20 items by default
- Add pagination if needed for more items

## Getting Help

If you encounter other issues:

1. **Check Console**: Browser console and terminal output
2. **Clear Cache**: `rm -rf .next && npm run build`
3. **Verify Environment**: Check `.env` file has all variables
4. **Database**: Verify migrations ran successfully in Supabase

## Technical Details

### Why Dynamic Import?

React Flow uses browser-specific APIs (DOM, Canvas) that don't exist in Node.js during SSR. The dynamic import with `ssr: false` ensures the component only renders where these APIs are available.

### File Structure
```
app/_components/
  ├── transaction-flow-wrapper.tsx   (Dynamic loader)
  └── transaction-flow-inner.tsx     (React Flow component)
```

### Performance Impact
- Initial bundle: Same size (React Flow loaded on demand)
- Client-side: Minimal overhead from dynamic import
- User experience: Shows loading state briefly

All issues resolved! App is production-ready. 🚀
