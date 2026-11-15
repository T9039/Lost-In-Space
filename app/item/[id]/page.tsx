import { notFound } from "next/navigation";
import ItemWorkspace from "@/components/ItemWorkspace";
import { getItemPageData } from "@/lib/queries/page-data";

export const dynamic = "force-dynamic";

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getItemPageData(id);
  if (!data) notFound();

  return (
    <div className="container">
      <ItemWorkspace item={data.item} sources={data.sources} peers={data.peers} />
    </div>
  );
}
