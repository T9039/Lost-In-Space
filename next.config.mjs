import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const threeRoot = path.resolve(path.dirname(require.resolve("three")), "..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep output tracing inside this repository, even if a parent directory
  // happens to contain another package-lock.json.
  outputFileTracingRoot: path.resolve("."),
  // Native protocol / WebSocket drivers belong in the Node runtime, not in a
  // bundled client chunk.
  serverExternalPackages: ["pg", "@neondatabase/serverless"],
  webpack: (config) => {
    // Keep a single copy of three.js by resolving bare "three" to the package
    // root (never to the CommonJS build, which references Node globals).
    config.resolve.alias = {
      ...config.resolve.alias,
      three: threeRoot,
    };
    return config;
  },
};

export default nextConfig;
