import React from "react";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import MarketDetailClient from "@/components/MarketDetailClient";
import LoginPage from "@/components/LoginPage";
import OddsTicker from "@/components/OddsTicker";
import {
  getServerUser,
  fetchAllUsers,
  fetchMarketDetails,
  fetchUserPositions,
  fetchMarketTransactions,
  fetchMarkets,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MarketDetailPage({ params }: PageProps) {
  // 1. Await parameters to get market ID
  const { id: marketId } = await params;

  // 2. Fetch active session user and all users in parallel
  const [currentUser, allUsers] = await Promise.all([
    getServerUser(),
    fetchAllUsers(),
  ]);

  if (!currentUser) {
    return <LoginPage allUsers={allUsers} />;
  }

  let markets: any[] = [];
  let marketData: any = null;
  let userPositions: any[] = [];
  let transactions: any[] = [];

  try {
    // 3. Fetch details, positions, ticker markets, and transactions in parallel
    const [marketsRes, marketDetailsRes, userPositionsRes, transactionsRes] = await Promise.all([
      fetchMarkets(),
      fetchMarketDetails(marketId),
      fetchUserPositions(currentUser.id),
      fetchMarketTransactions(marketId),
    ]);
    markets = marketsRes;
    marketData = marketDetailsRes;
    userPositions = userPositionsRes;
    transactions = transactionsRes;
  } catch (e) {
    console.error(`Error loading market ${marketId}:`, e);
    return notFound();
  }

  if (!marketData || !marketData.market) {
    return notFound();
  }

  const position = userPositions.find((p) => p.market_id === marketId) || null;

  // 4. Filter out markets where current user is tagged from the scrolling ticker
  const visibleTickerMarkets = markets.filter((m) => {
    const isInsider = m.tagged_users?.some((uname: string) => 
      uname.toLowerCase().trim() === currentUser.username.toLowerCase().trim()
    );
    return !isInsider;
  });

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-12">
      {/* Navbar with stats */}
      <Navbar currentUser={currentUser} allUsers={allUsers} />

      {/* Main detail workspace */}
      <main className="flex-1 flex flex-col">
        <MarketDetailClient
          currentUser={currentUser}
          market={marketData.market}
          pool={marketData.pool}
          position={position}
          transactions={transactions}
        />
      </main>

      {/* Global Footer */}
      <footer className="w-full border-t border-white/5 py-4 text-center text-xs text-slate-500 bg-slate-950/20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          &copy; {new Date().getFullYear()} TTSOPP Prediction Markets. Private Discord Community Sandbox.
        </div>
      </footer>

      {/* Live scrolling odds ticker */}
      <OddsTicker markets={visibleTickerMarkets} />
    </div>
  );
}
