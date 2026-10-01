import { type Address, createPublicClient, createWalletClient, getAbiItem, getAddress, type Hash, http, zeroAddress } from "viem";
import { campaignFactoryAbi } from "./abi/CampaignFactory.js";
import { harvestCampaignAbi } from "./abi/HarvestCampaign.js";
import { chain, config } from "./config.js";
import { log } from "./log.js";

export const publicClient = createPublicClient({ chain, transport: http(config.rpcUrl) });
export const walletClient = createWalletClient({ account: config.account, chain, transport: http(config.rpcUrl) });

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

async function getProofLogsRaw(fromBlock: bigint, toBlock: bigint, address?: Address[]) {
  return publicClient.getLogs({ address, event: proofSubmittedEvent, fromBlock, toBlock });
}

async function getProofLogsRange(fromBlock: bigint, toBlock: bigint): Promise<RawProofLog[]> {
  if (!useAddressFilter) {
    try {
      return await getProofLogsRaw(fromBlock, toBlock);
    } catch (e) {
      // Galat jaringan biasa akan gagal juga di bawah dan dicoba lagi di tick berikutnya.
      const campaigns = await getCampaigns();
      const logs = campaigns.length > 0 ? await getProofLogsRaw(fromBlock, toBlock, campaigns) : [];
      useAddressFilter = true;
      log("AGEN", `RPC menolak getLogs tanpa alamat (${(e as { shortMessage?: string }).shortMessage ?? "galat"}) → memakai filter daftar kampanye resmi`);
      return logs;
    }
  }
  const campaigns = await getCampaigns();
  return campaigns.length > 0 ? getProofLogsRaw(fromBlock, toBlock, campaigns) : [];
}

async function getCampaigns(): Promise<Address[]> {
  return [...(await publicClient.readContract({ address: config.factory, abi: campaignFactoryAbi, functionName: "getCampaigns" }))];
}

/**
 * Semua log ProofSubmitted di rentang blok. Sesuai PRD, difilter berdasarkan signature event saja
 * (tanpa filter alamat), kecuali RPC mewajibkan alamat (lihat `useAddressFilter`).
 * Rentang dibagi per `maxLogRange` karena RPC publik membatasinya.
 */
export async function getProofLogs(fromBlock: bigint, toBlock: bigint): Promise<ProofLog[]> {
  const out: ProofLog[] = [];
  for (let start = fromBlock; start <= toBlock; start += config.maxLogRange) {
    const end = start + config.maxLogRange - 1n < toBlock ? start + config.maxLogRange - 1n : toBlock;
    for (const l of await getProofLogsRange(start, end)) {
      out.push({
        campaign: getAddress(l.address),
        index: Number(l.args.index),
        cid: l.args.cid ?? "",
        attempt: Number(l.args.attempt),
        blockNumber: l.blockNumber,
        txHash: l.transactionHash,
        logIndex: l.logIndex,
      });
    }
  }
  return out;
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
