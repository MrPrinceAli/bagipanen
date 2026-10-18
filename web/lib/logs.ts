"use client";

import { createPublicClient, custom, type EIP1193RequestFn, type Hex } from "viem";
import { BSC_TESTNET_LOGS_RPC, IS_LOCAL, testnetChain } from "./config";
import { START_BLOCK } from "./addresses";
import { logProviders, scanLogs } from "./logScan";

type RawLog = { address: Hex; topics: Hex[]; blockNumber: Hex };
type LogFilter = { address?: Hex | Hex[]; topics?: (Hex | Hex[] | null)[]; fromBlock?: Hex | string; toBlock?: Hex | string };

const INDEX_TTL_MS = 8_000;

let index: { at: number; promise: Promise<{ toBlock: number; logs: RawLog[] }> } | undefined;

/** Indeks log dari server (/api/logs), dipakai bersama semua pembaca di halaman selama beberapa detik. */
function fetchIndex() {
  if (!index || Date.now() - index.at > INDEX_TTL_MS) {
    const promise = fetch("/api/logs").then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as { toBlock: number; logs: RawLog[] };
    });
    promise.catch(() => (index = undefined));
    index = { at: Date.now(), promise };
  }
  return index.promise;
}

const blockOf = (tag: string | undefined, fallback: number) =>
  tag === undefined || tag === "latest" || tag === "pending" || tag === "safe" || tag === "finalized" ? fallback : tag === "earliest" ? 0 : Number(tag);

function matches(log: RawLog, f: LogFilter, from: number, to: number) {
  const n = Number(log.blockNumber);
  if (n < from || n > to) return false;
  if (f.address) {
    const list = (Array.isArray(f.address) ? f.address : [f.address]).map((a) => a.toLowerCase());
    if (!list.includes(log.address.toLowerCase())) return false;
  }
  return (f.topics ?? []).every((t, i) => {
    if (t === null || t === undefined) return true;
    const want = (Array.isArray(t) ? t : [t]).map((x) => x.toLowerCase());
    return log.topics[i] !== undefined && want.includes(log.topics[i].toLowerCase());
  });
}

async function rpc(url: string, method: string, params: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = (await res.json()) as { result?: unknown; error?: { message: string } };
  if (body.error) throw new Error(body.error.message);
  return body.result;
}

/** Cadangan bila /api/logs gagal: pindai RPC log langsung dari browser (lib/logScan). Lebih lambat, tetapi tetap jalan. */
async function scanDirect(f: LogFilter): Promise<RawLog[]> {
  const latest = Number(await rpc(testnetChain.rpcUrls.default.http[0], "eth_blockNumber", []));
  const from = blockOf(f.fromBlock, Number(START_BLOCK));
  const to = Math.min(blockOf(f.toBlock, latest), latest);
  const logs = await scanLogs<RawLog & { logIndex: Hex }>(logProviders(from, latest, BSC_TESTNET_LOGS_RPC), { address: f.address, topics: f.topics }, from, to, 4);
  return logs;
}

/** eth_getLogs dijawab dari indeks server; metode lain diteruskan ke RPC utama. */
const request: EIP1193RequestFn = async ({ method, params }) => {
  if (method === "eth_getLogs") {
    const [f] = params as [LogFilter];
    try {
      const { toBlock, logs } = await fetchIndex();
      const from = blockOf(f.fromBlock, toBlock);
      const to = blockOf(f.toBlock, toBlock);
      return logs.filter((l) => matches(l, f, from, to)) as never;
    } catch {
      return (await scanDirect(f)) as never;
    }
  }
  return rpc(testnetChain.rpcUrls.default.http[0], method, params) as never;
};

/**
 * Klien khusus pembacaan log di testnet. Riwayat dibaca dari indeks /api/logs (snapshot + blok baru,
 * di-cache server) karena RPC publik hanya mengizinkan rentang kecil per panggilan.
 */
export const logsClient = IS_LOCAL ? undefined : createPublicClient({ chain: testnetChain, transport: custom({ request }) });

/**
 * Ambil log dari START_BLOCK sampai `latest` dalam satu panggilan.
 * - Testnet: dijawab dari indeks server, tanpa cache di browser agar log yang baru masuk indeks
 *   tidak terlewat (server & CDN yang meng-cache).
 * - Lokal (Anvil): langsung ke chain; tanpa cache karena `npm run dev:chain` bisa me-reset chain.
 */
export async function getLogsIncremental<T>(
  _key: string,
  latest: bigint,
  fetchRange: (fromBlock: bigint, toBlock: bigint) => Promise<T[]>,
): Promise<T[]> {
  return fetchRange(START_BLOCK, latest);
}
