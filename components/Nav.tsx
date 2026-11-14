import Link from "next/link";
import { getItems } from "@/lib/api";
import { Orbit } from "lucide-react";

export default async function Nav() {
  const items = await getItems();

  return (
    <header className="nav relative z-50">
      <div className="container nav-inner">
        <Link href="/" className="brand group inline-flex items-center gap-3">
          <span className="brand-mark"><Orbit size={17} strokeWidth={1.5} /></span>
          <span className="brand-name">Cosmic Relic <span>Museum</span></span>
        </Link>
        <nav className="nav-links">
          <Link href="/">Home</Link>
          <Link href="/#relic-map">Interactive Map</Link>
          <Link href="/archive">Archive</Link>
          <Link href="/compare">Compare</Link>
          <Link href="/test">Test</Link>
          <Link href="/sources">Sources</Link>
        </nav>
        <span className="nav-spacer" />
        <span className="nav-badge">{items.length} relics · fixture data</span>
      </div>
    </header>
  );
}
