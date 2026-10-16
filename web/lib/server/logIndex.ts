import { createPublicClient, http, type Address, type Hex } from "viem";
import { campaignFactoryAbi } from "@/lib/abi/CampaignFactory";
import { addresses, START_BLOCK } from "@/lib/addresses";
import { BSC_TESTNET_LOGS_RPC, testnetChain } from "@/lib/config";
import snapshot from "@/data/log-snapshot.json";

/** Log mentah persis seperti hasil eth_getLogs (semua angka dalam hex). */
export type RawLog = {
  address: Hex;
  topics: Hex[];
  data: Hex;
  blockNumber: Hex;
  blockHash: Hex;
  transactionHash: Hex;
  transactionIndex: Hex;
  logIndex: Hex;
  removed: boolean;
};

type Snapshot = { factory: string; toBlock: number; addresses: string[]; logs: RawLog[] };
const base = snapshot as unknown as Snapshot;

/** Batas Sentio (dan RPC publik lain) untuk satu panggilan eth_getLogs. */
const CHUNK = 5_000;
const PARALLEL = 8;

const client = createPublicClient({ chain: testnetChain, transport: http() });
const logsRpc = BSC_TESTNET_LOGS_RPC ?? testnetChain.rpcUrls.default.http[0];

async function getLogs(address: string[], from: number, to: number, attempt = 0): Promise<RawLog[]> {
  try {
    const res = await fetch(logsRpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getLogs",
        params: [{ address, fromBlock: `0x${from.toString(16)}`, toBlock: `0x${to.toString(16)}` }],
      }),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const body = (await res.json()) as { result?: RawLog[]; error?: { message: string } };
    if (!body.result) throw new Error(body.error?.message ?? `HTTP ${res.status}`);
    return body.result;
  } catch (e) {
    if (attempt >= 3) throw e;
    await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    return getLogs(address, from, to, attempt + 1);
  }
}

/** Indeks di memori instance server (bertahan selama instance hangat). */
let warm: { toBlock: number; addresses: string; logs: RawLog[] } | undefined;
let pending: Promise<LogIndex> | undefined;

export type LogIndex = { toBlock: number; addresses: string[]; logs: RawLog[] };

/**
 * Semua log CampaignFactory + HarvestCampaign resmi sampai blok terbaru: snapshot (web/data) +
 * pemindaian blok sesudahnya per 5.000 blok. Kampanye baru ikut terbaca karena daftar alamat
 * dibaca ulang dari factory setiap kali.
 */
export function getLogIndex(): Promise<LogIndex> {
  pending ??= build().finally(() => (pending = undefined));
  return pending;
}

async function build(): Promise<LogIndex> {
  const factory = addresses.factory!.toLowerCase();
  const [latestBig, campaigns] = await Promise.all([
    client.getBlockNumber(),
    client.readContract({ address: factory as Address, abi: campaignFactoryAbi, functionName: "getCampaigns" }),
  ]);
  const latest = Number(latestBig);
  const all = [factory, ...campaigns.map((c) => c.toLowerCase())];
  const key = all.join(",");

  // Lanjutkan dari indeks hangat bila daftar kontraknya sama; jika tidak, mulai dari snapshot.
  const sameSet = warm && warm.addresses === key;
  const fromLogs = sameSet ? warm!.logs : base.factory === factory ? base.logs : [];
  const fromBlock = (sameSet ? warm!.toBlock : base.factory === factory ? base.toBlock : Number(START_BLOCK)) + 1;

  // RPC utama bisa sedikit tertinggal dari snapshot/indeks; jangan sampai indeks mundur.
  const top = Math.max(latest, fromBlock - 1);
  const ranges: [number, number][] = [];
  for (let s = fromBlock; s <= top; s += CHUNK) ranges.push([s, Math.min(s + CHUNK - 1, top)]);
  const fresh: RawLog[] = [];
  for (let i = 0; i < ranges.length; i += PARALLEL) {
    const parts = await Promise.all(ranges.slice(i, i + PARALLEL).map(([a, b]) => getLogs(all, a, b)));
    for (const p of parts) fresh.push(...p);
  }
  const logs = [...fromLogs, ...fresh];
  warm = { toBlock: top, addresses: key, logs };
  return { toBlock: top, addresses: all, logs };
}
