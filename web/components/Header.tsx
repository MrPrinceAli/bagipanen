"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { useAccount, useConnect, useDisconnect, usePublicClient, useSwitchChain } from "wagmi";
import { mockUSDTAbi } from "@/lib/abi/MockUSDT";
import { addresses, CONTRACTS_READY } from "@/lib/addresses";
import { rememberDemoAccount } from "@/lib/anvilConnector";
import { useUsdtBalance } from "@/lib/campaigns";
import { FAUCET_AMOUNT, IS_LOCAL, REFRESH_MS, targetChain } from "@/lib/config";
import { DEMO_ACCOUNTS } from "@/lib/demoAccounts";
import { formatUsdt } from "@/lib/format";
import { ROLE_LABEL, type Role, useRole } from "@/lib/role";
import { useTx } from "@/lib/tx";
import { TxStatus } from "./common";
import { Badge, Button, cn, Select, type Tone } from "./ui";

const ROLE_TONE: Record<Role, Tone> = {
  tamu: "neutral",
  admin: "red",
  koperasi: "blue",
  petani: "brown",
  agen: "yellow",
  investor: "green",
};

export function Header() {
  const { role, address } = useRole();
  const pathname = usePathname();
  const nav = [
    { href: "/", label: "Beranda", show: true },
    { href: "/create", label: "Ajukan kampanye", show: role === "petani" },
    { href: "/dashboard", label: "Dashboard", show: role === "petani" || role === "investor" },
    { href: `/petani/${address}`, label: "Rapor saya", show: role === "petani" && Boolean(address) },
    { href: "/koperasi", label: "Koperasi", show: role === "koperasi" },
    { href: "/admin", label: "Admin", show: role === "admin" },
    { href: "/agent", label: "Agen AI", show: true },
  ].filter((n) => n.show);

  return (
    <header className="sticky top-0 z-20 border-b border-tanah-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-extrabold text-daun-800">
          <span aria-hidden>🌾</span> BagiPanen
        </Link>
        <div className="flex items-center gap-2">
          {role && role !== "tamu" && <Badge tone={ROLE_TONE[role]}>{ROLE_LABEL[role]}</Badge>}
          {IS_LOCAL ? <AccountPicker /> : <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />}
        </div>
      </div>
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 pb-2">
        <nav className="-mx-1 flex gap-1 overflow-x-auto">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-medium",
                pathname === n.href ? "bg-daun-100 text-daun-900" : "text-stone-600 hover:bg-tanah-100",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <FaucetButton />
      </div>
      <NetworkBanner />
    </header>
  );
}

/** Pemilih akun demo Anvil (hanya mode lokal). */
function AccountPicker() {
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

  if (DEMO_ACCOUNTS.length === 0) return <Badge tone="red">Akun demo tidak ada</Badge>;
  return (
    <Select
      aria-label="Pilih akun demo"
      className="w-auto max-w-48 py-1.5"
      value={isConnected && address ? address : ""}
      onChange={(e) => void onChange(e.target.value)}
    >
      <option value="">Pilih akun demo…</option>
      {DEMO_ACCOUNTS.map((a) => (
        <option key={a.address} value={a.address}>
          {a.label} · {a.hint}
        </option>
      ))}
    </Select>
  );
}

/** Tombol "Minta mUSDT demo": mint 1.000 mUSDT ke wallet sendiri. */
function FaucetButton() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useUsdtBalance();
  const tx = useTx();
  if (!isConnected || !address || !addresses.usdt) return null;

  return (
    <div className="flex shrink-0 flex-col items-end">
      <div className="flex items-center gap-2">
        {balance !== undefined && <span className="hidden text-xs text-stone-500 sm:inline">{formatUsdt(balance)} mUSDT</span>}
        <Button
          size="sm"
          variant="secondary"
          loading={tx.busy}
          onClick={() =>
            tx.write({ address: addresses.usdt!, abi: mockUSDTAbi, functionName: "mint", args: [address, FAUCET_AMOUNT] })
          }
        >
          Minta mUSDT demo
        </Button>
      </div>
      {tx.state.status === "error" && <TxStatus state={tx.state} />}
      {tx.state.status === "success" && <span className="text-xs text-daun-700">+1.000 mUSDT ✓</span>}
    </div>
  );
}

/** Banner jaringan salah (testnet) atau chain lokal belum siap. */
function NetworkBanner() {
  const { chainId, isConnected } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  const client = usePublicClient();
  const health = useQuery({
    queryKey: ["chainHealth"],
    enabled: Boolean(client),
    refetchInterval: REFRESH_MS,
    retry: false,
    queryFn: async () => {
      if (!CONTRACTS_READY) return "no-addresses" as const;
      const code = await client!.getCode({ address: addresses.factory! });
      return code && code !== "0x" ? ("ok" as const) : ("no-contracts" as const);
    },
  });

  let message: ReactNode = null;
  if (!IS_LOCAL && isConnected && chainId !== targetChain.id) {
    message = (
      <span className="flex flex-wrap items-center gap-2">
        Wallet Anda tidak terhubung ke {targetChain.name}.
        <Button size="sm" loading={isPending} onClick={() => switchChain({ chainId: targetChain.id })}>
          Ganti ke {targetChain.name}
        </Button>
      </span>
    );
  } else if (health.isError) {
    message = IS_LOCAL
      ? "Tidak terhubung ke chain lokal. Jalankan `npm run dev:chain` di root repo."
      : `Tidak bisa terhubung ke ${targetChain.name}. Coba muat ulang halaman.`;
  } else if (health.data === "no-addresses") {
    message = "Alamat kontrak belum diatur. Jalankan deploy lalu `npm run sync`.";
  } else if (health.data === "no-contracts") {
    message = IS_LOCAL
      ? "Kontrak belum ada di chain lokal. Jalankan ulang `npm run dev:chain`."
      : "Kontrak tidak ditemukan di jaringan ini. Periksa alamat kontrak.";
  }
  if (!message) return null;
  return <div className="border-t border-padi-500/40 bg-padi-100 px-4 py-2 text-center text-sm text-padi-700">{message}</div>;
}
