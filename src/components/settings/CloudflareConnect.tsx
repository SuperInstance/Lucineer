"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadKeys, saveKeys } from "@/lib/keys";
import { saveConfig } from "@/lib/config";

type Step = "idle" | "validating" | "validated" | "provisioning" | "done" | "error";

interface PermissionStatus {
  account: boolean;
  d1: boolean;
  kv: boolean;
  r2: boolean;
}

export function CloudflareConnect() {
  const [apiToken, setApiToken] = useState("");
  const [accountId, setAccountId] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [permissions, setPermissions] = useState<PermissionStatus | null>(null);
  const [resources, setResources] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");

  async function handleValidate() {
    setStep("validating");
    setError("");
    try {
      const res = await fetch("/api/cf-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiToken, accountId, step: "validate" }),
      });
      const data = await res.json() as { valid: boolean; permissions: PermissionStatus; error?: string };
      if (data.valid) {
        setPermissions(data.permissions);
        setStep("validated");
      } else {
        setPermissions(data.permissions);
        setError("Some permissions are missing. See details below.");
        setStep("error");
      }
    } catch {
      setError("Network error. Check your connection.");
      setStep("error");
    }
  }

  async function handleProvision() {
    setStep("provisioning");
    setError("");
    try {
      const res = await fetch("/api/cf-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiToken, accountId, step: "provision" }),
      });
      const data = await res.json() as { success: boolean; resources: Record<string, unknown>; error?: string };
      if (data.success) {
        setResources(data.resources);
        // Save credentials encrypted
        const keys = (await loadKeys()) ?? { version: "1.0" };
        keys.cloudflare = { apiToken, accountId };
        await saveKeys(keys);
        // Save resource IDs to config
        const r = data.resources as {
          d1?: { id?: string };
          kv?: { id?: string };
        };
        saveConfig({
          storageMode: "cloudflare",
          cloudflare: {
            accountId,
            r2Bucket: "lucineer-assets",
            d1DatabaseId: r.d1?.id ?? "",
            d1DatabaseName: "lucineer",
            kvNamespaceId: r.kv?.id ?? "",
            vectorizeIndexName: "lucineer-content",
            workerName: "lucineer",
            pagesProjectName: "lucineer",
          },
        });
        setStep("done");
      } else {
        setError(data.error ?? "Provisioning failed");
        setStep("error");
      }
    } catch {
      setError("Network error during provisioning.");
      setStep("error");
    }
  }

  if (step === "done") {
    return (
      <div className="p-4 rounded-lg bg-primary/10 border border-primary/30 text-sm">
        <p className="font-medium text-primary">BYOC connected!</p>
        <p className="text-muted-foreground mt-1">
          Your Cloudflare D1, KV, R2, and Vectorize resources have been
          provisioned. Data now goes to your account.
        </p>
        {resources && (
          <pre className="mt-3 text-xs bg-background/50 p-2 rounded overflow-x-auto">
            {JSON.stringify(resources, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Enter your Cloudflare API token and Account ID. The token needs Pages,
        Workers, D1, KV, R2, and Vectorize edit permissions.
        <a
          href="https://dash.cloudflare.com/profile/api-tokens"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-1 text-primary underline-offset-2 hover:underline"
        >
          Create token →
        </a>
      </p>

      <div className="space-y-2">
        <Input
          type="password"
          placeholder="Cloudflare API Token"
          value={apiToken}
          onChange={(e) => setApiToken(e.target.value)}
          disabled={step === "validating" || step === "provisioning"}
        />
        <Input
          placeholder="Account ID (32 hex chars)"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          disabled={step === "validating" || step === "provisioning"}
        />
      </div>

      {permissions && (
        <div className="space-y-1 text-xs">
          {Object.entries(permissions).map(([k, ok]) => (
            <div key={k} className="flex items-center gap-2">
              <span className={ok ? "text-primary" : "text-destructive"}>
                {ok ? "✓" : "✗"}
              </span>
              <span className="text-muted-foreground capitalize">{k}</span>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2">
        {step !== "validated" ? (
          <Button
            size="sm"
            onClick={handleValidate}
            disabled={!apiToken || !accountId || step === "validating"}
          >
            {step === "validating" ? "Validating…" : "Validate token"}
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleProvision}
            disabled={step === "provisioning"}
          >
            {step === "provisioning" ? "Provisioning…" : "Provision resources →"}
          </Button>
        )}
      </div>
    </div>
  );
}
