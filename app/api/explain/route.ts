import { NextRequest, NextResponse } from "next/server";
import { getSuiClient, extractDigestFromUrl, type SuiNetwork } from "@/lib/sui";
import { getAIModel, TRANSACTION_EXPLAINER_PROMPT } from "@/lib/ai";
import { parseTransactionData } from "@/lib/parse";
import { checkRateLimit } from "@/lib/rate-limiter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ExplainRequest {
  digest: string;
  network: SuiNetwork;
}

interface AIResponse {
  risk_level: "low" | "medium" | "high";
  summary: string;
  actions: string[];
  transfers: Array<{
    from: string;
    to: string;
    amount: string;
    coinType: string;
  }>;
  objects: {
    created: string[];
    mutated: string[];
    deleted: string[];
  };
  gas_sui: string;
}

export async function POST(request: NextRequest) {
  try {
    const clientIP =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const rateLimitResult = checkRateLimit(clientIP);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Please try again later.",
          resetTime: rateLimitResult.resetTime,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": rateLimitResult.resetTime.toString(),
          },
        }
      );
    }

    const body = (await request.json()) as ExplainRequest;

    if (!body.digest) {
      return NextResponse.json(
        { error: "Transaction digest is required" },
        { status: 400 }
      );
    }

    const network = body.network || "mainnet";
    const normalizedDigest = extractDigestFromUrl(body.digest);

    if (!normalizedDigest || normalizedDigest.length < 10) {
      return NextResponse.json(
        { error: "Invalid transaction digest format" },
        { status: 400 }
      );
    }

    const suiClient = getSuiClient(network);

    let txData;
    try {
      txData = await suiClient.getTransactionBlock({
        digest: normalizedDigest,
        options: {
          showEffects: true,
          showEvents: true,
          showBalanceChanges: true,
          showInput: true,
          showObjectChanges: true,
        },
      });
    } catch (error: any) {
      if (error?.message?.includes("not found") || error?.code === -32602) {
        return NextResponse.json(
          {
            error:
              "Transaction not found. Please check the digest and network selection.",
          },
          { status: 404 }
        );
      }
      throw error;
    }

    const facts = parseTransactionData(txData);

    const model = getAIModel();

    const prompt = `${TRANSACTION_EXPLAINER_PROMPT}

Network: ${network}
Transaction Digest: ${normalizedDigest}

Raw Transaction Data:
${JSON.stringify(
  {
    digest: facts.digest,
    sender: facts.sender,
    status: facts.status,
    gasUsedSui: facts.gasUsedSui,
    moveCall: facts.moveCall,
    balanceChanges: facts.balanceChanges,
    recipients: facts.recipients,
    objectChanges: facts.objectChanges,
    events: facts.events.slice(0, 5),
  },
  null,
  2
)}

Provide your analysis in the specified JSON format.`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const responseText = result.response.text();
    let aiResponse: AIResponse;

    try {
      aiResponse = JSON.parse(responseText);
    } catch {
      aiResponse = {
        risk_level: "medium",
        summary: "Unable to parse transaction details completely.",
        actions: ["Transaction executed"],
        transfers: [],
        objects: {
          created: facts.objectChanges.created,
          mutated: facts.objectChanges.mutated,
          deleted: facts.objectChanges.deleted,
        },
        gas_sui: facts.gasUsedSui,
      };
    }

    return NextResponse.json(
      {
        digest: normalizedDigest,
        network,
        facts,
        ai: aiResponse,
      },
      {
        headers: {
          "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
          "X-RateLimit-Reset": rateLimitResult.resetTime.toString(),
        },
      }
    );
  } catch (error: any) {
    console.error("Error explaining transaction:", error);

    return NextResponse.json(
      {
        error:
          error?.message || "An unexpected error occurred. Please try again.",
      },
      { status: 500 }
    );
  }
}
