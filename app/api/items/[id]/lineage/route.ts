import { NextResponse } from "next/server";
import { getLineage } from "@/lib/queries/lineage";

export const dynamic = "force-dynamic";

const CACHE = "public, s-maxage=3600, stale-while-revalidate=86400";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const lineage = await getLineage(id);
    if (!lineage) return NextResponse.json({ error: "Item not found" }, { status: 404 });
    return NextResponse.json(lineage, { headers: { "Cache-Control": CACHE } });
  } catch (error) {
    console.error(`[api/items/${id}/lineage]`, error);
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
}
