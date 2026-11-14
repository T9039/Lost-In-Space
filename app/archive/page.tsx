import { Suspense } from "react";
import ArchiveView from "@/components/ArchiveView";

export const metadata = {
  title: "Archive — Abandoned but not Forgotten",
};

export default function ArchivePage() {
  return (
    <div className="container">
      <Suspense fallback={<div className="empty-state">Loading archive…</div>}>
        <ArchiveView />
      </Suspense>
    </div>
  );
}
