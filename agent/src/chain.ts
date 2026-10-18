import {
  type Address,
  createPublicClient,
  createWalletClient,
  fallback,
  getAbiItem,
  getAddress,
  type Hash,
  http,
  type PublicClient,
  zeroAddress,
} from "viem";
import { campaignFactoryAbi } from "./abi/CampaignFactory.js";
import { harvestCampaignAbi } from "./abi/HarvestCampaign.js";
import { chain, config } from "./config.js";
import { log } from "./log.js";

/** RPC utama, lalu cadangan bila menolak (mis. HTTP 429 dari RPC publik yang membatasi frekuensi). */
const transport = () => fallback(config.rpcUrls.map((url) => http(url, { retryCount: 1 })));
export const publicClient = createPublicClient({ chain, transport: transport() });
export const walletClient = createWalletClient({ account: config.account, chain, transport: transport() });

/** Klien eth_getLogs per penyedia (config.logRpcUrls) + rentang blok yang terakhir diterima masing-masing. */
const logClients = config.logRpcUrls.map((url) => ({
  url,
  host: new URL(url).host,
  client: createPublicClient({ chain, transport: http(url, { retryCount: 2 }) }) as PublicClient,
  range: config.maxLogRange,
}));
type LogClient = (typeof logClients)[number];
/** publicnode hanya menyimpan log ±2 hari (blok lebih tua → [] tanpa galat); rentang lebih lama dilewatkan. */
const RECENT_WINDOW = 250_000n;

/** Event `ProofSubmitted(uint8 index, string cid, uint8 attempt)` dari HarvestCampaign. */
export const proofSubmittedEvent = getAbiItem({ abi: harvestCampaignAbi, name: "ProofSubmitted" });

export type ProofLog = {
  campaign: Address;
  index: number;
  cid: string;
  attempt: number;
  blockNumber: bigint;
  txHash: Hash;
  logIndex: number;
};

/**
 * RPC yang menolak eth_getLogs tanpa alamat (mis. publicnode: "Please specify an address") membuat
 * agen beralih ke filter daftar kampanye resmi `factory.getCampaigns()`. Hasilnya setara, karena
 * bukti dari alamat lain toh dilewati oleh cek `isCampaign`.
 */
let useAddressFilter = false;

type RawProofLog = Awaited<ReturnType<typeof getProofLogsRaw>>[number];

async function getProofLogsRaw(lc: LogClient, fromBlock: bigint, toBlock: bigint, address?: Address[]) {
  return lc.client.getLogs({ address, event: proofSubmittedEvent, fromBlock, toBlock });
}

async function getProofLogsRange(lc: LogClient, fromBlock: bigint, toBlock: bigint): Promise<RawProofLog[]> {
  if (!useAddressFilter) {
    try {
      return await getProofLogsRaw(lc, fromBlock, toBlock);
    } catch (e) {
      if (rangeLimitOf(e) !== undefined) throw e;
      // Galat jaringan biasa akan gagal juga di bawah dan penyedia berikutnya dicoba.
      const campaigns = await getCampaigns();
      const logs = campaigns.length > 0 ? await getProofLogsRaw(lc, fromBlock, toBlock, campaigns) : [];
      useAddressFilter = true;
      log("AGEN", `RPC menolak getLogs tanpa alamat (${errorText(e)}) → memakai filter daftar proyek resmi`);
      return logs;
    }
  }
  const campaigns = await getCampaigns();
  return campaigns.length > 0 ? getProofLogsRaw(lc, fromBlock, toBlock, campaigns) : [];
}

function errorText(e: unknown): string {
  const err = e as { details?: string; shortMessage?: string; message?: string };
  return err.details ?? err.shortMessage ?? err.message ?? String(e);
}

/**
 * Batas rentang dari galat "exceed maximum block range: 50000" / "limited to 1000 blocks" (0 = tak
 * disebut angkanya); undefined = bukan galat rentang (mis. "usage limit", HTTP 429).
 */
export function rangeLimitOf(e: unknown): bigint | undefined {
  const msg = errorText(e);
  if (!/range|blocks/i.test(msg) || /usage|quota|rate|beyond current head|HTTP request failed/i.test(msg)) return undefined;
  const n = /(\d[\d,]{2,})/.exec(msg)?.[1]?.replace(/,/g, "");
  return n ? BigInt(n) : 0n;
}

/** Semua bukti di [fromBlock, toBlock] lewat satu penyedia; rentang mengecil mengikuti batasnya. */
async function scanWith(lc: LogClient, fromBlock: bigint, toBlock: bigint): Promise<RawProofLog[]> {
  const out: RawProofLog[] = [];
  let start = fromBlock;
  while (start <= toBlock) {
    const end = start + lc.range - 1n < toBlock ? start + lc.range - 1n : toBlock;
    try {
      out.push(...(await getProofLogsRange(lc, start, end)));
      start = end + 1n;
    } catch (e) {
      const limit = rangeLimitOf(e);
      if (limit === undefined) throw e;
      const next = limit > 0n && limit <= lc.range ? limit - 1n : lc.range / 2n;
      if (next < 500n) throw e;
      log("AGEN", `${lc.host} membatasi getLogs → ${next} blok per panggilan`);
      lc.range = next;
    }
  }
  return out;
}

async function getCampaigns(): Promise<Address[]> {
  return [...(await publicClient.readContract({ address: config.factory, abi: campaignFactoryAbi, functionName: "getCampaigns" }))];
}

/**
 * Semua log ProofSubmitted di rentang blok. Sesuai PRD, difilter berdasarkan signature event saja
 * (tanpa filter alamat), kecuali RPC mewajibkan alamat (lihat `useAddressFilter`).
 * Penyedia log dicoba berurutan (config.logRpcUrls); rentang per panggilan adaptif.
 */
export async function getProofLogs(fromBlock: bigint, toBlock: bigint): Promise<ProofLog[]> {
  const recent = fromBlock + RECENT_WINDOW >= toBlock;
  const providers = logClients.filter((lc) => recent || !lc.url.includes("publicnode"));
  let raw: RawProofLog[] | undefined;
  let last: unknown;
  for (const lc of providers) {
    try {
      raw = await scanWith(lc, fromBlock, toBlock);
      break;
    } catch (e) {
      last = e;
      log("AGEN", `getLogs lewat ${lc.host} gagal (${errorText(e).split("\n")[0]}) → penyedia berikutnya`);
    }
  }
  if (!raw) throw last instanceof Error ? last : new Error("Semua RPC log gagal.");
  return raw.map((l) => ({
    campaign: getAddress(l.address),
    index: Number(l.args.index),
    cid: l.args.cid ?? "",
    attempt: Number(l.args.attempt),
    blockNumber: l.blockNumber,
    txHash: l.transactionHash,
    logIndex: l.logIndex,
  }));
}

export async function isCampaign(address: Address): Promise<boolean> {
  return publicClient.readContract({ address: config.factory, abi: campaignFactoryAbi, functionName: "isCampaign", args: [address] });
}

export async function readCampaign(address: Address) {
  const [summary, milestones] = await Promise.all([
    publicClient.readContract({ address, abi: harvestCampaignAbi, functionName: "getSummary" }),
    publicClient.readContract({ address, abi: harvestCampaignAbi, functionName: "getMilestones" }),
  ]);
  return { summary, milestones };
}
export type CampaignData = Awaited<ReturnType<typeof readCampaign>>;

/** Identitas agen yang terdaftar di factory (untuk JSON putusan & cek hak). */
export async function readAgentConfig() {
  const [identityRegistry, agentId, agentWallet, isAgent] = await Promise.all([
    publicClient.readContract({ address: config.factory, abi: campaignFactoryAbi, functionName: "identityRegistry" }),
    publicClient.readContract({ address: config.factory, abi: campaignFactoryAbi, functionName: "agentId" }),
    publicClient.readContract({ address: config.factory, abi: campaignFactoryAbi, functionName: "agentWallet" }),
    publicClient.readContract({
      address: config.factory,
      abi: campaignFactoryAbi,
      functionName: "isAgent",
      args: [config.account.address],
    }),
  ]);
  return { identityRegistry, agentId, agentWallet, isAgent, configured: agentWallet !== zeroAddress };
}

/** Catat putusan AI. Disimulasikan dulu agar revert (mis. status berubah) tertangkap tanpa buang gas. */
export async function recordVerdict(campaign: Address, approved: boolean, reasonCID: string): Promise<Hash> {
  const { request } = await publicClient.simulateContract({
    account: config.account,
    address: campaign,
    abi: harvestCampaignAbi,
    functionName: "recordVerdict",
    args: [approved, reasonCID],
  });
  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`recordVerdict gagal di chain (tx ${hash}).`);
  return hash;
}

export async function genesisHash(): Promise<Hash> {
  const block = await publicClient.getBlock({ blockNumber: 0n });
  return block.hash;
}
