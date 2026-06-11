"use client";

import React, { useState } from "react";
import { createMarketAction } from "@/app/actions";
import { Calendar, AlertCircle, X, HelpCircle, ArrowRight } from "lucide-react";

interface CreateMarketModalProps {
  isOpen: boolean;
  onClose: () => void;
  creatorId: string;
  userBalance: number;
}

export default function CreateMarketModal({
  isOpen,
  onClose,
  creatorId,
  userBalance,
}: CreateMarketModalProps) {
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [resolutionDate, setResolutionDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userBalance < 50) {
      setError("Insufficient balance. You need at least 50 tokens to create a market.");
      return;
    }

    setLoading(true);
    setError(null);

    const res = await createMarketAction(question, description, resolutionDate, creatorId);
    setLoading(false);

    if (res.success) {
      // Clear form and close modal
      setQuestion("");
      setDescription("");
      setResolutionDate("");
      onClose();
    } else {
      setError(res.error || "Failed to create market.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl animate-in scale-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600/20 text-indigo-400 text-sm font-bold">
              +
            </span>
            <h2 className="text-lg font-bold text-white">Create a Prediction Market</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Question */}
          <div className="space-y-1.5">
            <label htmlFor="question" className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              Market Question <HelpCircle className="h-3.5 w-3.5 text-slate-500" />
            </label>
            <input
              id="question"
              type="text"
              required
              placeholder='e.g., Will Bitcoin hit $100k by Friday?'
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label htmlFor="description" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Resolution Source & Details
            </label>
            <textarea
              id="description"
              required
              rows={3}
              placeholder="Detail the exact source, rules, and conditions for resolving this market."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all resize-none"
            />
          </div>

          {/* Resolution Date */}
          <div className="space-y-1.5">
            <label htmlFor="resolutionDate" className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              Resolution Date & Time <Calendar className="h-3.5 w-3.5 text-slate-500" />
            </label>
            <input
              id="resolutionDate"
              type="datetime-local"
              required
              value={resolutionDate}
              onChange={(e) => setResolutionDate(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>

          {/* Liquidity Injection Warning */}
          <div className="rounded-xl border border-yellow-500/10 bg-yellow-500/5 p-4 space-y-1">
            <div className="flex items-center gap-2 text-yellow-500 text-xs font-bold uppercase tracking-wider">
              <AlertCircle className="h-4 w-4" />
              Liquidity Requirement
            </div>
            <p className="text-slate-300 text-xs leading-relaxed">
              Creating a market requires injecting an initial <strong>50 Tokens</strong>. 
              This collateral sets up the AMM pool at a 50/50 probability (50 YES shares / 50 NO shares). 
              If you resolve the market, you will get back the value of the pool's remaining winning shares.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between border-t border-white/5 pt-4 mt-6">
            <div className="text-xs text-slate-400">
              Your Balance: <span className="font-mono text-slate-200 font-bold">{userBalance.toFixed(0)} T</span>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || userBalance < 50}
                className="glow-btn-purple flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              >
                {loading ? "Creating..." : "Confirm & Deposit 50 T"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
