import { Suspense } from "react";
import ArchiveView from "@/components/ArchiveView";
import { getArchiveData } from "@/lib/queries/archive";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Archive — Lost in Space",
};

export default async function ArchivePage() {
  const { items, zones, dataSource } = await getArchiveData();

  return (
    <div className="container">
      <Suspense fallback={<div className="empty-state">Loading archive…</div>}>
        <ArchiveView initialItems={items} initialZones={zones} dataSource={dataSource} />
      </Suspense>
    </div>
  );
}
