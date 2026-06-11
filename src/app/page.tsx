import React from "react";
import Navbar from "@/components/Navbar";
import DashboardClient from "@/components/DashboardClient";
import LoginPage from "@/components/LoginPage";
import OddsTicker from "@/components/OddsTicker";
import { 
  getServerUser, 
  fetchAllUsers, 
  fetchMarkets, 
  fetchUserPositions, 
  fetchGlobalTransactions,
  fetchShameList
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // 1. Fetch current server-simulated user based on cookie & all users in parallel
  const [currentUser, allUsers] = await Promise.all([
    getServerUser(),
    fetchAllUsers(),
  ]);

  if (!currentUser) {
    return <LoginPage allUsers={allUsers} />;
  }

  // 2. Fetch all prediction markets, user positions, transactions, and the shame list in parallel
  const [markets, positions, globalTransactions, shameList] = await Promise.all([
    fetchMarkets(),
    fetchUserPositions(currentUser.id),
    fetchGlobalTransactions(),
    fetchShameList(),
  ]);

  // 3. Filter out markets where current user is tagged from the scrolling ticker
  const visibleTickerMarkets = markets.filter((m) => {
    const isInsider = m.tagged_users?.some((uname: string) => 
      uname.toLowerCase().trim() === currentUser.username.toLowerCase().trim()
    );
    return !isInsider;
  });

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-12">
      {/* Navbar with User Stats */}
      <Navbar currentUser={currentUser} allUsers={allUsers} />

      {/* Main Dashboard Panel */}
      <main className="flex-1 flex flex-col">
        <DashboardClient
          currentUser={currentUser}
          allUsers={allUsers}
          markets={markets}
          positions={positions}
          globalTransactions={globalTransactions}
          shameList={shameList}
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
