#!/usr/bin/env node
// npm run dev:chain — satu perintah untuk chain lokal berisi data demo:
// nyalakan Anvil → deploy kontrak → seed data demo → sync ABI & alamat → daftarkan agen AI.
// Anvil tetap berjalan sampai Ctrl+C. Setiap kali dijalankan, chain dimulai dari nol.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, openSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const contractsDir = join(root, "contracts");
const PORT = "8545"; // sama dengan rpc_endpoints.anvil di contracts/foundry.toml
const RPC = `http://127.0.0.1:${PORT}`;
const LOG_FILE = join(root, ".anvil.log");

async function rpcReady() {
  try {
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function fail(message) {
  console.error(`\n✗ ${message}`);
  stop(1);
}

let anvil;
let stopping = false;
function stop(code = 0) {
  stopping = true;
  if (anvil && anvil.exitCode === null) anvil.kill("SIGTERM");
  process.exit(code);
}
process.on("SIGINT", () => {
  console.log("\nMematikan Anvil…");
  stop(0);
});
process.on("SIGTERM", () => stop(0));

function step(label, cmd, args, cwd) {
  console.log(`\n▶ ${label}`);
  const res = spawnSync(cmd, args, { cwd, stdio: "inherit" });
  if (res.error) fail(`${label} gagal: ${res.error.message}`);
  if (res.status !== 0) fail(`${label} gagal (kode ${res.status}).`);
}

if (await rpcReady()) {
  console.error(`✗ Port ${PORT} sudah dipakai (Anvil lain masih berjalan?). Hentikan dulu lalu ulangi.`);
  process.exit(1);
}

console.log(`▶ Menyalakan Anvil di ${RPC} (log: .anvil.log)`);
const log = openSync(LOG_FILE, "w");
anvil = spawn("anvil", ["--port", PORT, "--chain-id", "31337"], { stdio: ["ignore", log, log] });
anvil.on("error", (err) => fail(`Anvil tidak bisa dijalankan: ${err.message}. Sudah pasang Foundry?`));
anvil.on("exit", (code) => {
  if (!stopping) fail(`Anvil berhenti tiba-tiba (kode ${code}). Lihat .anvil.log.`);
});

let ready = false;
for (let i = 0; i < 60 && !ready; i++) {
  ready = await rpcReady();
  if (!ready) await new Promise((r) => setTimeout(r, 250));
}
if (!ready) fail("Anvil tidak merespons dalam 15 detik. Lihat .anvil.log.");

step("Deploy kontrak (Deploy.s.sol)", "forge", ["script", "script/Deploy.s.sol", "--rpc-url", "anvil", "--broadcast"], contractsDir);
step("Seed data demo (Seed.s.sol)", "forge", ["script", "script/Seed.s.sol", "--rpc-url", "anvil", "--broadcast"], contractsDir);
step("Sync ABI & alamat ke web/ dan agent/", "node", [join(root, "scripts/sync.mjs"), "--no-build"], root);

const agentDir = join(root, "agent");
let agentRegistered = false;
if (existsSync(join(agentDir, "node_modules"))) {
  console.log("\n▶ Daftarkan agen AI (MockAgentIdentity + setAgent)");
  const res = spawnSync("npm", ["run", "-s", "register"], {
    cwd: agentDir,
    stdio: "inherit",
    env: { ...process.env, APP_MODE: "local" },
  });
  agentRegistered = res.status === 0;
  if (!agentRegistered) console.warn("⚠ Registrasi agen gagal; chain tetap berjalan. Coba: cd agent && npm run register");
} else {
  console.warn("\n⚠ agent/node_modules belum ada — lewati registrasi agen. Jalankan: cd agent && npm install && npm run register");
}

const d = JSON.parse(readFileSync(join(root, "deployments/anvil.json"), "utf8"));
const rows = [
  ["CampaignFactory", d.factory],
  ["MockUSDT", d.usdt],
  ["MockAgentIdentity", d.identityRegistry],
  ["ReputationBook", d.reputationBook],
  ["ReservePool", d.reservePool],
];
const accounts = [
  ["Admin", "admin"],
  ["Koperasi", "koperasi"],
  ["Petani", "petani"],
  ["Rina", "rina"],
  ["Budi", "budi"],
  ["Sari", "sari"],
  ["Agen", "agen"],
];
console.log(`\n✅ Chain lokal siap di ${RPC} (chain ID ${d.chainId}), berisi data demo.`);
console.log("\nKontrak:");
for (const [name, addr] of rows) console.log(`  ${name.padEnd(18)} ${addr}`);
console.log("\nAkun demo (akun bawaan Anvil):");
for (const [label, key] of accounts) console.log(`  ${label.padEnd(18)} ${d.accounts[key].address}`);
console.log(`\nAgen AI: ${agentRegistered ? "terdaftar ✓ — jalankan `npm run dev:agent` di terminal lain" : "belum terdaftar"}`);
console.log("\nTekan Ctrl+C untuk mematikan chain.");
