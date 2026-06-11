"use client";

import React, { useState, useEffect } from "react";
import { authenticateAction } from "@/app/actions";
import { ShieldAlert, Info, User, LogIn } from "lucide-react";
import { UserProfile } from "@/lib/supabase";

interface LoginPageProps {
  allUsers?: UserProfile[];
}

export default function LoginPage({ allUsers = [] }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDev, setIsDev] = useState(false);
  const [logoClicks, setLogoClicks] = useState(0);

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

  const handleLogoClick = () => {
    const nextClicks = logoClicks + 1;
    setLogoClicks(nextClicks);
    if (nextClicks >= 5) {
      const newDevState = !isDev;
      setIsDev(newDevState);
      localStorage.setItem("dev_mode", newDevState ? "true" : "false");
      setLogoClicks(0);
      alert(`Developer Mode ${newDevState ? "ENABLED" : "DISABLED"}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setLoading(true);
    setError(null);

    const res = await authenticateAction(username.trim());
    setLoading(false);

    if (res.success) {
      window.location.reload();
    } else {
      setError(res.error || "Authentication failed");
    }
  };

  const handleQuickLogin = async (uname: string) => {
    setUsername(uname);
    setLoading(true);
    setError(null);
    const res = await authenticateAction(uname);
    setLoading(false);
    if (res.success) {
      window.location.reload();
    } else {
      setError(res.error || "Authentication failed");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
      <div className="absolute inset-0 bg-radial-gradient(circle at 50% 30%, #0e172e 0%, #060913 70%) pointer-events-none" />

      {/* Auth Box Container */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl p-6 sm:p-8 space-y-6 animate-in fade-in duration-300">
        
        {/* Brand Logo */}
        <div 
          onClick={handleLogoClick}
          className="flex flex-col items-center text-center space-y-2 cursor-pointer select-none group"
          title="Click 5 times to toggle developer options"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white font-black text-2xl shadow-lg shadow-indigo-600/30 group-hover:scale-105 transition-transform duration-200">
            P
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">TTSOPP MARKETS</h1>
          <p className="text-xs text-slate-400">
            The True Saga of Paul Pogchamp Prediction League
          </p>
        </div>

        {/* Info Notification */}
        <div className="flex items-start gap-2.5 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3 text-xs text-slate-300 leading-normal">
          <Info className="h-4.5 w-4.5 shrink-0 text-indigo-400" />
          <span>
            <strong>Password-free login:</strong> Just enter your nickname. If you're new, we'll create your account and grant you <strong>1,000 starting tokens</strong> instantly!
          </span>
        </div>

        {/* Error notification */}
        {error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400 leading-normal">
            <ShieldAlert className="h-4.5 w-4.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Login/Register Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Your Username / Nickname
            </label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                required
                placeholder="e.g. TraderJohn"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950 pl-11 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !username.trim()}
            className="glow-btn-purple w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-bold text-white hover:bg-indigo-500 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? "Signing in..." : "Enter Predictor Arena"}
          </button>
        </form>

        {/* Hidden Developer Quick Switcher */}
        {isDev && allUsers.length > 0 && (
          <div className="border-t border-white/10 pt-5 space-y-3 animate-in slide-in-from-top-4 duration-300">
            <div className="text-[10px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
              <LogIn className="h-3.5 w-3.5" />
              Developer Swap Personas
            </div>
            <div className="grid grid-cols-2 gap-2">
              {allUsers.map((user) => (
                <button
                   key={user.id}
                   type="button"
                   onClick={() => handleQuickLogin(user.username.split(" ")[0])}
                   disabled={loading}
                   className="flex items-center gap-2 rounded-xl border border-amber-500/10 bg-slate-950/60 px-3 py-2 text-left text-xs text-slate-300 hover:bg-amber-500/5 hover:border-amber-500/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  <img
                    src={user.avatar_url}
                    alt={user.username}
                    className="h-5 w-5 rounded-full object-cover bg-slate-800 shrink-0 border border-amber-500/20"
                  />
                  <span className="truncate">{user.username.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}