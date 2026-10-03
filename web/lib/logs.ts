"use client";

import { createPublicClient, http } from "viem";
import { BSC_TESTNET_LOGS_RPC, IS_LOCAL, testnetChain } from "./config";
import { START_BLOCK } from "./addresses";

/** Klien khusus log (testnet, bila NEXT_PUBLIC_BSC_TESTNET_LOGS_RPC diisi); undefined = pakai klien utama. */
export const logsClient =
  !IS_LOCAL && BSC_TESTNET_LOGS_RPC ? createPublicClient({ chain: testnetChain, transport: http(BSC_TESTNET_LOGS_RPC) }) : undefined;

/**
 * Rentang blok per panggilan eth_getLogs. RPC publik resmi BNB menolak getLogs; RPC publik
 * pihak ketiga yang dipakai (publicnode) membatasi 50.000 blok per panggilan.
 */
const CHUNK = BigInt(process.env.NEXT_PUBLIC_LOG_CHUNK_BLOCKS || (IS_LOCAL ? 1_000_000_000 : 50_000));
const PARALLEL = 4;

type Cached<T> = { toBlock: bigint; logs: T[] };
const cache = new Map<string, Cached<unknown>>();

/**
 * Ambil log dari START_BLOCK sampai `latest`, dibagi per CHUNK blok.
 * Di testnet, log yang sudah dibaca disimpan sehingga refresh berikutnya hanya membaca blok baru.
 * (Di mode lokal tanpa cache, karena `npm run dev:chain` bisa me-reset chain kapan saja.)
 */
export async function getLogsIncremental<T>(
  key: string,
  latest: bigint,
  fetchRange: (fromBlock: bigint, toBlock: bigint) => Promise<T[]>,
): Promise<T[]> {
  const cached = IS_LOCAL ? undefined : (cache.get(key) as Cached<T> | undefined);
  const valid = cached && cached.toBlock <= latest ? cached : undefined;
  const from = valid ? valid.toBlock + 1n : START_BLOCK;

  const ranges: [bigint, bigint][] = [];
  for (let s = from; s <= latest; s += CHUNK) ranges.push([s, s + CHUNK - 1n < latest ? s + CHUNK - 1n : latest]);

  const parts: T[][] = new Array(ranges.length);
  for (let i = 0; i < ranges.length; i += PARALLEL) {
    const batch = ranges.slice(i, i + PARALLEL);
    const results = await Promise.all(batch.map(([a, b]) => fetchRange(a, b)));
    results.forEach((r, j) => (parts[i + j] = r));
  }
  const logs = [...(valid?.logs ?? []), ...parts.flat()];
  if (!IS_LOCAL) cache.set(key, { toBlock: latest, logs });
  return logs;
}
