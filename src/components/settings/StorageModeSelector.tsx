"use client";

import { useEffect, useState } from "react";
import { loadConfig, saveConfig, type StorageMode } from "@/lib/config";

const OPTIONS: { value: StorageMode; label: string; description: string }[] = [
  {
    value: "local",
    label: "Local only",
    description: "All data stays on this device. No account needed.",
  },
  {
    value: "cloudflare",
    label: "My Cloudflare account (BYOC)",
    description:
      "Data goes to your own Cloudflare R2/D1/KV. Lucineer never sees it.",
  },
  {
    value: "hybrid",
    label: "Both (local + Cloudflare sync)",
    description: "Keep a local copy and sync to your Cloudflare account.",
  },
];

export function StorageModeSelector() {
  const [mode, setMode] = useState<StorageMode>("local");

  useEffect(() => {
    setMode(loadConfig().storageMode);
  }, []);

  function handleChange(value: StorageMode) {
    setMode(value);
    saveConfig({ storageMode: value });
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Where does your data live?</p>
      {OPTIONS.map((opt) => (
        <label
          key={opt.value}
          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
            mode === opt.value
              ? "border-primary bg-primary/5"
              : "border-border hover:border-muted-foreground"
          }`}
        >
          <input
            type="radio"
            name="storageMode"
            value={opt.value}
            checked={mode === opt.value}
            onChange={() => handleChange(opt.value)}
            className="mt-0.5 accent-primary"
          />
          <span>
            <span className="block text-sm font-medium">{opt.label}</span>
            <span className="block text-xs text-muted-foreground">
              {opt.description}
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}
