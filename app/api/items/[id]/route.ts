import { NextResponse } from "next/server";
import { getItemByAnyId } from "@/lib/queries/items";

export const dynamic = "force-dynamic";

const CACHE = "public, s-maxage=3600, stale-while-revalidate=86400";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const item = await getItemByAnyId(id);
    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });
    return NextResponse.json(item, { headers: { "Cache-Control": CACHE } });
  } catch (error) {
    console.error(`[api/items/${id}]`, error);
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
}
