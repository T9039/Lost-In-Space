import { notFound } from "next/navigation";
import { getItem, getItems, getSources } from "@/lib/api";
import ItemWorkspace from "@/components/ItemWorkspace";

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getItem(id);
  if (!item) notFound();

  const [sources, allItems] = await Promise.all([getSources(), getItems()]);
  const peers = allItems.filter((i) => i.id !== item.id);

  return (
    <div className="container">
      <ItemWorkspace item={item} sources={sources} peers={peers} />
    </div>
  );
}
