/**
 * Daftarkan agen ke registri identitas (PRD, Integrasi ERC-8004 — alur pendaftaran):
 *   1. Unggah agent-card.json (format registration file ERC-8004) ke IPFS.
 *   2. `register(agentURI)` dari wallet agen → agentId (wallet agen = pemilik = agentWallet).
 *   3. Lengkapi `registrations` di agent card dengan agentId (registri resmi: `setAgentURI`).
 *   4. Admin memanggil `factory.setAgent(registry, agentId, agentWallet)`.
 *      Mode lokal: otomatis dengan akun admin Anvil. Testnet: dari halaman /admin.
 *
 * Mendukung registri ERC-8004 resmi (lihat docs/erc8004-notes.md) dan fallback MockAgentIdentity.
 * Aman dijalankan ulang: hasil pendaftaran disimpan di data/registration.json.
 *
 * `npm run register -- --update-card` (agen sudah terdaftar): perbarui isi agent card. Wilayah,
 * komoditas, dan koperasi mitra dibaca dari semua proyek resmi di chain, lalu kartu baru diunggah
 * ke IPFS dan dipasang lewat `setAgentURI`. Agen ID & riwayat tidak berubah.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type Address, createWalletClient, http, isAddressEqual, parseEventLogs } from "viem";
import { campaignFactoryAbi } from "../src/abi/CampaignFactory.js";
import { harvestCampaignAbi } from "../src/abi/HarvestCampaign.js";
import { erc8004IdentityRegistryAbi } from "../src/abi/ERC8004IdentityRegistry.js";
import { mockAgentIdentityAbi } from "../src/abi/MockAgentIdentity.js";
import { createStorage } from "../src/adapters.js";
import { publicClient, readAgentConfig, walletClient } from "../src/chain.js";
import { AGENT_ROOT, chain, config, IS_LOCAL } from "../src/config.js";
import { deployments } from "../src/deployments.js";
import { fmt, log } from "../src/log.js";

type Registration = { chainId: number; registry: Address; agentId: string; agentURI: string; wallet: Address };
const REG_FILE = path.join(config.dataDir, "registration.json");

type Coverage = { regions: string[]; commodities: string[]; partnerCooperatives: string[] };

function buildCard(agentWallet: Address, registrations: { agentId: number; agentRegistry: string }[], coverage?: Coverage) {
  const card = JSON.parse(readFileSync(path.join(AGENT_ROOT, "agent-card.json"), "utf8")) as Record<string, unknown> & {
    image?: string;
    bagipanen?: Record<string, unknown>;
  };
  card.agentWallet = agentWallet;
  card.registrations = registrations;
  if (typeof card.image === "string" && card.image.includes("<")) delete card.image; // logo belum ada
  if (card.bagipanen) {
    card.bagipanen.network = IS_LOCAL ? "anvil-local" : "bsc-testnet";
    if (coverage) Object.assign(card.bagipanen, coverage);
    const rep = (IS_LOCAL ? null : (deployments.bscTestnet as { reputationRegistry?: string } | null))?.reputationRegistry;
    if (rep) card.bagipanen.reputationRegistry = `eip155:${chain.id}:${rep}`;
  }
  return card;
}

async function send(label: string, run: () => Promise<`0x${string}`>) {
  const hash = await run();
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${label} gagal (tx ${hash}).`);
  return receipt;
}

/** Cakupan kerja agen dari semua proyek resmi: provinsi (bagian akhir nama lokasi), komoditas, koperasi. */
async function readCoverage(): Promise<Coverage> {
  const campaigns = await publicClient.readContract({ address: config.factory, abi: campaignFactoryAbi, functionName: "getCampaigns" });
  const summaries = await Promise.all(campaigns.map((c) => publicClient.readContract({ address: c, abi: harvestCampaignAbi, functionName: "getSummary" })));
  const coops = [...new Set(summaries.map((s) => s.cooperative.toLowerCase()))] as Address[];
  const names = await Promise.all(coops.map((c) => publicClient.readContract({ address: config.factory, abi: campaignFactoryAbi, functionName: "cooperativeName", args: [c] })));
  const sorted = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "id"));
  return {
    regions: sorted(summaries.map((s) => s.locationName.split(",").at(-1) ?? "").map((r) => (r.trim() === "Garut" ? "Jawa Barat" : r))),
    commodities: sorted(summaries.map((s) => s.commodity)),
    partnerCooperatives: sorted(names),
  };
}

async function updateCard(agentId: bigint, registry: Address, chainId: number) {
  const coverage = await readCoverage();
  log("KARTU", `${coverage.regions.length} wilayah · ${coverage.commodities.length} komoditas · ${coverage.partnerCooperatives.length} koperasi`);
  const cid = await createStorage().putJson(buildCard(config.account.address, [{ agentId: Number(agentId), agentRegistry: `eip155:${chainId}:${registry}` }], coverage), "agent-card.json");
  const agentURI = `ipfs://${cid}`;
  const sim = await publicClient.simulateContract({
    account: config.account,
    address: registry,
    abi: erc8004IdentityRegistryAbi,
    functionName: "setAgentURI",
    args: [agentId, agentURI],
  });
  const receipt = await send("setAgentURI", () => walletClient.writeContract(sim.request));
  log("KARTU", fmt.green(`agent card #${agentId} diperbarui → ${agentURI} (tx ${receipt.transactionHash})`));
  const reg: Registration = { chainId, registry, agentId: agentId.toString(), agentURI, wallet: config.account.address };
  mkdirSync(config.dataDir, { recursive: true });
  writeFileSync(REG_FILE, JSON.stringify(reg, null, 2));
}

async function main() {
  const agentWallet = config.account.address;
  const chainId = await publicClient.getChainId();
  const current = await readAgentConfig();
  if (current.isAgent && isAddressEqual(current.agentWallet, agentWallet)) {
    if (process.argv.includes("--update-card")) return updateCard(current.agentId, current.identityRegistry, chainId);
    log("DAFTAR", fmt.green(`sudah terdaftar: agen #${current.agentId} di registri ${current.identityRegistry}`));
    return;
  }

  const dep = (IS_LOCAL ? deployments.anvil : deployments.bscTestnet) as { identityRegistry: Address; identityIsMock: boolean } | null;
  if (!dep) throw new Error("Deployment belum ada. Jalankan deploy lalu `npm run sync`.");
  const registry = dep.identityRegistry;
  const agentRegistry = `eip155:${chainId}:${registry}`;
  const storage = createStorage();

  // Pendaftaran yang sudah pernah dilakukan (mis. setAgent belum sempat dijalankan admin)
  let reg: Registration | null = existsSync(REG_FILE) ? (JSON.parse(readFileSync(REG_FILE, "utf8")) as Registration) : null;
  if (reg && (reg.chainId !== chainId || !isAddressEqual(reg.registry, registry) || !isAddressEqual(reg.wallet, agentWallet))) reg = null;
  if (reg) {
    const owner = await publicClient.readContract({ address: registry, abi: erc8004IdentityRegistryAbi, functionName: "ownerOf", args: [BigInt(reg.agentId)] }).catch(() => null);
    if (!owner || !isAddressEqual(owner, agentWallet)) reg = null;
    else log("DAFTAR", `memakai pendaftaran sebelumnya: agen #${reg.agentId} (${reg.agentURI})`);
  }

  if (!reg) {
    let agentId: bigint;
    let agentURI: string;
    if (dep.identityIsMock) {
      // MockAgentIdentity: ID berurutan, jadi `registrations` bisa diisi sebelum mendaftar.
      const next = (await publicClient.readContract({ address: registry, abi: mockAgentIdentityAbi, functionName: "totalAgents" })) + 1n;
      const cid = await storage.putJson(buildCard(agentWallet, [{ agentId: Number(next), agentRegistry }]), "agent-card.json");
      agentURI = `ipfs://${cid}`;
      const { request } = await publicClient.simulateContract({ account: config.account, address: registry, abi: mockAgentIdentityAbi, functionName: "register", args: [agentURI] });
      const receipt = await send("register", () => walletClient.writeContract(request));
      const [ev] = parseEventLogs({ abi: mockAgentIdentityAbi, logs: receipt.logs, eventName: "AgentRegistered" });
      if (!ev) throw new Error("Event AgentRegistered tidak ditemukan.");
      agentId = ev.args.agentId;
      log("DAFTAR", `terdaftar di MockAgentIdentity ${registry} sebagai agen #${agentId} (tx ${receipt.transactionHash})`);
    } else {
      // Registri ERC-8004 resmi: daftar dulu, lalu lengkapi `registrations` lewat setAgentURI.
      const firstCid = await storage.putJson(buildCard(agentWallet, []), "agent-card.json");
      const { request } = await publicClient.simulateContract({
        account: config.account,
        address: registry,
        abi: erc8004IdentityRegistryAbi,
        functionName: "register",
        args: [`ipfs://${firstCid}`],
      });
      const receipt = await send("register", () => walletClient.writeContract(request));
      const [ev] = parseEventLogs({ abi: erc8004IdentityRegistryAbi, logs: receipt.logs, eventName: "Registered" });
      if (!ev) throw new Error("Event Registered tidak ditemukan.");
      agentId = ev.args.agentId;
      log("DAFTAR", `terdaftar di registri ERC-8004 ${registry} sebagai agen #${agentId} (tx ${receipt.transactionHash})`);

      const cid = await storage.putJson(buildCard(agentWallet, [{ agentId: Number(agentId), agentRegistry }]), "agent-card.json");
      agentURI = `ipfs://${cid}`;
      const sim = await publicClient.simulateContract({
        account: config.account,
        address: registry,
        abi: erc8004IdentityRegistryAbi,
        functionName: "setAgentURI",
        args: [agentId, agentURI],
      });
      const r2 = await send("setAgentURI", () => walletClient.writeContract(sim.request));
      log("DAFTAR", `agent card dilengkapi registrations → ${agentURI} (tx ${r2.transactionHash})`);
    }
    reg = { chainId, registry, agentId: agentId.toString(), agentURI, wallet: agentWallet };
    mkdirSync(config.dataDir, { recursive: true });
    writeFileSync(REG_FILE, JSON.stringify(reg, null, 2));
  }

  // setAgent oleh admin
  if (!IS_LOCAL || !config.localAdminAccount) {
    log("DAFTAR", fmt.yellow("Langkah berikutnya: admin memanggil setAgent (halaman /admin → Konfigurasi agen AI) dengan:"));
    console.log(`  registry    ${registry}\n  agentId     ${reg.agentId}\n  agentWallet ${agentWallet}`);
    return;
  }
  const admin = createWalletClient({ account: config.localAdminAccount, chain, transport: http(config.rpcUrl) });
  const sim = await publicClient.simulateContract({
    account: config.localAdminAccount,
    address: config.factory,
    abi: campaignFactoryAbi,
    functionName: "setAgent",
    args: [registry, BigInt(reg.agentId), agentWallet],
  });
  const receipt = await send("setAgent", () => admin.writeContract(sim.request));
  const after = await readAgentConfig();
  log("DAFTAR", fmt.green(`admin menjalankan setAgent → isAgent(${agentWallet}) = ${after.isAgent} (tx ${receipt.transactionHash})`));
}

main().catch((e) => {
  log("ERROR", (e as { shortMessage?: string }).shortMessage ?? (e as Error).message);
  process.exit(1);
});
