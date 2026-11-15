import Link from "next/link";

export const metadata = {
  title: "Mission Test | Lost in Space",
};

export default function TestPage() {
  return (
    <div className="container">
      <section className="section-tight">
        <div className="eyebrow">Mission Test</div>
        <h1 style={{ fontSize: "clamp(28px, 4vw, 40px)" }}>Test what you learned</h1>
        <p className="lead">
          Revisit the mission record in five questions, then see which sourced ideas stayed with you.
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
