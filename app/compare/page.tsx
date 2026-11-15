import Link from "next/link";
import { getItems } from "@/lib/api";
import { compareItems, KIND_LABEL } from "@/lib/compare";
import type { Item } from "@/lib/types";

export const metadata = {
  title: "Mission Comparison — Lost in Space",
};

type SearchParams = Promise<{ a?: string; b?: string; deep?: string }>;

function Select({
  name,
  label,
  items,
  selected,
  exclude,
}: {
  name: string;
  label: string;
  items: Item[];
  selected: string;
  exclude?: string;
}) {
  return (
    <div>
      <label className="field-label" htmlFor={name}>
        {label}
      </label>
      <select id={name} name={name} defaultValue={selected} className="select">
        {items.map((i) => (
          <option key={i.id} value={i.id} disabled={i.id === exclude}>
            {i.short_name} — {i.zone.replace("-", " ")}
          </option>
        ))}
      </select>
    </div>
  );
}

export default async function ComparePage({ searchParams }: { searchParams: SearchParams }) {
  const { a, b, deep } = await searchParams;
  const items = await getItems();

  const itemA = items.find((i) => i.id === a) ?? items[0];
  const itemB = items.find((i) => i.id === b && i.id !== itemA.id) ?? items.find((i) => i.id !== itemA.id);

  const isDeep = deep === "1";
  const result = itemB ? compareItems(itemA, itemB) : null;
  const depthHref = (v: boolean) =>
    `/compare?a=${itemA.id}&b=${itemB?.id ?? ""}${v ? "&deep=1" : ""}`;

  return (
    <div className="container">
      <section className="section-tight">
        <div className="eyebrow">Story engine</div>
        <h1 style={{ fontSize: "clamp(28px, 4vw, 40px)" }}>Compare two machines</h1>
        <p className="lead">
          Pick any two objects, even from different zones. The comparison is computed directly
          from stored facts — not generated — so every difference is checkable.
        </p>
      </section>

      <div className="stack">
        <form method="get" action="/compare" className="compare-controls">
          <Select name="a" label="Machine A" items={items} selected={itemA.id} exclude={itemB?.id} />
          <div className="compare-swap">
            <button className="btn btn-sm" type="submit">
              Compare
            </button>
            {itemB ? (
              <Link
                className="btn btn-sm"
                href={`/compare?a=${itemB.id}&b=${itemA.id}${isDeep ? "&deep=1" : ""}`}
                style={{ marginLeft: 8 }}
                aria-label="Swap A and B"
              >
                ⇄
              </Link>
            ) : null}
          </div>
          <Select name="b" label="Machine B" items={items} selected={itemB?.id ?? ""} exclude={itemA.id} />
        </form>

        <div className="tabs" style={{ borderBottom: "none", paddingBottom: 0 }}>
          <Link className={`tab ${isDeep ? "" : "is-active"}`} href={depthHref(false)}>
            Simple story
          </Link>
          <Link className={`tab ${isDeep ? "is-active" : ""}`} href={depthHref(true)}>
            Deep comparison
          </Link>
        </div>

        {!result ? (
          <div className="empty-state">Pick two different machines to generate a comparison.</div>
        ) : (
          <>
            <div className="card">
              <div className="card-pad">
                <div className="eyebrow" style={{ marginBottom: 8 }}>
                  {result.a.short_name} vs {result.b.short_name}
                </div>
                <div className="row" style={{ marginBottom: 14 }}>
                  <span className="chip">{result.sharedCount} shared attributes</span>
                  <span className="chip">{result.differentCount} differences</span>
                  <span className="chip">
                    {result.a.facts.length + result.b.facts.length} sourced facts
                  </span>
                </div>
                <ul className="highlight-list">
                  {result.highlights.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="compare-columns">
              {[result.a, result.b].map((item) => (
                <div key={item.id}>
                  <div className="column-head">
                    <Link href={`/item/${item.id}`}>{item.short_name} →</Link>
                  </div>
                  <div className="card">
                    <div className="card-pad">
                      <p style={{ marginBottom: 10 }}>{item.abandonment_reason}</p>
                      <div className="card-meta">
                        {item.location.label} · {item.years_active}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {isDeep ? (
              <div className="card">
                <div className="card-pad">
                  <div className="card-title" style={{ marginBottom: 4 }}>
                    Attribute diff
                  </div>
                  <table className="diff-table">
                    <thead>
                      <tr>
                        <th>Attribute</th>
                        <th>{result.a.short_name}</th>
                        <th>{result.b.short_name}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.specs.map((row) => (
                        <tr key={row.key}>
                          <td>{row.key}</td>
                          <td>
                            {row.a}
                            {row.same ? <span className="diff-same">same</span> : null}
                          </td>
                          <td>
                            {row.b}
                            {row.same ? null : <span className="diff-diff">differs</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div>
              <div className="eyebrow">Facts by theme</div>
              <div className="stack" style={{ marginTop: 12 }}>
                {result.factsByKind.map((group) => (
                  <div key={group.kind} className="card">
                    <div className="card-pad">
                      <div className="card-title" style={{ marginBottom: 10 }}>
                        {KIND_LABEL[group.kind] ?? group.kind}
                      </div>
                      <div className="compare-columns">
                        {[
                          { item: result.a, rows: group.a },
                          { item: result.b, rows: group.b },
                        ].map(({ item, rows }) => (
                          <div key={item.id}>
                            <div className="column-head">{item.short_name}</div>
                            {rows.length === 0 ? (
                              <p className="muted" style={{ fontSize: 13 }}>
                                No facts of this kind.
                              </p>
                            ) : (
                              rows.map((f) => (
                                <div key={f.id} className="fact">
                                  <div>
                                    <div style={{ fontSize: 13, color: "var(--muted)" }}>
                                      {f.label}
                                    </div>
                                    <p className="fact-claim">{f.claim}</p>
                                  </div>
                                  <div className="fact-value">{f.value}</div>
                                </div>
                              ))
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
