import Link from "next/link";

export const metadata = {
  title: "Mission Test — Abandoned but not Forgotten",
};

export default function TestPage() {
  return (
    <div className="container">
      <section className="section-tight">
        <div className="eyebrow">Mission Test</div>
        <h1 style={{ fontSize: "clamp(28px, 4vw, 40px)" }}>Test what you learned</h1>
        <p className="lead">
          Five questions, generated only from the stored NASA facts. Finish with a Mission Report
          that shows your score, your streak and the ideas you missed.
        </p>
        <div className="empty-state" style={{ marginTop: 24 }}>
          Not wired up yet in this prototype. The questions and scoring are built from the same
          facts table that powers the archive.
          <div className="row" style={{ justifyContent: "center", marginTop: 16 }}>
            <Link href="/archive" className="btn btn-primary btn-sm">
              Explore the archive instead
            </Link>
            <Link href="/compare" className="btn btn-sm">
              Compare two machines
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
