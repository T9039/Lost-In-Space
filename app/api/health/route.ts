import { NextResponse } from "next/server";
import { checkHealth } from "@/lib/queries/health";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const report = await checkHealth();
    return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/health]", error);
    return NextResponse.json(
      { ok: false, database: "down", error: "Database unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
