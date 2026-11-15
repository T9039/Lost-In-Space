import { NextRequest, NextResponse } from "next/server";
import { isAllowedImageUrl } from "@/lib/images";

export const dynamic = "force-dynamic";

const CACHE = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400";

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }
  if (!isAllowedImageUrl(raw)) {
    return NextResponse.json({ error: "Image host is not allowlisted" }, { status: 400 });
  }

  try {
    const upstream = await fetch(raw, {
      headers: {
        accept: "image/*",
        "user-agent": "lost-in-space/0.1 (+https://github.com/T9039/Lost-In-Space)",
      },
      next: { revalidate: 86400 },
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${upstream.status}` },
        { status: upstream.status === 404 ? 404 : 502 }
      );
    }

    const contentType = upstream.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Upstream is not an image" }, { status: 415 });
    }

    const headers = new Headers({
      "content-type": contentType,
      "cache-control": CACHE,
    });
    const length = upstream.headers.get("content-length");
    if (length) headers.set("content-length", length);

    return new NextResponse(upstream.body, { status: 200, headers });
  } catch (error) {
    console.error("[api/image]", error);
    return NextResponse.json({ error: "Image fetch failed" }, { status: 502 });
  }
}
