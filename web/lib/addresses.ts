import type { Address } from "viem";
import { IS_LOCAL } from "./config";
import { deployments } from "./deployments";

export type Deployment = {
  network: string;
  chainId: number;
  startBlock: number;
  deployer: Address;
  usdt: Address;
  identityRegistry: Address;
  identityIsMock: boolean;
  factory: Address;
  campaignDeployer: Address;
  reputationBook: Address;
  reservePool: Address;
  mnemonic?: string;
  accounts?: Record<string, { index: number; address: Address }>;
};

const all = deployments as unknown as { anvil: Deployment | null; bscTestnet: Deployment | null };

/** Deployment lokal (Anvil); dipakai juga untuk pemilih akun demo. */
export const localDeployment = all.anvil;
const current = IS_LOCAL ? all.anvil : all.bscTestnet;

const asAddress = (v: string | undefined): Address | undefined =>
  v && /^0x[0-9a-fA-F]{40}$/.test(v) ? (v as Address) : undefined;

/**
 * Alamat kontrak. Mode lokal: dari deployments/anvil.json (lewat `npm run sync`).
 * Mode testnet: dari NEXT_PUBLIC_*_ADDRESS, jika kosong dari deployments/bscTestnet.json.
 */
export const addresses = IS_LOCAL
  ? {
      factory: current?.factory,
      usdt: current?.usdt,
      reservePool: current?.reservePool,
      reputationBook: current?.reputationBook,
    }
  : {
      factory: asAddress(process.env.NEXT_PUBLIC_FACTORY_ADDRESS) ?? current?.factory,
      usdt: asAddress(process.env.NEXT_PUBLIC_USDT_ADDRESS) ?? current?.usdt,
      reservePool: asAddress(process.env.NEXT_PUBLIC_RESERVE_ADDRESS) ?? current?.reservePool,
      reputationBook: asAddress(process.env.NEXT_PUBLIC_REPUTATION_ADDRESS) ?? current?.reputationBook,
    };

/** Blok awal pencarian event (blok deploy factory). */
export const START_BLOCK = BigInt(current?.startBlock ?? 0);

export const CONTRACTS_READY = Boolean(
  addresses.factory && addresses.usdt && addresses.reservePool && addresses.reputationBook,
);

/** Alamat yang sudah dipastikan ada (dipanggil hanya setelah CONTRACTS_READY dicek). */
export function requireAddresses() {
  if (!CONTRACTS_READY) throw new Error("Alamat kontrak belum diatur.");
  return addresses as { factory: Address; usdt: Address; reservePool: Address; reputationBook: Address };
}
