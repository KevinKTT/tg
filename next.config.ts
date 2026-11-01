import os from "node:os";
import type { NextConfig } from "next";

/**
 * Next blocks cross-origin requests for dev resources by default. If you open
 * the app through the machine's LAN or Tailscale address (not localhost), the
 * page renders but its client JavaScript never hydrates, so buttons do nothing.
 * Allow this machine's non-loopback IPv4 addresses as well as localhost.
 */
function devOrigins(): string[] {
  const origins = new Set(["localhost", "127.0.0.1"]);
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && !address.internal) origins.add(address.address);
    }
  }
  return [...origins];
}

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  allowedDevOrigins: devOrigins(),
};

export default nextConfig;
