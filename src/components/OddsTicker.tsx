"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Market } from "@/lib/supabase";
import { Sparkles, TrendingUp, X } from "lucide-react";

interface OddsTickerProps {
  markets: Market[];
}

export default function OddsTicker({ markets }: OddsTickerProps) {
  const [isVisible, setIsVisible] = useState(true);
  const activeMarkets = markets.filter(m => m.status === "active");

  if (!isVisible || activeMarkets.length === 0) return null;

  // Render the ticker items
  const renderItems = () => {
    return activeMarkets.map((market) => {
      const outcomes = market.outcomes || ["YES", "NO"];
      const prices = market.prices || outcomes.map(() => 1 / outcomes.length);
      const isBinary = outcomes.length === 2 && outcomes[0] === "YES" && outcomes[1] === "NO";

      return (
        <Link
          key={market.id}
          href={`/market/${market.id}`}
          className="inline-flex items-center gap-3 bg-slate-900/60 border border-white/5 px-4.5 py-1.5 rounded-full text-xs hover:bg-indigo-600/10 hover:border-indigo-500/30 hover:shadow-md hover:shadow-indigo-500/5 transition-all text-slate-300 font-sans cursor-pointer group shrink-0"
        >
          <span className="font-bold text-white group-hover:text-indigo-400 transition-colors">
            {market.question}
          </span>
          
          <div className="flex items-center gap-2 border-l border-white/10 pl-3 font-mono">
            {isBinary ? (
              <>
                <span className="text-[10px] uppercase font-bold text-emerald-400">
                  YES {Math.round(prices[0] * 100)}%
                </span>
                <span className="text-slate-600">/</span>
                <span className="text-[10px] uppercase font-bold text-red-400">
                  NO {Math.round(prices[1] * 100)}%
                </span>
              </>
            ) : (
              // Show top 2 options to keep it tidy
              outcomes.map((opt, idx) => ({ name: opt, price: prices[idx] }))
                .sort((a, b) => b.price - a.price)
                .slice(0, 2)
                .map((item, index) => (
                  <React.Fragment key={item.name}>
                    {index > 0 && <span className="text-slate-600">/</span>}
                    <span className="text-[10px] font-bold text-indigo-400 truncate max-w-[80px]">
                      {item.name} {Math.round(item.price * 100)}%
                    </span>
                  </React.Fragment>
                ))
            )}
          </div>
        </Link>
      );
    });
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/85 backdrop-blur-xl border-t border-indigo-500/20 shadow-2xl shadow-indigo-950/30 h-12 flex items-center select-none animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Left fixed indicator */}
      <div className="h-full flex items-center px-4 bg-slate-950 border-r border-white/5 text-[9px] uppercase font-black tracking-widest text-indigo-400 gap-2 shrink-0 z-10">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
        </span>
        <span className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3 text-indigo-400" />
          Live Odds
        </span>
      </div>

      {/* Ticker marquee */}
      <div className="flex-1 overflow-hidden relative h-full flex items-center">
        {/* Soft edge blur overlays */}
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-slate-950/80 to-transparent pointer-events-none z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-slate-950/80 to-transparent pointer-events-none z-10" />

        <div className="animate-marquee flex gap-8 py-1">
          {/* First iteration */}
          <div className="flex gap-8 shrink-0">
            {renderItems()}
          </div>
          {/* Second iteration to prevent seam gaps */}
          <div className="flex gap-8 shrink-0" aria-hidden="true">
            {renderItems()}
          </div>
        </div>
      </div>

      {/* Close button */}
      <button
        onClick={() => setIsVisible(false)}
        className="h-full px-4 hover:bg-white/5 border-l border-white/5 text-slate-500 hover:text-white transition-all cursor-pointer shrink-0 z-10"
        title="Hide Ticker"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
