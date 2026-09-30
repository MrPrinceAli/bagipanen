import { type Address, createPublicClient, createWalletClient, getAbiItem, getAddress, type Hash, http, zeroAddress } from "viem";
import { campaignFactoryAbi } from "./abi/CampaignFactory.js";
import { harvestCampaignAbi } from "./abi/HarvestCampaign.js";
import { chain, config } from "./config.js";

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
 * Semua log ProofSubmitted di rentang blok, TANPA filter alamat (filter berdasarkan
 * signature event). Rentang dibagi per `maxLogRange` karena RPC publik membatasinya.
 */
export async function getProofLogs(fromBlock: bigint, toBlock: bigint): Promise<ProofLog[]> {
  const out: ProofLog[] = [];
  for (let start = fromBlock; start <= toBlock; start += config.maxLogRange) {
    const end = start + config.maxLogRange - 1n < toBlock ? start + config.maxLogRange - 1n : toBlock;
    const logs = await publicClient.getLogs({ event: proofSubmittedEvent, fromBlock: start, toBlock: end });
    for (const l of logs) {
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
