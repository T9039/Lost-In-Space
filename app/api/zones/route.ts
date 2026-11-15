import { NextResponse } from "next/server";
import { listZones } from "@/lib/queries/zones";

export const dynamic = "force-dynamic";

const CACHE = "public, s-maxage=3600, stale-while-revalidate=86400";

export async function GET() {
  try {
    const zones = await listZones();
    return NextResponse.json(zones, { headers: { "Cache-Control": CACHE } });
  } catch (error) {
    console.error("[api/zones]", error);
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
}
