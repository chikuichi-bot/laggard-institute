#!/usr/bin/env node
/**
 * Pick a local Next.js URL for Capacitor (no Cursor Apps publish).
 * Prefer CAP_SERVER_URL, else first private LAN IPv4, else 127.0.0.1.
 */
import os from "node:os";

const PORT = process.env.PORT?.trim() || "3010";
const PATH = "/";

function lanIpv4() {
  const nets = os.networkInterfaces();
  for (const entries of Object.values(nets)) {
    if (!entries) continue;
    for (const net of entries) {
      if (net.family !== "IPv4" || net.internal) continue;
      const parts = net.address.split(".").map(Number);
      const privateRange =
        parts[0] === 10 ||
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
        (parts[0] === 192 && parts[1] === 168);
      if (privateRange) return net.address;
    }
  }
  return null;
}

const fromEnv = process.env.CAP_SERVER_URL?.trim();
if (fromEnv) {
  process.stdout.write(fromEnv);
  process.exit(0);
}

const host = lanIpv4() || "127.0.0.1";
process.stdout.write(`http://${host}:${PORT}${PATH}`);
