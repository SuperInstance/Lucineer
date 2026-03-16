"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadKeys, saveKeys, clearKeys, type LucineerKeys } from "@/lib/keys";

type AIProvider = "zai" | "anthropic" | "openai" | "google" | "mistral" | "ollama";

const PROVIDERS: { id: AIProvider; label: string; placeholder: string }[] = [
  { id: "zai", label: "z.ai", placeholder: "zai-..." },
  { id: "anthropic", label: "Anthropic", placeholder: "sk-ant-..." },
  { id: "openai", label: "OpenAI", placeholder: "sk-..." },
  { id: "google", label: "Google (Gemini)", placeholder: "AIza..." },
  { id: "mistral", label: "Mistral", placeholder: "..." },
  {
    id: "ollama",
    label: "Ollama (local)",
    placeholder: "http://localhost:11434",
  },
];

export function ApiKeyManager() {
  const [keys, setKeys] = useState<LucineerKeys | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadKeys().then((k) => setKeys(k ?? { version: "1.0", ai: {} }));
  }, []);

  function setProviderKey(provider: AIProvider, value: string) {
    setKeys((prev) => ({
      ...(prev ?? { version: "1.0" }),
      ai: {
        ...(prev?.ai ?? {}),
        [provider]: value || undefined,
      },
    }));
  }

  async function handleSave() {
    if (!keys) return;
    setSaving(true);
    await saveKeys(keys);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleClear() {
    await clearKeys();
    setKeys({ version: "1.0", ai: {} });
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Keys are encrypted with AES-256-GCM and stored only on this device.
        They are never uploaded or shared.
      </p>

      <div className="space-y-2">
        {PROVIDERS.map((p) => (
          <div key={p.id} className="flex items-center gap-2">
            <span className="text-xs w-32 shrink-0 text-muted-foreground">
              {p.label}
            </span>
            <Input
              type="password"
              placeholder={p.placeholder}
              value={keys?.ai?.[p.id] ?? ""}
              onChange={(e) => setProviderKey(p.id, e.target.value)}
              className="font-mono text-xs h-8"
            />
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saved ? "Saved!" : saving ? "Saving…" : "Save keys"}
        </Button>
        <Button size="sm" variant="outline" onClick={handleClear}>
          Clear all
        </Button>
      </div>
    </div>
  );
}
