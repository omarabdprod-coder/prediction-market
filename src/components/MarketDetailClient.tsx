"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Market, UserProfile, UserPosition, LiquidityPool } from "@/lib/supabase";
import {
  calculateBuyYes,
  calculateBuyNo,
  calculateSellYes,
  calculateSellNo,
  getYesPrice,
  getNoPrice,
} from "@/lib/amm";
import {
  placeBetAction,
  sellBetAction,
  resolveMarketAction,
  claimPayoutAction,
} from "@/app/actions";
import {
  ArrowLeft,
  Coins,
  ShieldAlert,
  ArrowRightLeft,
  DollarSign,
  TrendingUp,
  Percent,
  Compass,
  Award,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

interface ChartPoint {
  time: Date;
  price: number;
}

function getPriceHistory(transactions: any[], initialYes = 50, initialNo = 50): ChartPoint[] {
  let x = initialYes;
  let y = initialNo;
  const k = x * y;
  const points: ChartPoint[] = [];

  const baseTime = transactions.length > 0
    ? new Date(transactions[0].created_at)
    : new Date();

  // Initial anchor point
  points.push({
    time: new Date(baseTime.getTime() - 1000 * 60 * 60 * 2),
    price: 50
  });

  const tradeTxs = transactions.filter(tx => tx.type !== "create_market");

  tradeTxs.forEach((tx) => {
    const tokens = Number(tx.amount_tokens);
    const fee = Number(tx.fee_tokens);

    if (tx.type === "buy_yes") {
      const net = tokens - fee;
      y = y + net;
      x = k / y;
    } else if (tx.type === "buy_no") {
      const net = tokens - fee;
      x = x + net;
      y = k / x;
    } else if (tx.type === "sell_yes") {
      const gross = tokens / 0.98;
      y = y - gross;
      x = k / y;
    } else if (tx.type === "sell_no") {
      const gross = tokens / 0.98;
      x = x - gross;
      y = k / x;
    }

    const price = y / (x + y);
    points.push({
      time: new Date(tx.created_at),
      price: Math.round(price * 100)
    });
  });

  return points;
}

function LineChart({ points }: { points: ChartPoint[] }) {
  if (points.length <= 1) {
    return (
      <div className="w-full bg-slate-950/40 rounded-xl border border-white/5 p-6 text-center text-xs text-slate-500 font-medium">
        Price history will display here once trades are executed.
      </div>
    );
  }

  const width = 500;
  const height = 150;
  const padding = 15;

  const svgPoints = points.map((p) => {
    const minTime = points[0].time.getTime();
    const maxTime = points[points.length - 1].time.getTime();
    const timeRange = maxTime - minTime || 1;
    const timeRatio = (p.time.getTime() - minTime) / timeRange;
    const x = padding + timeRatio * (width - 2 * padding);
    const priceRatio = p.price / 100;
    const y = height - padding - priceRatio * (height - 2 * padding);
    return { x, y, price: p.price, date: p.time };
  });

  let pathD = `M ${svgPoints[0].x} ${svgPoints[0].y}`;
  for (let i = 1; i < svgPoints.length; i++) {
    pathD += ` L ${svgPoints[i].x} ${svgPoints[i].y}`;
  }

  const areaD = `${pathD} L ${svgPoints[svgPoints.length - 1].x} ${height - padding} L ${svgPoints[0].x} ${height - padding} Z`;

  return (
    <div className="w-full bg-slate-950/40 rounded-xl border border-white/5 p-4 space-y-3 font-mono">
      <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
        <span>YES Price Chart</span>
        <span className="text-slate-500 font-normal">
          {points.length - 1} trade{points.length - 1 !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
          <defs>
            <linearGradient id="chart-glow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="line-gradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="rgba(255,255,255,0.03)" strokeDasharray="3" />
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="rgba(255,255,255,0.03)" strokeDasharray="3" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.06)" />

          {/* Filled Area */}
          <path d={areaD} fill="url(#chart-glow)" />

          {/* Line */}
          <path
            d={pathD}
            fill="none"
            stroke="url(#line-gradient)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Circles */}
          {svgPoints.slice(1).map((pt, i) => (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r="3.5"
              className="fill-emerald-400 stroke-slate-900 stroke-[1px] hover:r-[4.5px] transition-all cursor-pointer"
            >
              <title>{`${pt.price}% on ${pt.date.toLocaleString()}`}</title>
            </circle>
          ))}
        </svg>
      </div>
      <div className="flex justify-between text-[9px] text-slate-500 font-semibold uppercase tracking-wider">
        <span>Created</span>
        <span>Latest</span>
      </div>
    </div>
  );
}

interface MarketDetailClientProps {
  currentUser: UserProfile;
  market: any; // Market with creator
  pool: any;   // LiquidityPool with yesPrice and noPrice
  position: UserPosition | null;
  transactions: any[];
}

export default function MarketDetailClient({
  currentUser,
  market,
  pool,
  position,
  transactions,
}: MarketDetailClientProps) {
  const router = useRouter();
  const chartPoints = getPriceHistory(transactions);

  // Trade States
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [outcome, setOutcome] = useState<"YES" | "NO">("YES");
  const [amountInput, setAmountInput] = useState("");
  
  // Dynamic trade computation previews
  const [previewShares, setPreviewShares] = useState(0);
  const [previewTokens, setPreviewTokens] = useState(0);
  const [previewFee, setPreviewFee] = useState(0);
  const [previewAvgPrice, setPreviewAvgPrice] = useState(0);
  const [previewSlippage, setPreviewSlippage] = useState(0);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Resolution & Claim States
  const [adminOutcome, setAdminOutcome] = useState<"YES" | "NO">("YES");
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isCreator = market.creator_id === currentUser.id;
  const isMarketActive = market.status === "active";

  const yesPercent = Math.round((pool.yesPrice || 0.5) * 100);
  const noPercent = 100 - yesPercent;

  // Run AMM calculations client-side to provide a live preview as the user types
  useEffect(() => {
    setPreviewError(null);
    const value = parseFloat(amountInput);

    if (isNaN(value) || value <= 0) {
      setPreviewShares(0);
      setPreviewTokens(0);
      setPreviewFee(0);
      setPreviewAvgPrice(0);
      setPreviewSlippage(0);
      return;
    }

    try {
      if (tradeType === "buy") {
        // Validation: Cannot wager more tokens than balance
        if (value > currentUser.balance) {
          setPreviewError("Wager exceeds your available token balance");
          return;
        }

        if (outcome === "YES") {
          const res = calculateBuyYes(value, Number(pool.yes_shares), Number(pool.no_shares));
          setPreviewShares(res.shares);
          setPreviewFee(res.fee);
          setPreviewAvgPrice(res.avgPrice);
          setPreviewSlippage(res.slippage);
        } else {
          const res = calculateBuyNo(value, Number(pool.yes_shares), Number(pool.no_shares));
          setPreviewShares(res.shares);
          setPreviewFee(res.fee);
          setPreviewAvgPrice(res.avgPrice);
          setPreviewSlippage(res.slippage);
        }
      } else {
        // Sell Validation: Cannot sell more shares than user owns
        const ownedShares = outcome === "YES" ? (position?.yes_shares || 0) : (position?.no_shares || 0);
        if (value > Number(ownedShares)) {
          setPreviewError(`Insufficient shares. You only own ${Number(ownedShares).toFixed(1)} ${outcome} shares.`);
          return;
        }

        if (outcome === "YES") {
          const res = calculateSellYes(value, Number(pool.yes_shares), Number(pool.no_shares));
          setPreviewTokens(res.tokens);
          setPreviewFee(res.fee);
          setPreviewAvgPrice(res.avgPrice);
          setPreviewSlippage(res.slippage);
        } else {
          const res = calculateSellNo(value, Number(pool.yes_shares), Number(pool.no_shares));
          setPreviewTokens(res.tokens);
          setPreviewFee(res.fee);
          setPreviewAvgPrice(res.avgPrice);
          setPreviewSlippage(res.slippage);
        }
      }
    } catch (e: any) {
      setPreviewError(e.message || "Invalid trade amount (insufficient pool liquidity)");
    }
  }, [amountInput, tradeType, outcome, pool, currentUser.balance, position]);

  // Execute trade Server Action
  const handleTradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amountInput);
    if (isNaN(value) || value <= 0 || previewError) return;

    setActionLoading(true);
    setFeedbackMsg(null);

    let res;
    if (tradeType === "buy") {
      res = await placeBetAction(currentUser.id, market.id, outcome, value);
    } else {
      res = await sellBetAction(currentUser.id, market.id, outcome, value);
    }

    setActionLoading(false);

    if (res.success) {
      setFeedbackMsg({
        type: "success",
        text: tradeType === "buy"
          ? `Successfully bought ${res.data?.toFixed(2)} ${outcome} shares!`
          : `Successfully sold ${value} shares for ${res.data?.toFixed(2)} Tokens!`,
      });
      setAmountInput("");
    } else {
      setFeedbackMsg({
        type: "error",
        text: res.error || "Trade execution failed.",
      });
    }
  };

  // Resolve market (Creator only)
  const handleResolveMarket = async () => {
    if (!confirm(`Are you absolutely sure you want to resolve this market as ${adminOutcome}? This action is irreversible.`)) {
      return;
    }

    setActionLoading(true);
    setFeedbackMsg(null);

    const res = await resolveMarketAction(market.id, adminOutcome, currentUser.id);
    setActionLoading(false);

    if (res.success) {
      setFeedbackMsg({
        type: "success",
        text: `Market successfully resolved as ${adminOutcome}! The pool has been liquidated and LP tokens returned.`,
      });
    } else {
      setFeedbackMsg({
        type: "error",
        text: res.error || "Failed to resolve market.",
      });
    }
  };

  // Claim winning shares payout
  const handleClaimPayout = async () => {
    setActionLoading(true);
    setFeedbackMsg(null);

    const res = await claimPayoutAction(currentUser.id, market.id);
    setActionLoading(false);

    if (res.success) {
      setFeedbackMsg({
        type: "success",
        text: res.data && res.data > 0
          ? `Successfully cashed out your winning shares for ${res.data.toFixed(2)} Tokens!`
          : "Position claimed. You held losing shares (worth 0 tokens). Your position has been closed.",
      });
    } else {
      setFeedbackMsg({
        type: "error",
        text: res.error || "Failed to claim payout.",
      });
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6 flex-1">
      {/* Back link */}
      <div>
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Details & Outcome Info */}
        <div className="lg:col-span-8 space-y-6">
          {/* Main Info Card */}
          <div className="glass-panel rounded-2xl p-6 sm:p-8 space-y-6">
            {/* Tag/Meta */}
            <div className="flex flex-wrap items-center gap-3">
              {isMarketActive ? (
                <span className="text-[10px] font-black uppercase tracking-wider border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded animate-pulse">
                  Live
                </span>
              ) : (
                <span className="text-[10px] font-black uppercase tracking-wider border border-indigo-500/20 bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded">
                  Resolved {market.outcome}
                </span>
              )}
              <span className="text-xs text-slate-400">
                Resolution Date: <strong>{new Date(market.resolution_date).toLocaleString()}</strong>
              </span>
            </div>

            {/* Question */}
            <h1 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight leading-tight">
              {market.question}
            </h1>

            {/* Description */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Resolution details
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/40 rounded-xl border border-white/5 p-4 font-normal">
                {market.description || "No further description provided."}
              </p>
            </div>

            {/* Probability Scale */}
            <div className="space-y-4 border-t border-white/5 pt-6">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Market Probability
              </h3>

              <div className="flex items-center justify-between font-mono text-sm">
                <div className="space-y-1">
                  <span className="text-slate-400 text-xs font-semibold">YES Share Price</span>
                  <div className="text-xl font-black text-emerald-400 flex items-center gap-1">
                    {pool.yesPrice.toFixed(2)} T
                    <span className="text-xs font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
                      {yesPercent}%
                    </span>
                  </div>
                </div>

                <div className="space-y-1 text-right">
                  <span className="text-slate-400 text-xs font-semibold">NO Share Price</span>
                  <div className="text-xl font-black text-red-400 flex items-center gap-1 justify-end">
                    {pool.noPrice.toFixed(2)} T
                    <span className="text-xs font-bold bg-red-500/10 px-2 py-0.5 rounded">
                      {noPercent}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress representation */}
              <div className="h-3.5 w-full overflow-hidden rounded-full bg-slate-950 flex border border-white/5">
                <div
                  style={{ width: `${yesPercent}%` }}
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                />
                <div
                  style={{ width: `${noPercent}%` }}
                  className="h-full bg-gradient-to-l from-red-500 to-red-400 transition-all duration-500"
                />
              </div>

              {/* Dynamic SVG Price Chart */}
              <div className="pt-2">
                <LineChart points={chartPoints} />
              </div>
            </div>

            {/* Creator info */}
            <div className="flex items-center gap-3 border-t border-white/5 pt-6 text-xs text-slate-400">
              <span>Created by:</span>
              <div className="flex items-center gap-1.5 text-slate-200 font-semibold">
                <img
                  src={market.creator.avatar_url}
                  alt={market.creator.username}
                  className="h-5 w-5 rounded-full object-cover bg-slate-800"
                />
                <span>{market.creator.username}</span>
              </div>
              <span className="text-slate-600">|</span>
              <span>Pool liquidity reserves: {Number(pool.yes_shares).toFixed(0)} YES / {Number(pool.no_shares).toFixed(0)} NO</span>
            </div>
          </div>

          {/* User Holdings Position Card */}
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-400" />
              Your Position in this Market
            </h2>

            {/* Position Display */}
            {(!position || (position.yes_shares === 0 && position.no_shares === 0)) ? (
              <div className="rounded-xl border border-white/5 bg-slate-950/20 p-6 text-center text-slate-500 text-xs">
                You do not hold any shares in this market. Use the trade panel to buy shares!
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-slate-400">YES Shares</div>
                    <div className="text-lg font-black font-mono text-emerald-400">
                      {Number(position.yes_shares).toFixed(4)}
                    </div>
                  </div>
                  <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded">
                    YES
                  </span>
                </div>

                <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-slate-400">NO Shares</div>
                    <div className="text-lg font-black font-mono text-red-400">
                      {Number(position.no_shares).toFixed(4)}
                    </div>
                  </div>
                  <span className="text-[10px] bg-red-500/10 border border-red-500/20 text-red-400 font-bold px-2 py-0.5 rounded">
                    NO
                  </span>
                </div>
              </div>
            )}

            {/* Redeem Interface (If Resolved) */}
            {!isMarketActive && position && (Number(position.yes_shares) > 0 || Number(position.no_shares) > 0) && (
              <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Award className="h-4 w-4 text-indigo-400" />
                    Market Resolved
                  </h4>
                  <p className="text-xs text-slate-300">
                    This market has resolved as <strong>{market.outcome}</strong>. 
                    Redeem your winning positions for 1 Token per share. Losing shares resolution is 0.
                  </p>
                </div>
                <button
                  onClick={handleClaimPayout}
                  disabled={actionLoading}
                  className="glow-btn-purple cursor-pointer rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 transition-all shrink-0"
                >
                  {actionLoading ? "Claiming..." : "Redeem Winning Shares"}
                </button>
              </div>
            )}
          </div>

          {/* Recent Activity Table Card */}
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-indigo-400" />
              Recent Trade Activity
            </h2>

            {transactions.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-slate-950/20 p-6 text-center text-slate-500 text-xs">
                No transactions recorded for this market yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-[10px] text-slate-500 uppercase tracking-widest border-b border-white/5 pb-2">
                      <th className="py-2.5 font-bold">Trader</th>
                      <th className="py-2.5 font-bold">Action</th>
                      <th className="py-2.5 font-bold">Wager/Payout</th>
                      <th className="py-2.5 font-bold text-right font-sans">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {transactions.slice().reverse().slice(0, 5).map((tx) => {
                      const isBuy = tx.type.startsWith("buy");
                      const isYes = tx.type.endsWith("yes");
                      
                      return (
                        <tr key={tx.id} className="text-slate-300 font-mono">
                          <td className="py-3 flex items-center gap-2 font-sans font-medium text-slate-200">
                            <img
                              src={tx.user.avatar_url}
                              alt={tx.user.username}
                              className="h-5 w-5 rounded-full object-cover bg-slate-800"
                            />
                            <span className="max-w-[100px] truncate">{tx.user.username}</span>
                          </td>
                          <td className="py-3">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              isBuy 
                                ? "bg-indigo-500/10 text-indigo-400" 
                                : "bg-orange-500/10 text-orange-400"
                            }`}>
                              {isBuy ? "BUY" : "SELL"} {isYes ? "YES" : "NO"}
                            </span>
                          </td>
                          <td className="py-3">
                            <span className="text-slate-100 font-bold">
                              {Number(tx.amount_tokens).toFixed(1)} T
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              ({Number(tx.amount_shares).toFixed(1)} shares)
                            </span>
                          </td>
                          <td className="py-3 text-right text-slate-500 text-[10px] font-sans">
                            {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Admin Creator Resolution Box (Only visible if creator & active) */}
          {isCreator && isMarketActive && (
            <div className="glass-panel border-l-2 border-l-yellow-500 rounded-2xl p-6 space-y-4 bg-yellow-500/[0.02]">
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 text-yellow-500" />
                  Creator Resolution Dashboard
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  As the creator, you are responsible for resolving this market truthfully according to the resolution details. 
                  Once resolved, winning shares convert 1:1 into Tokens, and the LP reserves will be settled back to your balance.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between border-t border-white/5 pt-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => setAdminOutcome("YES")}
                    className={`rounded-xl px-4 py-2.5 text-xs font-bold border transition-all cursor-pointer ${
                      adminOutcome === "YES"
                        ? "bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/20"
                        : "text-slate-400 border-white/5 hover:text-white"
                    }`}
                  >
                    Resolve YES
                  </button>
                  <button
                    onClick={() => setAdminOutcome("NO")}
                    className={`rounded-xl px-4 py-2.5 text-xs font-bold border transition-all cursor-pointer ${
                      adminOutcome === "NO"
                        ? "bg-red-500 text-white border-red-400 shadow-lg shadow-red-500/20"
                        : "text-slate-400 border-white/5 hover:text-white"
                    }`}
                  >
                    Resolve NO
                  </button>
                </div>

                <button
                  onClick={handleResolveMarket}
                  disabled={actionLoading}
                  className="glow-btn-purple cursor-pointer rounded-xl bg-yellow-600 hover:bg-yellow-500 text-white px-5 py-2.5 text-xs font-bold shadow-lg transition-all"
                >
                  {actionLoading ? "Resolving..." : `Confirm Resolution: ${adminOutcome}`}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Buy/Sell Trade Deck */}
        <div className="lg:col-span-4 space-y-4">
          <div className="glass-panel rounded-2xl p-5 space-y-5">
            {/* Feedback notifications */}
            {feedbackMsg && (
              <div
                className={`flex items-start gap-2 rounded-xl p-3 text-xs border ${
                  feedbackMsg.type === "success"
                    ? "bg-emerald-500/5 text-emerald-400 border-emerald-500/20"
                    : "bg-red-500/5 text-red-400 border-red-500/20"
                }`}
              >
                {feedbackMsg.type === "success" ? (
                  <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
                ) : (
                  <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                )}
                <span>{feedbackMsg.text}</span>
              </div>
            )}

            {/* Header: Trade Type (Buy vs Sell) */}
            <div className="flex rounded-xl bg-slate-950 p-1 border border-white/5">
              <button
                onClick={() => {
                  setTradeType("buy");
                  setAmountInput("");
                }}
                disabled={!isMarketActive}
                className={`flex-1 rounded-lg py-2 text-center text-xs font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none ${
                  tradeType === "buy"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Buy
              </button>
              <button
                onClick={() => {
                  setTradeType("sell");
                  setAmountInput("");
                }}
                disabled={!isMarketActive}
                className={`flex-1 rounded-lg py-2 text-center text-xs font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none ${
                  tradeType === "sell"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Sell
              </button>
            </div>

            {/* Active Switcher: Outcome (YES vs NO) */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => setOutcome("YES")}
                disabled={!isMarketActive}
                className={`rounded-xl py-3 border font-black text-sm transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none ${
                  outcome === "YES"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-inner shadow-emerald-500/10"
                    : "text-slate-400 border-white/5 bg-slate-950/20 hover:text-slate-200"
                }`}
              >
                YES ({(pool.yesPrice * 100).toFixed(0)}%)
              </button>
              <button
                onClick={() => setOutcome("NO")}
                disabled={!isMarketActive}
                className={`rounded-xl py-3 border font-black text-sm transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none ${
                  outcome === "NO"
                    ? "bg-red-500/10 text-red-400 border-red-500/30 shadow-inner shadow-red-500/10"
                    : "text-slate-400 border-white/5 bg-slate-950/20 hover:text-slate-200"
                }`}
              >
                NO ({(pool.noPrice * 100).toFixed(0)}%)
              </button>
            </div>

            {/* Input Field */}
            {isMarketActive ? (
              <form onSubmit={handleTradeSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="amount" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
                    <span>{tradeType === "buy" ? "Wager Amount" : "Shares to Sell"}</span>
                    <span className="font-mono text-slate-300">
                      {tradeType === "buy"
                        ? `Bal: ${currentUser.balance.toFixed(1)} Tokens`
                        : `Owned: ${(outcome === "YES" ? (position?.yes_shares || 0) : (position?.no_shares || 0)).toFixed(1)} shares`}
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      id="amount"
                      type="number"
                      step="any"
                      min="0.0001"
                      required
                      placeholder="0.00"
                      value={amountInput}
                      onChange={(e) => setAmountInput(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white font-mono placeholder-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                      {tradeType === "buy" ? "Tokens" : "Shares"}
                    </span>
                  </div>
                </div>

                {/* Live Preview Specs */}
                {previewError ? (
                  <div className="text-xs text-red-400 flex items-center gap-1.5 bg-red-500/5 border border-red-500/10 rounded-lg p-2.5">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{previewError}</span>
                  </div>
                ) : (
                  amountInput && (
                    <div className="rounded-xl bg-slate-950 border border-white/5 p-3.5 space-y-2.5 text-xs text-slate-400 font-mono">
                      <div className="flex justify-between items-center">
                        <span>Net {tradeType === "buy" ? "Wager" : "Payout"}</span>
                        <span className="text-slate-200">
                          {tradeType === "buy" 
                            ? `${previewShares > 0 ? (parseFloat(amountInput) * 0.98).toFixed(2) : "0.00"} Tokens`
                            : `${previewTokens.toFixed(2)} Tokens`}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span>{tradeType === "buy" ? "Estimated Shares" : "Shares Redeemed"}</span>
                        <span className="text-slate-100 font-bold">
                          {tradeType === "buy"
                            ? `${previewShares.toFixed(4)} shares`
                            : `${parseFloat(amountInput).toFixed(4)} shares`}
                        </span>
                      </div>

                      <div className="flex justify-between items-center border-t border-white/5 pt-2">
                        <span>Avg Execution Price</span>
                        <span className="text-slate-200">
                          {previewAvgPrice.toFixed(4)} Tokens/share
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span>Slippage Impact</span>
                        <span className={`font-semibold ${previewSlippage > 0.05 ? "text-yellow-500" : "text-slate-400"}`}>
                          {(previewSlippage * 100).toFixed(2)}%
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span>Transaction Fee (2%)</span>
                        <span>{previewFee.toFixed(2)} Tokens</span>
                      </div>
                    </div>
                  )
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={actionLoading || !amountInput || !!previewError}
                  className={`glow-btn-purple w-full rounded-xl py-3.5 text-sm font-bold text-white shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none ${
                    outcome === "YES"
                      ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/10"
                      : "bg-red-600 hover:bg-red-500 shadow-red-600/10"
                  }`}
                >
                  {actionLoading
                    ? "Transacting..."
                    : tradeType === "buy"
                    ? `Buy YES shares`
                    : `Sell YES shares`}
                </button>
              </form>
            ) : (
              <div className="rounded-xl border border-white/5 bg-slate-950/30 p-8 text-center space-y-2 text-slate-500 text-xs">
                <Award className="h-8 w-8 text-indigo-400 opacity-60 mx-auto" />
                <p className="font-bold text-slate-300">Market Resolved</p>
                <p className="leading-relaxed">
                  Trading has ended. If you held winning positions, you can claim your cash out rewards from the holdings panel.
                </p>
              </div>
            )}
          </div>

          {/* Helper details */}
          <div className="rounded-xl border border-white/5 bg-slate-950/20 p-4 space-y-2 text-xs text-slate-400 leading-relaxed font-normal">
            <h4 className="font-bold text-white uppercase tracking-wider text-[10px]">Trading instructions</h4>
            <p>
              Prices range from 0.01 to 0.99 tokens. The share price equates to the current probability. 
              Buying NO shares increases NO probability, and vice versa. 2% trade fees are allocated to the market creator.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
