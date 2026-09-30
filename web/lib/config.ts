import { defineChain } from "viem";
import { anvil, bscTestnet } from "viem/chains";

/** Mode aplikasi: `local` (Anvil + penyimpanan lokal) atau `testnet` (BSC testnet + Pinata). */
export type AppMode = "local" | "testnet";
export const APP_MODE: AppMode = process.env.NEXT_PUBLIC_APP_MODE === "testnet" ? "testnet" : "local";
export const IS_LOCAL = APP_MODE === "local";

const LOCAL_RPC = process.env.NEXT_PUBLIC_LOCAL_RPC_URL || anvil.rpcUrls.default.http[0];
const BSC_TESTNET_RPC = process.env.NEXT_PUBLIC_BSC_TESTNET_RPC || bscTestnet.rpcUrls.default.http[0];

export const localChain = defineChain({
  ...anvil,
  name: "Chain lokal (Anvil)",
  rpcUrls: { default: { http: [LOCAL_RPC] } },
});

export const testnetChain = defineChain({
  ...bscTestnet,
  rpcUrls: { default: { http: [BSC_TESTNET_RPC] } },
});

/** Chain tujuan sesuai mode. */
export const targetChain = IS_LOCAL ? localChain : testnetChain;

/** Kurs tetap untuk perkiraan rupiah (PRD: Rp16.000 per USDT). */
export const IDR_PER_USDT = Number(process.env.NEXT_PUBLIC_IDR_PER_USDT) || 16_000;

export const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

/** Refresh otomatis data kontrak (PRD: setiap 10 detik). */
export const REFRESH_MS = 10_000;

/** Jumlah mUSDT yang diminta tombol "Minta mUSDT demo". */
export const FAUCET_AMOUNT = 1_000n * 10n ** 18n;

export function explorerTxUrl(hash: string): string | null {
  const base = targetChain.blockExplorers?.default.url;
  return base ? `${base}/tx/${hash}` : null;
}

export function explorerAddressUrl(address: string): string | null {
  const base = targetChain.blockExplorers?.default.url;
  return base ? `${base}/address/${address}` : null;
}
