# Schema 03 — Ad Integration
## Lucineer · Revenue Model

---

## Overview

Goal: Ad revenue covers hosting costs, with a user experience that feels fair — not intrusive.
The model is **opt-in to ads in exchange for free play**, with a clear value exchange.

### Revenue Philosophy

```
User loads game
  → Short video ad (15s, skippable at 5s) plays before game session
  → Full game unlocked, no further interruptions
  → Optional: watch rewarded ad to unlock a premium lesson or character skin
  → Banner shown in non-gameplay UI (lobby, settings, leaderboard)
```

---

## 1. Ad Network Recommendation

### Primary: Google IMA SDK (Interactive Media Ads)
**Best for:** Pre-roll and mid-roll video ads
**CPM range:** $3–$15 (education/gaming category)
**Integration:** Google Ad Manager or AdSense for Games
**Why:** Industry standard, excellent fill rate, works everywhere

### Secondary: CrazyGames Developer SDK
**Best for:** If game is listed on CrazyGames platform
**CPM range:** $8–$25 (gaming-specific, much higher)
**Integration:** CrazyGames SDK (replaces IMA entirely if using their platform)
**Why:** Highest CPM for browser games; requires submitting game to their catalog

### Fallback: Direct sponsorships
**Best for:** Educational brand sponsors (chip companies, coding bootcamps)
**Revenue:** Fixed rate, not CPM
**Why:** Education content attracts Intel, ARM, NVIDIA, Coursera, etc.

---

## 2. File Structure

```
src/
├── components/
│   └── ads/
│       ├── AdProvider.tsx           ← Context, initializes SDK
│       ├── VideoAd.tsx              ← Pre-roll / rewarded video
│       ├── BannerAd.tsx             ← Display banner
│       ├── RewardedAdButton.tsx     ← "Watch ad to unlock" button
│       └── AdConsent.tsx           ← GDPR/CCPA consent banner
├── hooks/
│   └── useAds.ts                    ← Ad state, show/hide logic
├── lib/
│   └── ads/
│       ├── ima-loader.ts            ← Google IMA SDK loader
│       ├── crazygames-loader.ts     ← CrazyGames SDK loader
│       └── ad-config.ts            ← Placement config, toggle flags
└── app/
    ├── layout.tsx                   ← Add AdProvider + AdConsent
    └── voxel-explorer/
        └── page.tsx                 ← Add pre-roll gate + rewarded ads
```

---

## 3. Ad Configuration (`src/lib/ads/ad-config.ts`)

```typescript
export const AD_CONFIG = {
  // Which network is active
  network: (process.env.NEXT_PUBLIC_AD_NETWORK ?? 'google') as
    | 'google'
    | 'crazygames'
    | 'none',

  // Google IMA / AdSense settings
  google: {
    adClient: process.env.NEXT_PUBLIC_AD_CLIENT ?? '',   // ca-pub-XXXXXXXXXX
    adTag: process.env.NEXT_PUBLIC_AD_TAG_URL ?? '',     // from Ad Manager
    slots: {
      preRoll:  process.env.NEXT_PUBLIC_AD_SLOT_PREROLL  ?? '',
      banner:   process.env.NEXT_PUBLIC_AD_SLOT_BANNER   ?? '',
      rewarded: process.env.NEXT_PUBLIC_AD_SLOT_REWARDED ?? '',
    },
  },

  // CrazyGames settings
  crazyGames: {
    gameId: process.env.NEXT_PUBLIC_CRAZYGAMES_ID ?? '',
  },

  // Placement rules
  placements: {
    // Show pre-roll before game session starts
    preRollOnGameStart: true,
    // Minimum seconds between mid-roll ads (0 = never)
    midRollIntervalSeconds: 0,
    // Show banner in: lobby, settings, leaderboard — NOT during gameplay
    bannerInGameplay: false,
    // Allow rewarded ads for unlocking content
    rewardedAdsEnabled: true,
  },

  // Revenue sharing: if user has own Cloudflare (BYOC mode), disable ads
  disableForBYOCUsers: true,

  // Consent requirement (GDPR regions)
  requireConsent: true,
  consentStorageKey: 'lucineer_ad_consent',
};
```

---

## 4. Environment Variables (add to `.env.example`)

```env
# ── Ad Network ─────────────────────────────────
NEXT_PUBLIC_AD_NETWORK=google        # google | crazygames | none

# Google IMA / AdSense
NEXT_PUBLIC_AD_CLIENT=ca-pub-XXXXXXXXXX
NEXT_PUBLIC_AD_TAG_URL=https://pubads.g.doubleclick.net/gampad/ads?...
NEXT_PUBLIC_AD_SLOT_PREROLL=XXXXXXXXXX
NEXT_PUBLIC_AD_SLOT_BANNER=XXXXXXXXXX
NEXT_PUBLIC_AD_SLOT_REWARDED=XXXXXXXXXX

# CrazyGames
NEXT_PUBLIC_CRAZYGAMES_ID=lucineer
```

---

## 5. Google IMA SDK Loader (`src/lib/ads/ima-loader.ts`)

```typescript
// src/lib/ads/ima-loader.ts
declare global {
  interface Window {
    google?: { ima: google.ima.AdDisplayContainer };
  }
}

let imaLoaded = false;
let imaPromise: Promise<void> | null = null;

export function loadIMASDK(): Promise<void> {
  if (imaLoaded) return Promise.resolve();
  if (imaPromise) return imaPromise;

  imaPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://imasdk.googleapis.com/js/sdkloader/ima3.js';
    script.async = true;
    script.onload = () => {
      imaLoaded = true;
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return imaPromise;
}
```

---

## 6. Hook: `useAds.ts`

```typescript
// src/hooks/useAds.ts
import { useState, useCallback, useEffect } from 'react';
import { AD_CONFIG } from '@/lib/ads/ad-config';

interface AdState {
  hasConsent: boolean;
  isAdPlaying: boolean;
  canShowAds: boolean;
  sessionAdShown: boolean;
  grantConsent: () => void;
  revokeConsent: () => void;
  markSessionAdShown: () => void;
}

export function useAds(): AdState {
  const [hasConsent, setHasConsent] = useState(false);
  const [isAdPlaying, setIsAdPlaying] = useState(false);
  const [sessionAdShown, setSessionAdShown] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(AD_CONFIG.consentStorageKey);
    if (stored === 'granted') setHasConsent(true);

    // Check if session already had an ad
    const sessionKey = sessionStorage.getItem('lucineer_session_ad');
    if (sessionKey === 'shown') setSessionAdShown(true);
  }, []);

  const grantConsent = useCallback(() => {
    localStorage.setItem(AD_CONFIG.consentStorageKey, 'granted');
    setHasConsent(true);
  }, []);

  const revokeConsent = useCallback(() => {
    localStorage.setItem(AD_CONFIG.consentStorageKey, 'denied');
    setHasConsent(false);
  }, []);

  const markSessionAdShown = useCallback(() => {
    sessionStorage.setItem('lucineer_session_ad', 'shown');
    setSessionAdShown(true);
  }, []);

  return {
    hasConsent,
    isAdPlaying,
    canShowAds: AD_CONFIG.network !== 'none' && hasConsent,
    sessionAdShown,
    grantConsent,
    revokeConsent,
    markSessionAdShown,
  };
}
```

---

## 7. Component: `VideoAd.tsx` (Pre-roll gate)

```tsx
// src/components/ads/VideoAd.tsx
'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { loadIMASDK } from '@/lib/ads/ima-loader';
import { AD_CONFIG } from '@/lib/ads/ad-config';

interface VideoAdProps {
  onComplete: () => void;   // Called when ad finishes or is skipped
  onError: () => void;      // Called on ad failure — always let user through
}

export function VideoAd({ onComplete, onError }: VideoAdProps) {
  const adContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [canSkip, setCanSkip] = useState(false);

  const initAd = useCallback(async () => {
    try {
      await loadIMASDK();
      const { google } = window as any;
      if (!google?.ima || !adContainerRef.current || !videoRef.current) {
        onError();
        return;
      }

      const adDisplayContainer = new google.ima.AdDisplayContainer(
        adContainerRef.current,
        videoRef.current
      );
      adDisplayContainer.initialize();

      const adsLoader = new google.ima.AdsLoader(adDisplayContainer);
      const adsRequest = new google.ima.AdsRequest();
      adsRequest.adTagUrl = AD_CONFIG.google.adTag;
      adsRequest.linearAdSlotWidth = window.innerWidth;
      adsRequest.linearAdSlotHeight = window.innerHeight;

      adsLoader.addEventListener(
        google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
        (e: any) => {
          const adsManager = e.getAdsManager(videoRef.current);

          adsManager.addEventListener(google.ima.AdEvent.Type.STARTED, () => {
            let t = 5;
            setCountdown(t);
            const interval = setInterval(() => {
              t--;
              setCountdown(t);
              if (t <= 0) {
                clearInterval(interval);
                setCanSkip(true);
                setCountdown(null);
              }
            }, 1000);
          });

          adsManager.addEventListener(google.ima.AdEvent.Type.COMPLETE, onComplete);
          adsManager.addEventListener(google.ima.AdErrorEvent.Type.AD_ERROR, () => onError());

          adsManager.init(window.innerWidth, window.innerHeight, google.ima.ViewMode.FULLSCREEN);
          adsManager.start();
        }
      );

      adsLoader.addEventListener(google.ima.AdErrorEvent.Type.AD_ERROR, () => onError());
      adsLoader.requestAds(adsRequest);
    } catch {
      onError();
    }
  }, [onComplete, onError]);

  useEffect(() => { initAd(); }, [initAd]);

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
      <div ref={adContainerRef} className="absolute inset-0" />
      <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />

      {/* Skip button */}
      <div className="absolute bottom-8 right-8 z-10">
        {canSkip ? (
          <button
            onClick={onComplete}
            className="px-6 py-2 bg-white/90 text-black font-semibold
                       rounded-lg hover:bg-white transition-colors text-sm"
          >
            Skip Ad →
          </button>
        ) : countdown !== null ? (
          <div className="px-4 py-2 bg-black/60 text-white text-sm rounded-lg">
            Skip in {countdown}s
          </div>
        ) : null}
      </div>

      {/* Branding */}
      <div className="absolute top-4 left-4 z-10 text-white/60 text-xs">
        Advertisement · Lucineer is free because of ads
      </div>
    </div>
  );
}
```

---

## 8. Component: `AdConsent.tsx` (GDPR banner)

```tsx
// src/components/ads/AdConsent.tsx
'use client';
import { useState, useEffect } from 'react';
import { AD_CONFIG } from '@/lib/ads/ad-config';
import { useAds } from '@/hooks/useAds';

export function AdConsent() {
  const { hasConsent, grantConsent, revokeConsent } = useAds();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(AD_CONFIG.consentStorageKey);
    if (!stored) setShowBanner(true);
  }, []);

  if (!showBanner || !AD_CONFIG.requireConsent) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9998] bg-dark-900
                    border-t border-dark-600 p-4">
      <div className="max-w-4xl mx-auto flex items-center gap-4 flex-wrap">
        <p className="text-sm text-gray-300 flex-1">
          Lucineer uses ads to stay free. We don&apos;t sell your data.
          Ads help cover server costs so you can play for free.
          <a href="/privacy" className="underline ml-1 text-green-400">Privacy policy</a>
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => { revokeConsent(); setShowBanner(false); }}
            className="px-4 py-2 text-sm text-gray-400 border border-dark-500
                       rounded-lg hover:border-gray-400 transition-colors"
          >
            No ads (may limit features)
          </button>
          <button
            onClick={() => { grantConsent(); setShowBanner(false); }}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg
                       hover:bg-green-500 transition-colors font-medium"
          >
            Accept & Play Free
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## 9. Integration Into Game Flow

### Pre-roll gate in `voxel-explorer/page.tsx`

```tsx
// Add to VoxelLabPage component
import { VideoAd } from '@/components/ads/VideoAd';
import { useAds } from '@/hooks/useAds';

const { canShowAds, sessionAdShown, markSessionAdShown } = useAds();
const [showAd, setShowAd] = useState(false);
const [gameUnlocked, setGameUnlocked] = useState(false);

useEffect(() => {
  if (!canShowAds || sessionAdShown) {
    setGameUnlocked(true);
    return;
  }
  // Small delay before showing ad (let page render first)
  const t = setTimeout(() => setShowAd(true), 1500);
  return () => clearTimeout(t);
}, [canShowAds, sessionAdShown]);

const handleAdComplete = () => {
  setShowAd(false);
  markSessionAdShown();
  setGameUnlocked(true);
};

// In JSX:
// {showAd && <VideoAd onComplete={handleAdComplete} onError={handleAdComplete} />}
// {!gameUnlocked && !showAd && <LoadingScreen />}
// {gameUnlocked && <ActualGame />}
```

---

## 10. Revenue Projections

| Scenario | Daily Users | Avg CPM | Daily Revenue | Monthly |
|----------|------------|---------|--------------|---------|
| Early (launch) | 100 | $5 | $0.50 | $15 |
| Growing | 1,000 | $8 | $8.00 | $240 |
| Established | 5,000 | $10 | $50 | $1,500 |
| Scale | 20,000 | $12 | $240 | $7,200 |

**Cloudflare cost at scale (20k users/day):**
- Pages + Workers: ~$5/month (paid plan flat rate)
- R2 storage (assets): ~$2–5/month
- D1 database: free tier covers most usage
- **Total infra cost: ~$10–15/month at 20k users/day**

**Break-even: ~30 users/day at $5 CPM**

---

## 11. Ad-Free Options

| Path | Mechanism |
|------|-----------|
| **BYOC mode** | User connects own Cloudflare account — no ads shown |
| **Premium subscription** | Future: $3/month removes ads |
| **Educator account** | Teachers get ad-free for classroom use |
| **Self-hosted** | Open source — run your own instance, no ads |

---

## 12. Ad Placement Map

```
┌──────────────────────────────────────────────┐
│  LOBBY / HOME (banner ad — bottom strip)     │
│  ┌────────────────────────────────────────┐  │
│  │ [Game modes]  [Leaderboard]  [Profile] │  │
│  └────────────────────────────────────────┘  │
│  ═══════════════ BANNER AD ════════════════  │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  GAME SESSION — NO ADS during active play    │
│  Pre-roll shown ONCE per session, before     │
│  the game starts                             │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  SETTINGS / PROFILE pages                    │
│  Banner ad in sidebar only                   │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  LESSON COMPLETE / ACHIEVEMENT screens       │
│  Optional: [Watch ad to double XP reward]    │
└──────────────────────────────────────────────┘
```
