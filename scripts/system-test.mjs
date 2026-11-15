#!/usr/bin/env node
/**
 * System test: start the production server, hit every route and API endpoint,
 * assert the contract, then stop the whole process group.
 *
 *   npm run build && npm run test:system
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { spawn } from "node:child_process";

const PORT = process.env.SYSTEM_TEST_PORT ?? "3210";
const BASE = `http://127.0.0.1:${PORT}`;

if (!fs.existsSync(".next/BUILD_ID")) {
  console.error("No production build found. Run `npm run build` first.");
  process.exit(1);
}

const child = spawn("npm", ["start", "--", "-p", PORT], {
  detached: true,
  stdio: ["ignore", "pipe", "pipe"],
  env: process.env,
});

let logs = "";
child.stdout.on("data", (chunk) => {
  logs += chunk;
});
child.stderr.on("data", (chunk) => {
  logs += chunk;
});

function stop() {
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    /* already gone */
  }
}

async function waitForHealth() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/api/health`);
      if (response.ok) return;
    } catch {
      /* server not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Server did not become healthy.\n${logs}`);
}

async function check(path, expected, verify) {
  const response = await fetch(`${BASE}${path}`, { redirect: "manual" });
  assert.equal(response.status, expected, `${path} returned ${response.status}`);
  if (verify) await verify(response);
}

const checks = [];
try {
  await waitForHealth();

  checks.push(
    await check("/api/health", 200, async (response) => {
      const body = await response.json();
      assert.equal(body.ok, true);
      assert.equal(body.database, "up");
      assert.ok(body.artifacts >= 12);
    })
  );

  checks.push(await check("/", 200, async (response) => assert.match(await response.text(), /LOST IN/)));
  checks.push(
    await check("/archive", 200, async (response) =>
      assert.match(await response.text(), /DATABASE|OFFLINE FIXTURES/)
    )
  );
  checks.push(
    await check("/sources", 200, async (response) =>
      assert.match(await response.text(), /DATABASE|OFFLINE FIXTURES/)
    )
  );
  checks.push(
    await check("/compare?a=opportunity&b=insight", 200, async (response) =>
      assert.match(await response.text(), /DATABASE|OFFLINE FIXTURES/)
    )
  );
  checks.push(
    await check("/item/opportunity", 200, async (response) => {
      const html = await response.text();
      assert.match(html, /Why it was left/);
      assert.match(html, /Provenance/);
      assert.match(html, /Lineage/);
      assert.match(html, /property="og:image" content="https?:\/\//);
    })
  );
  checks.push(
    await check("/item/apollo-11-eagle", 200, async (response) =>
      assert.match(await response.text(), /Apollo 11/)
    )
  );

  checks.push(
    await check("/api/items?zone=mars", 200, async (response) => {
      const items = await response.json();
      assert.ok(Array.isArray(items));
      assert.ok(items.length >= 4);
      assert.ok(items.every((item) => item.zone === "mars"));
    })
  );
  checks.push(await check("/api/items?zone=pluto", 400));
  checks.push(
    await check(
      "/api/image?url=" +
        encodeURIComponent("https://images-assets.nasa.gov/image/PIA20285/PIA20285~orig.jpg"),
      200,
      async (response) => {
        assert.match(response.headers.get("content-type") ?? "", /^image\//);
      }
    )
  );
  checks.push(
    await check(
      "/api/image?url=" + encodeURIComponent("https://example.com/a.jpg"),
      400
    )
  );
  checks.push(
    await check("/api/items?q=opportunity", 200, async (response) => {
      const items = await response.json();
      assert.ok(items.length >= 1);
      assert.ok(items.every((item) => /opportunity/i.test(item.name)));
    })
  );
  checks.push(
    await check("/archive?q=opportunity", 200, async (response) =>
      assert.match(await response.text(), /Opportunity/)
    )
  );
  checks.push(
    await check("/api/items/apollo-11-eagle", 200, async (response) => {
      const item = await response.json();
      assert.equal(item.id, "apollo-11-eagle");
      assert.ok(item.facts.length >= 1);
      assert.ok(item.phases.length >= 1);
    })
  );
  checks.push(await check("/api/items/does-not-exist", 404));
  checks.push(
    await check("/api/artifacts/hubble-space-telescope/gp", 404)
  );
  checks.push(
    await check("/api/items/opportunity/lineage", 200, async (response) => {
      const lineage = await response.json();
      assert.equal(lineage.item_id, "opportunity");
      assert.ok(Array.isArray(lineage.edges));
      assert.ok(Array.isArray(lineage.facts));
    })
  );
  const compare = await fetch(`${BASE}/api/compare`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ aId: "opportunity", bId: "insight", depth: "deep" }),
  });
  assert.equal(compare.status, 200);
  const result = await compare.json();
  assert.ok(result.specs.length > 0);
  assert.equal(result.sharedCount + result.differentCount, result.specs.length);
  checks.push("POST /api/compare");

  const badCompare = await fetch(`${BASE}/api/compare`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  assert.equal(badCompare.status, 400);
  checks.push("POST /api/compare invalid body");
} finally {
  stop();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    /* already gone */
  }
}

console.log(`system tests passed: ${checks.length} checks`);
