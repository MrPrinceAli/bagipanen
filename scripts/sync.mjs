#!/usr/bin/env node
// npm run sync — salin ABI (contracts/out) dan alamat deployment (deployments/*.json)
// ke web/lib/ dan agent/src/ sebagai modul TypeScript bertipe (`as const`).
//   --no-build  lewati `forge build` (dipakai dev:chain yang sudah build lewat forge script)
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTRACTS = [
  "MockUSDT",
  "MockAgentIdentity",
  "CampaignFactory",
  "HarvestCampaign",
  "ReservePool",
  "ReputationBook",
];
const NETWORKS = ["anvil", "bscTestnet"];
const TARGETS = [
  { abiDir: "web/lib/abi", deploymentsFile: "web/lib/deployments.ts" },
  { abiDir: "agent/src/abi", deploymentsFile: "agent/src/deployments.ts" },
];
const HEADER = "// File ini dibuat otomatis oleh `npm run sync`. Jangan diedit manual.\n";

if (!process.argv.includes("--no-build")) {
  execFileSync("forge", ["build"], { cwd: join(root, "contracts"), stdio: "inherit" });
}

const lowerFirst = (s) => s[0].toLowerCase() + s.slice(1);

function readAbi(name) {
  const file = join(root, "contracts/out", `${name}.sol`, `${name}.json`);
  if (!existsSync(file)) throw new Error(`ABI ${name} tidak ditemukan di ${file}. Jalankan forge build.`);
  return JSON.parse(readFileSync(file, "utf8")).abi;
}

function readDeployments() {
  const out = {};
  for (const net of NETWORKS) {
    const file = join(root, "deployments", `${net}.json`);
    out[net] = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
  }
  return out;
}

const abis = Object.fromEntries(CONTRACTS.map((n) => [n, readAbi(n)]));
const deployments = readDeployments();

for (const t of TARGETS) {
  const abiDir = join(root, t.abiDir);
  mkdirSync(abiDir, { recursive: true });
  rmSync(join(abiDir, ".gitkeep"), { force: true });
  for (const [name, abi] of Object.entries(abis)) {
    const src = `${HEADER}export const ${lowerFirst(name)}Abi = ${JSON.stringify(abi, null, 2)} as const;\n`;
    writeFileSync(join(abiDir, `${name}.ts`), src);
  }
  const dep = `${HEADER}export const deployments = ${JSON.stringify(deployments, null, 2)} as const;\n`;
  writeFileSync(join(root, t.deploymentsFile), dep);
}

const nets = NETWORKS.filter((n) => deployments[n]).join(", ") || "belum ada";
console.log(`✓ sync: ${CONTRACTS.length} ABI → ${TARGETS.map((t) => t.abiDir).join(" & ")}; deployment: ${nets}`);
