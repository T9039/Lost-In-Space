import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ItemWorkspace from "@/components/ItemWorkspace";
import { getItemPageData } from "@/lib/queries/page-data";

export const dynamic = "force-dynamic";

const loadItem = cache(getItemPageData);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await loadItem(id);
  if (!data) return { title: "Item not found — Lost in Space" };

  const { item } = data;
  const title = `${item.name} — Lost in Space`;
  const description =
    item.abandonment_reason ||
    `${item.short_name} in ${item.location.label}. ${item.facts.length} sourced facts and ${item.phases.length} mission phases.`;
  const imagePath = item.images[0]?.src;
  const image = imagePath
    ? new URL(imagePath, process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").toString()
    : undefined;

  return {
    title,
    description,
    alternates: { canonical: `/item/${item.id}` },
    openGraph: {
      title,
      description,
      type: "article",
      images: image ? [image] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadItem(id);
  if (!data) notFound();

  return (
    <div className="container">
      <ItemWorkspace item={data.item} sources={data.sources} peers={data.peers} edges={data.edges} gp={data.gp} />
    </div>
  );
}
