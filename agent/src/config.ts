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

/** RPC publik BSC testnet tanpa kunci; dipakai sebagai cadangan bila RPC utama menolak (mis. HTTP 429). */
export const PUBLICNODE_TESTNET_RPC = "https://bsc-testnet-rpc.publicnode.com";
/** Endpoint publik NodeReal (dokumentasi BNB Chain): riwayat log lengkap, kuota bersama. */
export const NODEREAL_TESTNET_RPC = "https://bsc-testnet.nodereal.io/v1/e9a36765eb8a40b9bd12e680a1fd2bc5";

const list = (v: string | undefined) => (v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
const unique = (xs: string[]) => [...new Set(xs)];

/** RPC utama + cadangan (baca & kirim transaksi). */
const rpcUrls = IS_LOCAL ? [rpcUrl] : unique([rpcUrl, PUBLICNODE_TESTNET_RPC, bscTestnet.rpcUrls.default.http[0]]);
/**
 * Penyedia eth_getLogs, dicoba berurutan. publicnode cepat (50.000 blok/panggilan) tetapi hanya menyimpan
 * log ±2 hari, jadi dipakai hanya untuk rentang baru (lihat chain.ts); sisanya berriwayat lengkap.
 */
const logRpcUrls = IS_LOCAL ? [rpcUrl] : unique([...list(env("LOGS_RPC")), PUBLICNODE_TESTNET_RPC, rpcUrl, NODEREAL_TESTNET_RPC]);

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
  rpcUrls,
  logRpcUrls,
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
  /** Folder state agen (blok terakhir, sidik jari foto, antrean ulang). Bisa diganti untuk uji/CI. */
  dataDir: path.resolve(AGENT_ROOT, env("AGENT_DATA_DIR") ?? "data"),
  pollMs: Number(env("POLL_INTERVAL_MS") ?? 10_000),
  retryAttempts: 3,
  retryDelayMs: Number(env("RETRY_DELAY_MS") ?? 15_000),
  /**
   * Rentang blok awal per getLogs. Rentang mengecil otomatis per penyedia bila RPC menyebut batasnya
   * (Sentio: 1.000 blok sejak Okt 2026; publicnode/NodeReal: 50.000).
   */
  maxLogRange: BigInt(env("MAX_LOG_RANGE") ?? (IS_LOCAL ? 100_000 : 50_000)),
};
