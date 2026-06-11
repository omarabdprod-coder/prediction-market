"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { dbRpc } from "@/lib/supabase";

export interface ActionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Creates a new market.
 */
export async function createMarketAction(
  question: string,
  description: string,
  resolutionDateStr: string,
  creatorId: string,
  imageUrl?: string,
  taggedUsers?: string[],
  outcomes?: string[],
  b?: number
): Promise<ActionResponse<string>> {
  try {
    if (!question || question.trim().length === 0) {
      return { success: false, error: "Question cannot be empty" };
    }
    if (!resolutionDateStr) {
      return { success: false, error: "Resolution date is required" };
    }

    const resolutionDate = new Date(resolutionDateStr);
    if (isNaN(resolutionDate.getTime())) {
      return { success: false, error: "Invalid resolution date format" };
    }

    if (resolutionDate <= new Date()) {
      return { success: false, error: "Resolution date must be in the future" };
    }

    const outcomesList = outcomes && outcomes.length >= 2 ? outcomes : ["YES", "NO"];

    const { data: marketId, error } = await dbRpc("create_market_rpc", {
      p_question: question,
      p_description: description,
      p_resolution_date: resolutionDate.toISOString(),
      p_creator_id: creatorId,
      p_image_url: imageUrl || null,
      p_tagged_users: taggedUsers || null,
      p_outcomes: outcomesList,
      p_b: b || 200.00
    });

    if (error) {
      return { success: false, error: error.message || String(error) };
    }

    revalidatePath("/");
    return { success: true, data: marketId };
  } catch (e: any) {
    return { success: false, error: e.message || "An unexpected error occurred" };
  }
}

/**
 * Places a bet on a specific outcome option index.
 */
export async function placeBetAction(
  userId: string,
  marketId: string,
  outcomeIndex: number,
  wager: number
): Promise<ActionResponse<number>> {
  try {
    if (wager <= 0) {
      return { success: false, error: "Wager must be greater than 0" };
    }

    const { data: shares, error } = await dbRpc("place_bet_rpc", {
      p_user_id: userId,
      p_market_id: marketId,
      p_outcome_index: outcomeIndex,
      p_wager: wager,
    });

    if (error) {
      return { success: false, error: error.message || String(error) };
    }

    revalidatePath("/");
    revalidatePath(`/market/${marketId}`);
    return { success: true, data: Number(shares) };
  } catch (e: any) {
    return { success: false, error: e.message || "An unexpected error occurred" };
  }
}

/**
 * Sells shares of a specific outcome option index back to the pool.
 */
export async function sellBetAction(
  userId: string,
  marketId: string,
  outcomeIndex: number,
  shares: number
): Promise<ActionResponse<number>> {
  try {
    if (shares <= 0) {
      return { success: false, error: "Shares to sell must be greater than 0" };
    }

    const { data: tokens, error } = await dbRpc("sell_bet_rpc", {
      p_user_id: userId,
      p_market_id: marketId,
      p_outcome_index: outcomeIndex,
      p_shares: shares,
    });

    if (error) {
      return { success: false, error: error.message || String(error) };
    }

    revalidatePath("/");
    revalidatePath(`/market/${marketId}`);
    return { success: true, data: Number(tokens) };
  } catch (e: any) {
    return { success: false, error: e.message || "An unexpected error occurred" };
  }
}

/**
 * Resolves a market to the winning outcome option name.
 */
export async function resolveMarketAction(
  marketId: string,
  outcomeName: string,
  adminId: string
): Promise<ActionResponse<void>> {
  try {
    const { error } = await dbRpc("resolve_market_rpc", {
      p_market_id: marketId,
      p_outcome: outcomeName,
      p_admin_id: adminId,
    });

    if (error) {
      return { success: false, error: error.message || String(error) };
    }

    revalidatePath("/");
    revalidatePath(`/market/${marketId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || "An unexpected error occurred" };
  }
}

/**
 * Claims payout for a resolved market user position.
 */
export async function claimPayoutAction(
  userId: string,
  marketId: string
): Promise<ActionResponse<number>> {
  try {
    const { data: payout, error } = await dbRpc("claim_payout_rpc", {
      p_user_id: userId,
      p_market_id: marketId,
    });

    if (error) {
      return { success: false, error: error.message || String(error) };
    }

    revalidatePath("/");
    revalidatePath(`/market/${marketId}`);
    return { success: true, data: Number(payout) };
  } catch (e: any) {
    return { success: false, error: e.message || "An unexpected error occurred" };
  }
}

/**
 * Unified authentication action (Password-free: logs in if exists, registers if new)
 */
export async function authenticateAction(username: string): Promise<ActionResponse<string>> {
  try {
    if (!username || username.trim().length === 0) {
      return { success: false, error: "Username is required" };
    }
    if (username.trim().length < 2) {
      return { success: false, error: "Username must be at least 2 characters" };
    }

    const { data: userId, error } = await dbRpc("login_or_register_user_rpc", {
      p_username: username.trim(),
    });

    if (error) {
      return { success: false, error: error.message || String(error) };
    }

    const cookieStore = await cookies();
    cookieStore.set("persona", userId, {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
    });

    return { success: true, data: userId };
  } catch (e: any) {
    return { success: false, error: e.message || "An unexpected error occurred" };
  }
}

/**
 * Log out the current user session.
 */
export async function logoutAction(): Promise<ActionResponse<void>> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("persona");
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || "An unexpected error occurred" };
  }
}

/**
 * Grant 1,000 more tokens to the current user (faucet)
 */
export async function claimFaucetAction(userId: string): Promise<ActionResponse<void>> {
  try {
    const { fetchUser } = await import("@/lib/supabase");
    const user = await fetchUser(userId);
    if (!user || user.username.toLowerCase() !== "marketmaker") {
      return { success: false, error: "Only the MarketMaker user can claim faucet tokens." };
    }

    const { error } = await dbRpc("faucet_tokens_rpc", {
      p_user_id: userId,
    });
    if (error) {
      return { success: false, error: error.message || String(error) };
    }
    revalidatePath("/");
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || "An unexpected error occurred" };
  }
}
