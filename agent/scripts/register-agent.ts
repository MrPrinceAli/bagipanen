/**
 * Daftarkan agen ke registri identitas (PRD, Integrasi ERC-8004 — alur pendaftaran):
 *   1. Unggah agent-card.json ke IPFS (mode lokal: web/.local-ipfs).
 *   2. Panggil `register(uri)` dari wallet agen → simpan agentId.
 *   3. Admin memanggil `factory.setAgent(registry, agentId, agentWallet)`.
 *      Mode lokal: otomatis memakai akun admin Anvil. Testnet: dari halaman /admin.
 *
 * Saat ini hanya jalur MockAgentIdentity (`register(string) returns (uint256)`) yang didukung.
 * Registri ERC-8004 resmi di BSC testnet diriset di tahap konfigurasi (docs/erc8004-notes.md).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { createWalletClient, http, isAddressEqual, parseEventLogs } from "viem";
import { campaignFactoryAbi } from "../src/abi/CampaignFactory.js";
import { mockAgentIdentityAbi } from "../src/abi/MockAgentIdentity.js";
import { createStorage } from "../src/adapters.js";
import { publicClient, readAgentConfig, walletClient } from "../src/chain.js";
import { AGENT_ROOT, chain, config, IS_LOCAL } from "../src/config.js";
import { fmt, log } from "../src/log.js";
import { deployments } from "../src/deployments.js";

async function main() {
  const agentWallet = config.account.address;
  const current = await readAgentConfig();
  if (current.isAgent && isAddressEqual(current.agentWallet, agentWallet)) {
    log("DAFTAR", fmt.green(`sudah terdaftar: agen #${current.agentId} di registri ${current.identityRegistry}`));
    return;
  }

  const dep = (IS_LOCAL ? deployments.anvil : deployments.bscTestnet) as { identityRegistry: `0x${string}`; identityIsMock: boolean } | null;
  if (!dep) throw new Error("Deployment belum ada. Jalankan deploy lalu `npm run sync`.");
  if (!dep.identityIsMock) {
    throw new Error(
      "Registri ERC-8004 resmi belum didukung script ini. Lihat docs/erc8004-notes.md (tahap konfigurasi).",
    );
  }
  const registry = dep.identityRegistry;

  // 1. Agent card → IPFS
  const card = JSON.parse(readFileSync(path.join(AGENT_ROOT, "agent-card.json"), "utf8")) as Record<string, unknown> & {
    image?: string;
    bagipanen?: Record<string, unknown>;
  };
  card.agentWallet = agentWallet;
  if (typeof card.image === "string" && card.image.includes("<")) delete card.image; // logo belum ada
  if (IS_LOCAL && card.bagipanen) card.bagipanen.network = "anvil-local";
  const storage = createStorage();
  const cardCid = await storage.putJson(card, "agent-card.json");
  const uri = `ipfs://${cardCid}`;
  log("DAFTAR", `agent card diunggah (${storage.name}): ${uri}`);

  // 2. register(uri) dari wallet agen
  const { request } = await publicClient.simulateContract({
    account: config.account,
    address: registry,
    abi: mockAgentIdentityAbi,
    functionName: "register",
    args: [uri],
  });
  const regHash = await walletClient.writeContract(request);
  const regReceipt = await publicClient.waitForTransactionReceipt({ hash: regHash });
  const [registered] = parseEventLogs({ abi: mockAgentIdentityAbi, logs: regReceipt.logs, eventName: "AgentRegistered" });
  if (!registered) throw new Error("Event AgentRegistered tidak ditemukan.");
  const agentId = registered.args.agentId;
  log("DAFTAR", `terdaftar di MockAgentIdentity ${registry} sebagai agen #${agentId} (tx ${regHash})`);

  // 3. setAgent oleh admin
  if (!IS_LOCAL || !config.localAdminAccount) {
    log("DAFTAR", fmt.yellow("Langkah berikutnya: admin memanggil setAgent dari halaman /admin dengan:"));
    console.log(`  registry    ${registry}\n  agentId     ${agentId}\n  agentWallet ${agentWallet}`);
    return;
  }
  const admin = createWalletClient({ account: config.localAdminAccount, chain, transport: http(config.rpcUrl) });
  const sim = await publicClient.simulateContract({
    account: config.localAdminAccount,
    address: config.factory,
    abi: campaignFactoryAbi,
    functionName: "setAgent",
    args: [registry, agentId, agentWallet],
  });
  const setHash = await admin.writeContract(sim.request);
  await publicClient.waitForTransactionReceipt({ hash: setHash });
  const after = await readAgentConfig();
  log("DAFTAR", fmt.green(`admin menjalankan setAgent → isAgent(${agentWallet}) = ${after.isAgent} (tx ${setHash})`));
}

main().catch((e) => {
  log("ERROR", (e as { shortMessage?: string }).shortMessage ?? (e as Error).message);
  process.exit(1);
});
