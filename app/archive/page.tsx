import { Suspense } from "react";
import ArchiveView from "@/components/ArchiveView";
import { getArchiveData } from "@/lib/queries/archive";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Archive — Lost in Space",
};

type SearchParams = Promise<{ q?: string }>;

export default async function ArchivePage({ searchParams }: { searchParams: SearchParams }) {
  const { q } = await searchParams;
  const { items, zones, dataSource } = await getArchiveData(q);

  return (
    <div className="container">
      <Suspense fallback={<div className="empty-state">Loading archive…</div>}>
        <ArchiveView initialItems={items} initialZones={zones} initialQuery={q ?? ""} dataSource={dataSource} />
      </Suspense>
    </div>
  );
}
