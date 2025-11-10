import { createClient } from "@supabase/supabase-js";
import { config } from "./config";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface UserProfile {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
  credits?: number;
  free_explanations_used?: number;
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

export async function getUserCredits(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("credits, free_explanations_used")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  
  // If profile doesn't exist, return free explanations remaining
  if (!data) {
    return config.pricing.freeExplanations;
  }

  // If user has used less than free explanations, return remaining free + credits
  const freeUsed = data.free_explanations_used || 0;
  const credits = data.credits || 0;
  const freeRemaining = Math.max(0, config.pricing.freeExplanations - freeUsed);
  
  return freeRemaining + credits;
}

export async function useExplanation(userId: string): Promise<{ usedFree: boolean; usedCredit: boolean }> {
  const { data: profile, error: fetchError } = await supabase
    .from("user_profiles")
    .select("credits, free_explanations_used, email")
    .eq("id", userId)
    .maybeSingle();

  if (fetchError) throw fetchError;

  // If profile doesn't exist, create it (shouldn't happen due to trigger, but just in case)
  if (!profile) {
    // Get user email from auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");
    
    const { error: createError } = await supabase
      .from("user_profiles")
      .insert({
        id: userId,
        email: user.email || '',
        credits: 0,
        free_explanations_used: 0,
      });
    if (createError) throw createError;
    
    // Use free explanation
    const { error: updateError } = await supabase
      .from("user_profiles")
      .update({
        free_explanations_used: 1,
        credits: 0,
      })
      .eq("id", userId);
    if (updateError) throw updateError;
    return { usedFree: true, usedCredit: false };
  }

  const freeUsed = profile.free_explanations_used || 0;
  const credits = profile.credits || 0;

  if (freeUsed < config.pricing.freeExplanations) {
    // Use free explanation
    const { error } = await supabase
      .from("user_profiles")
      .update({
        free_explanations_used: freeUsed + 1,
        credits: credits,
      })
      .eq("id", userId);
    if (error) throw error;
    return { usedFree: true, usedCredit: false };
  } else if (credits > 0) {
    // Use credit
    const { error } = await supabase
      .from("user_profiles")
      .update({
        credits: credits - 1,
        free_explanations_used: freeUsed,
      })
      .eq("id", userId);
    if (error) throw error;
    return { usedFree: false, usedCredit: true };
  } else {
    throw new Error("No credits or free explanations available");
  }
}

export async function refundExplanation(userId: string, usedFree: boolean, usedCredit: boolean): Promise<void> {
  if (!usedFree && !usedCredit) return;

  const { data: profile, error: fetchError } = await supabase
    .from("user_profiles")
    .select("credits, free_explanations_used")
    .eq("id", userId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!profile) return; // Profile doesn't exist, nothing to refund

  const freeUsed = profile.free_explanations_used || 0;
  const credits = profile.credits || 0;

  if (usedFree && freeUsed > 0) {
    // Refund free explanation
    const { error } = await supabase
      .from("user_profiles")
      .update({
        free_explanations_used: freeUsed - 1,
        credits: credits,
      })
      .eq("id", userId);
    if (error) throw error;
  } else if (usedCredit) {
    // Refund credit
    const { error } = await supabase
      .from("user_profiles")
      .update({
        credits: credits + 1,
        free_explanations_used: freeUsed,
      })
      .eq("id", userId);
    if (error) throw error;
  }
}

export interface PaymentReceipt {
  id: string;
  user_id: string;
  network: string;
  tx_digest: string;
  amount_mist: string;
  credits_added: number;
  pack_id: string;
  receipt_url: string;
  verified: boolean;
  created_at: string;
}

export async function getUserPaymentHistory(userId: string, limit: number = 10): Promise<PaymentReceipt[]> {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}
