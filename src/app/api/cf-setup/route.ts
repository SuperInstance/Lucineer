/**
 * BYOC onboarding API
 * POST /api/cf-setup — validate token & provision Cloudflare resources
 * GET  /api/cf-setup — check current BYOC status
 */

import { NextRequest, NextResponse } from "next/server";

const CF_BASE = "https://api.cloudflare.com/client/v4";

interface SetupPayload {
  apiToken: string;
  accountId: string;
  step: "validate" | "provision" | "status";
}

interface CFResponse {
  success: boolean;
  result?: unknown;
  errors?: { message: string }[];
}

async function cfFetch(path: string, token: string, options?: RequestInit) {
  const res = await fetch(`${CF_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });
  return res.json() as Promise<CFResponse>;
}

// Validate that the token has the required permissions
async function validateToken(token: string, accountId: string) {
  const checks = await Promise.allSettled([
    cfFetch(`/accounts/${accountId}`, token),
    cfFetch(`/accounts/${accountId}/d1/database`, token),
    cfFetch(`/accounts/${accountId}/storage/kv/namespaces`, token),
    cfFetch(`/accounts/${accountId}/r2/buckets`, token),
  ]);

  const results = {
    account: checks[0].status === "fulfilled" && (checks[0].value as CFResponse).success,
    d1: checks[1].status === "fulfilled" && (checks[1].value as CFResponse).success,
    kv: checks[2].status === "fulfilled" && (checks[2].value as CFResponse).success,
    r2: checks[3].status === "fulfilled" && (checks[3].value as CFResponse).success,
  };

  const allOk = Object.values(results).every(Boolean);
  return { valid: allOk, permissions: results };
}

// Provision all required Cloudflare resources
async function provision(token: string, accountId: string) {
  const results: Record<string, unknown> = {};

  // Create D1 database
  const d1 = await cfFetch(`/accounts/${accountId}/d1/database`, token, {
    method: "POST",
    body: JSON.stringify({ name: "lucineer" }),
  });
  results.d1 = d1.success
    ? { id: (d1.result as { uuid?: string })?.uuid, status: "created" }
    : { status: "error", error: d1.errors?.[0]?.message };

  // Create KV namespace
  const kv = await cfFetch(`/accounts/${accountId}/storage/kv/namespaces`, token, {
    method: "POST",
    body: JSON.stringify({ title: "LUCINEER_CACHE" }),
  });
  results.kv = kv.success
    ? { id: (kv.result as { id?: string })?.id, status: "created" }
    : { status: "error", error: kv.errors?.[0]?.message };

  // Create R2 bucket
  const r2 = await cfFetch(`/accounts/${accountId}/r2/buckets`, token, {
    method: "POST",
    body: JSON.stringify({ name: "lucineer-assets" }),
  });
  results.r2 = r2.success
    ? { name: "lucineer-assets", status: "created" }
    : { status: "error", error: r2.errors?.[0]?.message };

  // Create Vectorize index (may not be available on all plans)
  const vectorize = await cfFetch(
    `/accounts/${accountId}/vectorize/v2/indexes`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        name: "lucineer-content",
        config: { dimensions: 1536, metric: "cosine" },
      }),
    }
  );
  results.vectorize = vectorize.success
    ? { name: "lucineer-content", status: "created" }
    : { status: "skipped", note: "Vectorize may require paid plan" };

  return results;
}

export async function POST(req: NextRequest) {
  let body: SetupPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { apiToken, accountId, step } = body;
  if (!apiToken || !accountId) {
    return NextResponse.json(
      { error: "apiToken and accountId are required" },
      { status: 400 }
    );
  }

  try {
    if (step === "validate") {
      const result = await validateToken(apiToken, accountId);
      return NextResponse.json(result);
    }

    if (step === "provision") {
      const validation = await validateToken(apiToken, accountId);
      if (!validation.valid) {
        return NextResponse.json(
          { error: "Token validation failed", permissions: validation.permissions },
          { status: 403 }
        );
      }
      const result = await provision(apiToken, accountId);
      return NextResponse.json({ success: true, resources: result });
    }

    return NextResponse.json({ error: "Unknown step" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  // Returns whether BYOC is configured (no secrets exposed)
  const hasAccountId = !!process.env.CLOUDFLARE_ACCOUNT_ID;
  return NextResponse.json({
    byocConfigured: hasAccountId,
    storageMode: hasAccountId ? "cloudflare" : "local",
  });
}
