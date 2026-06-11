"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Market, UserProfile, UserPosition } from "@/lib/supabase";
import CreateMarketModal from "./CreateMarketModal";
import { Search, Compass, Clock, Award, ShieldAlert, ChevronRight, TrendingUp, Info, Trophy, Activity, MessageSquare, Send, Users } from "lucide-react";

interface DashboardClientProps {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  markets: Market[];
  positions: any[];
  globalTransactions?: any[];
}

const TWITCH_COLORS = [
  "text-red-400",
  "text-blue-400",
  "text-emerald-400",
  "text-amber-400",
  "text-pink-400",
  "text-purple-400",
  "text-cyan-400",
  "text-orange-400",
  "text-fuchsia-400",
];

function getTwitchColor(username: string) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % TWITCH_COLORS.length;
  return TWITCH_COLORS[index];
}

export default function DashboardClient({
  currentUser,
  allUsers,
  markets,
  positions,
  globalTransactions = [],
}: DashboardClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"active" | "resolved" | "all">("active");
  const [sortBy, setSortBy] = useState<"newest" | "ending" | "alphabetical">("newest");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Chat Feed State
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new message
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  useEffect(() => {
    // Convert transactions to Twitch chat logs
    const formattedTxs = (globalTransactions || []).map((tx, idx) => {
      const isBuy = tx.type === "buy" || tx.type === "buy_yes" || tx.type.startsWith("buy");
      const isSell = tx.type === "sell" || tx.type === "sell_yes" || tx.type.startsWith("sell");
      const isCreate = tx.type === "create_market";
      
      const outcomes = tx.market?.outcomes || ["YES", "NO"];
      let outcomeName = "YES";
      if (tx.outcome_index !== undefined && tx.outcome_index !== null) {
        outcomeName = outcomes[tx.outcome_index] || "YES";
      }

      let content: React.ReactNode = "";
      let emote = "";
      let emoteColor = "text-indigo-400";
      
      if (isBuy) {
        content = (
          <span>
            bet <span className="text-white font-bold">{Number(tx.amount_tokens).toFixed(0)} T</span> on{" "}
            <span className="text-emerald-400 font-bold">"{outcomeName}"</span> in{" "}
            <Link href={`/market/${tx.market_id}`} className="text-indigo-400 hover:underline font-semibold font-sans">
              {tx.market?.question}
            </Link>
          </span>
        );
        emote = "PogChamp 🚀";
        emoteColor = "text-emerald-400";
      } else if (isSell) {
        content = (
          <span>
            sold <span className="text-white font-bold">{Number(tx.amount_shares).toFixed(0)} shares</span> of{" "}
            <span className="text-orange-400 font-bold">"{outcomeName}"</span> on{" "}
            <Link href={`/market/${tx.market_id}`} className="text-indigo-400 hover:underline font-semibold font-sans">
              {tx.market?.question}
            </Link>{" "}
            for <span className="text-white font-bold">{Number(tx.amount_tokens).toFixed(0)} T</span>
          </span>
        );
        emote = "monkaS 📉";
        emoteColor = "text-orange-400";
      } else if (isCreate) {
        content = (
          <span>
            created a new market:{" "}
            <Link href={`/market/${tx.market_id}`} className="text-indigo-400 hover:underline font-semibold font-sans">
              {tx.market?.question}
            </Link>
          </span>
        );
        emote = "HYPERS 🔮";
        emoteColor = "text-purple-400";
      } else {
        content = (
          <span>
            claimed a payout of <span className="text-white font-bold">{Number(tx.amount_tokens).toFixed(0)} T</span> on{" "}
            <Link href={`/market/${tx.market_id}`} className="text-indigo-400 hover:underline font-semibold font-sans">
              {tx.market?.question}
            </Link>
          </span>
        );
        emote = "EZ 🏆";
        emoteColor = "text-yellow-400";
      }

      const isMod = tx.user?.username.toLowerCase() === "marketmaker";
      const isBroadcaster = tx.market?.creator_id === tx.user?.id;
      const badges = [];
      if (isMod) badges.push("🛡️");
      else if (isBroadcaster) badges.push("👑");
      else if (Number(tx.user?.balance || 0) > 2000) badges.push("💎");
      else badges.push("🔮");

      return {
        id: tx.id || `tx-${idx}`,
        username: tx.user?.username || "Trader",
        avatarUrl: tx.user?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${idx}`,
        content,
        emote,
        emoteColor,
        badges,
        timestamp: new Date(tx.created_at || Date.now()),
      };
    });

    // Fun default comments
    const defaultChats = [
      {
        id: "chat-1",
        username: "Kabir",
        avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=Kabir",
        content: "This prediction league is getting wild, who is top of the leaderboard? 👀",
        emote: "monkaS 📉",
        emoteColor: "text-orange-400",
        badges: ["💎"],
        timestamp: new Date(Date.now() - 1000 * 60 * 12),
      },
      {
        id: "chat-2",
        username: "Adi",
        avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=Adi",
        content: "Double down on YES for BTC! Free tokens 🚀",
        emote: "PogChamp 🚀",
        emoteColor: "text-emerald-400",
        badges: ["🔮"],
        timestamp: new Date(Date.now() - 1000 * 60 * 8),
      },
      {
        id: "chat-3",
        username: "Omar H",
        avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=OmarH",
        content: "Wait, someone just resolve-locked my bet? PepeLaugh",
        emote: "LUL 🎭",
        emoteColor: "text-yellow-400",
        badges: ["👑"],
        timestamp: new Date(Date.now() - 1000 * 60 * 3),
      }
    ];

    const combined = [...defaultChats, ...formattedTxs].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    setChatMessages(combined);
  }, [globalTransactions]);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = {
      id: `chat-${Math.random().toString(36).substring(2, 11)}`,
      username: currentUser.username,
      avatarUrl: currentUser.avatar_url,
      content: chatInput.trim(),
      emote: "Pog 💬",
      emoteColor: "text-indigo-400",
      badges: currentUser.username.toLowerCase() === "marketmaker" ? ["🛡️"] : ["🔮"],
      timestamp: new Date(),
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput("");

    // Simulate mock reply from players list 1.5 seconds later
    setTimeout(() => {
      const PLAYERS = ["Adi", "Omar H", "Omar A", "Kabir", "Lorenzo", "Aditya", "Jad", "Adam", "Omar Debas", "Rosslan", "Sami", "Aashis"];
      const randomPlayer = PLAYERS[Math.floor(Math.random() * PLAYERS.length)];
      
      const BOT_REPLIES = [
        "POGGERS, that bet is free money! 🚀",
        "no way that outcome wins, pure copium LUL 🎭",
        "MarketMaker print more tokens please! EZ 🏆",
        "Double down! monkaS 📉",
        "Is that insider trading I see? monkaS 📉",
        "EZ tokens, thanks for the liquidity 🏆",
        "Who bet YES? absolute gigachad Pog",
        "This league is getting wild PogChamp 🚀",
        "What are those odds? PepeLaugh 🎭",
        "I'm all-in on None for guest join PepeLaugh 🎭",
      ];
      const randomReply = BOT_REPLIES[Math.floor(Math.random() * BOT_REPLIES.length)];

      const botMessage = {
        id: `chat-${Math.random().toString(36).substring(2, 11)}`,
        username: randomPlayer,
        avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${randomPlayer}`,
        content: randomReply,
        emote: "",
        emoteColor: "text-slate-400",
        badges: ["🔮"],
        timestamp: new Date(),
      };

      setChatMessages(prev => [...prev, botMessage]);
    }, 1500);
  };

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
              The True Saga of Paul Pogchamp
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-slate-400">
              Welcome back, <span className="text-indigo-400 font-semibold">{currentUser.username}</span>. 
              Trade live event probabilities, resolve forecasts, and top the community leaderboard.
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
                const outcomes = market.outcomes || ["YES", "NO"];
                const prices = market.prices || outcomes.map(() => 0.5);
                const isBinary = outcomes.length === 2 && outcomes[0] === "YES" && outcomes[1] === "NO";

                const yesPercent = isBinary ? Math.round((prices[0] || 0.5) * 100) : 50;
                const noPercent = isBinary ? 100 - yesPercent : 50;

                const sortedOptions = outcomes.map((name, idx) => ({
                  name,
                  percent: Math.round((prices[idx] || 0.0) * 100)
                })).sort((a, b) => b.percent - a.percent);

                 return (
                  <div
                    key={market.id}
                    className="glass-panel glass-panel-hover flex flex-col justify-between rounded-2xl overflow-hidden border border-white/5 bg-slate-900 shadow-lg hover:border-indigo-500/20 transition-all duration-300"
                  >
                    {/* Cover Image banner */}
                    <div className="h-36 w-full overflow-hidden relative border-b border-white/5 bg-slate-950">
                      <img
                        src={market.image_url || "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=500&auto=format&fit=crop&q=60"}
                        alt={market.question}
                        className="h-full w-full object-cover opacity-90 hover:opacity-100 hover:scale-105 transition-all duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
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
                      {isBinary ? (
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
                      ) : (
                        <div className="space-y-2.5">
                          {sortedOptions.slice(0, 3).map((opt) => (
                            <div key={opt.name} className="space-y-1">
                              <div className="flex justify-between text-[11px] font-medium text-slate-400">
                                <span className="truncate max-w-[170px] text-slate-300 font-semibold">{opt.name}</span>
                                <span className="font-mono text-xs font-bold text-indigo-400">{opt.percent}%</span>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-slate-950 overflow-hidden border border-white/5">
                                <div
                                  style={{ width: `${opt.percent}%` }}
                                  className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                                />
                              </div>
                            </div>
                          ))}
                          {outcomes.length > 3 && (
                            <div className="text-[10px] text-slate-500 text-right font-medium italic">
                              + {outcomes.length - 3} other outcome{outcomes.length - 3 !== 1 ? "s" : ""}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between border-t border-white/5 pt-4">
                        <span className="text-[10px] text-slate-500">
                          LMSR liquidity pool
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
                  const outcomes = m.outcomes || ["YES", "NO"];

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

                      <div className="flex flex-col gap-1.5 text-xs border-t border-white/5 pt-2 font-mono w-full">
                        <div className="space-y-1">
                          {outcomes.map((opt: string, idx: number) => {
                            const shares = pos.shares ? pos.shares[idx] : (idx === 0 ? pos.yes_shares : pos.no_shares);
                            const shNum = Number(shares || 0);
                            if (shNum <= 0) return null;
                            return (
                              <div key={opt} className="flex items-center justify-between text-slate-400 text-[11px]">
                                <span className="flex items-center gap-1 font-sans">
                                  <span className={`h-1.5 w-1.5 rounded-full ${idx === 0 ? "bg-indigo-500" : "bg-slate-600"}`} />
                                  <span className="truncate max-w-[100px]">{opt}:</span>
                                </span>
                                <span className="text-slate-100 font-bold">{shNum.toFixed(1)} sh</span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-end pt-1">
                          <Link href={`/market/${m.id}`} className="text-[10px] text-indigo-400 font-bold hover:underline font-sans">
                            View details
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Leaderboard Card */}
          <div className="glass-panel rounded-2xl p-5 space-y-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Trophy className="h-4 w-4 text-indigo-400" />
              Leaderboard
            </h2>
            <div className="space-y-2.5">
              {[...allUsers]
                .sort((a, b) => b.balance - a.balance)
                .slice(0, 5)
                .map((user, idx) => {
                  const ranks = ["🥇", "🥈", "🥉", "4th", "5th"];
                  return (
                    <div key={user.id} className="flex items-center justify-between rounded-xl bg-slate-950/30 border border-white/5 px-3 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-sans font-bold text-slate-400 w-6">
                          {ranks[idx]}
                        </span>
                        <img
                          src={user.avatar_url}
                          alt={user.username}
                          className="h-6 w-6 rounded-full object-cover bg-slate-800"
                        />
                        <span className="font-semibold text-slate-200 truncate max-w-[100px]">
                          {user.username}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-slate-100">
                        {user.balance.toFixed(0)} T
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Twitch Live Stream Chat Feed */}
          <div className="glass-panel rounded-2xl p-5 space-y-4 flex flex-col h-[480px]">
            <div className="flex items-center justify-between border-b border-white/5 pb-3 shrink-0">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-indigo-400 animate-pulse" />
                Live Stream Chat
              </h2>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                {12 + (globalTransactions?.length || 0)} Viewers
              </div>
            </div>

            {/* Chat Messages Box */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-3 scroll-smooth min-h-0">
              {chatMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500 text-xs font-mono">
                  Connecting to server...
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const twitchColor = getTwitchColor(msg.username);
                  return (
                    <div key={msg.id} className="text-xs leading-relaxed font-sans animate-in fade-in duration-200">
                      <span className="text-[10px] text-slate-600 font-mono mr-1.5">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      
                      {/* Badges */}
                      <span className="mr-1 inline-flex gap-0.5 select-none">
                        {msg.badges.map((b: string, bi: number) => (
                          <span key={bi} className="text-[11px]" title="Chat badge">
                            {b}
                          </span>
                        ))}
                      </span>

                      {/* Username */}
                      <span className={`font-bold mr-1.5 ${twitchColor} cursor-pointer hover:underline`}>
                        {msg.username}
                      </span>

                      {/* Message Content */}
                      <span className="text-slate-300 font-medium break-all">
                        {msg.content}
                      </span>

                      {/* Emote Badge */}
                      {msg.emote && (
                        <span className={`inline-block ml-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold font-mono bg-white/5 border border-white/5 ${msg.emoteColor} select-none`}>
                          {msg.emote}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendChat} className="flex gap-2 border-t border-white/5 pt-3 shrink-0">
              <input
                type="text"
                placeholder="Send a prediction chat message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                maxLength={100}
                className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl px-3 py-2 text-xs font-bold transition-all cursor-pointer flex items-center justify-center shrink-0 active:scale-95"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>

          {/* Sandbox Info */}
          <div className="glass-panel rounded-2xl p-5 border-l-2 border-l-indigo-500 space-y-3">
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Info className="h-4 w-4 text-indigo-400" />
              TTSOPP Prediction Engine
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              This is a private sandboxed virtual predictions league for The True Saga of Paul Pogchamp. 
              Toggle different profiles to simulate bets, test the AMM slippage calculator, and resolve forecasts.
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
