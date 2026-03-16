"use client";

import { useState } from "react";
import { StorageModeSelector } from "@/components/settings/StorageModeSelector";
import { CloudflareConnect } from "@/components/settings/CloudflareConnect";
import { ApiKeyManager } from "@/components/settings/ApiKeyManager";
import { loadConfig, saveConfig, type LucineerConfig } from "@/lib/config";

export default function SettingsPage() {
  const [config, setConfig] = useState<LucineerConfig>(
    () => (typeof window === "undefined" ? loadConfig() : loadConfig())
  );

  function togglePrivacy(key: keyof LucineerConfig["privacy"]) {
    const updated = {
      ...config,
      privacy: { ...config.privacy, [key]: !config.privacy[key] },
    };
    setConfig(updated);
    saveConfig({ privacy: updated.privacy });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Storage, privacy, and API keys. Everything stays local unless you
          choose otherwise.
        </p>
      </div>

      {/* ── Storage & Data ─────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold border-b border-border pb-2">
          Storage & Data
        </h2>
        <StorageModeSelector />

        {config.storageMode !== "local" && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium">Connect Cloudflare account</p>
            <CloudflareConnect />
          </div>
        )}
      </section>

      {/* ── AI API Keys ───────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold border-b border-border pb-2">
          AI API Keys
        </h2>
        <ApiKeyManager />
      </section>

      {/* ── Community ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold border-b border-border pb-2">
          Community
        </h2>
        <div className="space-y-3">
          {(
            [
              { key: "enabled", label: "Enable community hub", description: "Browse and download community content" },
            ] as const
          ).map(({ key, label, description }) => (
            <label key={key} className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.community[key as keyof typeof config.community] as boolean}
                onChange={() => {
                  const updated = {
                    ...config,
                    community: {
                      ...config.community,
                      [key]: !config.community[key as keyof typeof config.community],
                    },
                  };
                  setConfig(updated);
                  saveConfig({ community: updated.community });
                }}
                className="mt-0.5 accent-primary"
              />
              <span>
                <span className="block text-sm">{label}</span>
                <span className="block text-xs text-muted-foreground">
                  {description}
                </span>
              </span>
            </label>
          ))}
          {config.community.enabled && (
            <div className="pl-6">
              <p className="text-xs text-muted-foreground">
                Hub:{" "}
                <span className="font-mono">{config.community.hubUrl}</span>
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── Privacy ───────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold border-b border-border pb-2">
          Privacy
        </h2>
        <div className="space-y-3">
          {(
            [
              {
                key: "analyticsEnabled" as const,
                label: "Anonymous analytics",
                description: "Aggregate usage data, never personal",
              },
              {
                key: "crashReportsEnabled" as const,
                label: "Crash reports",
                description: "Help us fix errors faster",
              },
              {
                key: "adPersonalizationEnabled" as const,
                label: "Personalised ads",
                description: "More relevant ads (requires consent)",
              },
              {
                key: "showAds" as const,
                label: "Show ads",
                description:
                  "Support Lucineer for free. Disabled in BYOC mode.",
              },
            ] as const
          ).map(({ key, label, description }) => (
            <label key={key} className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.privacy[key]}
                onChange={() => togglePrivacy(key)}
                className="mt-0.5 accent-primary"
              />
              <span>
                <span className="block text-sm">{label}</span>
                <span className="block text-xs text-muted-foreground">
                  {description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}
