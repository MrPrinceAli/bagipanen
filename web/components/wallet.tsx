"use client";

import { tr } from "@/lib/i18n";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ChevronDown, Lock, Wallet } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Address } from "viem";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { rememberDemoAccount } from "@/lib/anvilConnector";
import { JUDGE_ACCOUNTS, type JudgeAccount } from "@/lib/demoJudge";
import { rememberJudgeAccount } from "@/lib/judgeConnector";
import { IS_LOCAL } from "@/lib/config";
import { DEMO_ACCOUNTS } from "@/lib/demoAccounts";
import type { Role } from "@/lib/role";
import { Badge, Button, Card, cn, IconBubble } from "./ui";

/** Pemilih akun demo Anvil (hanya mode lokal). */
export function AccountPicker({ dark = false, className }: { dark?: boolean; className?: string }) {
  const { address, isConnected } = useAccount();
  const { connectors, connectAsync } = useConnect();
  const { disconnect } = useDisconnect();
  const demo = connectors.find((c) => c.id === "anvilDemo");

  async function onChange(value: string) {
    if (!demo) return;
    if (value === "") return disconnect();
    const next = value as Address;
    if (!isConnected) {
      rememberDemoAccount(next);
      await connectAsync({ connector: demo });
    } else {
      (demo as unknown as { selectAccount(a: Address): void }).selectAccount(next);
    }
  }

  if (DEMO_ACCOUNTS.length === 0) return <Badge tone="red">{tr("Akun demo belum ada", "No demo accounts yet")}</Badge>;
  return (
    <div className={cn("relative", className)}>
      <select
        aria-label={tr("Pilih akun demo", "Choose a demo account")}
        className={cn(
          "h-9 w-full max-w-52 cursor-pointer appearance-none rounded-full border pr-8 pl-4 text-sm font-semibold transition focus:ring-2 focus:ring-emas-400 focus:outline-none",
          dark ? "border-white/15 bg-white/10 text-white hover:bg-white/15" : "border-krem-300 bg-white text-hutan-900 hover:border-hutan-300",
        )}
        value={isConnected && address ? address : ""}
        onChange={(e) => void onChange(e.target.value)}
      >
        <option value="" className="text-stone-900">
          {tr("Pilih akun demo", "Choose a demo account")}
        </option>
        {DEMO_ACCOUNTS.map((a) => (
          <option key={a.address} value={a.address} className="text-stone-900">
            {a.label} · {a.hint}
          </option>
        ))}
      </select>
      <ChevronDown className={cn("pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2", dark ? "text-white/70" : "text-stone-500")} aria-hidden />
    </div>
  );
}

/** Tombol dompet di header: akun demo (lokal) atau MetaMask lewat RainbowKit (testnet). */
export function WalletButton() {
  if (IS_LOCAL) return <AccountPicker dark />;
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, mounted }) => {
        if (!mounted) return <div className="h-9 w-36" aria-hidden />;
        if (!account || !chain)
          return (
            <Link
              href="/masuk"
              className="inline-flex h-9 items-center gap-2 rounded-full bg-emas-400 px-4 text-sm font-semibold text-hutan-950 shadow-soft transition hover:bg-emas-300"
            >
              <Wallet className="size-4" aria-hidden /> Login
            </Link>
          );
        if (chain.unsupported)
          return (
            <Button size="sm" variant="danger" onClick={openChainModal}>
              {tr("Ganti jaringan", "Switch network")}
            </Button>
          );
        return (
          <button
            type="button"
            onClick={openAccountModal}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-white/15 bg-white/10 pr-3 pl-1.5 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            <span className="size-6 rounded-full bg-linear-to-br from-emas-300 to-hutan-500" aria-hidden />
            {account.displayName}
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}

/** Ajakan menghubungkan dompet di dalam halaman. */
export function ConnectPrompt() {
  if (IS_LOCAL) return <AccountPicker />;
  return (
    <ConnectButton.Custom>
      {({ openConnectModal, mounted }) => (
        <Button variant="primary" onClick={openConnectModal} disabled={!mounted}>
          <Wallet className="size-4" aria-hidden /> {tr("Hubungkan dompet", "Connect wallet")}
        </Button>
      )}
    </ConnectButton.Custom>
  );
}

type Need = "admin" | "koperasi" | "petani" | "dashboard";

function needText(need: Need): { title: string; guest: string; wrong: string } {
  switch (need) {
    case "admin":
      return {
        title: tr("Halaman khusus admin", "Admin only"),
        guest: IS_LOCAL
          ? tr("Pilih akun Admin di atas untuk membukanya.", "Pick the Admin account above to open it.")
          : tr("Hubungkan dompet admin untuk membukanya.", "Connect the admin wallet to open it."),
        wrong: tr("Dompet yang terhubung sekarang bukan dompet admin.", "The connected wallet isn't the admin wallet."),
      };
    case "koperasi":
      return {
        title: tr("Halaman khusus koperasi", "Cooperatives only"),
        guest: IS_LOCAL
          ? tr("Pilih akun Koperasi di atas untuk membukanya.", "Pick the Cooperative account above to open it.")
          : tr("Hubungkan dompet koperasi yang sudah terdaftar.", "Connect a registered cooperative wallet."),
        wrong: tr(
          "Dompet ini belum terdaftar sebagai koperasi. Minta admin mendaftarkannya dulu.",
          "This wallet isn't registered as a cooperative yet. Ask the admin to register it first.",
        ),
      };
    case "petani":
      return {
        title: tr("Khusus petani anggota koperasi", "For cooperative member farmers"),
        guest: IS_LOCAL
          ? tr("Pilih akun Petani di atas untuk mengajukan proyek tanam.", "Pick the Farmer account above to propose a crop project.")
          : tr("Hubungkan dompet petani yang sudah didaftarkan koperasi.", "Connect a farmer wallet registered by a cooperative."),
        wrong: tr(
          "Dompet ini belum terdaftar sebagai petani. Koperasimu yang bisa mendaftarkannya.",
          "This wallet isn't registered as a farmer yet. Your cooperative can register it.",
        ),
      };
    default:
      return {
        title: tr("Masuk dulu, yuk", "Sign in first"),
        guest: IS_LOCAL
          ? tr("Pilih akun demo di atas untuk melihat dashboard-mu.", "Pick a demo account above to see your dashboard.")
          : tr("Hubungkan dompetmu untuk melihat porsi dan proyekmu.", "Connect your wallet to see your shares and projects."),
        wrong: tr("Dashboard ini untuk petani dan investor.", "This dashboard is for farmers and investors."),
      };
  }
}

/** Kartu yang muncul saat peran dompet belum sesuai dengan halaman. */
export function RoleGate({ need, role, children }: { need: Need; role: Role | undefined; children?: ReactNode }) {
  const t = needText(need);
  const guest = role === "tamu";
  return (
    <Card className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 py-10 text-center">
      <IconBubble icon={Lock} tone="gold" className="size-12" />
      <div>
        <h2 className="font-display text-2xl font-semibold text-hutan-950">{t.title}</h2>
        <p className="mt-1.5 text-stone-600">{guest ? t.guest : t.wrong}</p>
      </div>
      {guest && <ConnectPrompt />}
      {children}
    </Card>
  );
}

/* ------------------------------------------------------------- Mode demo juri */

/** Masuk / ganti peran sebagai akun demo juri (testnet). */
export function useJudgeLogin() {
  const { connector, isConnected } = useAccount();
  const { connectors, connectAsync } = useConnect();
  const { disconnectAsync } = useDisconnect();
  return async (key: JudgeAccount["key"]) => {
    const judge = connectors.find((c) => c.id === "judgeDemo");
    if (!judge) return;
    if (isConnected && connector?.id === "judgeDemo") {
      (judge as unknown as { selectRole(k: string): void }).selectRole(key);
      return;
    }
    if (isConnected) await disconnectAsync();
    rememberJudgeAccount(key);
    await connectAsync({ connector: judge });
  };
}

/** Pita di bawah header selama memakai akun demo juri. */
export function JudgeBanner() {
  const { connector, address } = useAccount();
  const { disconnect } = useDisconnect();
  if (connector?.id !== "judgeDemo" || !address) return null;
  const acc = JUDGE_ACCOUNTS.find((a) => a.address.toLowerCase() === address.toLowerCase());
  return (
    <div className="border-t border-emas-300/20 bg-emas-400 text-hutan-950">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5 text-xs sm:px-6 lg:px-8 2xl:max-w-[88rem]">
        <span className="rounded-full bg-hutan-950 px-2 py-0.5 font-bold tracking-wide text-emas-300 uppercase">{tr("Mode demo juri", "Judge demo mode")}</span>
        <span>
          {tr("Masuk sebagai", "Signed in as")} <strong>{acc?.who ?? tr("akun demo", "demo account")}</strong>
          {acc?.readOnly ? tr(" · lihat saja", " · view only") : tr(" · transaksi ditandatangani server, bukan dompetmu", " · transactions are signed by the server, not your wallet")}
        </span>
        <span className="ml-auto flex gap-3 font-semibold">
          <Link href="/masuk" className="underline-offset-2 hover:underline">
            {tr("Ganti peran", "Switch role")}
          </Link>
          <button type="button" onClick={() => disconnect()} className="underline-offset-2 hover:underline">
            {tr("Keluar", "Sign out")}
          </button>
        </span>
      </div>
    </div>
  );
}
