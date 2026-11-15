import assert from "node:assert/strict";
import test from "node:test";

import { imageProxySrc, isAllowedImageUrl } from "./images";

test("only allowlisted HTTPS image hosts pass", () => {
  assert.equal(isAllowedImageUrl("https://images-assets.nasa.gov/image/a.jpg"), true);
  assert.equal(isAllowedImageUrl("https://nssdc.gsfc.nasa.gov/thumbnail/a.gif"), true);
  assert.equal(isAllowedImageUrl("http://images-assets.nasa.gov/image/a.jpg"), false);
  assert.equal(isAllowedImageUrl("https://example.com/a.jpg"), false);
  assert.equal(isAllowedImageUrl("not a url"), false);
});

test("remote assets are routed through the proxy; local paths are untouched", () => {
  assert.equal(
    imageProxySrc("https://images-assets.nasa.gov/image/a.jpg"),
    "/api/image?url=https%3A%2F%2Fimages-assets.nasa.gov%2Fimage%2Fa.jpg"
  );
  assert.equal(imageProxySrc("/img/opportunity-1.jpg"), "/img/opportunity-1.jpg");
  assert.equal(imageProxySrc("https://example.com/a.jpg"), "https://example.com/a.jpg");
});
