/**
 * AMM Math Utilities for Prediction Market
 * Includes:
 * 1. Legacy CPMM: x * y = k, where x is YES shares and y is NO shares in the pool.
 * 2. LMSR (Logarithmic Market Scoring Rule) for Mutually Exclusive Multi-Outcome markets.
 */

export interface TradeResult {
  shares: number;
  tokens: number;
  fee: number;
  priceBefore: number;
  priceAfter: number;
  avgPrice: number;
  slippage: number;
  newPoolYes: number;
  newPoolNo: number;
}

/**
 * Calculates the marginal price of a YES share.
 * P_yes = y / (x + y)
 */
export function getYesPrice(poolYes: number, poolNo: number): number {
  const total = poolYes + poolNo;
  if (total === 0) return 0.5;
  return poolNo / total;
}

/**
 * Calculates the marginal price of a NO share.
 * P_no = x / (x + y)
 */
export function getNoPrice(poolYes: number, poolNo: number): number {
  const total = poolYes + poolNo;
  if (total === 0) return 0.5;
  return poolYes / total;
}

/**
 * Calculate the result of buying YES shares with tokens.
 */
export function calculateBuyYes(
  tokens: number,
  poolYes: number,
  poolNo: number
): TradeResult {
  if (tokens <= 0) throw new Error("Wager amount must be positive");
  if (poolYes <= 0 || poolNo <= 0) throw new Error("Pool must have liquidity");

  const fee = tokens * 0.02;
  const netWager = tokens - fee;
  const k = poolYes * poolNo;

  const newPoolNo = poolNo + netWager;
  const newPoolYes = k / newPoolNo;
  const shares = netWager + (poolYes - newPoolYes);

  const priceBefore = getYesPrice(poolYes, poolNo);
  const priceAfter = getYesPrice(newPoolYes, newPoolNo);
  const avgPrice = netWager / shares;
  const slippage = priceBefore > 0 ? (avgPrice - priceBefore) / priceBefore : 0;

  return {
    shares,
    tokens: netWager,
    fee,
    priceBefore,
    priceAfter,
    avgPrice,
    slippage,
    newPoolYes,
    newPoolNo,
  };
}

/**
 * Calculate the result of buying NO shares with tokens.
 */
export function calculateBuyNo(
  tokens: number,
  poolYes: number,
  poolNo: number
): TradeResult {
  if (tokens <= 0) throw new Error("Wager amount must be positive");
  if (poolYes <= 0 || poolNo <= 0) throw new Error("Pool must have liquidity");

  const fee = tokens * 0.02;
  const netWager = tokens - fee;
  const k = poolYes * poolNo;

  const newPoolYes = poolYes + netWager;
  const newPoolNo = k / newPoolYes;
  const shares = netWager + (poolNo - newPoolNo);

  const priceBefore = getNoPrice(poolYes, poolNo);
  const priceAfter = getNoPrice(newPoolYes, newPoolNo);
  const avgPrice = netWager / shares;
  const slippage = priceBefore > 0 ? (avgPrice - priceBefore) / priceBefore : 0;

  return {
    shares,
    tokens: netWager,
    fee,
    priceBefore,
    priceAfter,
    avgPrice,
    slippage,
    newPoolYes,
    newPoolNo,
  };
}

/**
 * Calculate the result of selling YES shares for tokens.
 */
export function calculateSellYes(
  shares: number,
  poolYes: number,
  poolNo: number
): TradeResult {
  if (shares <= 0) throw new Error("Shares to sell must be positive");
  if (poolYes <= 0 || poolNo <= 0) throw new Error("Pool must have liquidity");

  const k = poolYes * poolNo;
  const L = shares + poolYes;

  const a = 1;
  const b = -(L + poolNo);
  const c = shares * poolNo;

  const d = b * b - 4 * a * c;
  if (d < 0) {
    throw new Error("Invalid pool math: discriminant is negative");
  }

  const grossTokens = (-b - Math.sqrt(d)) / (2 * a);
  if (grossTokens >= poolNo) {
    throw new Error("Insufficient pool liquidity for a sell of this size");
  }

  const fee = grossTokens * 0.02;
  const netTokens = grossTokens - fee;

  const newPoolNo = poolNo - grossTokens;
  const newPoolYes = k / newPoolNo;

  const priceBefore = getYesPrice(poolYes, poolNo);
  const priceAfter = getYesPrice(newPoolYes, newPoolNo);
  const avgPrice = grossTokens / shares;
  const slippage = priceBefore > 0 ? (priceBefore - avgPrice) / priceBefore : 0;

  return {
    shares,
    tokens: netTokens,
    fee,
    priceBefore,
    priceAfter,
    avgPrice,
    slippage,
    newPoolYes,
    newPoolNo,
  };
}

/**
 * Calculate the result of selling NO shares for tokens.
 */
export function calculateSellNo(
  shares: number,
  poolYes: number,
  poolNo: number
): TradeResult {
  if (shares <= 0) throw new Error("Shares to sell must be positive");
  if (poolYes <= 0 || poolNo <= 0) throw new Error("Pool must have liquidity");

  const k = poolYes * poolNo;
  const L = shares + poolNo;

  const a = 1;
  const b = -(L + poolYes);
  const c = shares * poolYes;

  const d = b * b - 4 * a * c;
  if (d < 0) {
    throw new Error("Invalid pool math: discriminant is negative");
  }

  const grossTokens = (-b - Math.sqrt(d)) / (2 * a);
  if (grossTokens >= poolYes) {
    throw new Error("Insufficient pool liquidity for a sell of this size");
  }

  const fee = grossTokens * 0.02;
  const netTokens = grossTokens - fee;

  const newPoolYes = poolYes - grossTokens;
  const newPoolNo = k / newPoolYes;

  const priceBefore = getNoPrice(poolYes, poolNo);
  const priceAfter = getNoPrice(newPoolYes, newPoolNo);
  const avgPrice = grossTokens / shares;
  const slippage = priceBefore > 0 ? (priceBefore - avgPrice) / priceBefore : 0;

  return {
    shares,
    tokens: netTokens,
    fee,
    priceBefore,
    priceAfter,
    avgPrice,
    slippage,
    newPoolYes,
    newPoolNo,
  };
}

// ==========================================
// LMSR (LOGARITHMIC MARKET SCORING RULE)
// ==========================================

export interface LmsrTradeResult {
  shares: number;
  tokens: number;
  fee: number;
  priceBefore: number;
  priceAfter: number;
  avgPrice: number;
  slippage: number;
  newQ: number[];
}

/**
 * Calculates LMSR cost C(q) = b * ln( sum( exp(qi/b) ) )
 */
export function lmsrCost(q: number[], b: number): number {
  const maxQ = Math.max(...q);
  const sumExp = q.reduce((sum, qi) => sum + Math.exp((qi - maxQ) / b), 0);
  return maxQ + b * Math.log(sumExp);
}

/**
 * Calculates marginal prices (probabilities) for all outcomes.
 */
export function lmsrPrices(q: number[], b: number): number[] {
  const maxQ = Math.max(...q);
  const exps = q.map((qi) => Math.exp((qi - maxQ) / b));
  const sumExp = exps.reduce((sum, e) => sum + e, 0);
  return exps.map((e) => e / sumExp);
}

/**
 * Calculates the result of buying shares of outcome index.
 */
export function calculateBuyLmsr(
  wager: number,
  q: number[],
  outcomeIndex: number,
  b: number
): LmsrTradeResult {
  if (wager <= 0) throw new Error("Wager amount must be positive");
  const fee = wager * 0.02;
  const netWager = wager - fee;

  const currentCost = lmsrCost(q, b);
  const targetCost = currentCost + netWager;

  const maxQ = Math.max(...q);
  const sumExpOthers = q.reduce((sum, qk, idx) => {
    if (idx === outcomeIndex) return sum;
    return sum + Math.exp((qk - maxQ) / b);
  }, 0);

  const diffTarget = (targetCost - maxQ) / b;
  const termInsideLog = Math.exp(diffTarget) - sumExpOthers;

  if (termInsideLog <= 0) {
    throw new Error("Math error: Insufficient liquidity for this transaction size");
  }

  const newQi = maxQ + b * Math.log(termInsideLog);
  const shares = newQi - q[outcomeIndex];

  const newQ = [...q];
  newQ[outcomeIndex] = newQi;

  const oldPrices = lmsrPrices(q, b);
  const newPrices = lmsrPrices(newQ, b);

  const avgPrice = netWager / shares;
  const slippage = oldPrices[outcomeIndex] > 0 ? (avgPrice - oldPrices[outcomeIndex]) / oldPrices[outcomeIndex] : 0;

  return {
    shares,
    tokens: netWager,
    fee,
    priceBefore: oldPrices[outcomeIndex],
    priceAfter: newPrices[outcomeIndex],
    avgPrice,
    slippage: Math.max(0, slippage),
    newQ,
  };
}

/**
 * Calculates the result of selling shares of outcome index.
 */
export function calculateSellLmsr(
  shares: number,
  q: number[],
  outcomeIndex: number,
  b: number
): LmsrTradeResult {
  if (shares <= 0) throw new Error("Shares to sell must be positive");
  if (shares > q[outcomeIndex]) {
    throw new Error("Cannot sell more shares than outstanding in the pool");
  }

  const currentCost = lmsrCost(q, b);
  const newQ = [...q];
  newQ[outcomeIndex] = q[outcomeIndex] - shares;

  const targetCost = lmsrCost(newQ, b);
  const grossTokens = currentCost - targetCost;

  const fee = grossTokens * 0.02;
  const tokens = grossTokens - fee;

  const oldPrices = lmsrPrices(q, b);
  const newPrices = lmsrPrices(newQ, b);
  const avgPrice = tokens / shares;
  const slippage = oldPrices[outcomeIndex] > 0 ? (oldPrices[outcomeIndex] - avgPrice) / oldPrices[outcomeIndex] : 0;

  return {
    shares,
    tokens,
    fee,
    priceBefore: oldPrices[outcomeIndex],
    priceAfter: newPrices[outcomeIndex],
    avgPrice,
    slippage: Math.max(0, slippage),
    newQ,
  };
}