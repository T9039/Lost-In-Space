import Link from "next/link";
import { getItems } from "@/lib/api";
import { Radio } from "lucide-react";

export default async function Nav() {
  const items = await getItems();

  return (
    <header className="nav relative z-50">
      <div className="container nav-inner">
        <Link href="/" className="brand group inline-flex items-center gap-3">
          <span className="brand-mark"><Radio size={17} strokeWidth={1.6} /></span>
          <span className="brand-name">LOST <span>IN SPACE</span></span>
        </Link>
        <nav className="nav-links">
          <Link href="/">Home</Link>
          <Link href="/#timeline">Mission Timeline</Link>
          <Link href="/archive">Archive</Link>
          <Link href="/compare">Compare</Link>
          <Link href="/test">Test</Link>
          <Link href="/sources">Sources</Link>
        </nav>
        <span className="nav-spacer" />
        <span className="nav-badge">{items.length} OBJECT FILES · CURATED DATA</span>
      </div>
    </header>
  );
}
