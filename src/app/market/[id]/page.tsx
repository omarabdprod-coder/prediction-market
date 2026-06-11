import React from "react";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import MarketDetailClient from "@/components/MarketDetailClient";
import LoginPage from "@/components/LoginPage";
import {
  getServerUser,
  fetchAllUsers,
  fetchMarketDetails,
  fetchUserPositions,
  fetchMarketTransactions,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MarketDetailPage({ params }: PageProps) {
  // 1. Await parameters to get market ID
  const { id: marketId } = await params;

  // 2. Fetch active session user
  const currentUser = await getServerUser();
  const allUsers = await fetchAllUsers();

  if (!currentUser) {
    return <LoginPage allUsers={allUsers} />;
  }

  let marketData;
  try {
    // 3. Fetch detailed market data and liquidity reserves
    marketData = await fetchMarketDetails(marketId);
  } catch (e) {
    console.error(`Error loading market ${marketId}:`, e);
    return notFound();
  }

  if (!marketData || !marketData.market) {
    return notFound();
  }

  // 4. Fetch position for this market
  const userPositions = await fetchUserPositions(currentUser.id);
  const position = userPositions.find((p) => p.market_id === marketId) || null;

  // 5. Fetch market transactions history for the chart and table
  const transactions = await fetchMarketTransactions(marketId);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
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
    </div>
  );
}
