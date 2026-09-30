import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { type Address, type Hex, defineChain } from "viem";
import { type LocalAccount, mnemonicToAccount, privateKeyToAccount } from "viem/accounts";
import { anvil, bscTestnet } from "viem/chains";
import { deployments } from "./deployments.js";

/** Root paket agent/ (tempat .env, data/, agent-card.json). */
export const AGENT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(AGENT_ROOT, ".env"), quiet: true });

export type AppMode = "local" | "testnet";
export const APP_MODE: AppMode = process.env.APP_MODE === "testnet" ? "testnet" : "local";
export const IS_LOCAL = APP_MODE === "local";

type Deployment = {
  chainId: number;
  startBlock: number;
  factory: Address;
  identityRegistry: Address;
  identityIsMock: boolean;
  mnemonic?: string;
  accounts?: Record<string, { index: number; address: Address }>;
};
const all = deployments as unknown as { anvil: Deployment | null; bscTestnet: Deployment | null };

function env(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

export function requireEnv(name: string, hint: string): string {
  const v = env(name);
  if (!v) throw new Error(`Variabel ${name} belum diisi di agent/.env (${hint}).`);
  return v;
}

const deployment = IS_LOCAL ? all.anvil : all.bscTestnet;

const rpcUrl = IS_LOCAL
  ? env("LOCAL_RPC_URL") ?? anvil.rpcUrls.default.http[0]
  : env("BSC_TESTNET_RPC") ?? bscTestnet.rpcUrls.default.http[0];

export const chain = defineChain({
  ...(IS_LOCAL ? anvil : bscTestnet),
  rpcUrls: { default: { http: [rpcUrl] } },
});

function resolveFactory(): Address {
  const fromEnv = env("FACTORY_ADDRESS");
  const addr = IS_LOCAL ? deployment?.factory : (fromEnv as Address | undefined) ?? deployment?.factory;
  if (!addr) {
    throw new Error(
      IS_LOCAL
        ? "deployments/anvil.json belum ada. Jalankan `npm run dev:chain` di root repo."
        : "FACTORY_ADDRESS belum diisi dan deployments/bscTestnet.json belum ada.",
    );
  }
  return addr;
}

/** Wallet agen. Lokal: akun bawaan Anvil "agen"; testnet: AGENT_PRIVATE_KEY. */
function resolveAccount(): LocalAccount {
  if (IS_LOCAL) {
    const agen = deployment?.accounts?.agen;
    if (!deployment?.mnemonic || !agen) throw new Error("Akun agen tidak ada di deployments/anvil.json.");
    return mnemonicToAccount(deployment.mnemonic, { addressIndex: agen.index });
  }
  const key = requireEnv("AGENT_PRIVATE_KEY", "private key wallet agen, KHUSUS testnet");
  return privateKeyToAccount((key.startsWith("0x") ? key : `0x${key}`) as Hex);
}

export const config = {
  mode: APP_MODE,
  rpcUrl,
  factory: resolveFactory(),
  startBlock: BigInt(env("START_BLOCK") ?? deployment?.startBlock ?? 0),
  identityIsMock: deployment?.identityIsMock ?? true,
  account: resolveAccount(),
  /** Akun admin Anvil — hanya untuk `setAgent` otomatis di mode lokal. */
  localAdminAccount:
    IS_LOCAL && deployment?.mnemonic && deployment.accounts?.admin
      ? mnemonicToAccount(deployment.mnemonic, { addressIndex: deployment.accounts.admin.index })
      : undefined,
  storage: IS_LOCAL ? ("local" as const) : ("pinata" as const),
  vision: IS_LOCAL ? ("mock" as const) : ("gemini" as const),
  localIpfsDir: path.resolve(AGENT_ROOT, env("LOCAL_IPFS_DIR") ?? "../web/.local-ipfs"),
  ipfsGateway: env("IPFS_GATEWAY"),
  dataDir: path.join(AGENT_ROOT, "data"),
  pollMs: Number(env("POLL_INTERVAL_MS") ?? 10_000),
  retryAttempts: 3,
  retryDelayMs: Number(env("RETRY_DELAY_MS") ?? 15_000),
  /** Rentang blok maksimal per getLogs (RPC publik membatasi rentang). */
  maxLogRange: BigInt(env("MAX_LOG_RANGE") ?? (IS_LOCAL ? 100_000 : 5_000)),
};
