"use client";

import { useQuery } from "@tanstack/react-query";
import { Coins } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAccount, usePublicClient, useSwitchChain } from "wagmi";
import { mockUSDTAbi } from "@/lib/abi/MockUSDT";
import { addresses, CONTRACTS_READY } from "@/lib/addresses";
import { useUsdtBalance } from "@/lib/campaigns";
import { FAUCET_AMOUNT, IS_LOCAL, REFRESH_MS, targetChain } from "@/lib/config";
import { formatUsdt } from "@/lib/format";
import { ROLE_LABEL, useRole } from "@/lib/role";
import { useTx } from "@/lib/tx";
import { Button, Container, cn, Spinner } from "./ui";
import { WalletButton } from "./wallet";

/** Logo BagiPanen: petani bercaping memikul dua keranjang hasil panen. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="20" fill="#e6b043" />
      <path d="M7 27 Q32 22.5 57 27" stroke="#0b1d15" strokeWidth="2.8" fill="none" strokeLinecap="round" />
      <path d="M10.5 27 L7.5 40 M14.5 27 L17.5 40 M49.5 27 L46.5 40 M53.5 27 L56.5 40" stroke="#0b1d15" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M5 40 H20 L17.8 50 H7.2 Z" fill="#0b1d15" />
      <path d="M44 40 H59 L56.8 50 H46.2 Z" fill="#0b1d15" />
      <path d="M23 17.5 L32 9 L41 17.5 C37 19.6 27 19.6 23 17.5 Z" fill="#0b1d15" />
      <circle cx="32" cy="21.6" r="3.4" fill="#0b1d15" />
      <path d="M27 26.5 H37 L35.4 42 H28.6 Z" fill="#0b1d15" />
      <path d="M29.6 42 L27.4 55.5 M34.4 42 L36.6 55.5" stroke="#0b1d15" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5 text-white", className)}>
      <LogoMark className="size-8" />
      <span className="font-display text-xl font-semibold tracking-tight">BagiPanen</span>
    </Link>
  );
}

export function Header() {
  const { role } = useRole();
  const pathname = usePathname();
  // Menu publik untuk semua orang + satu pintu ke ruang kerja sesuai peran dompet.
  const roleHome =
    role === "petani" || role === "investor"
      ? { href: "/dashboard", label: "Dashboard" }
      : role === "koperasi"
        ? { href: "/koperasi", label: "Koperasi" }
        : role === "admin"
          ? { href: "/admin", label: "Admin" }
          : null;
  const nav: { href: string; label: string; short?: string }[] = [
    { href: "/", label: "Beranda" },
    { href: "/proyek", label: "Proyek" },
    { href: "/petani", label: "Petani" },
    { href: "/transparansi", label: "Transparansi" },
    { href: "/agent", label: "Agen AI" },
    { href: "/faq", label: "FAQ" },
    ...(roleHome ? [roleHome] : []),
  ];

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
  const link = (n: (typeof nav)[number], compact = false) => (
    <Link
      key={n.href}
      href={n.href}
      className={cn(
        "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition",
        isActive(n.href) ? "bg-white/12 text-white" : "text-white/65 hover:bg-white/8 hover:text-white",
      )}
    >
      {compact && n.short ? n.short : n.label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-hutan-950/90 text-white backdrop-blur-xl">
      <Container className="flex h-16 items-center gap-3">
        <Logo />
        <nav className="ml-4 hidden items-center gap-0.5 xl:flex">{nav.map((n) => link(n))}</nav>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden sm:block">
            <FaucetButton />
          </div>
          {role && role !== "tamu" && (
            <span className="hidden rounded-full bg-emas-400/15 px-3 py-1 text-xs font-semibold text-emas-200 ring-1 ring-emas-300/30 md:inline xl:hidden 2xl:inline">
              {ROLE_LABEL[role]}
            </span>
          )}
          <WalletButton />
        </div>
      </Container>
      <div className="border-t border-white/5 xl:hidden">
        <Container className="flex items-center gap-2 py-2">
          <nav className="-mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto">{nav.map((n) => link(n, true))}</nav>
          <div className="sm:hidden">
            <FaucetButton compact />
          </div>
        </Container>
      </div>
      <NetworkBanner />
    </header>
  );
}

/** Tombol "minta mUSDT": mint 1.000 mUSDT demo ke dompet sendiri. */
function FaucetButton({ compact = false }: { compact?: boolean }) {
  const { address, isConnected } = useAccount();
  const { data: balance } = useUsdtBalance();
  const tx = useTx();
  if (!isConnected || !address || !addresses.usdt) return null;

  return (
    <div className="flex items-center gap-2">
      {!compact && balance !== undefined && (
        <span className="hidden text-xs text-white/60 2xl:inline">Saldo {formatUsdt(balance)} mUSDT</span>
      )}
      <Button
        size="sm"
        variant="light"
        loading={tx.busy}
        title={tx.state.status === "error" ? tx.state.message : "Isi 1.000 mUSDT (token demo) ke dompetmu"}
        onClick={() => tx.write({ address: addresses.usdt!, abi: mockUSDTAbi, functionName: "mint", args: [address, FAUCET_AMOUNT] })}
      >
        {!tx.busy && <Coins className="size-4 text-emas-300" aria-hidden />}
        {tx.state.status === "success" ? "+1.000 masuk" : compact ? "mUSDT" : "Minta mUSDT"}
      </Button>
    </div>
  );
}

/** Pita peringatan: jaringan dompet salah, atau chain/kontrak belum siap. */
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
      <span className="flex flex-wrap items-center justify-center gap-3">
        Dompetmu sedang terhubung ke jaringan lain.
        <Button size="sm" variant="primary" onClick={() => switchChain({ chainId: targetChain.id })} disabled={isPending}>
          {isPending && <Spinner />} Pindah ke {targetChain.name}
        </Button>
      </span>
    );
  } else if (health.isError) {
    message = IS_LOCAL ? (
      <>
        Chain lokal belum jalan. Jalankan <Code>npm run dev:chain</Code> di folder proyek.
      </>
    ) : (
      `Belum bisa terhubung ke ${targetChain.name}. Coba muat ulang halaman.`
    );
  } else if (health.data === "no-addresses") {
    message = (
      <>
        Alamat kontrak belum diatur. Deploy kontrak dulu, lalu jalankan <Code>npm run sync</Code>.
      </>
    );
  } else if (health.data === "no-contracts") {
    message = IS_LOCAL ? (
      <>
        Kontrak belum ada di chain lokal. Jalankan ulang <Code>npm run dev:chain</Code>.
      </>
    ) : (
      "Kontraknya tidak ditemukan di jaringan ini. Cek lagi alamat kontrak."
    );
  }
  if (!message) return null;
  return <div className="bg-emas-300 px-4 py-2 text-center text-sm font-medium text-hutan-950">{message}</div>;
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded-md bg-hutan-950/10 px-1.5 py-0.5 font-mono text-[0.85em]">{children}</code>;
}
