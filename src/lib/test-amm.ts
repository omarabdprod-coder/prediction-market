import {
  calculateBuyYes,
  calculateBuyNo,
  calculateSellYes,
  calculateSellNo,
  getYesPrice,
  getNoPrice,
} from "./amm";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function runTests() {
  console.log("Running AMM mathematical tests...");

  // 1. Initial State
  const initialYes = 50;
  const initialNo = 50;
  const k = initialYes * initialNo; // 2500

  assert(getYesPrice(initialYes, initialNo) === 0.5, "Starting YES price should be 50%");
  assert(getNoPrice(initialYes, initialNo) === 0.5, "Starting NO price should be 50%");
  console.log("✓ Initial state prices are 50/50");

  // 2. Buy YES
  const buyAmount = 10; // wager 10 tokens
  const buyYesResult = calculateBuyYes(buyAmount, initialYes, initialNo);
  
  // Fee = 10 * 0.02 = 0.2 tokens. Net wager = 9.8 tokens.
  assert(buyYesResult.fee === 0.2, "Fee should be 2%");
  assert(buyYesResult.tokens === 9.8, "Net tokens should be 9.8");
  
  // Pool No becomes 50 + 9.8 = 59.8
  // Pool Yes becomes 2500 / 59.8 = 41.80602
  // Shares received = 9.8 + (50 - 41.80602) = 17.99398
  assert(Math.abs(buyYesResult.newPoolNo - 59.8) < 1e-5, "New pool NO should be 59.8");
  assert(Math.abs(buyYesResult.newPoolYes * buyYesResult.newPoolNo - k) < 1e-5, "Product k should remain constant");
  
  const expectedYesShares = 9.8 + (50 - 2500 / 59.8);
  assert(Math.abs(buyYesResult.shares - expectedYesShares) < 1e-5, "Shares received check");
  assert(buyYesResult.priceAfter > buyYesResult.priceBefore, "Price of YES should increase after buying YES");
  
  console.log(`✓ Buy YES calculation details:
    Wager: ${buyAmount} tokens
    Fee: ${buyYesResult.fee} tokens
    YES Shares Received: ${buyYesResult.shares.toFixed(4)}
    Price Before: ${(buyYesResult.priceBefore * 100).toFixed(2)}%
    Price After: ${(buyYesResult.priceAfter * 100).toFixed(2)}%
    Avg Price: ${buyYesResult.avgPrice.toFixed(4)} tokens/share
    Slippage: ${(buyYesResult.slippage * 100).toFixed(2)}%`);

  // 3. Sell YES back
  // Let's sell the exact amount of YES shares received to see if we get back the net wager amount
  const sellYesResult = calculateSellYes(buyYesResult.shares, buyYesResult.newPoolYes, buyYesResult.newPoolNo);
  
  // Check that new pool values return back to initial pool values (within precision limits)
  assert(Math.abs(sellYesResult.newPoolYes - initialYes) < 1e-4, "Selling back should restore pool YES inventory");
  assert(Math.abs(sellYesResult.newPoolNo - initialNo) < 1e-4, "Selling back should restore pool NO inventory");
  
  // Gross tokens received should be 9.8 tokens (since that was the net wager)
  const grossTokensReceived = sellYesResult.tokens + sellYesResult.fee;
  assert(Math.abs(grossTokensReceived - 9.8) < 1e-4, "Gross tokens received on sell back should match net wager");
  
  console.log(`✓ Sell YES calculation details:
    Shares Sold: ${buyYesResult.shares.toFixed(4)}
    Gross Tokens Returned: ${grossTokensReceived.toFixed(4)}
    Fee Paid on Sell: ${sellYesResult.fee.toFixed(4)}
    Net Tokens Received: ${sellYesResult.tokens.toFixed(4)}
    Price After Sell: ${(sellYesResult.priceAfter * 100).toFixed(2)}%`);

  // 4. Buy NO
  const buyNoResult = calculateBuyNo(buyAmount, initialYes, initialNo);
  assert(buyNoResult.fee === 0.2, "Buy NO fee should be 2%");
  assert(buyNoResult.tokens === 9.8, "Buy NO net tokens should be 9.8");
  assert(Math.abs(buyNoResult.newPoolYes - 59.8) < 1e-5, "New pool YES should be 59.8 after buying NO");
  assert(Math.abs(buyNoResult.newPoolYes * buyNoResult.newPoolNo - k) < 1e-5, "Product k should remain constant for Buy NO");
  assert(buyNoResult.priceAfter > buyNoResult.priceBefore, "Price of NO should increase after buying NO");

  console.log(`✓ Buy NO calculation details:
    Wager: ${buyAmount} tokens
    NO Shares Received: ${buyNoResult.shares.toFixed(4)}
    Price Before: ${(buyNoResult.priceBefore * 100).toFixed(2)}%
    Price After: ${(buyNoResult.priceAfter * 100).toFixed(2)}%`);

  // 5. Sell NO back
  const sellNoResult = calculateSellNo(buyNoResult.shares, buyNoResult.newPoolYes, buyNoResult.newPoolNo);
  assert(Math.abs(sellNoResult.newPoolYes - initialYes) < 1e-4, "Selling back NO should restore pool YES inventory");
  assert(Math.abs(sellNoResult.newPoolNo - initialNo) < 1e-4, "Selling back NO should restore pool NO inventory");

  console.log("✓ Sell NO calculation details were successful");
  console.log("All AMM mathematical tests passed successfully!");
}

try {
  runTests();
} catch (e) {
  console.error("Test failed!", e);
  process.exit(1);
}