"use client";

import { useAds } from "./AdProvider";

interface BannerAdProps {
  className?: string;
}

export function BannerAd({ className = "" }: BannerAdProps) {
  const { canShowAd } = useAds();

  if (!canShowAd("banner")) return null;

  return (
    <div
      className={`flex items-center justify-center bg-zinc-900/50 border border-border rounded text-zinc-500 text-xs ${className}`}
      style={{ minHeight: 90 }}
    >
      {/* IMA / AdSense banner mounts here */}
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_CLIENT}
        data-ad-slot={process.env.NEXT_PUBLIC_AD_SLOT_BANNER}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
