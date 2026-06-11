"use client";

import React, { useState, useEffect } from "react";
import { Timer } from "lucide-react";

interface LiveCountdownProps {
  dateString: string;
}

export default function LiveCountdown({ dateString }: LiveCountdownProps) {
  const [timeLeft, setTimeLeft] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [isEnded, setIsEnded] = useState(false);

  useEffect(() => {
    const calculateTime = () => {
      const targetTime = new Date(dateString).getTime();
      const now = new Date().getTime();
      const difference = targetTime - now;

      if (difference <= 0) {
        setTimeLeft("Ended");
        setIsEnded(true);
        setIsUrgent(false);
        return;
      }

      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference / (1000 * 60)) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      // If more than 24 hours, show normal date
      if (hours >= 24) {
        const formattedDate = new Date(dateString).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        setTimeLeft(`Ends ${formattedDate}`);
        setIsUrgent(false);
      } else {
        const hStr = hours > 0 ? `${hours}h ` : "";
        const mStr = `${minutes}m `;
        const sStr = `${seconds}s`;
        setTimeLeft(`${hStr}${mStr}${sStr} left`);
        setIsUrgent(hours === 0); // Urgent if less than 1 hour left
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [dateString]);

  return (
    <div className="flex items-center gap-1">
      {!isEnded && <Timer className={`h-3 w-3 ${isUrgent ? "text-rose-400 animate-pulse" : "text-slate-500"}`} />}
      <span
        className={`text-[10px] font-mono font-bold tracking-wider ${
          isEnded
            ? "text-slate-500"
            : isUrgent
            ? "text-rose-400 animate-pulse"
            : "text-slate-400"
        }`}
      >
        {timeLeft}
      </span>
    </div>
  );
}
