"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ArrowRight, Building2, Check, HandCoins, KeyRound, Loader2, LogOut, ShieldCheck, Sprout, UserCog, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useDisconnect } from "wagmi";
import { LogoMark } from "@/components/Header";
import { cn } from "@/components/ui";
import { AccountPicker } from "@/components/wallet";
import { IS_LOCAL } from "@/lib/config";
import { shortAddress } from "@/lib/format";
import { ROLE_LABEL, type Role, useRole } from "@/lib/role";
import heroImage from "@/public/hero-lahan.jpg";

const ROLES: { role: Role; icon: LucideIcon; desc: string }[] = [
  { role: "investor", icon: HandCoins, desc: "Dompet apa pun. Danai proyek, pantau porsi, klaim bagi hasil." },
  { role: "petani", icon: Sprout, desc: "Didaftarkan koperasi. Ajukan proyek, kirim foto lahan, setor panen." },
  { role: "koperasi", icon: Building2, desc: "Didaftarkan admin. Daftarkan petani, cek lahan, nilai agen AI." },
  { role: "admin", icon: UserCog, desc: "Pemilik kontrak. Setujui proyek, putuskan sengketa." },
];

/** Ruang kerja tujuan setelah masuk, sesuai peran. */
const HOME: Record<Role, { href: string; label: string }> = {
  tamu: { href: "/", label: "Beranda" },
  investor: { href: "/dashboard", label: "Dashboard investor" },
  petani: { href: "/dashboard", label: "Dashboard petani" },
  koperasi: { href: "/koperasi", label: "Ruang kerja koperasi" },
  admin: { href: "/admin", label: "Panel admin" },
  agen: { href: "/agent", label: "Profil agen" },
};

const REDIRECT_S = 4;

function SignedIn() {
  const router = useRouter();
  const params = useSearchParams();
  const { address, role, loading } = useRole();
  const { disconnect } = useDisconnect();
  const [left, setLeft] = useState(REDIRECT_S);
  const next = params.get("next");
  const target = next && next.startsWith("/") && !next.startsWith("//") ? { href: next, label: "halaman sebelumnya" } : role ? HOME[role] : null;
  const targetHref = target?.href;

  useEffect(() => {
    if (!targetHref || loading) return;
    if (left <= 0) {
      router.push(targetHref);
      return;
    }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left, targetHref, loading, router]);

  if (loading || !role)
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Loader2 className="size-8 animate-spin text-hutan-600" aria-hidden />
        <p className="text-sm text-stone-600">Mengenali peran dompetmu di blockchain…</p>
      </div>
    );

  const Icon = ROLES.find((r) => r.role === role)?.icon ?? ShieldCheck;
  return (
    <div className="flex flex-col items-center text-center">
      <span className="relative grid size-20 place-items-center rounded-3xl bg-hutan-900 text-emas-300 shadow-lift">
        <Icon className="size-9" aria-hidden />
        <span className="absolute -right-1.5 -bottom-1.5 grid size-7 place-items-center rounded-full bg-hutan-500 text-white ring-4 ring-white">
          <Check className="size-4" aria-hidden />
        </span>
      </span>
      <p className="mt-5 text-sm text-stone-500">Selamat datang kembali</p>
      <h2 className="mt-1 font-display text-3xl font-semibold text-hutan-950">Kamu masuk sebagai {ROLE_LABEL[role]}</h2>
      <p className="mt-2 font-mono text-sm text-stone-500">{address ? shortAddress(address) : ""}</p>
      {target && (
        <>
          <Link
            href={target.href}
            className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-hutan-900 px-5 py-3.5 font-semibold text-white transition hover:bg-hutan-800"
          >
            Buka {target.label} <ArrowRight className="size-4" aria-hidden />
          </Link>
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-krem-200" aria-hidden>
            <div className="h-full rounded-full bg-emas-400 transition-[width] duration-1000 ease-linear" style={{ width: `${((REDIRECT_S - left) / REDIRECT_S) * 100}%` }} />
          </div>
          <p className="mt-2 text-xs text-stone-500">Otomatis dibuka dalam {Math.max(0, left)} detik</p>
        </>
      )}
      <button type="button" onClick={() => disconnect()} className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-red-700">
        <LogOut className="size-4" aria-hidden /> Ganti dompet / keluar
      </button>
    </div>
  );
}

function SignIn() {
  return (
    <div>
      <p className="text-sm font-semibold tracking-[0.18em] text-emas-600 uppercase">Masuk</p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-hutan-950 sm:text-4xl">Selamat datang di BagiPanen</h1>
      <p className="mt-2 text-pretty text-stone-600">
        Tidak perlu email atau kata sandi. Dompetmu adalah akunmu, dan peranmu dikenali otomatis dari alamatnya.
      </p>

      <div className="mt-7">
        {IS_LOCAL ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-hutan-950">Mode lokal: pilih akun demo</p>
            <AccountPicker className="[&_select]:h-12 [&_select]:max-w-none" />
          </div>
        ) : (
          <ConnectButton.Custom>
            {({ openConnectModal, mounted }) => (
              <button
                type="button"
                onClick={openConnectModal}
                disabled={!mounted}
                className="group flex w-full items-center gap-4 rounded-2xl bg-hutan-900 px-5 py-4 text-left text-white shadow-lift transition hover:bg-hutan-800 disabled:opacity-60"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emas-400 text-hutan-950">
                  <Wallet className="size-5" aria-hidden />
                </span>
                <span className="flex-1">
                  <span className="block font-semibold">Masuk dengan dompet</span>
                  <span className="block text-sm text-white/65">MetaMask, WalletConnect, dan lainnya</span>
                </span>
                <ArrowRight className="size-5 transition group-hover:translate-x-1" aria-hidden />
              </button>
            )}
          </ConnectButton.Custom>
        )}
        <p className="mt-3 flex items-start gap-2 text-xs text-stone-500">
          <KeyRound className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          BagiPanen tidak pernah meminta kunci rahasia (seed phrase). Masuk hanya membagikan alamat dompet, bukan izin memindahkan dana.
        </p>
      </div>

      <div className="mt-8">
        <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">Peran dikenali otomatis</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {ROLES.map(({ role, icon: Icon, desc }) => (
            <li key={role} className="flex gap-3 rounded-2xl bg-krem-50 p-3 ring-1 ring-krem-200">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-hutan-700 ring-1 ring-krem-200">
                <Icon className="size-4" aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-semibold text-hutan-950">{ROLE_LABEL[role]}</span>
                <span className="block text-xs leading-snug text-stone-500">{desc}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-krem-200 pt-5 text-sm">
        <a href="https://metamask.io/download/" target="_blank" rel="noreferrer" className="font-semibold text-hutan-700 hover:text-hutan-900">
          Belum punya dompet? Pasang MetaMask
        </a>
        <Link href="/coba" className="inline-flex items-center gap-1 text-stone-500 hover:text-hutan-800">
          Panduan demo <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

function LoginCard() {
  const { isConnected } = useRole();
  return isConnected ? <SignedIn /> : <SignIn />;
}

export default function LoginPage() {
  return (
    <div className="relative min-h-[calc(100svh-4rem)] bg-krem-50 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* Panel visual */}
      <aside className="relative hidden overflow-hidden bg-hutan-950 text-white lg:block">
        <Image src={heroImage} alt="" fill sizes="50vw" placeholder="blur" className="object-cover opacity-40" />
        <div className="absolute inset-0 bg-linear-to-t from-hutan-950 via-hutan-950/60 to-hutan-950/30" aria-hidden />
        <div className="glow-hutan absolute inset-0" aria-hidden />
        <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
          <div className="flex items-center gap-3">
            <LogoMark className="size-11" />
            <span className="font-display text-2xl font-semibold">BagiPanen</span>
          </div>
          <div>
            <p className="max-w-md font-display text-4xl leading-tight font-semibold text-balance xl:text-5xl">
              Satu dompet, <span className="text-emas-300 italic">semua peran</span> dikenali kontrak.
            </p>
            <ul className="mt-8 flex flex-col gap-3 text-white/80">
              {[
                "Tanpa email & kata sandi, tanpa server yang menyimpan data akunmu",
                "Dana tetap di kontrak, bukan di dompet BagiPanen",
                "Peran petani, koperasi, admin, dan investor dibaca langsung dari BNB Chain",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-emas-400 text-hutan-950">
                    <Check className="size-3.5" aria-hidden />
                  </span>
                  <span className="text-pretty">{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-white/45">{IS_LOCAL ? "Mode lokal · chain Anvil" : "BNB Smart Chain Testnet · token demo, bukan uang sungguhan"}</p>
        </div>
      </aside>

      {/* Kartu masuk */}
      <main className="relative flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgb(19_46_34/0.07)_1px,transparent_1.4px)] bg-[size:22px_22px] lg:hidden" aria-hidden />
        <div className={cn("relative w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-lift ring-1 ring-krem-200 sm:p-9")}>
          <Suspense fallback={null}>
            <LoginCard />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
