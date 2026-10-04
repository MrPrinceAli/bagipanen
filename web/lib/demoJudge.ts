import type { Address } from "viem";
import { IS_LOCAL } from "./config";

/**
 * Mode demo juri (testnet): akun demo yang bisa dipakai tanpa MetaMask. Kuncinya hanya ada di
 * server (DEMO_MNEMONIC); transaksi ditandatangani lewat /api/demo-tx. Admin = lihat saja.
 * Alamat publik di bawah boleh diketahui siapa pun (hasil `npm run seed:demo`).
 */
export type DemoRole = "koperasi" | "petani" | "investor";
export const DEMO_ROLE_INDEX: Record<DemoRole, number> = { koperasi: 0, petani: 1, investor: 2 };

export type JudgeAccount = { key: DemoRole | "admin"; label: string; who: string; address: Address; readOnly: boolean; does: string };

export const ADMIN_ADDRESS: Address = "0x871af3D3767e91939FA5c18235370A00612c8f70";

export const JUDGE_ACCOUNTS: JudgeAccount[] = IS_LOCAL
  ? []
  : [
      {
        key: "investor",
        label: "Investor",
        who: "Investor Demo",
        address: "0x13F1c1a348FA479EDF12C9c92B7A85Efa57f98b8",
        readOnly: false,
        does: "Danai proyek, lihat porsi & klaim",
      },
      {
        key: "petani",
        label: "Petani",
        who: "Pak Juri (petani demo)",
        address: "0xb7A91e07aE60Ef0DE8B71FA7d2601F8BEC00F323",
        readOnly: false,
        does: "Kirim foto lahan, lihat agen AI menilai",
      },
      {
        key: "koperasi",
        label: "Koperasi",
        who: "Koperasi Demo Juri",
        address: "0x5D1888F23A2F138858Ca0EfEB67c2cA5805D0347",
        readOnly: false,
        does: "Konfirmasi tahap, cairkan dana, nilai agen",
      },
      {
        key: "admin",
        label: "Admin",
        who: "Admin BagiPanen",
        address: ADMIN_ADDRESS,
        readOnly: true,
        does: "Lihat panel admin (tanpa transaksi)",
      },
    ];

/** Proyek demo yang disiapkan untuk juri (agent/data/demo-judges.json). */
export const JUDGE_PROJECT: Address | undefined = IS_LOCAL ? undefined : "0x875Af5435E084F906E1f05b9b8f27Ca2C032FAEe";
