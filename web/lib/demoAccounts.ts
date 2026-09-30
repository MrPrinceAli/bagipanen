import type { Address } from "viem";
import { localDeployment } from "./addresses";
import { IS_LOCAL } from "./config";

/** Akun demo di pemilih header (mode lokal). Urutan & indeks dari deployments/anvil.json. */
const ROLES = [
  { key: "admin", label: "Admin", hint: "Tim BagiPanen" },
  { key: "koperasi", label: "Koperasi", hint: "Koperasi Tani Makmur" },
  { key: "petani", label: "Petani", hint: "Pak Darto" },
  { key: "rina", label: "Rina", hint: "Investor" },
  { key: "budi", label: "Budi", hint: "Investor" },
  { key: "sari", label: "Sari", hint: "Investor" },
] as const;

export type DemoAccount = { key: string; label: string; hint: string; address: Address };

export const DEMO_ACCOUNTS: DemoAccount[] = !IS_LOCAL
  ? []
  : ROLES.flatMap((r) => {
  const acc = localDeployment?.accounts?.[r.key];
  return acc ? [{ ...r, address: acc.address }] : [];
});

/** Nama tampilan untuk alamat akun demo (mis. di riwayat transaksi). */
const NAMES: Record<string, string> = {};
for (const [key, acc] of Object.entries(localDeployment?.accounts ?? {})) {
  const role = ROLES.find((r) => r.key === key);
  NAMES[acc.address.toLowerCase()] = role ? role.label : key === "agen" ? "Agen AI" : key;
}

export function demoName(address: string | undefined): string | undefined {
  return IS_LOCAL && address ? NAMES[address.toLowerCase()] : undefined;
}
