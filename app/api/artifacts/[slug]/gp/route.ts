import { NextResponse } from "next/server";
import { getLatestGp } from "@/lib/queries/gp";

export const dynamic = "force-dynamic";

const CACHE = "public, s-maxage=300, stale-while-revalidate=600";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const gp = await getLatestGp(slug);
    if (!gp) {
      return NextResponse.json(
        { error: "No element set for this artifact" },
        { status: 404 }
      );
    }
    return NextResponse.json(gp, { headers: { "Cache-Control": CACHE } });
  } catch (error) {
    console.error(`[api/artifacts/${slug}/gp]`, error);
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
}
