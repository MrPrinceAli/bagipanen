/**
 * Pemindai eth_getLogs yang tahan perubahan aturan RPC publik (dipakai server /api/logs dan cadangan
 * di browser; logika yang sama ada di scripts/log-snapshot.mjs dan agent/src/logs.ts).
 *
 * RPC publik BSC testnet sering berubah: Sentio turun dari 50.000 → 5.000 → 1.000 blok per panggilan
 * dan membatasi frekuensi (429); kunci publik NodeReal kerap habis kuota; publicnode cepat dan
 * mengizinkan 50.000 blok, tetapi hanya menyimpan log ±2 hari dan mengembalikan [] (tanpa galat)
 * untuk blok yang lebih tua. Karena itu:
 * - penyedia dipilih menurut umur rentang: rentang baru → publicnode dulu; rentang lama → hanya
 *   penyedia berriwayat lengkap (jangan sampai log lama hilang diam-diam);
 * - penyedia dicoba berurutan; rentang per panggilan adaptif mengikuti batas di pesan galat;
 * - 429/galat jaringan dicoba ulang dengan jeda sebelum pindah penyedia.
 */

export const PUBLICNODE_TESTNET_RPC = "https://bsc-testnet-rpc.publicnode.com";
/** Endpoint publik NodeReal (dokumentasi BNB Chain): riwayat lengkap, 50.000 blok/panggilan, kuota bersama. */
export const NODEREAL_TESTNET_RPC = "https://bsc-testnet.nodereal.io/v1/e9a36765eb8a40b9bd12e680a1fd2bc5";
/** Rentang yang dianggap "baru" (aman untuk publicnode): ±30 jam blok BSC testnet. */
export const RECENT_WINDOW_BLOCKS = 250_000;

export type LogFilter = { address?: string | string[]; topics?: (string | string[] | null)[] };
export type RawLogLike = { blockNumber: string; logIndex: string };

const START_CHUNK = 50_000;
const MIN_CHUNK = 500;
const chunkFor = new Map<string, number>();

class RangeLimitError extends Error {
  constructor(public limit: number | null) {
    super(`range limit ${limit ?? "?"}`);
  }
}
class HeadError extends Error {
  constructor(public head: number) {
    super(`head ${head}`);
  }
}

const hex = (n: number) => `0x${n.toString(16)}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const host = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

async function getLogs<T>(url: string, filter: LogFilter, from: number, to: number): Promise<T[]> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getLogs", params: [{ ...filter, fromBlock: hex(from), toBlock: hex(to) }] }),
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch (e) {
      if (attempt >= 2) throw e;
      await sleep(600 * 2 ** attempt);
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      if (attempt >= 2) throw new Error(`${host(url)}: HTTP ${res.status}`);
      await sleep(800 * 2 ** attempt);
      continue;
    }
    const body = (await res.json().catch(() => ({}))) as { result?: T[]; error?: { message?: string }; message?: string };
    if (Array.isArray(body.result)) return body.result;
    const msg = body.error?.message ?? body.message ?? `HTTP ${res.status}`;
    // "block range extends beyond current head block: requested 1, head 2"
    if (/beyond current head/i.test(msg)) {
      const head = Number(/head\D*(\d+)/i.exec(msg)?.[1]);
      if (Number.isFinite(head)) throw new HeadError(head);
    }
    // "exceed maximum block range: 50000", "limited to 1000 blocks", "ranges over 10000 blocks are not supported"
    if (/range|blocks/i.test(msg) && !/usage|quota|rate/i.test(msg)) {
      const n = Number(/(\d[\d,]{2,})/.exec(msg)?.[1]?.replace(/,/g, ""));
      throw new RangeLimitError(Number.isFinite(n) && n > 0 ? n : null);
    }
    throw new Error(`${host(url)}: ${msg}`);
  }
}

/** Pindai [from, to] dengan satu penyedia; rentang mengecil otomatis, `to` dipangkas ke head penyedia. */
async function scanWith<T>(url: string, filter: LogFilter, from: number, to: number, parallel: number): Promise<T[]> {
  for (;;) {
    const chunk = chunkFor.get(url) ?? START_CHUNK;
    const ranges: [number, number][] = [];
    for (let s = from; s <= to; s += chunk) ranges.push([s, Math.min(s + chunk - 1, to)]);
    try {
      const out: T[] = [];
      for (let i = 0; i < ranges.length; i += parallel) {
        const parts = await Promise.all(ranges.slice(i, i + parallel).map(([a, b]) => getLogs<T>(url, filter, a, b)));
        for (const p of parts) out.push(...p);
      }
      return out;
    } catch (e) {
      if (e instanceof HeadError && e.head >= from && e.head < to) {
        to = e.head; // penyedia ini sedikit tertinggal; cukup sampai head-nya
        continue;
      }
      if (!(e instanceof RangeLimitError)) throw e;
      // Batas dari pesan (dikurangi 1 karena sebagian RPC menghitung inklusif), atau separuhnya.
      const next = e.limit && e.limit <= chunk ? e.limit - 1 : Math.floor(chunk / 2);
      if (next < MIN_CHUNK) throw new Error(`${host(url)}: rentang getLogs terlalu kecil`);
      chunkFor.set(url, next);
    }
  }
}

/** Semua log yang cocok di [from, to], mencoba penyedia satu per satu. */
export async function scanLogs<T extends RawLogLike>(
  providers: (string | undefined)[],
  filter: LogFilter,
  from: number,
  to: number,
  parallel = 8,
): Promise<T[]> {
  if (from > to) return [];
  const list = [...new Set(providers.filter((p): p is string => Boolean(p)))];
  let last: unknown;
  for (const url of list) {
    try {
      const logs = await scanWith<T>(url, filter, from, to, parallel);
      return logs.sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber) || Number(a.logIndex) - Number(b.logIndex));
    } catch (e) {
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error("Semua RPC log gagal.");
}

/**
 * Urutan penyedia untuk rentang [from, …] dengan head `head`: rentang baru boleh lewat publicnode
 * (cepat, 50.000 blok), rentang lama hanya lewat penyedia berriwayat lengkap.
 */
export function logProviders(from: number, head: number, historyRpc?: string): string[] {
  const full = [historyRpc, NODEREAL_TESTNET_RPC].filter((x): x is string => Boolean(x));
  return from >= head - RECENT_WINDOW_BLOCKS ? [PUBLICNODE_TESTNET_RPC, ...full] : full;
}
