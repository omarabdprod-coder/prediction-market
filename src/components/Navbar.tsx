"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { UserProfile } from "@/lib/supabase";
import { Coins, ChevronDown, LogIn, User } from "lucide-react";

interface NavbarProps {
  currentUser: UserProfile;
  allUsers?: UserProfile[];
}

export default function Navbar({ currentUser, allUsers = [] }: NavbarProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [isDev, setIsDev] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const devParam = searchParams.get("dev");
      
      if (devParam === "true") {
        localStorage.setItem("dev_mode", "true");
        setIsDev(true);
      } else if (devParam === "false") {
        localStorage.setItem("dev_mode", "false");
        setIsDev(false);
      } else {
        const storedDev = localStorage.getItem("dev_mode");
        if (storedDev === "true") {
          setIsDev(true);
        }
      }
    }
  }, []);

  const handlePersonaChange = (userId: string) => {
    document.cookie = `persona=${userId}; path=/; max-age=31536000; SameSite=Lax`;
    setShowDropdown(false);
    window.location.reload();
  };

  const handleAvatarDoubleClick = () => {
    const newDevState = !isDev;
    setIsDev(newDevState);
    localStorage.setItem("dev_mode", newDevState ? "true" : "false");
    alert(`Developer Mode ${newDevState ? "ENABLED" : "DISABLED"}`);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-slate-950/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2 font-sans font-black tracking-tight text-xl text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/20">
              P
            </span>
            <span>TTSOPP</span>
            <span className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full font-semibold">
              MARKETS
            </span>
          </Link>
        </div>

        {/* User Stats & Persona Switcher */}
        <div className="flex items-center gap-4">
          {/* Balance Widget & Faucet */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-full bg-slate-900 border border-white/5 px-4 py-1.5 shadow-inner">
              <Coins className="h-4.5 w-4.5 text-yellow-500 fill-yellow-500/20" />
              <span className="font-mono text-sm font-bold text-slate-100">
                {currentUser.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs font-semibold text-slate-400">Tokens</span>
            </div>
            
            {currentUser.username.toLowerCase() === "marketmaker" && (
              <button
                onClick={async () => {
                  const { claimFaucetAction } = await import("@/app/actions");
                  const res = await claimFaucetAction(currentUser.id);
                  if (res.success) {
                    window.location.reload();
                  } else {
                    alert(res.error || "Faucet failed");
                  }
                }}
                title="Get +1,000 Tokens (Faucet)"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-600/20 hover:text-emerald-300 hover:border-emerald-500/30 transition-all cursor-pointer font-bold text-lg active:scale-95"
              >
                +
              </button>
            )}
          </div>

          {/* Persona Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              onDoubleClick={handleAvatarDoubleClick}
              className={`flex items-center gap-2.5 rounded-full pl-2 pr-3 py-1 text-sm font-medium text-slate-200 transition-all cursor-pointer ${
                isDev 
                  ? "bg-amber-600/10 border border-amber-500/30 hover:bg-amber-600/20" 
                  : "bg-indigo-600/10 border border-indigo-500/20 hover:bg-indigo-600/20"
              }`}
              title="Double-click to toggle developer options"
            >
              <img
                src={currentUser.avatar_url}
                alt={currentUser.username}
                className={`h-7 w-7 rounded-full object-cover bg-slate-800 border ${
                  isDev ? "border-amber-500/50" : "border-indigo-500/30"
                }`}
              />
              <span className="max-w-[120px] truncate">{currentUser.username}</span>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>

            {showDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10 cursor-default"
                  onClick={() => setShowDropdown(false)}
                />
                <div className="absolute right-0 mt-2 z-20 w-64 rounded-xl border border-white/10 bg-slate-950 p-3 shadow-2xl shadow-black/80 animate-in fade-in slide-in-from-top-2 duration-150 space-y-3">
                  <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                    <img
                      src={currentUser.avatar_url}
                      alt={currentUser.username}
                      className="h-10 w-10 rounded-full border border-white/10 object-cover bg-slate-800"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-sm text-white truncate">{currentUser.username}</span>
                      <span className="text-xs text-indigo-400 font-medium">Logged in</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs text-slate-400 py-1">
                      <span>Total Balance:</span>
                      <span className="font-bold text-slate-200 font-mono">
                        {currentUser.balance.toFixed(2)} T
                      </span>
                    </div>
                  </div>

                  {/* Hidden Dev Mode Persona Switcher Drawer */}
                  {isDev && allUsers.length > 0 && (
                    <div className="border-t border-amber-500/10 pt-2.5 space-y-1.5">
                      <div className="text-[9px] font-bold text-amber-400 uppercase tracking-widest px-1">
                        Dev Persona Swap
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-0.5 pr-1">
                        {allUsers.map((user) => (
                          <button
                            key={user.id}
                            onClick={() => handlePersonaChange(user.id)}
                            className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition-all cursor-pointer ${
                              user.id === currentUser.id
                                ? "bg-amber-600/20 text-amber-300 border border-amber-500/20"
                                : "text-slate-400 hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <img
                                src={user.avatar_url}
                                alt={user.username}
                                className="h-5 w-5 rounded-full object-cover bg-slate-800"
                              />
                              <span className="font-medium truncate">{user.username}</span>
                            </div>
                            <span className="font-mono text-[10px] opacity-80">
                              {user.balance.toFixed(0)} T
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-white/5 pt-2">
                    <button
                      onClick={async () => {
                        const { logoutAction } = await import("@/app/actions");
                        await logoutAction();
                        window.location.reload();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all cursor-pointer font-semibold"
                    >
                      <LogIn className="h-4 w-4 rotate-180" />
                      Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}