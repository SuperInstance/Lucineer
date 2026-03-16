"use client";

import { useState } from "react";
import { useAds } from "./AdProvider";
import { Button } from "@/components/ui/button";
import { VideoAd } from "./VideoAd";

interface RewardedAdButtonProps {
  label?: string;
  onRewarded: () => void;
}

export function RewardedAdButton({
  label = "Watch ad to unlock",
  onRewarded,
}: RewardedAdButtonProps) {
  const { canShowAd } = useAds();
  const [watching, setWatching] = useState(false);

  if (!canShowAd("rewarded")) return null;

  if (watching) {
    return (
      <VideoAd
        onComplete={() => {
          setWatching(false);
          onRewarded();
        }}
        onSkip={() => setWatching(false)}
      />
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={() => setWatching(true)}>
      {label}
    </Button>
  );
}
