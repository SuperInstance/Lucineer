export type AgeLevel = "elementary" | "middle" | "high";
export type StorageMode = "local" | "cloudflare" | "hybrid";

export interface LucineerConfig {
  version: string;
  storageMode: StorageMode;

  local: {
    dataPath: string;
    assetsPath: string;
    dbPath: string;
    keysFile: string;
    maxAssetSizeMb: number;
  };

  cloudflare: {
    accountId: string;
    r2Bucket: string;
    d1DatabaseId: string;
    d1DatabaseName: string;
    kvNamespaceId: string;
    vectorizeIndexName: string;
    workerName: string;
    pagesProjectName: string;
    customDomain?: string;
  };

  community: {
    enabled: boolean;
    hubUrl: string;
    username?: string;
    shareByDefault: boolean;
    allowDownload: boolean;
    selfHostedHub?: string;
  };

  privacy: {
    analyticsEnabled: boolean;
    crashReportsEnabled: boolean;
    telemetryEnabled: boolean;
    adPersonalizationEnabled: boolean;
    showAds: boolean;
  };

  preferences: {
    defaultAgeLevel: AgeLevel;
    language: string;
    theme: "dark" | "light" | "system";
    fullscreenOnLaunch: boolean;
    soundEnabled: boolean;
  };

  features: {
    debateSimulation: boolean;
    synthEngine: boolean;
    voxelExplorer: boolean;
    llnPlayground: boolean;
    minecraftBridge: boolean;
    multiplayerEnabled: boolean;
    communityHub: boolean;
  };
}

export const defaultConfig: LucineerConfig = {
  version: "1.0",
  storageMode: "local",

  local: {
    dataPath: "~/.lucineer",
    assetsPath: "~/.lucineer/assets",
    dbPath: "~/.lucineer/lucineer.db",
    keysFile: "~/.lucineer/keys.json",
    maxAssetSizeMb: 100,
  },

  cloudflare: {
    accountId: "",
    r2Bucket: "lucineer-assets",
    d1DatabaseId: "",
    d1DatabaseName: "lucineer",
    kvNamespaceId: "",
    vectorizeIndexName: "lucineer-content",
    workerName: "lucineer",
    pagesProjectName: "lucineer",
  },

  community: {
    enabled: false,
    hubUrl: "https://community.lucineer.com",
    shareByDefault: false,
    allowDownload: true,
  },

  privacy: {
    analyticsEnabled: false,
    crashReportsEnabled: false,
    telemetryEnabled: false,
    adPersonalizationEnabled: false,
    showAds: true,
  },

  preferences: {
    defaultAgeLevel: "middle",
    language: "en",
    theme: "dark",
    fullscreenOnLaunch: false,
    soundEnabled: true,
  },

  features: {
    debateSimulation: true,
    synthEngine: true,
    voxelExplorer: true,
    llnPlayground: true,
    minecraftBridge: false,
    multiplayerEnabled: false,
    communityHub: false,
  },
};

const CONFIG_KEY = "lucineer_config";

export function loadConfig(): LucineerConfig {
  if (typeof window === "undefined") return defaultConfig;
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (!stored) return defaultConfig;
    return { ...defaultConfig, ...JSON.parse(stored) } as LucineerConfig;
  } catch {
    return defaultConfig;
  }
}

export function saveConfig(config: Partial<LucineerConfig>): void {
  if (typeof window === "undefined") return;
  const current = loadConfig();
  localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...current, ...config }));
}

export function isByocEnabled(): boolean {
  const cfg = loadConfig();
  return (
    cfg.storageMode !== "local" &&
    !!cfg.cloudflare.accountId &&
    !!cfg.cloudflare.d1DatabaseId
  );
}
