import React from "react";
import Navbar from "@/components/Navbar";
import DashboardClient from "@/components/DashboardClient";
import LoginPage from "@/components/LoginPage";
import { getServerUser, fetchAllUsers, fetchMarkets, fetchUserPositions } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // 1. Fetch current server-simulated user based on cookie
  const currentUser = await getServerUser();

  // 2. Fetch all users for the persona switcher
  const allUsers = await fetchAllUsers();

  if (!currentUser) {
    return <LoginPage allUsers={allUsers} />;
  }

  // 3. Fetch all active and resolved prediction markets
  const markets = await fetchMarkets();

  // 4. Fetch the current user's positions
  const positions = await fetchUserPositions(currentUser.id);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Navbar with User Stats & Selector */}
      <Navbar currentUser={currentUser} allUsers={allUsers} />

      {/* Main Dashboard Panel */}
      <main className="flex-1 flex flex-col">
        <DashboardClient
          currentUser={currentUser}
          allUsers={allUsers}
          markets={markets}
          positions={positions}
        />
      </main>

      {/* Global Footer */}
      <footer className="w-full border-t border-white/5 py-4 text-center text-xs text-slate-500 bg-slate-950/20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          &copy; {new Date().getFullYear()} Antigravity Prediction Markets. Private Discord Community Sandbox.
        </div>
      </footer>
    </div>
  );
}
