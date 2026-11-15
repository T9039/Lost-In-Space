import { NextResponse } from "next/server";
import { listSources } from "@/lib/queries/sources";

export const dynamic = "force-dynamic";

const CACHE = "public, s-maxage=3600, stale-while-revalidate=86400";

export async function GET() {
  try {
    const sources = await listSources();
    return NextResponse.json(sources, { headers: { "Cache-Control": CACHE } });
  } catch (error) {
    console.error("[api/sources]", error);
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
}
