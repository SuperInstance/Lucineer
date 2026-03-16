"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { adConfig } from "@/lib/ad-config";

interface AdContextValue {
  isAdEnabled: boolean;
  hasConsent: boolean;
  isByocUser: boolean;
  setConsent: (value: boolean) => void;
  canShowAd: (placement: "preRoll" | "banner" | "rewarded") => boolean;
  markAdShownThisSession: () => void;
  sessionAdShown: boolean;
}

const AdContext = createContext<AdContextValue>({
  isAdEnabled: false,
  hasConsent: false,
  isByocUser: false,
  setConsent: () => {},
  canShowAd: () => false,
  markAdShownThisSession: () => {},
  sessionAdShown: false,
});

export function useAds() {
  return useContext(AdContext);
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    CrazyGames?: any;
  }
}

export function AdProvider({ children }: { children: React.ReactNode }) {
  const [hasConsent, setHasConsent] = useState(false);
  const [isByocUser] = useState(false); // wired up by StorageAdapter later
  const [sessionAdShown, setSessionAdShown] = useState(false);
  const sdkLoaded = useRef(false);

  const isAdEnabled =
    adConfig.network !== "none" &&
    !isByocUser &&
    (!adConfig.requireConsent || hasConsent);

  // Load consent from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("lucineer_ad_consent");
    if (stored === "true") setHasConsent(true);
  }, []);

  // Load CrazyGames SDK once consent is given
  useEffect(() => {
    if (!isAdEnabled || sdkLoaded.current) return;
    if (adConfig.network === "crazygames") {
      const script = document.createElement("script");
      script.src = "https://sdk.crazygames.com/crazygames-sdk-v3.js";
      script.async = true;
      document.head.appendChild(script);
      sdkLoaded.current = true;
    }
  }, [isAdEnabled]);

  function setConsent(value: boolean) {
    setHasConsent(value);
    localStorage.setItem("lucineer_ad_consent", String(value));
  }

  function canShowAd(placement: "preRoll" | "banner" | "rewarded"): boolean {
    if (!isAdEnabled) return false;
    if (placement === "preRoll") {
      return adConfig.placements.preRollOnGameStart && !sessionAdShown;
    }
    if (placement === "banner") {
      return !adConfig.placements.bannerInGameplay;
    }
    if (placement === "rewarded") {
      return adConfig.placements.rewardedAdsEnabled;
    }
    return false;
  }

  function markAdShownThisSession() {
    setSessionAdShown(true);
  }

  return (
    <AdContext.Provider
      value={{
        isAdEnabled,
        hasConsent,
        isByocUser,
        setConsent,
        canShowAd,
        markAdShownThisSession,
        sessionAdShown,
      }}
    >
      {children}
    </AdContext.Provider>
  );
}
