/**
 * Isi awal reputasi agen di ERC-8004 ReputationRegistry resmi: untuk setiap tahap yang sudah diputus
 * agen DAN koperasi, wallet koperasi demo memberi feedback 100 (sepakat) atau 0 (tidak sepakat) —
 * sama persis dengan tombol "Catat penilaian" di web. Feedback yang sudah ada dilewati.
 *
 *   npm run feedback:backfill     (APP_MODE=testnet; mnemonic & RPC dari contracts/.env)
 *
 * Hanya koperasi yang wallet-nya diturunkan dari TESTNET_MNEMONIC (koperasi demo) yang bisa diproses.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { type Address, createPublicClient, createWalletClient, http, isAddressEqual, zeroHash } from "viem";
import { type HDAccount, mnemonicToAccount } from "viem/accounts";
import { campaignFactoryAbi } from "../src/abi/CampaignFactory.js";
import { erc8004ReputationRegistryAbi } from "../src/abi/ERC8004ReputationRegistry.js";
import { harvestCampaignAbi } from "../src/abi/HarvestCampaign.js";
import { AGENT_ROOT, chain, config, IS_LOCAL, requireEnv } from "../src/config.js";
import { deployments } from "../src/deployments.js";

if (IS_LOCAL) throw new Error("feedback:backfill hanya untuk testnet (APP_MODE=testnet di agent/.env).");

const FEEDBACK_TAG = "verdictAgreement"; // sama dengan web/lib/agentReputation.ts
const feedbackKey = (campaign: Address, index: number, attempt: number) => `${campaign.toLowerCase()}:m${index + 1}:a${attempt}`;

const contractsEnv = dotenv.parse(await readFile(path.join(AGENT_ROOT, "../contracts/.env"), "utf8").catch(() => ""));
const RPC = contractsEnv.BSC_TESTNET_RPC || config.rpcUrl;
const mnemonic = contractsEnv.TESTNET_MNEMONIC;
if (!mnemonic) throw new Error("TESTNET_MNEMONIC belum diisi di contracts/.env.");
const registry = (deployments.bscTestnet as unknown as { reputationRegistry?: Address }).reputationRegistry;
if (!registry) throw new Error("reputationRegistry belum ada di deployments/bscTestnet.json.");

const pub = createPublicClient({ chain, transport: http(RPC) });
const log = (msg: string) => console.log(`${new Date().toLocaleTimeString("id-ID", { hour12: false })} ${msg}`);

/** Wallet koperasi demo: cari indeks mnemonic yang alamatnya cocok. */
const demoAccounts = Array.from({ length: 40 }, (_, i) => mnemonicToAccount(mnemonic, { addressIndex: i }));
const accountOf = (addr: Address): HDAccount | undefined => demoAccounts.find((a) => isAddressEqual(a.address, addr));

const PINATA_JWT = requireEnv("PINATA_JWT", "JWT Pinata");
async function pinJson(doc: unknown, name: string): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([JSON.stringify(doc)], { type: "application/json" }), name);
  form.append("network", "public");
  form.append("name", name);
  const res = await fetch("https://uploads.pinata.cloud/v3/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  const body = (await res.json().catch(() => ({}))) as { data?: { cid?: string } };
  if (!res.ok || !body.data?.cid) throw new Error(`Unggah ${name} ke Pinata gagal (HTTP ${res.status}).`);
  return body.data.cid;
}

const factory = (deployments.bscTestnet as unknown as { factory: Address }).factory;
const [agentId, identityRegistry, campaigns] = await Promise.all([
  pub.readContract({ address: factory, abi: campaignFactoryAbi, functionName: "agentId" }),
  pub.readContract({ address: factory, abi: campaignFactoryAbi, functionName: "identityRegistry" }),
  pub.readContract({ address: factory, abi: campaignFactoryAbi, functionName: "getCampaigns" }),
]);
log(`agen #${agentId} · ${campaigns.length} proyek · registri reputasi ${registry}`);

const given = new Map<string, Set<string>>();
async function givenBy(client: Address): Promise<Set<string>> {
  const k = client.toLowerCase();
  if (!given.has(k)) {
    const [, , , , , tag2s] = await pub.readContract({
      address: registry!,
      abi: erc8004ReputationRegistryAbi,
      functionName: "readAllFeedback",
      args: [agentId, [client], FEEDBACK_TAG, "", true],
    });
    given.set(k, new Set(tag2s));
  }
  return given.get(k)!;
}

let sent = 0;
for (const campaign of campaigns) {
  const [summary, milestones] = await Promise.all([
    pub.readContract({ address: campaign, abi: harvestCampaignAbi, functionName: "getSummary" }),
    pub.readContract({ address: campaign, abi: harvestCampaignAbi, functionName: "getMilestones" }),
  ]);
  const coop = accountOf(summary.cooperative);
  for (const [index, m] of milestones.entries()) {
    if (!m.aiDecided || !m.verifierDecided) continue;
    const key = feedbackKey(campaign, index, m.attempts);
    if (!coop) {
      log(`  lewati ${key}: koperasi ${summary.cooperative} bukan wallet demo`);
      continue;
    }
    const done = await givenBy(coop.address);
    if (done.has(key)) continue;
    const agree = m.aiApproved === m.verifierApproved;
    const cid = await pinJson(
      {
        schema: "bagipanen.agent-feedback.v1",
        agentRegistry: `eip155:${chain.id}:${identityRegistry}`,
        agentId: Number(agentId),
        clientAddress: `eip155:${chain.id}:${coop.address}`,
        createdAt: new Date().toISOString(),
        value: agree ? 100 : 0,
        valueDecimals: 0,
        tag1: FEEDBACK_TAG,
        tag2: key,
        campaign,
        milestoneIndex: index,
        milestoneName: m.name,
        attempt: m.attempts,
        proofCID: m.proofCID,
        aiApproved: m.aiApproved,
        aiReasonCID: m.aiReasonCID,
        verifierApproved: m.verifierApproved,
      },
      `feedback-${campaign.slice(2, 10)}-m${index + 1}-a${m.attempts}.json`,
    );
    const wallet = createWalletClient({ account: coop, chain, transport: http(RPC) });
    const hash = await wallet.writeContract({
      address: registry,
      abi: erc8004ReputationRegistryAbi,
      functionName: "giveFeedback",
      args: [agentId, agree ? 100n : 0n, 0, FEEDBACK_TAG, key, "", `ipfs://${cid}`, zeroHash],
    });
    const receipt = await pub.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`giveFeedback ${key} gagal (tx ${hash})`);
    done.add(key);
    sent++;
    log(`  ✓ ${m.name} ${campaign.slice(0, 8)}… → ${agree ? "sepakat (100)" : "tidak sepakat (0)"} · ${hash.slice(0, 12)}…`);
  }
}

const coops = [...new Set(campaigns.length ? (await Promise.all(campaigns.map((c) => pub.readContract({ address: c, abi: harvestCampaignAbi, functionName: "getSummary" })))).map((s) => s.cooperative) : [])];
const [count, value, decimals] = await pub.readContract({
  address: registry,
  abi: erc8004ReputationRegistryAbi,
  functionName: "getSummary",
  args: [agentId, coops, FEEDBACK_TAG, ""],
});
log(`== ${sent} feedback baru · ringkasan registri: ${count} penilaian, kesepakatan ${Number(value) / 10 ** decimals}%`);
