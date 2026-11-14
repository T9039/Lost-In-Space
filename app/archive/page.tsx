import { Suspense } from "react";
import ArchiveView from "@/components/ArchiveView";

export const metadata = {
  title: "Archive — Abandoned but not Forgotten",
};

export default function ArchivePage() {
  return (
    <div className="container">
      <section className="section-tight archive-intro">
        <div className="eyebrow">The archive</div>
        <h1 style={{ fontSize: "clamp(32px, 5vw, 56px)" }}>A museum of machines<br />that never came home.</h1>
        <p className="lead">
          Filter by zone, search by name, then open a machine to read its mission profile.
        </p>
      </section>
      <Suspense fallback={<div className="empty-state">Loading archive…</div>}>
        <ArchiveView />
      </Suspense>
    </div>
  );
}
