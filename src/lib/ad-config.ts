export type AdNetwork = "google" | "crazygames" | "none";

export interface AdConfig {
  network: AdNetwork;
  google: {
    adClient: string;
    adTag: string;
    slots: {
      preRoll: string;
      banner: string;
      rewarded: string;
    };
  };
  crazygames: {
    gameId: string;
  };
  placements: {
    preRollOnGameStart: boolean;
    midRollIntervalSeconds: number; // 0 = disabled
    bannerInGameplay: boolean;
    rewardedAdsEnabled: boolean;
  };
  disableForBYOCUsers: boolean;
  requireConsent: boolean;
}

export const adConfig: AdConfig = {
  network: (process.env.NEXT_PUBLIC_AD_NETWORK as AdNetwork) ?? "none",

  google: {
    adClient: process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "ca-pub-XXXXXXXXXX",
    adTag:
      process.env.NEXT_PUBLIC_AD_TAG_URL ??
      "https://pubads.g.doubleclick.net/gampad/ads",
    slots: {
      preRoll: process.env.NEXT_PUBLIC_AD_SLOT_PREROLL ?? "",
      banner: process.env.NEXT_PUBLIC_AD_SLOT_BANNER ?? "",
      rewarded: process.env.NEXT_PUBLIC_AD_SLOT_REWARDED ?? "",
    },
  },

  crazygames: {
    gameId: process.env.NEXT_PUBLIC_CRAZYGAMES_ID ?? "lucineer",
  },

  placements: {
    preRollOnGameStart: true,
    midRollIntervalSeconds: 0,
    bannerInGameplay: false,
    rewardedAdsEnabled: true,
  },

  disableForBYOCUsers: true,
  requireConsent: true,
};
