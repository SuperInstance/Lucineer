"use client";

import { useEffect, useRef, useState } from "react";
import { useAds } from "./AdProvider";

interface VideoAdProps {
  onComplete: () => void;
  onSkip?: () => void;
}

const SKIP_DELAY = 5; // seconds before skip button appears

export function VideoAd({ onComplete, onSkip }: VideoAdProps) {
  const { canShowAd, markAdShownThisSession } = useAds();
  const [countdown, setCountdown] = useState(SKIP_DELAY);
  const [canSkip, setCanSkip] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!canShowAd("preRoll")) {
      onComplete();
      return;
    }

    markAdShownThisSession();

    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current!);
          setCanSkip(true);
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!canShowAd("preRoll")) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      {/* Ad container — IMA SDK mounts here */}
      <div id="lucineer-ad-container" className="w-full max-w-3xl aspect-video bg-zinc-900 flex items-center justify-center">
        <span className="text-zinc-500 text-sm">Advertisement</span>
      </div>

      <div className="absolute bottom-6 right-6 flex items-center gap-3">
        {canSkip ? (
          <button
            onClick={() => {
              onSkip?.();
              onComplete();
            }}
            className="px-4 py-2 bg-white text-black text-sm font-medium rounded"
          >
            Skip ad →
          </button>
        ) : (
          <span className="px-4 py-2 bg-black/60 text-white text-sm rounded">
            Skip in {countdown}s
          </span>
        )}
      </div>
    </div>
  );
}
