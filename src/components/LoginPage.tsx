"use client";

import React, { useState } from "react";
import { loginAction, registerAction } from "@/app/actions";
import { ShieldAlert, LogIn, UserPlus, Key, Info } from "lucide-react";

interface LoginPageProps {
  allUsers: any[];
}

export default function LoginPage({ allUsers }: LoginPageProps) {
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setLoading(true);
    setError(null);

    let res;
    if (activeTab === "login") {
      res = await loginAction(username, password);
    } else {
      res = await registerAction(username, password);
    }

    setLoading(false);

    if (res.success) {
      // Reload page to let next.js read cookies and render dashboard
      window.location.reload();
    } else {
      setError(res.error || "Authentication failed");
    }
  };

  const handleQuickLogin = async (uname: string) => {
    setUsername(uname);
    setPassword("password");
    setLoading(true);
    setError(null);
    const res = await loginAction(uname, "password");
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
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white font-black text-2xl shadow-lg shadow-indigo-600/30">
            Λ
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">ANTIGRAVITY MARKETS</h1>
          <p className="text-xs text-slate-400">
            Private Predictions League & AMM Simulation
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex rounded-xl bg-slate-950 p-1 border border-white/5">
          <button
            onClick={() => {
              setActiveTab("login");
              setError(null);
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-center text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "login"
                ? "bg-indigo-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <LogIn className="h-3.5 w-3.5" />
            Log In
          </button>
          <button
            onClick={() => {
              setActiveTab("register");
              setError(null);
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-center text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "register"
                ? "bg-indigo-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" />
            New Account
          </button>
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
              Username
            </label>
            <input
              type="text"
              required
              placeholder="e.g. TraderJohn"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Password
            </label>
            <div className="relative">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
              <input
                type="password"
                required
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950 pl-11 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="glow-btn-purple w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-bold text-white hover:bg-indigo-500 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? "Please wait..." : activeTab === "login" ? "Sign In" : "Create Account & Grant 1,000 T"}
          </button>
        </form>

        {/* Quick Simulation Profiles (Mock Accounts Drawer) */}
        {allUsers.length > 0 && (
          <div className="border-t border-white/5 pt-5 space-y-3">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-indigo-400" />
              Quick Demo Accounts
            </div>
            <div className="grid grid-cols-2 gap-2">
              {allUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleQuickLogin(user.username.split(" ")[0])}
                  disabled={loading}
                  className="flex items-center gap-2 rounded-xl border border-white/5 bg-slate-950/40 px-3 py-2 text-left text-xs text-slate-300 hover:bg-white/5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <img
                    src={user.avatar_url}
                    alt={user.username}
                    className="h-5 w-5 rounded-full object-cover bg-slate-800 shrink-0"
                  />
                  <span className="truncate">{user.username.split(" ")[0]}</span>
                </button>
              ))}
            </div>
            <div className="text-[9px] text-slate-500 leading-normal">
              * Seeded accounts have the password set to <strong>"password"</strong>. Creating a custom account starts you with 1,000 Tokens!
            </div>
          </div>
        )}
      </div>
    </div>
  );
}