import { Suspense } from "react";
import ArchiveView from "@/components/ArchiveView";

export const metadata = {
  title: "Archive — Lost in Space",
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
