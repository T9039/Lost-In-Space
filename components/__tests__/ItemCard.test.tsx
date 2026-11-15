import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import ItemCard from "../ItemCard";
import { CompareProvider } from "../CompareProvider";
import { items } from "../../lib/fixtures";

test("ItemCard renders the database/fixture item shape", () => {
  const item = items.find((candidate) => candidate.id === "opportunity");
  assert.ok(item);

  const html = renderToStaticMarkup(
    createElement(CompareProvider, null, createElement(ItemCard, { item }))
  );

  assert.match(html, /Opportunity/);
  assert.match(html, /WENT SILENT/);
  assert.match(html, /VIEW DATA/);
  assert.match(html, /COMPARE/);
  assert.match(html, /Meridiani|Perseverance Valley/);
});
