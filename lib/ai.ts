import { GoogleGenerativeAI } from "@google/generative-ai";

export function getAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }

  return new GoogleGenerativeAI(apiKey);
}

export function getAIModel() {
  const genAI = getAIClient();
  return genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
}

export const TRANSACTION_EXPLAINER_PROMPT = `
You are a Sui blockchain transaction explainer. Your job is to analyze raw Sui transaction data and provide a clear, accurate explanation.

Given a Sui transaction JSON, produce:
1. A concise plain-language summary (2-3 sentences) that explains what happened
2. A risk assessment (low, medium, or high)
3. A list of key actions taken
4. Details about transfers (coins/objects)
5. Information about objects created, mutated, or deleted
6. Gas used in SUI

Return STRICT JSON with this exact structure:
{
  "risk_level": "low" | "medium" | "high",
  "summary": "Plain language explanation of what this transaction does",
  "actions": ["Action 1", "Action 2", ...],
  "transfers": [
    {
      "from": "address or 'system'",
      "to": "address",
      "amount": "amount with unit (e.g., '1.5 SUI' or 'Object 0x123...')",
      "coinType": "coin type or 'object'"
    }
  ],
  "objects": {
    "created": ["objectId1", "objectId2", ...],
    "mutated": ["objectId1", "objectId2", ...],
    "deleted": ["objectId1", "objectId2", ...]
  },
  "gas_sui": "gas amount in SUI"
}

Guidelines:
- Be concise and accurate
- Do not hallucinate or make up information
- If something is unknown or unclear, say "unknown"
- Risk level: low (simple transfers), medium (smart contract calls), high (unusual patterns or large values)
- For transfers, include the actual amounts when available
- Explain technical details in simple terms
`.trim();
