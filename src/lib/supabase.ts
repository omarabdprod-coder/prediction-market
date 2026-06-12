import { createClient } from "@supabase/supabase-js";
import {
  lmsrCost,
  lmsrPrices,
  calculateBuyLmsr,
  calculateSellLmsr,
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
  declared_identity_id?: string | null;
}

export interface Market {
  id: string;
  question: string;
  description: string;
  resolution_date: string;
  creator_id: string;
  status: "active" | "resolved";
  outcome: string | null;
  image_url?: string;
  tagged_users?: string[];
  outcomes: string[]; // Outcomes options list
  created_at: string;
  prices?: number[];  // UI helper: Current probability prices (0 to 1) for each option
}

export interface LiquidityPool {
  market_id: string;
  shares: number[]; // Outstanding shares vector
  b: number;        // LMSR liquidity parameter
  updated_at: string;
}

export interface UserPosition {
  id: string;
  user_id: string;
  market_id: string;
  shares: number[]; // Shares owned for each outcome index
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  market_id: string;
  outcome_index?: number;
  type: "buy" | "sell" | "resolve_claim" | "create_market";
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
    // Seed standard test users (including admin/MarketMaker)
    const seedUsers = [
      { id: "user-discord-admin", username: "Discord Admin 👑", balance: 5000.00, avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=admin", password: "password" },
      { id: "user-marketmaker", username: "MarketMaker", balance: 10000.00, avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=marketmaker", password: "password" },
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
        created_at: new Date().toISOString(),
        declared_identity_id: null
      });
    });

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    // Seed binary YES/NO markets
    const m1Id = "market-btc-100k";
    this.markets.set(m1Id, {
      id: m1Id,
      question: "Will Bitcoin reach $100,000 before the end of this month?",
      description: "BTC/USD price as reported on Coinbase Pro at 11:59 PM UTC on the last day of the month.",
      resolution_date: futureDate.toISOString(),
      creator_id: "user-discord-admin",
      status: "active",
      outcome: null,
      outcomes: ["YES", "NO"],
      created_at: new Date().toISOString()
    });
    this.liquidityPools.set(m1Id, {
      market_id: m1Id,
      shares: [0.0000, 0.0000],
      b: 200.00,
      updated_at: new Date().toISOString()
    });

    const m2Id = "market-eth-upgrade";
    this.markets.set(m2Id, {
      id: m2Id,
      question: "Will the Ethereum Dencun upgrade deploy on schedule?",
      description: "Based on official EF announcements and slot completion timestamp.",
      resolution_date: futureDate.toISOString(),
      creator_id: "user-alice",
      status: "active",
      outcome: null,
      outcomes: ["YES", "NO"],
      created_at: new Date().toISOString()
    });
    this.liquidityPools.set(m2Id, {
      market_id: m2Id,
      shares: [0.0000, 0.0000],
      b: 200.00,
      updated_at: new Date().toISOString()
    });

    // Seed Multi-Outcome market
    const m3Id = "market-rare-join";
    this.markets.set(m3Id, {
      id: m3Id,
      question: "Which guest joins the voice channel this weekend?",
      description: "Resolves to the name of the first guest who speaks in TTSOPP voice channel, or None if no guests join.",
      resolution_date: new Date(Date.now() + 86400000 * 2).toISOString(),
      creator_id: "user-marketmaker",
      status: "active",
      outcome: null,
      outcomes: ["Adi", "Omar H", "Lorenzo", "None"],
      created_at: new Date().toISOString()
    });
    this.liquidityPools.set(m3Id, {
      market_id: m3Id,
      shares: [0.0000, 0.0000, 0.0000, 0.0000],
      b: 200.00,
      updated_at: new Date().toISOString()
    });
  }
}

// Global server-side database singleton for mock mode
const mockDb = new MockDatabase();

// Helper to simulate current logged in user from cookies / session headers
export async function getCurrentUser(): Promise<UserProfile | null> {
  const cookieStore = await (await import("next/headers")).cookies();
  const persona = cookieStore.get("persona")?.value;
  if (persona && mockDb.users.has(persona)) {
    return mockDb.users.get(persona)!;
  }
  // Fallback to first user in list if no active cookie
  return Array.from(mockDb.users.values())[0];
}

export async function fetchUser(userId: string): Promise<UserProfile | null> {
  if (!isMockMode && supabase) {
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
        const { p_username, p_declared_identity_id } = params;
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
            created_at: new Date().toISOString(),
            declared_identity_id: p_declared_identity_id || null
          };
          mockDb.users.set(newUserId, user);
        }
        return { data: user.id as any, error: null };
      }

      case "faucet_tokens_rpc": {
        const { p_user_id } = params;
        const user = mockDb.users.get(p_user_id);
        if (user) {
          user.balance += 1000.00;
        }
        return { data: null, error: null };
      }

      case "merge_accounts_rpc": {
        const { p_source_id, p_target_id } = params;
        const target = mockDb.users.get(p_target_id);
        const source = mockDb.users.get(p_source_id);

        if (!target || !source) {
          throw new Error("Target or source user profile not found");
        }

        // 1. Calculate active wagers
        const activeMarkets = Array.from(mockDb.markets.values())
          .filter(m => m.status === "active")
          .map(m => m.id);

        const calculateActiveWagers = (userId: string) => {
          return mockDb.transactions
            .filter(tx => tx.user_id === userId && activeMarkets.includes(tx.market_id))
            .reduce((sum, tx) => {
              if (tx.type === "buy") {
                return sum + tx.amount_tokens;
              } else if (tx.type === "sell") {
                return sum - tx.amount_tokens;
              }
              return sum;
            }, 0);
        };

        const wTarget = calculateActiveWagers(p_target_id);
        const wSource = calculateActiveWagers(p_source_id);

        // 2. Compute capacity and scaling factor
        const cTarget = target.balance + wTarget;
        const cCombined = target.balance + source.balance + wTarget + wSource;

        let f = 1.0;
        if (cCombined > cTarget && cCombined > 0) {
          f = cTarget / cCombined;
        }

        // 3. Update target balance
        target.balance = (target.balance + source.balance) * f;

        // 4. Update and scale transactions
        mockDb.transactions.forEach((tx) => {
          if (tx.user_id === p_target_id) {
            if (f < 1.0) {
              tx.amount_tokens *= f;
              tx.amount_shares *= f;
              tx.fee_tokens *= f;
            }
          } else if (tx.user_id === p_source_id) {
            tx.user_id = p_target_id;
            tx.amount_tokens *= f;
            tx.amount_shares *= f;
            tx.fee_tokens *= f;
          }
        });

        // 5. Merge positions
        const sourcePositions = Array.from(mockDb.userPositions.values())
          .filter(pos => pos.user_id === p_source_id);

        sourcePositions.forEach((sPos) => {
          const market = mockDb.markets.get(sPos.market_id);
          const outcomesLen = market ? market.outcomes.length : 2;

          // Scale source shares
          const scaledSourceShares = sPos.shares.map(sh => sh * f);

          const targetKey = `${p_target_id}:${sPos.market_id}`;
          const tPos = mockDb.userPositions.get(targetKey);

          if (tPos) {
            // Ensure size compatibility
            while (tPos.shares.length < outcomesLen) tPos.shares.push(0);
            
            // Merge target and source
            tPos.shares = tPos.shares.map((tSh, idx) => {
              const sSh = scaledSourceShares[idx] || 0;
              return (tSh * f) + sSh;
            });
          } else {
            // Reassign and scale
            sPos.user_id = p_target_id;
            sPos.shares = scaledSourceShares;
            mockDb.userPositions.set(targetKey, sPos);
          }
          
          // Delete old key if it was different
          const sourceKey = `${p_source_id}:${sPos.market_id}`;
          mockDb.userPositions.delete(sourceKey);
        });

        // Scale other target positions in markets where source did not have positions
        if (f < 1.0) {
          Array.from(mockDb.userPositions.values())
            .filter(pos => pos.user_id === p_target_id)
            .forEach((tPos) => {
              const sourceHasPosition = sourcePositions.some(sp => sp.market_id === tPos.market_id);
              if (!sourceHasPosition) {
                tPos.shares = tPos.shares.map(sh => sh * f);
              }
            });
        }

        // 6. Delete source user
        mockDb.users.delete(p_source_id);

        return { data: null, error: null };
      }

      case "create_market_rpc": {
        const {
          p_question,
          p_description,
          p_resolution_date,
          p_creator_id,
          p_image_url,
          p_tagged_users,
          p_outcomes,
          p_b
        } = params;

        const outcomesList: string[] = p_outcomes || ["YES", "NO"];
        const bVal = Number(p_b || 200.00);

        const creator = mockDb.users.get(p_creator_id);
        if (!creator) throw new Error("Creator user profile not found");

        // Subsidy = b * ln(N)
        const subsidy = bVal * Math.log(outcomesList.length);
        if (creator.balance < subsidy) {
          throw new Error(`Insufficient balance to inject initial liquidity (${subsidy.toFixed(2)} Tokens required)`);
        }

        // Deduct balance
        creator.balance -= subsidy;

        const newMarketId = `market-${Math.random().toString(36).substring(2, 11)}`;
        
        mockDb.markets.set(newMarketId, {
          id: newMarketId,
          question: p_question,
          description: p_description,
          resolution_date: p_resolution_date,
          creator_id: p_creator_id,
          status: "active",
          outcome: null,
          outcomes: outcomesList,
          image_url: p_image_url,
          tagged_users: p_tagged_users,
          created_at: new Date().toISOString()
        });

        // Initialize shares vector to zeros
        const initialShares = outcomesList.map(() => 0.0);

        mockDb.liquidityPools.set(newMarketId, {
          market_id: newMarketId,
          shares: initialShares,
          b: bVal,
          updated_at: new Date().toISOString()
        });

        mockDb.transactions.push({
          id: `tx-${Math.random().toString(36).substring(2, 11)}`,
          user_id: p_creator_id,
          market_id: newMarketId,
          type: "create_market",
          amount_tokens: subsidy,
          amount_shares: 0,
          fee_tokens: 0,
          created_at: new Date().toISOString()
        });

        return { data: newMarketId as any, error: null };
      }

      case "place_bet_rpc": {
        const { p_user_id, p_market_id, p_outcome_index, p_wager } = params;
        const user = mockDb.users.get(p_user_id);
        const pool = mockDb.liquidityPools.get(p_market_id);
        const market = mockDb.markets.get(p_market_id);

        if (!user) throw new Error("User profile not found");
        if (!pool || !market) throw new Error("Market or liquidity pool not found");
        if (market.status !== "active") throw new Error("Market is not active");
        if (user.balance < p_wager) throw new Error("Insufficient balance");

        const outcomeIdx = Number(p_outcome_index);

        // Perform LMSR calculation
        const trade = calculateBuyLmsr(Number(p_wager), pool.shares, outcomeIdx, pool.b);

        // Deduct wager
        user.balance -= Number(p_wager);

        // Add fee to creator
        const creator = mockDb.users.get(market.creator_id);
        if (creator) creator.balance += trade.fee;

        // Update pool
        pool.shares = trade.newQ;
        pool.updated_at = new Date().toISOString();

        // Update user position
        const posKey = `${p_user_id}:${p_market_id}`;
        let pos = mockDb.userPositions.get(posKey);
        if (!pos) {
          pos = {
            id: `pos-${Math.random().toString(36).substring(2, 11)}`,
            user_id: p_user_id,
            market_id: p_market_id,
            shares: market.outcomes.map(() => 0.0),
            created_at: new Date().toISOString()
          };
          mockDb.userPositions.set(posKey, pos);
        }
        
        // Ensure size compatibility
        while (pos.shares.length < market.outcomes.length) {
          pos.shares.push(0.0);
        }
        pos.shares[outcomeIdx] += trade.shares;

        mockDb.transactions.push({
          id: `tx-${Math.random().toString(36).substring(2, 11)}`,
          user_id: p_user_id,
          market_id: p_market_id,
          outcome_index: outcomeIdx,
          type: "buy",
          amount_tokens: Number(p_wager),
          amount_shares: trade.shares,
          fee_tokens: trade.fee,
          created_at: new Date().toISOString()
        });

        return { data: trade.shares as any, error: null };
      }

      case "sell_bet_rpc": {
        const { p_user_id, p_market_id, p_outcome_index, p_shares } = params;
        const user = mockDb.users.get(p_user_id);
        const pool = mockDb.liquidityPools.get(p_market_id);
        const market = mockDb.markets.get(p_market_id);
        const posKey = `${p_user_id}:${p_market_id}`;
        const pos = mockDb.userPositions.get(posKey);

        if (!user) throw new Error("User profile not found");
        if (!pool || !market) throw new Error("Market or liquidity pool not found");
        if (market.status !== "active") throw new Error("Market is not active");
        
        const outcomeIdx = Number(p_outcome_index);
        if (!pos || pos.shares[outcomeIdx] < Number(p_shares)) {
          throw new Error("Insufficient shares in user position");
        }

        const trade = calculateSellLmsr(Number(p_shares), pool.shares, outcomeIdx, pool.b);

        // Update user position
        pos.shares[outcomeIdx] -= Number(p_shares);

        // Credit tokens
        user.balance += trade.tokens;

        // Pay fee to creator
        const creator = mockDb.users.get(market.creator_id);
        if (creator) creator.balance += trade.fee;

        // Update pool
        pool.shares = trade.newQ;
        pool.updated_at = new Date().toISOString();

        mockDb.transactions.push({
          id: `tx-${Math.random().toString(36).substring(2, 11)}`,
          user_id: p_user_id,
          market_id: p_market_id,
          outcome_index: outcomeIdx,
          type: "sell",
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
        const adminUser = mockDb.users.get(p_admin_id);

        if (!market || !pool) throw new Error("Market or pool not found");
        if (market.status !== "active") throw new Error("Market is already resolved");
        
        // Allow creator OR MarketMaker username bypass
        const isAuthorized = market.creator_id === p_admin_id || 
          (adminUser && adminUser.username.toLowerCase() === "marketmaker");
        if (!isAuthorized) throw new Error("Only the market creator or MarketMaker can resolve this market");

        const outcomeIdx = market.outcomes.findIndex(opt => opt.toLowerCase() === p_outcome.toLowerCase());
        if (outcomeIdx === -1) throw new Error("Winning outcome must match one of the market options");

        // Creator refund is C(q) - q_win
        const finalCost = lmsrCost(pool.shares, pool.b);
        const qWin = pool.shares[outcomeIdx];
        const refund = finalCost - qWin;

        // Resolve market
        market.status = "resolved";
        market.outcome = p_outcome;

        // Refund creator
        const creator = mockDb.users.get(market.creator_id);
        if (creator && refund > 0) creator.balance += refund;

        // Drain pool
        pool.shares = pool.shares.map(() => 0.0);
        pool.updated_at = new Date().toISOString();

        if (refund > 0) {
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
        }

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
        
        const outcomeIdx = market.outcomes.findIndex(opt => opt.toLowerCase() === market.outcome?.toLowerCase());
        if (outcomeIdx === -1) throw new Error("Losing position");

        const payout = pos ? pos.shares[outcomeIdx] : 0;

        // Reset all position shares to 0
        if (pos) {
          pos.shares = pos.shares.map(() => 0.0);
        }

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
      const outcomes = m.outcomes || ["YES", "NO"];
      
      let prices: number[];
      if (pool && pool.shares) {
        prices = lmsrPrices(pool.shares, Number(pool.b || 100));
      } else if (pool && (pool as any).yes_shares !== undefined && (pool as any).no_shares !== undefined) {
        const yesPrice = getYesPrice(Number((pool as any).yes_shares), Number((pool as any).no_shares));
        prices = [yesPrice, 1 - yesPrice];
      } else {
        prices = outcomes.map(() => 1 / outcomes.length);
      }

      return {
        ...m,
        outcomes,
        prices,
      };
    });
  }

  // Mock implementation
  return Array.from(mockDb.markets.values()).map(m => {
    const pool = mockDb.liquidityPools.get(m.id);
    const outcomes = m.outcomes || ["YES", "NO"];
    
    let prices: number[];
    if (pool && pool.shares) {
      prices = lmsrPrices(pool.shares, pool.b);
    } else {
      prices = outcomes.map(() => 1 / outcomes.length);
    }

    return {
      ...m,
      outcomes,
      prices,
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

    const outcomes = market.outcomes || ["YES", "NO"];
    let prices: number[];
    if (pool && pool.shares) {
      prices = lmsrPrices(pool.shares, Number(pool.b || 100));
    } else if (pool && (pool as any).yes_shares !== undefined && (pool as any).no_shares !== undefined) {
      const yesPrice = getYesPrice(Number((pool as any).yes_shares), Number((pool as any).no_shares));
      prices = [yesPrice, 1 - yesPrice];
    } else {
      prices = outcomes.map(() => 1 / outcomes.length);
    }

    return {
      market: {
        ...market,
        outcomes,
      },
      pool: {
        ...pool,
        prices,
      }
    };
  }

  // Mock implementation
  const market = mockDb.markets.get(marketId);
  const pool = mockDb.liquidityPools.get(marketId);
  if (!market) throw new Error("Market not found");

  const outcomes = market.outcomes || ["YES", "NO"];
  let prices: number[];
  if (pool && pool.shares) {
    prices = lmsrPrices(pool.shares, pool.b);
  } else {
    prices = outcomes.map(() => 1 / outcomes.length);
  }

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
      creator,
      outcomes,
    },
    pool: {
      ...pool,
      prices,
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
    
    return (data || []).map(pos => {
      const market = pos.market;
      const outcomes = market?.outcomes || ["YES", "NO"];
      let shares = pos.shares;
      if (!shares && pos.yes_shares !== undefined && pos.no_shares !== undefined) {
        shares = [Number(pos.yes_shares), Number(pos.no_shares)];
      }
      return {
        ...pos,
        shares: shares || outcomes.map(() => 0),
      };
    });
  }

  // Mock implementation
  return Array.from(mockDb.userPositions.values())
    .filter(pos => pos.user_id === userId)
    .map(pos => {
      const market = mockDb.markets.get(pos.market_id);
      const outcomes = market?.outcomes || ["YES", "NO"];
      return {
        ...pos,
        market,
        shares: pos.shares || outcomes.map(() => 0)
      };
    });
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

  // Mock implementation
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

export async function fetchGlobalTransactions() {
  if (!isMockMode && supabase) {
    const { data, error } = await supabase
      .from("transactions")
      .select("*, user:users(*), market:markets(*)")
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) throw error;
    return data || [];
  }

  return mockDb.transactions
    .map((tx) => ({
      ...tx,
      user: mockDb.users.get(tx.user_id) || {
        id: tx.user_id,
        username: "User",
        avatar_url: `https://api.dicebear.com/7.x/adventurer/svg?seed=${tx.user_id}`,
        balance: 0,
        created_at: "",
      },
      market: mockDb.markets.get(tx.market_id) || {
        id: tx.market_id,
        question: "Unknown Market",
        outcomes: ["YES", "NO"],
      }
    }))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);
}

export async function getServerUser(): Promise<UserProfile | null> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const personaId = cookieStore.get("persona")?.value;
  if (!personaId) return null;
  return fetchUser(personaId);
}

export async function fetchAllUsers(): Promise<UserProfile[]> {
  if (!isMockMode && supabase) {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("balance", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  return Array.from(mockDb.users.values());
}

export async function fetchShameList(): Promise<{ id: string; username: string; avatar_url: string; total_lost: number }[]> {
  if (!isMockMode && supabase) {
    try {
      const { data: txs, error } = await supabase
        .from("transactions")
        .select(`
          user_id,
          amount_tokens,
          outcome_index,
          user:users(username, avatar_url),
          market:markets(status, outcome, outcomes)
        `)
        .eq("type", "buy");

      if (error) throw error;

      const shameMap = new Map<string, { username: string; avatar_url: string; total_lost: number }>();

      (txs || []).forEach((tx: any) => {
        const market = tx.market;
        if (market && market.status === "resolved") {
          const outcomes = market.outcomes || ["YES", "NO"];
          const winningOutcome = market.outcome;
          const winningIdx = outcomes.findIndex((opt: string) => opt.toLowerCase() === winningOutcome?.toLowerCase());
          
          if (winningIdx !== -1 && tx.outcome_index !== winningIdx) {
            const uId = tx.user_id;
            const amount = Number(tx.amount_tokens || 0);
            const user = tx.user;
            
            if (shameMap.has(uId)) {
              shameMap.get(uId)!.total_lost += amount;
            } else {
              shameMap.set(uId, {
                username: user?.username || "Trader",
                avatar_url: user?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${uId}`,
                total_lost: amount
              });
            }
          }
        }
      });

      return Array.from(shameMap.entries())
        .map(([id, val]) => ({ id, ...val }))
        .sort((a, b) => b.total_lost - a.total_lost)
        .slice(0, 5);
    } catch (e) {
      console.error("Error in fetchShameList:", e);
      return [];
    }
  }

  // Mock Mode Shame List Calculation
  const shameMap = new Map<string, { username: string; avatar_url: string; total_lost: number }>();
  mockDb.transactions.forEach((tx) => {
    const isBuy = tx.type === "buy";
    if (isBuy) {
      const market = mockDb.markets.get(tx.market_id);
      if (market && market.status === "resolved") {
        const outcomes = market.outcomes || ["YES", "NO"];
        const winningOutcome = market.outcome;
        const winningIdx = outcomes.findIndex((opt: string) => opt.toLowerCase() === winningOutcome?.toLowerCase());
        
        if (winningIdx !== -1 && tx.outcome_index !== winningIdx) {
          const uId = tx.user_id;
          const amount = tx.amount_tokens;
          const user = mockDb.users.get(uId);
          
          if (shameMap.has(uId)) {
            shameMap.get(uId)!.total_lost += amount;
          } else {
            shameMap.set(uId, {
              username: user?.username || "Trader",
              avatar_url: user?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${uId}`,
              total_lost: amount
            });
          }
        }
      }
    }
  });

  return Array.from(shameMap.entries())
    .map(([id, val]) => ({ id, ...val }))
    .sort((a, b) => b.total_lost - a.total_lost)
    .slice(0, 5);
}
