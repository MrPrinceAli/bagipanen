#!/usr/bin/env node
/**
 * Snapshot event log BagiPanen di BSC testnet → web/data/log-snapshot.json.
 *
 * Isinya semua log mentah dari CampaignFactory + semua HarvestCampaign resmi, dari blok deploy
 * sampai blok (hampir) terbaru. Server web (/api/logs) memakai snapshot ini sebagai titik awal sehingga
 * hanya perlu memindai blok sesudahnya. Tanpa dependensi (hanya fetch JSON-RPC), agar bisa
 * dijalankan langsung di GitHub Actions: `node scripts/log-snapshot.mjs` (FULL=1 = pindai ulang semua).
 *
 * Inkremental: bila snapshot lama ada (factory sama), hanya blok sesudah `toBlock`-nya yang dipindai;
 * kampanye baru yang belum ada di snapshot dipindai dari blok deploy. Rentang baru lewat publicnode
 * (cepat, 50.000 blok, tetapi hanya menyimpan log ±2 hari); rentang lama hanya lewat penyedia
 * berriwayat lengkap (LOGS_RPC/Sentio, NodeReal). Rentang per panggilan adaptif mengikuti batas di
 * pesan galat RPC (logika yang sama dengan web/lib/logScan.ts).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "web/data/log-snapshot.json");
const PUBLICNODE = "https://bsc-testnet-rpc.publicnode.com";
const NODEREAL = "https://bsc-testnet.nodereal.io/v1/e9a36765eb8a40b9bd12e680a1fd2bc5";
const HISTORY = [...new Set([process.env.LOGS_RPC || "https://rpc.sentio.xyz/bsc-testnet", NODEREAL])];
/** RPC untuk eth_blockNumber/eth_call (bukan getLogs). */
const HEAD_RPC = process.env.HEAD_RPC || "https://bsc-testnet.bnbchain.org";
/** Rentang yang dianggap "baru" (masih disimpan publicnode): ±30 jam. */
const RECENT_WINDOW = 250_000;
/** Snapshot berhenti beberapa blok sebelum head; sisanya dipindai server (penyedia bisa sedikit tertinggal). */
const TAIL = 40;
const PARALLEL = 8;
/** publicnode menolak filter berisi lebih dari 9 alamat ("Request blocked"). */
const MAX_ADDRESSES = { [PUBLICNODE]: 8 };
const GET_CAMPAIGNS = "0xa6b03633"; // getCampaigns()

const deployment = JSON.parse(fs.readFileSync(path.join(ROOT, "deployments/bscTestnet.json"), "utf8"));
const factory = deployment.factory.toLowerCase();
const startBlock = deployment.startBlock;
const host = (url) => new URL(url).host;

let nextId = 1;
async function rpc(method, params, url, attempt = 0) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 429 || res.status >= 500) throw new Error(`${host(url)}: HTTP ${res.status}`);
    const body = await res.json().catch(() => ({}));
    if (body.result !== undefined) return body.result;
    const msg = body.error?.message ?? body.message ?? `HTTP ${res.status}`;
    // "exceed maximum block range: 50000", "limited to 1000 blocks" — bukan "usage limit"/kuota.
    if (/range|blocks/i.test(msg) && !/usage|quota|rate|beyond current head/i.test(msg)) {
      const n = Number(/(\d[\d,]{2,})/.exec(msg)?.[1]?.replace(/,/g, ""));
      throw Object.assign(new Error(msg), { rangeLimit: Number.isFinite(n) && n > 0 ? n : 0 });
    }
    throw Object.assign(new Error(`${host(url)}: ${msg}`), { fatal: /usage|quota|beyond current head|blocked/i.test(msg) });
  } catch (e) {
    if (e.rangeLimit !== undefined || e.fatal || attempt >= 3) throw e;
    await new Promise((r) => setTimeout(r, 1_000 * 2 ** attempt));
    return rpc(method, params, url, attempt + 1);
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

/** Pindai semua log alamat-alamat ini di [from, to]: penyedia berurutan, rentang adaptif. */
async function scan(address, from, to, head) {
  if (from > to || address.length === 0) return [];
  const providers = from >= head - RECENT_WINDOW ? [PUBLICNODE, ...HISTORY] : HISTORY;
  let last;
  for (const url of providers) {
    let chunk = 50_000;
    for (;;) {
      const max = MAX_ADDRESSES[url] ?? address.length;
      const groups = [];
      for (let i = 0; i < address.length; i += max) groups.push(address.slice(i, i + max));
      const tasks = [];
      for (let s = from; s <= to; s += chunk) for (const g of groups) tasks.push([g, s, Math.min(s + chunk - 1, to)]);
      try {
        console.log(`Memindai blok ${from}–${to} (${tasks.length} panggilan, ${chunk} blok) lewat ${host(url)}…`);
        const out = [];
        for (let i = 0; i < tasks.length; i += PARALLEL) {
          const parts = await Promise.all(
            tasks
              .slice(i, i + PARALLEL)
              .map(([g, a, b]) => rpc("eth_getLogs", [{ address: g, fromBlock: `0x${a.toString(16)}`, toBlock: `0x${b.toString(16)}` }], url)),
          );
          for (const p of parts) out.push(...p);
        }
        return out;
      } catch (e) {
        last = e;
        console.log(`  ${host(url)}: ${e.message}`);
        if (e.rangeLimit === undefined) break; // galat lain → penyedia berikutnya
        const next = e.rangeLimit ? Math.min(e.rangeLimit - 1, chunk - 1) : Math.floor(chunk / 2);
        if (next < 500) break;
        chunk = next;
      }
    }
  }
  throw last;
}

const head = parseInt(await rpc("eth_blockNumber", [], HEAD_RPC), 16);
const toBlock = head - TAIL;
const campaigns = decodeAddressArray(await rpc("eth_call", [{ to: factory, data: GET_CAMPAIGNS }, `0x${toBlock.toString(16)}`], HEAD_RPC));
const addresses = [factory, ...campaigns];

let prev;
try {
  prev = JSON.parse(fs.readFileSync(OUT, "utf8"));
} catch {
  prev = undefined;
}
const incremental = !process.env.FULL && prev?.factory === factory && prev.toBlock < toBlock;

let logs;
if (incremental) {
  const known = addresses.filter((a) => prev.addresses.includes(a));
  const added = addresses.filter((a) => !prev.addresses.includes(a));
  console.log(`Inkremental: blok ${prev.toBlock + 1} → ${toBlock}, ${known.length} kontrak lama, ${added.length} kontrak baru`);
  const [fresh, addedLogs] = await Promise.all([
    scan(known, prev.toBlock + 1, toBlock, head),
    scan(added, startBlock, prev.toBlock, head),
  ]);
  logs = [...prev.logs, ...addedLogs, ...fresh];
} else {
  console.log(`Penuh: blok ${startBlock} → ${toBlock}, ${addresses.length} kontrak`);
  logs = await scan(addresses, startBlock, toBlock, head);
}

const seen = new Set();
logs = logs
  .filter((l) => {
    const id = `${l.transactionHash}:${l.logIndex}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  })
  .sort((a, b) => parseInt(a.blockNumber, 16) - parseInt(b.blockNumber, 16) || parseInt(a.logIndex, 16) - parseInt(b.logIndex, 16));
const snapshot = { chainId: 97, factory, startBlock, toBlock, addresses, logs };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(snapshot)}\n`);
console.log(`Selesai: ${logs.length} log sampai blok ${toBlock} → ${path.relative(ROOT, OUT)}`);
