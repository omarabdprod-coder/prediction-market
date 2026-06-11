"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Market, UserProfile, UserPosition } from "@/lib/supabase";
import CreateMarketModal from "./CreateMarketModal";
import { Search, Compass, Clock, Award, ShieldAlert, ChevronRight, TrendingUp, Info } from "lucide-react";

interface DashboardClientProps {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  markets: Market[];
  positions: any[];
}

export default function DashboardClient({
  currentUser,
  allUsers,
  markets,
  positions,
}: DashboardClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"active" | "resolved" | "all">("active");
  const [sortBy, setSortBy] = useState<"newest" | "ending" | "alphabetical">("newest");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filter markets
  const filteredMarkets = markets.filter((m) => {
    // Insider Lockout: Hide if logged-in user is tagged
    const isInsider = m.tagged_users?.some(uname => 
      uname.toLowerCase().trim() === currentUser.username.toLowerCase().trim()
    );
    if (isInsider) return false;

    const matchesSearch =
      m.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.description || "").toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesTab =
      filterTab === "all" ||
      (filterTab === "active" && m.status === "active") ||
      (filterTab === "resolved" && m.status === "resolved");

    return matchesSearch && matchesTab;
  });

  // Sort markets
  const sortedMarkets = [...filteredMarkets].sort((a, b) => {
    if (sortBy === "newest") {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    } else if (sortBy === "ending") {
      return new Date(a.resolution_date).getTime() - new Date(b.resolution_date).getTime();
    } else if (sortBy === "alphabetical") {
      return a.question.localeCompare(b.question);
    }
    return 0;
  });

  // Calculate user portfolio stats
  const activePositions = positions.filter((p) => {
    const hasShares = p.yes_shares > 0 || p.no_shares > 0;
    const isInsider = p.market?.tagged_users?.some((uname: string) => 
      uname.toLowerCase().trim() === currentUser.username.toLowerCase().trim()
    );
    return hasShares && !isInsider;
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8 flex-1">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-indigo-500/10 bg-gradient-to-r from-indigo-950/40 via-slate-900/60 to-slate-900/60 p-6 sm:p-8">
        <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-indigo-500/5 blur-3xl" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Discord Prediction Market
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-slate-400">
              Welcome back, <span className="text-indigo-400 font-semibold">{currentUser.username}</span>. 
              Wager your tokens, trade live probabilities, and resolve community forecasts.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="glow-btn-purple cursor-pointer self-start sm:self-auto rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 hover:shadow-indigo-600/30 transition-all"
          >
            + Create New Market
          </button>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Markets List */}
        <div className="lg:col-span-8 space-y-6">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
            {/* Tabs */}
            <div className="flex rounded-xl bg-slate-950 p-1 border border-white/5 self-start">
              <button
                onClick={() => setFilterTab("active")}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  filterTab === "active"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Compass className="h-3.5 w-3.5" />
                Active
              </button>
              <button
                onClick={() => setFilterTab("resolved")}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  filterTab === "resolved"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Award className="h-3.5 w-3.5" />
                Resolved
              </button>
              <button
                onClick={() => setFilterTab("all")}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  filterTab === "all"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                All
              </button>
            </div>

            {/* Search & Sort Panel */}
            <div className="flex gap-3 flex-1 max-w-md items-stretch">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search predictions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 pl-11 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>

              {/* Sort selector */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all cursor-pointer"
              >
                <option value="newest">Sort: Newest</option>
                <option value="ending">Sort: Ending Soon</option>
                <option value="alphabetical">Sort: Alphabetical</option>
              </select>
            </div>
          </div>

          {/* Markets Cards Grid */}
          {sortedMarkets.length === 0 ? (
            <div className="glass-panel rounded-2xl p-12 text-center border border-dashed border-white/5 space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 border border-white/10 text-slate-400">
                <Search className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">No markets found</h3>
                <p className="text-xs text-slate-400">
                  Try refining your search query or check back later.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sortedMarkets.map((market) => {
                const yesPercent = Math.round((market.yesPrice || 0.5) * 100);
                const noPercent = 100 - yesPercent;

                 return (
                  <div
                    key={market.id}
                    className="glass-panel glass-panel-hover flex flex-col justify-between rounded-2xl overflow-hidden border border-white/5 bg-slate-900 shadow-lg hover:border-indigo-500/20 transition-all duration-300"
                  >
                    {/* Cover Image banner */}
                    <div className="h-28 w-full overflow-hidden relative border-b border-white/5 bg-slate-950">
                      <img
                        src={market.image_url || "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=500&auto=format&fit=crop&q=60"}
                        alt={market.question}
                        className="h-full w-full object-cover opacity-60 hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent opacity-90" />
                    </div>

                    <div className="p-5 flex flex-col justify-between flex-1 space-y-4">
                      {/* Header */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {market.status === "resolved" ? (
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded border bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                              Resolved {market.outcome}
                            </span>
                          ) : (
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 animate-pulse">
                              Active
                            </span>
                          )}
                          <span className="text-[10px] text-slate-500">
                            Ends {new Date(market.resolution_date).toLocaleDateString()}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-100 hover:text-indigo-400 transition-colors leading-snug">
                          <Link href={`/market/${market.id}`}>{market.question}</Link>
                        </h3>
                      </div>

                      {/* Progress representation */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                          <span className="flex items-center gap-1.5 text-emerald-400">
                            YES <span className="font-mono text-sm font-bold">{yesPercent}%</span>
                          </span>
                          <span className="flex items-center gap-1.5 text-red-400">
                            NO <span className="font-mono text-sm font-bold">{noPercent}%</span>
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-950 flex border border-white/5">
                          <div
                            style={{ width: `${yesPercent}%` }}
                            className="h-full bg-emerald-500 transition-all duration-500"
                          />
                          <div
                            style={{ width: `${noPercent}%` }}
                            className="h-full bg-red-500 transition-all duration-500"
                          />
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between border-t border-white/5 pt-4">
                        <span className="text-[10px] text-slate-500">
                          Initial pool 50 Tokens
                        </span>
                        <Link
                          href={`/market/${market.id}`}
                          className="flex items-center gap-1 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                          Trade
                          <ChevronRight className="h-4.5 w-4.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Sidebar Portfolio */}
        <div className="lg:col-span-4 space-y-6">
          {/* User Portfolio Holdings */}
          <div className="glass-panel rounded-2xl p-5 space-y-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-400" />
              Your Market Positions
            </h2>

            {activePositions.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4 text-center space-y-1">
                <p className="text-xs text-slate-400">You don't hold any positions yet.</p>
                <p className="text-[10px] text-slate-500">Find an active market and place a bet!</p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {activePositions.map((pos) => {
                  const m = pos.market;
                  if (!m) return null;
                  return (
                    <div key={pos.id} className="rounded-xl bg-slate-950/50 border border-white/5 p-3.5 space-y-3">
                      <div className="flex justify-between items-start gap-3">
                        <span className="text-xs font-bold text-slate-200 line-clamp-2 leading-snug flex-1">
                          <Link href={`/market/${m.id}`}>{m.question}</Link>
                        </span>
                        {m.status === "resolved" ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                            Claimable
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                            Live
                          </span>
                        )}
                      </div>

                      <div className="flex justify-between items-center text-xs border-t border-white/5 pt-2 font-mono">
                        <div>
                          {pos.yes_shares > 0 && (
                            <div className="flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              <span className="text-slate-400">YES:</span>
                              <span className="text-slate-100 font-bold">{pos.yes_shares.toFixed(1)} sh</span>
                            </div>
                          )}
                          {pos.no_shares > 0 && (
                            <div className="flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                              <span className="text-slate-400">NO:</span>
                              <span className="text-slate-100 font-bold">{pos.no_shares.toFixed(1)} sh</span>
                            </div>
                          )}
                        </div>
                        <Link href={`/market/${m.id}`} className="text-[10px] text-indigo-400 font-bold hover:underline">
                          View details
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sandbox Info */}
          <div className="glass-panel rounded-2xl p-5 border-l-2 border-l-indigo-500 space-y-3">
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Info className="h-4 w-4 text-indigo-400" />
              Discord Prediction Engine
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              This is a private sandboxed virtual predictions league. 
              Toggle different profiles from the persona menu on the navbar to simulate bets, test the slippage calculator, and practice cashing out winning shares.
            </p>
          </div>
        </div>
      </div>

      {/* Create Market Modal */}
      <CreateMarketModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        creatorId={currentUser.id}
        userBalance={currentUser.balance}
      />
    </div>
  );
}
