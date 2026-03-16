import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  let dbStatus: "ok" | "error" = "ok";
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = "error";
  }

  return NextResponse.json({
    version: process.env.npm_package_version ?? "0.2.0",
    environment: process.env.NODE_ENV ?? "development",
    status: "ok",
    db: dbStatus,
    storage: "local",
    timestamp: new Date().toISOString(),
  });
}
