import { NextRequest, NextResponse } from "next/server";
import { isZone } from "@/lib/contract";
import { listItems } from "@/lib/queries/items";

export const dynamic = "force-dynamic";

const CACHE = "public, s-maxage=3600, stale-while-revalidate=86400";

export async function GET(request: NextRequest) {
  const zone = request.nextUrl.searchParams.get("zone");
  if (zone !== null && !isZone(zone)) {
    return NextResponse.json({ error: `Unknown zone: ${zone}` }, { status: 400 });
  }

  const search = request.nextUrl.searchParams.get("q") ?? undefined;
  if (search && search.length > 80) {
    return NextResponse.json({ error: "Search query is too long" }, { status: 400 });
  }

  try {
    const items = await listItems(zone ?? undefined, search);
    return NextResponse.json(items, { headers: { "Cache-Control": CACHE } });
  } catch (error) {
    console.error("[api/items]", error);
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
}
