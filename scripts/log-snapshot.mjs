#!/usr/bin/env node
/**
 * Snapshot event log BagiPanen di BSC testnet → web/data/log-snapshot.json.
 *
 * Isinya semua log mentah dari CampaignFactory + semua HarvestCampaign resmi, dari blok deploy
 * sampai blok terbaru. Server web (/api/logs) memakai snapshot ini sebagai titik awal sehingga
 * hanya perlu memindai blok sesudahnya. Tanpa dependensi (hanya fetch JSON-RPC), agar bisa
 * dijalankan langsung di GitHub Actions: `node scripts/log-snapshot.mjs`.
 *
 * Env: LOGS_RPC (bawaan Sentio; dibatasi 5.000 blok per eth_getLogs).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "web/data/log-snapshot.json");
const RPC = process.env.LOGS_RPC || "https://rpc.sentio.xyz/bsc-testnet";
const CHUNK = 5_000;
const PARALLEL = 8;
const GET_CAMPAIGNS = "0xa6b03633"; // getCampaigns()

const deployment = JSON.parse(fs.readFileSync(path.join(ROOT, "deployments/bscTestnet.json"), "utf8"));
const factory = deployment.factory.toLowerCase();
const startBlock = deployment.startBlock;

let nextId = 1;
async function rpc(method, params, attempt = 0) {
  try {
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
      signal: AbortSignal.timeout(30_000),
    });
    const body = await res.json();
    if (body.error) throw new Error(`${method}: ${body.error.message}`);
    return body.result;
  } catch (e) {
    if (attempt >= 5) throw e;
    await new Promise((r) => setTimeout(r, 1_000 * 2 ** attempt));
    return rpc(method, params, attempt + 1);
  }
}

/** Dekode `address[]` hasil eth_call. */
function decodeAddressArray(hex) {
  const data = hex.slice(2);
  const word = (i) => data.slice(i * 64, (i + 1) * 64);
  const offset = parseInt(word(0), 16) / 32;
  const length = parseInt(word(offset), 16);
  return Array.from({ length }, (_, i) => `0x${word(offset + 1 + i).slice(24)}`.toLowerCase());
}

const toBlock = parseInt(await rpc("eth_blockNumber", []), 16);
const tag = `0x${toBlock.toString(16)}`;
const campaigns = decodeAddressArray(await rpc("eth_call", [{ to: factory, data: GET_CAMPAIGNS }, tag]));
const addresses = [factory, ...campaigns];

const ranges = [];
for (let s = startBlock; s <= toBlock; s += CHUNK) ranges.push([s, Math.min(s + CHUNK - 1, toBlock)]);
console.log(`Memindai ${ranges.length} potongan (${startBlock} → ${toBlock}), ${addresses.length} kontrak…`);

const logs = [];
for (let i = 0; i < ranges.length; i += PARALLEL) {
  const batch = ranges.slice(i, i + PARALLEL);
  const results = await Promise.all(
    batch.map(([a, b]) => rpc("eth_getLogs", [{ address: addresses, fromBlock: `0x${a.toString(16)}`, toBlock: `0x${b.toString(16)}` }])),
  );
  for (const r of results) logs.push(...r);
  if ((i / PARALLEL) % 10 === 0) process.stdout.write(`  ${Math.min(i + PARALLEL, ranges.length)}/${ranges.length}\r`);
}

logs.sort((a, b) => parseInt(a.blockNumber, 16) - parseInt(b.blockNumber, 16) || parseInt(a.logIndex, 16) - parseInt(b.logIndex, 16));
const snapshot = { chainId: 97, factory, startBlock, toBlock, addresses, logs };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(snapshot)}\n`);
console.log(`\nSelesai: ${logs.length} log sampai blok ${toBlock} → ${path.relative(ROOT, OUT)}`);
