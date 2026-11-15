import { NextResponse } from "next/server";
import { compareByIds } from "@/lib/queries/compare";
import type { CompareRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

function isCompareRequest(value: unknown): value is CompareRequest {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body.aId === "string" &&
    body.aId.length > 0 &&
    typeof body.bId === "string" &&
    body.bId.length > 0 &&
    (body.depth === "simple" || body.depth === "deep")
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  if (!isCompareRequest(body)) {
    return NextResponse.json(
      { error: "Expected { aId: string, bId: string, depth: 'simple' | 'deep' }" },
      { status: 400 }
    );
  }

  try {
    const { a, b, result } = await compareByIds(body.aId, body.bId, body.depth);
    if (!a || !b || !result) {
      return NextResponse.json({ error: "One or both items were not found" }, { status: 404 });
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/compare]", error);
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
}
