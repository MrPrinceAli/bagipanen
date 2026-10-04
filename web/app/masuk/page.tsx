"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ArrowRight, Building2, Check, FlaskConical, HandCoins, KeyRound, Loader2, LogOut, ShieldCheck, Sprout, UserCog, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { LogoMark } from "@/components/Header";
import { Container } from "@/components/ui";
import { AccountPicker, useJudgeLogin } from "@/components/wallet";
import { JUDGE_ACCOUNTS, JUDGE_PROJECT } from "@/lib/demoJudge";
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
  const { connector } = useAccount();
  const judge = connector?.id === "judgeDemo";
  const { disconnect } = useDisconnect();
  const [left, setLeft] = useState(REDIRECT_S);
  const next = params.get("next");
  const isJudgePetani = Boolean(JUDGE_PROJECT && address && JUDGE_ACCOUNTS.find((a) => a.key === "petani")?.address.toLowerCase() === address.toLowerCase());
  const target =
    next && next.startsWith("/") && !next.startsWith("//")
      ? { href: next, label: "halaman sebelumnya" }
      : isJudgePetani
        ? { href: `/campaign/${JUDGE_PROJECT}`, label: "proyek demo" }
        : role
          ? HOME[role]
          : null;
  const targetHref = target?.href;

  useEffect(() => {
    if (!targetHref || loading || judge) return;
    if (left <= 0) {
      router.push(targetHref);
      return;
    }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left, targetHref, loading, judge, router]);

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
      <span className="relative grid size-16 place-items-center rounded-3xl bg-hutan-900 text-emas-300 shadow-lift">
        <Icon className="size-8" aria-hidden />
        <span className="absolute -right-1.5 -bottom-1.5 grid size-7 place-items-center rounded-full bg-hutan-500 text-white ring-4 ring-white">
          <Check className="size-4" aria-hidden />
        </span>
      </span>
      <p className="mt-4 text-sm text-stone-500">Selamat datang kembali</p>
      <h2 className="mt-1 font-display text-2xl font-semibold text-hutan-950">Kamu masuk sebagai {ROLE_LABEL[role]}</h2>
      <p className="mt-2 font-mono text-sm text-stone-500">{address ? shortAddress(address) : ""}</p>
      {target && (
        <>
          <Link
            href={target.href}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-hutan-900 px-5 py-3 font-semibold text-white transition hover:bg-hutan-800"
          >
            Buka {target.label} <ArrowRight className="size-4" aria-hidden />
          </Link>
          {!judge && (
            <>
              <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-krem-200" aria-hidden>
                <div className="h-full rounded-full bg-emas-400 transition-[width] duration-1000 ease-linear" style={{ width: `${((REDIRECT_S - left) / REDIRECT_S) * 100}%` }} />
              </div>
              <p className="mt-2 text-xs text-stone-500">Otomatis dibuka dalam {Math.max(0, left)} detik</p>
            </>
          )}
        </>
      )}
      {judge && (
        <div className="w-full text-left">
          <JudgePanel />
        </div>
      )}
      <button type="button" onClick={() => disconnect()} className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-red-700">
        <LogOut className="size-4" aria-hidden /> Ganti dompet / keluar
      </button>
    </div>
  );
}

/** Panel akun demo untuk juri: masuk sebagai peran apa pun tanpa dompet. */
function JudgePanel() {
  const login = useJudgeLogin();
  const { connector } = useAccount();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const icons: Record<string, LucideIcon> = { investor: HandCoins, petani: Sprout, koperasi: Building2, admin: UserCog };
  return (
    <div className="mt-5 rounded-2xl border-2 border-dashed border-emas-300 bg-emas-50/70 p-3.5">
      <div className="flex items-start gap-2">
        <FlaskConical className="mt-0.5 size-4 shrink-0 text-emas-700" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-hutan-950">{connector?.id === "judgeDemo" ? "Ganti peran akun demo" : "Coba tanpa dompet: akun demo untuk juri"}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-pretty text-stone-600">
            Khusus pengujian. Aslinya setiap orang masuk dengan dompet kripto miliknya sendiri. Akun demo memakai wallet testnet yang
            ditandatangani server, bukan uang sungguhan.
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {JUDGE_ACCOUNTS.map((a) => {
          const Icon = icons[a.key] ?? Wallet;
          return (
            <button
              key={a.key}
              type="button"
              disabled={busy !== null}
              onClick={async () => {
                setError("");
                setBusy(a.key);
                try {
                  await login(a.key);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Gagal masuk sebagai akun demo.");
                } finally {
                  setBusy(null);
                }
              }}
              title={a.does}
              className="group flex items-center gap-2 rounded-xl bg-white px-2.5 py-2 text-left ring-1 ring-krem-200 transition hover:ring-hutan-400 disabled:opacity-60"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-hutan-900 text-emas-300">
                {busy === a.key ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Icon className="size-4" aria-hidden />}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-hutan-950">
                  {a.label}
                  {a.readOnly && <span className="rounded bg-stone-100 px-1 text-[10px] font-medium text-stone-500">lihat saja</span>}
                </span>
                <span className="block truncate text-[10.5px] leading-snug text-stone-500">{a.does}</span>
              </span>
            </button>
          );
        })}
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

function SignIn() {
  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.18em] text-emas-600 uppercase">Masuk</p>
      <h1 className="mt-1.5 font-display text-2xl font-semibold text-hutan-950 sm:text-3xl">Selamat datang di BagiPanen</h1>
      <p className="mt-1.5 text-sm text-pretty text-stone-600">
        Tidak perlu email atau kata sandi. Dompetmu adalah akunmu, dan peranmu dikenali otomatis dari alamatnya.
      </p>

      <div className="mt-5">
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
                className="shine group flex w-full items-center gap-3.5 rounded-2xl bg-linear-to-r from-hutan-900 via-hutan-800 to-hutan-900 px-4 py-3 text-left text-white shadow-lift ring-1 ring-emas-300/30 transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-14px_rgb(230_176_67/0.55)] disabled:opacity-60"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emas-400 text-hutan-950 shadow-[0_0_0_0_rgb(237_197_106/0.6)] transition group-hover:shadow-[0_0_18px_2px_rgb(237_197_106/0.6)]">
                  <Wallet className="size-5" aria-hidden />
                </span>
                <span className="flex-1">
                  <span className="block font-semibold">Masuk dengan dompet</span>
                  <span className="block truncate text-sm text-white/65">MetaMask, WalletConnect, dll.</span>
                </span>
                <ArrowRight className="size-5 transition group-hover:translate-x-1" aria-hidden />
              </button>
            )}
          </ConnectButton.Custom>
        )}
        <p className="mt-2 flex items-start gap-2 text-[11px] leading-snug text-stone-500">
          <KeyRound className="mt-px size-3.5 shrink-0" aria-hidden />
          Tidak pernah meminta seed phrase. Masuk hanya membagikan alamat dompet, bukan izin memindahkan dana.
        </p>
      </div>

      {JUDGE_ACCOUNTS.length > 0 && <JudgePanel />}

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-krem-200 pt-3 text-xs sm:mt-5 sm:pt-4 sm:text-sm">
        <a href="https://metamask.io/download/" target="_blank" rel="noreferrer" className="font-semibold text-hutan-700 hover:text-hutan-900">
          Pasang MetaMask
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
    <div className="relative isolate flex min-h-[calc(100svh-7rem)] items-center overflow-hidden bg-hutan-950 text-white lg:min-h-[calc(100svh-4rem)]">
      {/* Latar sawah penuh satu layar */}
      <Image src={heroImage} alt="" fill priority sizes="100vw" placeholder="blur" className="-z-20 object-cover" />
      <div className="absolute inset-0 -z-10 bg-linear-to-r from-hutan-950/95 via-hutan-950/70 to-hutan-950/30" aria-hidden />
      <div className="absolute inset-0 -z-10 bg-linear-to-t from-hutan-950/80 via-transparent to-hutan-950/40" aria-hidden />
      <div className="glow-hutan absolute inset-0 -z-10" aria-hidden />

      <Container className="grid items-center gap-10 py-6 sm:py-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:gap-16">
        {/* Tagline (desktop) */}
        <div className="hidden lg:block">
          <div className="flex items-center gap-3">
            <LogoMark className="size-11" />
            <span className="font-display text-2xl font-semibold">BagiPanen</span>
          </div>
          <p className="mt-10 max-w-lg font-display text-4xl leading-tight font-semibold text-balance xl:text-5xl">
            Satu dompet, <span className="text-emas-300 italic">semua peran</span> dikenali kontrak.
          </p>
          <ul className="mt-7 flex flex-col gap-3 text-white/80">
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
          <p className="mt-10 text-xs text-white/45">{IS_LOCAL ? "Mode lokal · chain Anvil" : "BNB Smart Chain Testnet · token demo, bukan uang sungguhan"}</p>
        </div>

        {/* Kartu masuk melayang di atas sawah */}
        <div className="relative w-full rounded-[1.75rem] bg-white/95 p-4 text-stone-800 shadow-[0_40px_90px_-30px_rgb(0_0_0/0.7)] ring-1 ring-white/40 backdrop-blur-xl sm:p-6">
          <Suspense fallback={null}>
            <LoginCard />
          </Suspense>
        </div>
      </Container>
    </div>
  );
}
