"use client";

import React, { useState } from "react";
import { createMarketAction } from "@/app/actions";
import { Calendar, AlertCircle, X, HelpCircle, ArrowRight, Image as ImageIcon, Users, ListPlus, Trash2 } from "lucide-react";

interface CreateMarketModalProps {
  isOpen: boolean;
  onClose: () => void;
  creatorId: string;
  userBalance: number;
}

const PRESET_IMAGES = [
  { label: "📊 Finance", url: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=500&auto=format&fit=crop&q=60" },
  { label: "💻 Tech", url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=500&auto=format&fit=crop&q=60" },
  { label: "🎮 Gaming", url: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=500&auto=format&fit=crop&q=60" },
  { label: "⚔️ Esports", url: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=500&auto=format&fit=crop&q=60" },
  { label: "🏛️ Politics", url: "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=500&auto=format&fit=crop&q=60" },
  { label: "👥 Social", url: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60" }
];

const PLAYERS = [
  "Adi", "Omar H", "Omar A", "Kabir", "Lorenzo", "Aditya", 
  "Jad", "Adam", "Omar Debas", "Rosslan", "Sami", "Aashis"
];

export default function CreateMarketModal({
  isOpen,
  onClose,
  creatorId,
  userBalance,
}: CreateMarketModalProps) {
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [resolutionDate, setResolutionDate] = useState("");
  const [outcomeType, setOutcomeType] = useState<"binary" | "multi">("binary");
  const [options, setOptions] = useState<string[]>(["Option 1", "Option 2", "Option 3"]);
  const [imageOption, setImageOption] = useState<"preset" | "custom" | "file">("preset");
  const [selectedPresetUrl, setSelectedPresetUrl] = useState(PRESET_IMAGES[0].url);
  const [customImageUrl, setCustomImageUrl] = useState("");
  const [fileBase64, setFileBase64] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [taggedUsers, setTaggedUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setFileError("File size exceeds 2MB. Choose a smaller image.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setFileBase64(reader.result);
      }
    };
    reader.onerror = () => {
      setFileError("Error reading image file.");
    };
    reader.readAsDataURL(file);
  };

  const handlePlayerToggle = (player: string) => {
    if (taggedUsers.includes(player)) {
      setTaggedUsers(taggedUsers.filter((u) => u !== player));
    } else {
      setTaggedUsers([...taggedUsers, player]);
    }
  };

  const handleAddOption = () => {
    if (options.length >= 10) return;
    setOptions([...options, `Option ${options.length + 1}`]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, idx) => idx !== index));
  };

  const handleOptionChange = (index: number, val: string) => {
    const updated = [...options];
    updated[index] = val;
    setOptions(updated);
  };

  // Cost and Outcomes list
  const activeOutcomes = outcomeType === "binary" 
    ? ["YES", "NO"] 
    : options.map(o => o.trim()).filter(o => o !== "");

  const bValue = 100.00; // LMSR Liquidity factor
  const requiredLiquidity = bValue * Math.log(Math.max(2, activeOutcomes.length));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (outcomeType === "multi" && activeOutcomes.length < 2) {
      setError("Please provide at least 2 non-empty options for multiple outcomes.");
      return;
    }

    if (userBalance < requiredLiquidity) {
      setError(`Insufficient balance. You need at least ${requiredLiquidity.toFixed(0)} tokens to subsidize this market.`);
      return;
    }

    setLoading(true);
    setError(null);

    const imageUrl = 
      imageOption === "preset" 
        ? selectedPresetUrl 
        : imageOption === "custom" 
          ? customImageUrl.trim() 
          : fileBase64;

    const res = await createMarketAction(
      question,
      description,
      resolutionDate,
      creatorId,
      imageUrl || undefined,
      taggedUsers,
      activeOutcomes,
      bValue
    );

    setLoading(false);

    if (res.success) {
      // Reset form
      setQuestion("");
      setDescription("");
      setResolutionDate("");
      setOutcomeType("binary");
      setOptions(["Option 1", "Option 2", "Option 3"]);
      setImageOption("preset");
      setSelectedPresetUrl(PRESET_IMAGES[0].url);
      setCustomImageUrl("");
      setFileBase64("");
      setFileError(null);
      setTaggedUsers([]);
      onClose();
    } else {
      setError(res.error || "Failed to create market.");
    }
  };

  const currentImageUrl = 
    imageOption === "preset" 
      ? selectedPresetUrl 
      : imageOption === "custom" 
        ? customImageUrl.trim() 
        : fileBase64;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative z-10 w-full max-w-lg my-8 overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl animate-in scale-in duration-200">
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
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
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
              rows={2}
              placeholder="Detail the exact source, rules, and conditions for resolving this market."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all resize-none"
            />
          </div>

          {/* Outcome Type & Settings */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <ListPlus className="h-3.5 w-3.5 text-indigo-400" />
              Outcome Format
            </label>
            
            <div className="flex gap-2 rounded-xl bg-slate-950 p-1 border border-white/5">
              <button
                type="button"
                onClick={() => setOutcomeType("binary")}
                className={`flex-1 rounded-lg py-1.5 text-center text-xs font-bold transition-all cursor-pointer ${
                  outcomeType === "binary" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Binary (YES / NO)
              </button>
              <button
                type="button"
                onClick={() => setOutcomeType("multi")}
                className={`flex-1 rounded-lg py-1.5 text-center text-xs font-bold transition-all cursor-pointer ${
                  outcomeType === "multi" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Multiple Outcomes
              </button>
            </div>

            {/* Custom Multi-Outcome Rows */}
            {outcomeType === "multi" && (
              <div className="space-y-2.5 rounded-xl border border-white/5 bg-slate-950/20 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Outcomes Options</span>
                  <button
                    type="button"
                    onClick={handleAddOption}
                    disabled={options.length >= 10}
                    className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer disabled:opacity-50"
                  >
                    + Add Option
                  </button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {options.map((opt, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text"
                        required
                        placeholder={`Option ${idx + 1}`}
                        value={opt}
                        onChange={(e) => handleOptionChange(idx, e.target.value)}
                        className="flex-1 rounded-lg border border-white/5 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-indigo-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(idx)}
                        disabled={options.length <= 2}
                        className="rounded-lg p-1.5 text-slate-500 hover:text-red-400 disabled:opacity-30 disabled:hover:text-slate-500 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Market Image Field */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5 text-indigo-400" />
              Market Image Cover
            </label>

            {/* Toggle options */}
            <div className="flex rounded-xl bg-slate-950 p-1 border border-white/5">
              <button
                type="button"
                onClick={() => setImageOption("preset")}
                className={`flex-1 rounded-lg py-1.5 text-center text-xs font-bold transition-all cursor-pointer ${
                  imageOption === "preset" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Presets
              </button>
              <button
                type="button"
                onClick={() => setImageOption("custom")}
                className={`flex-1 rounded-lg py-1.5 text-center text-xs font-bold transition-all cursor-pointer ${
                  imageOption === "custom" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                URL Link
              </button>
              <button
                type="button"
                onClick={() => setImageOption("file")}
                className={`flex-1 rounded-lg py-1.5 text-center text-xs font-bold transition-all cursor-pointer ${
                  imageOption === "file" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Upload Photo
              </button>
            </div>

            {/* Select options */}
            {imageOption === "preset" ? (
              <div className="grid grid-cols-3 gap-1.5">
                {PRESET_IMAGES.map((img) => (
                  <button
                    key={img.label}
                    type="button"
                    onClick={() => setSelectedPresetUrl(img.url)}
                    className={`rounded-lg border px-2 py-1.5 text-xs text-left font-medium transition-all truncate cursor-pointer ${
                      selectedPresetUrl === img.url
                        ? "border-indigo-500 bg-indigo-500/10 text-white"
                        : "border-white/5 bg-slate-950/20 text-slate-400 hover:bg-white/5"
                    }`}
                  >
                    {img.label}
                  </button>
                ))}
              </div>
            ) : imageOption === "custom" ? (
              <input
                type="url"
                placeholder="Paste direct image link (e.g. https://...jpg)"
                value={customImageUrl}
                onChange={(e) => setCustomImageUrl(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-2 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
              />
            ) : (
              <div className="space-y-1.5">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-600/20 file:text-indigo-400 hover:file:bg-indigo-600/30 file:cursor-pointer"
                />
                {fileError && (
                  <div className="text-[10px] text-red-400 font-semibold">{fileError}</div>
                )}
              </div>
            )}

            {/* Image Preview thumbnail */}
            {currentImageUrl && (
              <div className="relative h-20 w-full overflow-hidden rounded-xl border border-white/5 bg-slate-950">
                <img
                  src={currentImageUrl}
                  alt="Market Cover Preview"
                  className="h-full w-full object-cover opacity-70"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-[10px] text-slate-500 font-mono">Image Cover Preview</span>
                </div>
              </div>
            )}
          </div>

          {/* Insider Lockout Tagging */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-indigo-400" />
              Involved Players (Insider Lockout)
            </label>
            <p className="text-[10px] text-slate-500 leading-normal">
              Select players involved in this event. Tagged players will be locked out from betting or viewing this market to avoid conflicts of interest.
            </p>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
              {PLAYERS.map((player) => {
                const isSelected = taggedUsers.includes(player);
                return (
                  <button
                    key={player}
                    type="button"
                    onClick={() => handlePlayerToggle(player)}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs text-center font-semibold transition-all truncate cursor-pointer ${
                      isSelected
                        ? "border-red-500/40 bg-red-500/10 text-red-300"
                        : "border-white/5 bg-slate-950/20 text-slate-400 hover:bg-white/5"
                    }`}
                  >
                    {player}
                  </button>
                );
              })}
            </div>
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
              Liquidity Subsidy Requirement
            </div>
            <p className="text-slate-300 text-xs leading-relaxed">
              Creating a market requires injecting an initial liquidity subsidy of <strong>{requiredLiquidity.toFixed(1)} Tokens</strong> (LMSR $b = 100$). 
              This is locked in the contract to back initial wagers, and any remaining surplus is refunded to you upon market resolution.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between border-t border-white/5 pt-4 mt-6">
            <div className="text-xs text-slate-400">
              Balance: <span className="font-mono text-slate-200 font-bold">{userBalance.toFixed(0)} T</span>
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
                disabled={loading || userBalance < requiredLiquidity}
                className="glow-btn-purple flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              >
                {loading ? "Creating..." : `Confirm & Deposit ${requiredLiquidity.toFixed(0)} T`}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
