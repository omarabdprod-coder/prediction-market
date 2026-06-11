import { createClient } from "@supabase/supabase-js";
import {
  calculateBuyYes,
  calculateBuyNo,
  calculateSellYes,
  calculateSellNo,
  getYesPrice,
  getNoPrice,
} from "./amm";

// Determine if we should use mock database
const supabaseUrlRaw = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Strip any trailing slashes to prevent PGRST125 double-slash errors in PostgREST queries
const supabaseUrl = supabaseUrlRaw ? supabaseUrlRaw.replace(/\/+$/, "") : "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isMockMode = !supabaseUrl || !supabaseAnonKey || supabaseUrl.includes("your-supabase");

console.log(`[Prediction Market] Database mode: ${isMockMode ? "MOCK (In-Memory)" : "REAL (Supabase PostgreSQL)"}`);

// Real Supabase client instance (if configuration is present)
export const supabase = !isMockMode
  ? createClient(supabaseUrl, supabaseAnonKey!)
  : null;

// ==========================================
// IN-MEMORY MOCK DATABASE FOR INSTANT DEV/TEST
// ==========================================

export interface UserProfile {
  id: string;
  username: string;
  avatar_url: string;
  balance: number;
  password?: string;
  created_at: string;
}

export interface Market {
  id: string;
  question: string;
  description: string;
  resolution_date: string;
  creator_id: string;
  status: "active" | "resolved";
  outcome: "YES" | "NO" | null;
  created_at: string;
  yesPrice?: number; // UI helper
  noPrice?: number;  // UI helper
}

export interface LiquidityPool {
  market_id: string;
  yes_shares: number;
  no_shares: number;
  k: number;
  updated_at: string;
}

export interface UserPosition {
  id: string;
  user_id: string;
  market_id: string;
  yes_shares: number;
  no_shares: number;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  market_id: string;
  type: "buy_yes" | "buy_no" | "sell_yes" | "sell_no" | "resolve_claim" | "create_market";
  amount_tokens: number;
  amount_shares: number;
  fee_tokens: number;
  created_at: string;
}

// Global mock state
class MockDatabase {
  users = new Map<string, UserProfile>();
  markets = new Map<string, Market>();
  liquidityPools = new Map<string, LiquidityPool>();
  userPositions = new Map<string, UserPosition>(); // key: userId:marketId
  transactions: Transaction[] = [];

  constructor() {
    this.seed();
  }

  seed() {
    // Seed standard test users (Discord avatars simulated with ui-avatars)
    const seedUsers = [
      { id: "user-discord-admin", username: "Discord Admin 👑", balance: 5000.00, avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=admin", password: "password" },
      { id: "user-alice", username: "Alice_Trader 📈", balance: 1000.00, avatar: "https://api.dicebear.com/7.x/adventurer/svg?seed=Alice", password: "password" },
      { id: "user-bob", username: "Bob_HODLer 📉", balance: 1000.00, avatar: "https://api.dicebear.com/7.x/adventurer/svg?seed=Bob", password: "password" },
      { id: "user-charlie", username: "Charlie_Whale 🐳", balance: 1500.00, avatar: "https://api.dicebear.com/7.x/adventurer/svg?seed=Charlie", password: "password" },
    ];

    seedUsers.forEach(u => {
      this.users.set(u.id, {
        id: u.id,
        username: u.username,
        avatar_url: u.avatar,
        balance: u.balance,
        password: u.password,
        created_at: new Date().toISOString()
      });
    });

    // Seed some mock markets
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    const m1Id = "market-btc-100k";
    this.markets.set(m1Id, {
      id: m1Id,
      question: "Will Bitcoin reach $100,000 before the end of this month?",
      description: "BTC/USD price as reported on Coinbase Pro at 11:59 PM UTC on the last day of the month.",
      resolution_date: futureDate.toISOString(),
      creator_id: "user-discord-admin",
      status: "active",
      outcome: null,
      created_at: new Date().toISOString()
    });
    this.liquidityPools.set(m1Id, {
      market_id: m1Id,
      yes_shares: 65.0000,
      no_shares: 35.0000,
      k: 65.0000 * 35.0000,
      updated_at: new Date().toISOString()
    });

    const m2Id = "market-eth-upgrade";
    this.markets.set(m2Id, {
      id: m2Id,
      question: "Will the Ethereum Dencun upgrade deploy on mainnet on schedule?",
      description: "Based on official EF announcements and slot completion timestamp.",
      resolution_date: futureDate.toISOString(),
      creator_id: "user-alice",
      status: "active",
      outcome: null,
      created_at: new Date().toISOString()
    });
    this.liquidityPools.set(m2Id, {
      market_id: m2Id,
      yes_shares: 50.0000,
      no_shares: 50.0000,
      k: 2500.0000,
      updated_at: new Date().toISOString()
    });

    const m3Id = "market-gpt5-release";
    this.markets.set(m3Id, {
      id: m3Id,
      question: "Will OpenAI announce GPT-5 by Friday evening?",
      description: "Must be a formal public press release or blog post announcement from OpenAI.",
      resolution_date: new Date(Date.now() + 86400000).toISOString(),
      creator_id: "user-bob",
      status: "active",
      outcome: null,
      created_at: new Date().toISOString()
    });
    this.liquidityPools.set(m3Id, {
      market_id: m3Id,
      yes_shares: 30.0000,
      no_shares: 70.0000,
      k: 2100.0000,
      updated_at: new Date().toISOString()
    });
  }
}

// Global server-side database singleton for mock mode
const mockDb = new MockDatabase();

// Helper to simulate current logged in user from cookies / session headers
// In a real app, this parses Supabase auth header. In mock mode, we use a simple header override.
export function getSessionUser(request?: Request): UserProfile {
  let userId = "user-alice"; // Default persona

  if (request) {
    const url = new URL(request.url);
    const persona = url.searchParams.get("persona") || request.headers.get("x-user-persona");
    if (persona && mockDb.users.has(persona)) {
      userId = persona;
    }
  }

  // Fallback to Alice if user not found
  return mockDb.users.get(userId) || Array.from(mockDb.users.values())[0];
}

// ==========================================
// UNIFIED DATABASE ACTION RUNNER (dbRpc)
// ==========================================

export async function dbRpc<T = any>(
  fnName: string,
  params: Record<string, any>
): Promise<{ data: T | null; error: any }> {
  if (!isMockMode && supabase) {
    try {
      const { data, error } = await supabase.rpc(fnName, params);
      if (error) throw error;
      return { data, error: null };
    } catch (e: any) {
      console.error(`Supabase RPC Error in ${fnName}:`, e);
      return { data: null, error: e.message || e };
    }
  }

  // ==========================================
  // MOCK RPC IMPLEMENTATIONS
  // ==========================================
  try {
    switch (fnName) {
      case "login_or_register_user_rpc": {
        const { p_username } = params;
        const normalized = p_username.trim();
        let user = Array.from(mockDb.users.values()).find(
          (u) => u.username.toLowerCase() === normalized.toLowerCase()
        );

        if (!user) {
          const newUserId = `user-${Math.random().toString(36).substring(2, 11)}`;
          user = {
            id: newUserId,
            username: normalized,
            avatar_url: `https://api.dicebear.com/7.x/adventurer/svg?seed=${normalized}`,
            balance: 1000.00,
            created_at: new Date().toISOString()
          };
          mockDb.users.set(newUserId, user);
        }
        return { data: user.id as any, error: null };
      }

      case "create_market_rpc": {
        const { p_question, p_description, p_resolution_date, p_creator_id } = params;
        const creator = mockDb.users.get(p_creator_id);
        if (!creator) throw new Error("Creator user profile not found");
        if (creator.balance < 50.00) {
          throw new Error("Insufficient balance to inject initial liquidity (50 Tokens required)");
        }

        // Deduct balance
        creator.balance -= 50.00;

        const newMarketId = `market-${Math.random().toString(36).substring(2, 11)}`;
        
        mockDb.markets.set(newMarketId, {
          id: newMarketId,
          question: p_question,
          description: p_description,
          resolution_date: p_resolution_date,
          creator_id: p_creator_id,
          status: "active",
          outcome: null,
          created_at: new Date().toISOString()
        });

        mockDb.liquidityPools.set(newMarketId, {
          market_id: newMarketId,
          yes_shares: 50.0000,
          no_shares: 50.0000,
          k: 2500.0000,
          updated_at: new Date().toISOString()
        });

        mockDb.transactions.push({
          id: `tx-${Math.random().toString(36).substring(2, 11)}`,
          user_id: p_creator_id,
          market_id: newMarketId,
          type: "create_market",
          amount_tokens: 50.00,
          amount_shares: 50.0000,
          fee_tokens: 0,
          created_at: new Date().toISOString()
        });

        return { data: newMarketId as any, error: null };
      }

      case "place_bet_yes_rpc": {
        const { p_user_id, p_market_id, p_wager } = params;
        const user = mockDb.users.get(p_user_id);
        const pool = mockDb.liquidityPools.get(p_market_id);
        const market = mockDb.markets.get(p_market_id);

        if (!user) throw new Error("User profile not found");
        if (!pool || !market) throw new Error("Market or liquidity pool not found");
        if (market.status !== "active") throw new Error("Market is not active");
        if (user.balance < p_wager) throw new Error("Insufficient balance");

        const trade = calculateBuyYes(Number(p_wager), Number(pool.yes_shares), Number(pool.no_shares));

        // Deduct wager
        user.balance -= Number(p_wager);

        // Add fee to creator
        const creator = mockDb.users.get(market.creator_id);
        if (creator) creator.balance += trade.fee;

        // Update pool
        pool.yes_shares = trade.newPoolYes;
        pool.no_shares = trade.newPoolNo;
        pool.updated_at = new Date().toISOString();

        // Update user position
        const posKey = `${p_user_id}:${p_market_id}`;
        let pos = mockDb.userPositions.get(posKey);
        if (!pos) {
          pos = {
            id: `pos-${Math.random().toString(36).substring(2, 11)}`,
            user_id: p_user_id,
            market_id: p_market_id,
            yes_shares: 0,
            no_shares: 0,
            created_at: new Date().toISOString()
          };
          mockDb.userPositions.set(posKey, pos);
        }
        pos.yes_shares += trade.shares;

        mockDb.transactions.push({
          id: `tx-${Math.random().toString(36).substring(2, 11)}`,
          user_id: p_user_id,
          market_id: p_market_id,
          type: "buy_yes",
          amount_tokens: Number(p_wager),
          amount_shares: trade.shares,
          fee_tokens: trade.fee,
          created_at: new Date().toISOString()
        });

        return { data: trade.shares as any, error: null };
      }

      case "place_bet_no_rpc": {
        const { p_user_id, p_market_id, p_wager } = params;
        const user = mockDb.users.get(p_user_id);
        const pool = mockDb.liquidityPools.get(p_market_id);
        const market = mockDb.markets.get(p_market_id);

        if (!user) throw new Error("User profile not found");
        if (!pool || !market) throw new Error("Market or liquidity pool not found");
        if (market.status !== "active") throw new Error("Market is not active");
        if (user.balance < p_wager) throw new Error("Insufficient balance");

        const trade = calculateBuyNo(Number(p_wager), Number(pool.yes_shares), Number(pool.no_shares));

        // Deduct wager
        user.balance -= Number(p_wager);

        // Add fee to creator
        const creator = mockDb.users.get(market.creator_id);
        if (creator) creator.balance += trade.fee;

        // Update pool
        pool.yes_shares = trade.newPoolYes;
        pool.no_shares = trade.newPoolNo;
        pool.updated_at = new Date().toISOString();

        // Update user position
        const posKey = `${p_user_id}:${p_market_id}`;
        let pos = mockDb.userPositions.get(posKey);
        if (!pos) {
          pos = {
            id: `pos-${Math.random().toString(36).substring(2, 11)}`,
            user_id: p_user_id,
            market_id: p_market_id,
            yes_shares: 0,
            no_shares: 0,
            created_at: new Date().toISOString()
          };
          mockDb.userPositions.set(posKey, pos);
        }
        pos.no_shares += trade.shares;

        mockDb.transactions.push({
          id: `tx-${Math.random().toString(36).substring(2, 11)}`,
          user_id: p_user_id,
          market_id: p_market_id,
          type: "buy_no",
          amount_tokens: Number(p_wager),
          amount_shares: trade.shares,
          fee_tokens: trade.fee,
          created_at: new Date().toISOString()
        });

        return { data: trade.shares as any, error: null };
      }

      case "sell_bet_yes_rpc": {
        const { p_user_id, p_market_id, p_shares } = params;
        const user = mockDb.users.get(p_user_id);
        const pool = mockDb.liquidityPools.get(p_market_id);
        const market = mockDb.markets.get(p_market_id);
        const posKey = `${p_user_id}:${p_market_id}`;
        const pos = mockDb.userPositions.get(posKey);

        if (!user) throw new Error("User profile not found");
        if (!pool || !market) throw new Error("Market or liquidity pool not found");
        if (market.status !== "active") throw new Error("Market is not active");
        if (!pos || pos.yes_shares < Number(p_shares)) throw new Error("Insufficient YES shares to sell");

        const trade = calculateSellYes(Number(p_shares), Number(pool.yes_shares), Number(pool.no_shares));

        // Deduct user shares
        pos.yes_shares -= Number(p_shares);

        // Add net tokens to user
        user.balance += trade.tokens;

        // Add fee to creator
        const creator = mockDb.users.get(market.creator_id);
        if (creator) creator.balance += trade.fee;

        // Update pool
        pool.yes_shares = trade.newPoolYes;
        pool.no_shares = trade.newPoolNo;
        pool.updated_at = new Date().toISOString();

        mockDb.transactions.push({
          id: `tx-${Math.random().toString(36).substring(2, 11)}`,
          user_id: p_user_id,
          market_id: p_market_id,
          type: "sell_yes",
          amount_tokens: trade.tokens,
          amount_shares: Number(p_shares),
          fee_tokens: trade.fee,
          created_at: new Date().toISOString()
        });

        return { data: trade.tokens as any, error: null };
      }

      case "sell_bet_no_rpc": {
        const { p_user_id, p_market_id, p_shares } = params;
        const user = mockDb.users.get(p_user_id);
        const pool = mockDb.liquidityPools.get(p_market_id);
        const market = mockDb.markets.get(p_market_id);
        const posKey = `${p_user_id}:${p_market_id}`;
        const pos = mockDb.userPositions.get(posKey);

        if (!user) throw new Error("User profile not found");
        if (!pool || !market) throw new Error("Market or liquidity pool not found");
        if (market.status !== "active") throw new Error("Market is not active");
        if (!pos || pos.no_shares < Number(p_shares)) throw new Error("Insufficient NO shares to sell");

        const trade = calculateSellNo(Number(p_shares), Number(pool.yes_shares), Number(pool.no_shares));

        // Deduct user shares
        pos.no_shares -= Number(p_shares);

        // Add net tokens to user
        user.balance += trade.tokens;

        // Add fee to creator
        const creator = mockDb.users.get(market.creator_id);
        if (creator) creator.balance += trade.fee;

        // Update pool
        pool.yes_shares = trade.newPoolYes;
        pool.no_shares = trade.newPoolNo;
        pool.updated_at = new Date().toISOString();

        mockDb.transactions.push({
          id: `tx-${Math.random().toString(36).substring(2, 11)}`,
          user_id: p_user_id,
          market_id: p_market_id,
          type: "sell_no",
          amount_tokens: trade.tokens,
          amount_shares: Number(p_shares),
          fee_tokens: trade.fee,
          created_at: new Date().toISOString()
        });

        return { data: trade.tokens as any, error: null };
      }

      case "resolve_market_rpc": {
        const { p_market_id, p_outcome, p_admin_id } = params;
        const market = mockDb.markets.get(p_market_id);
        const pool = mockDb.liquidityPools.get(p_market_id);

        if (!market || !pool) throw new Error("Market or pool not found");
        if (market.status !== "active") throw new Error("Market is already resolved");
        if (market.creator_id !== p_admin_id) throw new Error("Only the market creator can resolve this market");

        const refund = p_outcome === "YES" ? pool.yes_shares : pool.no_shares;

        // Resolve market
        market.status = "resolved";
        market.outcome = p_outcome;

        // Refund creator
        const creator = mockDb.users.get(market.creator_id);
        if (creator) creator.balance += refund;

        // Drain pool
        pool.yes_shares = 0.0001;
        pool.no_shares = 0.0001;
        pool.k = 0.00000001;
        pool.updated_at = new Date().toISOString();

        mockDb.transactions.push({
          id: `tx-${Math.random().toString(36).substring(2, 11)}`,
          user_id: market.creator_id,
          market_id: p_market_id,
          type: "resolve_claim",
          amount_tokens: refund,
          amount_shares: refund,
          fee_tokens: 0,
          created_at: new Date().toISOString()
        });

        return { data: null as any, error: null };
      }

      case "claim_payout_rpc": {
        const { p_user_id, p_market_id } = params;
        const user = mockDb.users.get(p_user_id);
        const market = mockDb.markets.get(p_market_id);
        const posKey = `${p_user_id}:${p_market_id}`;
        const pos = mockDb.userPositions.get(posKey);

        if (!user) throw new Error("User profile not found");
        if (!market) throw new Error("Market not found");
        if (market.status !== "resolved") throw new Error("Market is not resolved yet");
        if (!pos || (pos.yes_shares === 0 && pos.no_shares === 0)) {
          throw new Error("No position to claim");
        }

        const payout = market.outcome === "YES" ? pos.yes_shares : pos.no_shares;

        // Reset positions
        pos.yes_shares = 0;
        pos.no_shares = 0;

        if (payout > 0) {
          user.balance += payout;
          mockDb.transactions.push({
            id: `tx-${Math.random().toString(36).substring(2, 11)}`,
            user_id: p_user_id,
            market_id: p_market_id,
            type: "resolve_claim",
            amount_tokens: payout,
            amount_shares: payout,
            fee_tokens: 0,
            created_at: new Date().toISOString()
          });
        }

        return { data: payout as any, error: null };
      }

      default:
        throw new Error(`Unknown RPC function: ${fnName}`);
    }
  } catch (e: any) {
    return { data: null, error: e.message || e };
  }
}

// ==========================================
// UNIFIED FETCH HELPERS
// ==========================================

export async function fetchMarkets(): Promise<Market[]> {
  if (!isMockMode && supabase) {
    const { data: markets, error: mErr } = await supabase
      .from("markets")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (mErr) throw mErr;

    const { data: pools, error: pErr } = await supabase
      .from("liquidity_pools")
      .select("*");
    
    if (pErr) throw pErr;

    return (markets || []).map(m => {
      const pool = (pools || []).find(p => p.market_id === m.id);
      return {
        ...m,
        yesPrice: pool ? getYesPrice(Number(pool.yes_shares), Number(pool.no_shares)) : 0.5,
        noPrice: pool ? getNoPrice(Number(pool.yes_shares), Number(pool.no_shares)) : 0.5,
      };
    });
  }

  // Mock implementation
  return Array.from(mockDb.markets.values()).map(m => {
    const pool = mockDb.liquidityPools.get(m.id)!;
    return {
      ...m,
      yesPrice: getYesPrice(pool.yes_shares, pool.no_shares),
      noPrice: getNoPrice(pool.yes_shares, pool.no_shares),
    };
  });
}

export async function fetchMarketDetails(marketId: string) {
  if (!isMockMode && supabase) {
    const { data: market, error: mErr } = await supabase
      .from("markets")
      .select("*, creator:users(*)")
      .eq("id", marketId)
      .single();
    if (mErr) throw mErr;

    const { data: pool, error: pErr } = await supabase
      .from("liquidity_pools")
      .select("*")
      .eq("market_id", marketId)
      .single();
    if (pErr) throw pErr;

    return {
      market,
      pool: {
        ...pool,
        yesPrice: getYesPrice(Number(pool.yes_shares), Number(pool.no_shares)),
        noPrice: getNoPrice(Number(pool.yes_shares), Number(pool.no_shares)),
      }
    };
  }

  // Mock implementation
  const market = mockDb.markets.get(marketId);
  const pool = mockDb.liquidityPools.get(marketId);
  if (!market || !pool) throw new Error("Market details not found");

  const creator = mockDb.users.get(market.creator_id) || {
    id: market.creator_id,
    username: "Creator",
    avatar_url: "",
    balance: 0,
    created_at: "",
  };

  return {
    market: {
      ...market,
      creator
    },
    pool: {
      ...pool,
      yesPrice: getYesPrice(pool.yes_shares, pool.no_shares),
      noPrice: getNoPrice(pool.yes_shares, pool.no_shares),
    }
  };
}

export async function fetchUserPositions(userId: string) {
  if (!isMockMode && supabase) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return [];
    }
    const { data, error } = await supabase
      .from("user_positions")
      .select("*, market:markets(*)")
      .eq("user_id", userId);
    if (error) throw error;
    return data || [];
  }

  // Mock implementation
  return Array.from(mockDb.userPositions.values())
    .filter(pos => pos.user_id === userId)
    .map(pos => ({
      ...pos,
      market: mockDb.markets.get(pos.market_id)
    }));
}

export async function fetchUser(userId: string): Promise<UserProfile | null> {
  if (!isMockMode && supabase) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return null;
    }
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();
    if (error) return null;
    return data;
  }

  return mockDb.users.get(userId) || null;
}

export async function fetchAllUsers(): Promise<UserProfile[]> {
  if (!isMockMode && supabase) {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("username");
    if (error) throw error;
    return data || [];
  }

  return Array.from(mockDb.users.values());
}

export async function fetchMarketTransactions(marketId: string) {
  if (!isMockMode && supabase) {
    const { data, error } = await supabase
      .from("transactions")
      .select("*, user:users(*)")
      .eq("market_id", marketId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  // Mock database search
  return mockDb.transactions
    .filter((tx) => tx.market_id === marketId)
    .map((tx) => ({
      ...tx,
      user: mockDb.users.get(tx.user_id) || {
        id: tx.user_id,
        username: "User",
        avatar_url: `https://api.dicebear.com/7.x/adventurer/svg?seed=${tx.user_id}`,
        balance: 0,
        created_at: "",
      },
    }))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

export async function getServerUser(): Promise<UserProfile | null> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const persona = cookieStore.get("persona")?.value;
  if (!persona) return null;

  if (!isMockMode) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(persona)) {
      return null;
    }
  }

  const user = await fetchUser(persona);
  return user || null;
}
