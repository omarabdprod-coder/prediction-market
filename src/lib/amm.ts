/**
 * AMM Math Utilities for Prediction Market
 * CPMM: x * y = k, where x is YES shares and y is NO shares in the pool.
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
 * @param tokens Amount of tokens wagered by the user (gross, before 2% fee)
 * @param poolYes Current YES shares in the pool (x)
 * @param poolNo Current NO shares in the pool (y)
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

  // Pool adds netWager to No shares (y' = y + netWager)
  const newPoolNo = poolNo + netWager;
  // Pool reduces Yes shares to maintain k (x' = k / y')
  const newPoolYes = k / newPoolNo;

  // Shares user receives: S_yes = netWager + (x - x')
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
 * @param tokens Amount of tokens wagered by the user (gross, before 2% fee)
 * @param poolYes Current YES shares in the pool (x)
 * @param poolNo Current NO shares in the pool (y)
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

  // Pool adds netWager to Yes shares (x' = x + netWager)
  const newPoolYes = poolYes + netWager;
  // Pool reduces No shares to maintain k (y' = k / x')
  const newPoolNo = k / newPoolYes;

  // Shares user receives: S_no = netWager + (y - y')
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
 * @param shares Number of YES shares the user wants to sell (S)
 * @param poolYes Current YES shares in the pool (x)
 * @param poolNo Current NO shares in the pool (y)
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

  // Solve quadratic equation: T^2 - (L + y)T + (L*y - k) = 0
  // Note: L*y - k = (shares + x)*y - x*y = shares * y
  const a = 1;
  const b = -(L + poolNo);
  const c = shares * poolNo;

  const d = b * b - 4 * a * c;
  if (d < 0) {
    throw new Error("Invalid pool math: discriminant is negative");
  }

  // The smaller root is the correct token payout
  const grossTokens = (-b - Math.sqrt(d)) / (2 * a);

  // Verification check: cannot extract more than the pool's entire NO balance
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
 * @param shares Number of NO shares the user wants to sell (S)
 * @param poolYes Current YES shares in the pool (x)
 * @param poolNo Current NO shares in the pool (y)
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

  // Solve quadratic equation: T^2 - (L + x)T + (L*x - k) = 0
  // Note: L*x - k = (shares + y)*x - x*y = shares * x
  const a = 1;
  const b = -(L + poolYes);
  const c = shares * poolYes;

  const d = b * b - 4 * a * c;
  if (d < 0) {
    throw new Error("Invalid pool math: discriminant is negative");
  }

  // The smaller root is the correct token payout
  const grossTokens = (-b - Math.sqrt(d)) / (2 * a);

  // Verification check: cannot extract more than the pool's entire YES balance
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