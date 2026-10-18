import { createPublicClient, fallback, http, type Address, type Hex } from "viem";
import { campaignFactoryAbi } from "@/lib/abi/CampaignFactory";
import { addresses, START_BLOCK } from "@/lib/addresses";
import { BSC_TESTNET_LOGS_RPC, testnetChain } from "@/lib/config";
import snapshot from "@/data/log-snapshot.json";
import { logProviders, scanLogs } from "@/lib/logScan";

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

/** RPC log berkunci milik sendiri (mis. NodeReal), rahasia: hanya dibaca di server, jangan NEXT_PUBLIC_. */
const OWN_LOGS_RPC = process.env.LOGS_RPC?.trim() || undefined;

const client = createPublicClient({ chain: testnetChain, transport: OWN_LOGS_RPC ? fallback([http(), http(OWN_LOGS_RPC)]) : http() });

/** Jumlah blok ujung yang dipindai ulang tiap putaran (±1 menit di BSC testnet). */
const RESCAN_TAIL = 40;

/** Indeks di memori instance server (bertahan selama instance hangat). */
let warm: { toBlock: number; addresses: string; logs: RawLog[] } | undefined;
let pending: Promise<LogIndex> | undefined;

export type LogIndex = { toBlock: number; addresses: string[]; logs: RawLog[] };

/**
 * Semua log CampaignFactory + HarvestCampaign resmi sampai blok terbaru: snapshot (web/data) +
 * pemindaian blok sesudahnya (lib/logScan: publicnode untuk blok baru, cadangan berriwayat lengkap,
 * rentang adaptif). Kampanye baru ikut terbaca karena daftar alamat dibaca ulang dari factory setiap kali.
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
  const fresh = await scanLogs<RawLog>(logProviders(fromBlock, top, BSC_TESTNET_LOGS_RPC, OWN_LOGS_RPC), { address: all }, fromBlock, top);
  const logs = [...fromLogs, ...fresh];
  // Blok paling ujung dipindai ulang di putaran berikutnya: penyedia bisa sedikit tertinggal dari
  // head (mengembalikan [] untuk blok yang belum ia punya) atau blok ujung bisa ter-reorg.
  const settled = Math.max(fromBlock - 1, top - RESCAN_TAIL);
  warm = { toBlock: settled, addresses: key, logs: logs.filter((l) => Number(l.blockNumber) <= settled) };
  return { toBlock: top, addresses: all, logs };
}
