import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface UserProfile {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface TransactionExplanation {
  id: string;
  user_id: string;
  digest: string;
  network: string;
  summary?: string;
  risk_level?: string;
  facts?: any;
  ai_response?: any;
  created_at: string;
}

export async function getUserExplanationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("transaction_explanations")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) throw error;
  return count || 0;
}

export async function saveExplanation(
  userId: string,
  digest: string,
  network: string,
  summary?: string,
  riskLevel?: string,
  facts?: any,
  aiResponse?: any
): Promise<void> {
  const { error } = await supabase
    .from("transaction_explanations")
    .insert({
      user_id: userId,
      digest,
      network,
      summary,
      risk_level: riskLevel,
      facts,
      ai_response: aiResponse,
    });

  if (error) throw error;
}

export async function getUserTransactionHistory(
  userId: string,
  limit: number = 10
): Promise<TransactionExplanation[]> {
  const { data, error } = await supabase
    .from("transaction_explanations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function getUserExplanations(
  userId: string
): Promise<TransactionExplanation[]> {
  const { data, error } = await supabase
    .from("transaction_explanations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}
