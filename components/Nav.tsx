import Link from "next/link";
import { getItems } from "@/lib/api";

export default async function Nav() {
  const items = await getItems();

  return (
    <header className="nav">
      <div className="container nav-inner">
        <Link href="/" className="brand">
          <span className="brand-dot" />
          Abandoned but not Forgotten
        </Link>
        <nav className="nav-links">
          <Link href="/">Home</Link>
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
