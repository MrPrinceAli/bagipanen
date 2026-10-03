"use client";

import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  Blocks,
  Bot,
  Boxes,
  ChevronLeft,
  ChevronRight,
  CloudSun,
  Coins,
  HandCoins,
  Landmark,
  MapPin,
  Scale,
  ScanEye,
  ShieldCheck,
  Sprout,
  Users,
  Wheat,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CampaignCard, CampaignCover, fundedPercent } from "@/components/CampaignCard";
import { StepBadge, StepVisual } from "@/components/HowItWorksVisuals";
import { StatusBadge } from "@/components/common";
import { Reveal, useActiveIndex, useReducedMotion, useScrollProgress } from "@/components/scroll";
import { ButtonLink, Card, Container, cn, EmptyState, Notice, ProgressBar, SectionTitle, Skeleton, Stat } from "@/components/ui";
import { useCampaignList, useIpfsJson, useReserveBalance } from "@/lib/campaigns";
import { HIDDEN_FROM_HOME, IS_LOCAL } from "@/lib/config";
import { formatPercent, formatRupiah, formatUsdt, projectedInvestorReturn } from "@/lib/format";
import { identityIsMock, useAgentProfile, useRegistrations } from "@/lib/registry";
import { useRole } from "@/lib/role";
import { type CampaignMetadata, type CampaignSummary, FailType, Status } from "@/lib/types";
import heroImage from "@/public/hero-lahan.jpg";

/** Teknologi utama di hero; di mode lokal adapter AI & penyimpanan memakai mock. */
const TECH_STACK = [
  { icon: Wheat, label: "Real World Asset" },
  { icon: Blocks, label: IS_LOCAL ? "Anvil (local)" : "BSC Testnet" },
  { icon: BadgeCheck, label: "ERC-8004 Identity + Reputation" },
  { icon: ScanEye, label: IS_LOCAL ? "AI Vision (mock)" : "Gemini Vision" },
  { icon: CloudSun, label: "Open-Meteo" },
  { icon: Boxes, label: IS_LOCAL ? "Local storage" : "IPFS · Pinata" },
  { icon: Coins, label: "Stablecoin" },
];

const FILTERS = [
  { key: "all", label: "Semua" },
  { key: "funding", label: "Cari dana" },
  { key: "active", label: "Berjalan" },
  { key: "done", label: "Selesai" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

function matches(c: CampaignSummary, f: FilterKey) {
  if (f === "funding") return c.status === Status.Funding;
  if (f === "active") return c.status === Status.Active;
  if (f === "done") return c.status !== Status.Funding && c.status !== Status.Active;
  return true;
}

export default function HomePage() {
  const { data: campaigns, isLoading, isError } = useCampaignList();
  const { data: reserve } = useReserveBalance();
  const { data: regs } = useRegistrations();
  const { role } = useRole();
  const [filter, setFilter] = useState<FilterKey>("all");

  const all = (campaigns ?? []).filter((c) => !HIDDEN_FROM_HOME.has(c.address.toLowerCase()));
  const funded = all.filter(
    (c) =>
      c.status === Status.Active ||
      c.status === Status.Harvested ||
      c.status === Status.Defaulted ||
      (c.status === Status.Failed && c.failType === FailType.Crop),
  );
  const totalFunded = funded.reduce((sum, c) => sum + c.raisedAmount, 0n);
  const visible = all.filter((c) => c.status !== Status.Draft && c.status !== Status.Cancelled);
  const activeCount = all.filter((c) => c.status === Status.Funding || c.status === Status.Active).length;
  const drafts = all.filter((c) => c.status === Status.Draft);
  const shown = visible.filter((c) => matches(c, filter));
  // Slide hero: cari dana dulu, lalu berjalan, lalu yang sudah selesai.
  const featured = [Status.Funding, Status.Active].flatMap((st) => visible.filter((c) => c.status === st));
  featured.push(...visible.filter((c) => !featured.includes(c)));

  return (
    <>
      {/* ------------------------------------------------------------ Hero */}
      <section className="relative isolate flex min-h-[calc(100svh-7rem)] flex-col overflow-hidden bg-hutan-950 text-white lg:min-h-[calc(100svh-4rem)]">
        <div className="hero-zoom absolute inset-0 -z-20">
          <Image
            src={heroImage}
            alt=""
            fill
            sizes="100vw"
            placeholder="blur"
            loading="eager"
            fetchPriority="high"
            className="object-cover object-center opacity-45"
          />
        </div>
        <div className="absolute inset-0 -z-10 bg-linear-to-b from-hutan-950/70 via-hutan-950/60 to-hutan-950" aria-hidden />
        <div className="glow-hutan absolute inset-0 -z-10" aria-hidden />

        <Container className="hero-exit flex flex-1 items-center py-12 sm:py-16">
          <div className="grid w-full grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <div className="animate-fade-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emas-300 opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-emas-300" />
                </span>
                {IS_LOCAL ? "Mode demo lokal" : "Sudah berjalan di BNB Smart Chain Testnet"}
              </span>
              <h1 className="mt-6 font-display text-[2.15rem] leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl xl:text-[3.4rem]">
                Tanpa ijon, tanpa tengkulak.{" "}
                <span className="box-decoration-clone bg-linear-to-r from-emas-200 via-emas-300 to-emas-500 bg-clip-text pe-[0.12em] text-transparent italic">
                  Hasil panen dibagi smart&nbsp;contract.
                </span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-pretty text-white/75">
                Pendanaan modal tanam berbasis RWA di BNB&nbsp;Chain. Investor mendanai petani sejak awal musim tanam dan mendapat
                bagian hasil panen saat proyek berhasil. Agen AI beridentitas ERC-8004 bersama koperasi memverifikasi setiap tahap,
                sehingga penggunaan modal sampai pembagian hasil tercatat transparan.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/#proyek" variant="gold" size="lg">
                  Lihat proyek tanam <ArrowRight className="size-4" aria-hidden />
                </ButtonLink>
                {role === "petani" ? (
                  <ButtonLink href="/create" variant="light" size="lg">
                    Ajukan proyek tanam
                  </ButtonLink>
                ) : (
                  <ButtonLink href="/#cara-kerja" variant="light" size="lg">
                    Begini cara kerjanya
                  </ButtonLink>
                )}
              </div>
              <ul aria-label="Teknologi yang dipakai" className="mt-8 flex flex-wrap gap-2">
                {TECH_STACK.map(({ icon: Icon, label }) => (
                  <li
                    key={label}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur sm:text-sm"
                  >
                    <Icon className="size-3.5 text-emas-300 sm:size-4" aria-hidden /> {label}
                  </li>
                ))}
              </ul>
            </div>

            <div className="min-w-0 animate-fade-up [animation-delay:150ms]">
              {featured.length > 0 ? <FeaturedCarousel items={featured.slice(0, 6)} /> : <Skeleton className="h-96 bg-white/10" />}
            </div>
          </div>
        </Container>

        <a
          href="#kenapa"
          className="mx-auto mb-6 hidden flex-col items-center gap-1.5 text-xs font-medium tracking-wide text-white/55 transition hover:text-white sm:flex"
        >
          Gulir untuk lanjut
          <ArrowDown className="scroll-cue size-4" aria-hidden />
        </a>
      </section>

      {/* ------------------------------------------------- Kenapa (gulir) */}
      <ProblemStatement />

      {/* ------------------------------------------------------- Angka */}
      <section className="bg-hutan-950 pb-16 text-white sm:pb-20">
        <Container className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            {
              icon: HandCoins,
              label: "Dana tersalurkan",
              value: campaigns ? formatUsdt(totalFunded) : "…",
              sub: campaigns ? `USDT · sekitar ${formatRupiah(totalFunded)}` : "memuat dari blockchain",
            },
            {
              icon: Wheat,
              label: "Proyek aktif",
              value: campaigns ? activeCount : "…",
              sub: campaigns ? `cari dana atau berjalan, dari ${visible.length} proyek` : "memuat…",
            },
            {
              icon: Landmark,
              label: "Dana cadangan",
              value: reserve === undefined ? "…" : formatUsdt(reserve),
              sub: "USDT untuk kompensasi gagal panen",
            },
            {
              icon: Users,
              label: "Petani",
              value: regs ? regs.farmers.length : "…",
              sub: regs ? `didampingi ${regs.cooperatives.length} koperasi` : "memuat…",
            },
          ].map((s, i) => (
            <Reveal key={s.label} delay={i * 90}>
              <Stat variant="glass" icon={s.icon} label={s.label} value={s.value} sub={s.sub} />
            </Reveal>
          ))}
        </Container>
      </section>

      {/* ------------------------------------------------------- Proyek */}
      <section id="proyek" className="scroll-mt-24 py-16 sm:py-24">
        <Container>
          <Reveal>
            <SectionTitle
              eyebrow="Proyek tanam"
              description="Setiap proyek adalah satu musim tanam satu petani, lengkap dengan rencana biaya dan perkiraan panennya."
              action={
                <div className="flex flex-wrap gap-1 rounded-full border border-krem-200 bg-white p-1 shadow-soft">
                  {FILTERS.map((f) => {
                    const n = visible.filter((c) => matches(c, f.key)).length;
                    return (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setFilter(f.key)}
                        className={cn(
                          "rounded-full px-3.5 py-1.5 text-sm font-medium transition",
                          filter === f.key ? "bg-hutan-900 text-white" : "text-stone-600 hover:bg-krem-100",
                        )}
                      >
                        {f.label} <span className={cn("ml-0.5 text-xs", filter === f.key ? "text-emas-300" : "text-stone-400")}>{n}</span>
                      </button>
                    );
                  })}
                </div>
              }
            >
              Pilih petani yang mau kamu dukung
            </SectionTitle>
          </Reveal>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[26rem] rounded-3xl" />
              ))}
            </div>
          ) : isError ? (
            <Notice tone="error">Data proyek belum bisa dibaca dari blockchain. Cek koneksi internetmu, lalu muat ulang halaman.</Notice>
          ) : shown.length === 0 ? (
            <EmptyState icon={Sprout} title={visible.length === 0 ? "Belum ada proyek tanam yang dibuka" : "Belum ada proyek di kategori ini"}>
              {role === "petani" ? (
                <Link href="/create" className="font-semibold text-hutan-700 underline">
                  Ajukan proyek tanam pertamamu
                </Link>
              ) : (
                "Proyek baru muncul di sini setelah petani mengajukan dan admin menyetujuinya."
              )}
            </EmptyState>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((c, i) => (
                <Reveal key={`${filter}-${c.address}`} delay={(i % 3) * 90} className="h-full">
                  <CampaignCard c={c} />
                </Reveal>
              ))}
            </div>
          )}

          {drafts.length > 0 && (role === "admin" || role === "petani") && (
            <div className="mt-12">
              <h3 className="mb-4 font-display text-xl font-semibold text-hutan-950">Menunggu review admin ({drafts.length})</h3>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {drafts.map((c) => (
                  <CampaignCard key={c.address} c={c} />
                ))}
              </div>
            </div>
          )}
        </Container>
      </section>

      {/* ------------------------------------------------------ Cara kerja */}
      <HowItWorks />

      {/* ------------------------------------------------- Dua kunci + bagi hasil */}
      <section className="py-16 sm:py-24">
        <Container className="grid gap-6 lg:grid-cols-2">
          <Reveal className="h-full">
            <Card className="flex h-full flex-col gap-6 p-6 sm:p-8">
              <div>
                <p className="text-xs font-semibold tracking-[0.18em] text-emas-600 uppercase">Dua kunci pencairan</p>
                <h2 className="mt-2 font-display text-3xl font-semibold text-balance text-hutan-950">Uang baru keluar kalau dua pihak setuju</h2>
                <p className="mt-2 text-pretty text-stone-600">
                  Agen AI memeriksa foto: lokasi GPS, tanggal, jenis tanaman, fase tumbuh, sampai cuaca 14 hari terakhir. Koperasi yang
                  kenal lahannya ikut memastikan. Kalau salah satu menolak, dananya tetap terkunci.
                </p>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="flex flex-col items-center gap-2 rounded-2xl bg-hutan-50 p-4 text-center">
                  <Bot className="size-6 text-hutan-700" aria-hidden />
                  <p className="text-sm font-semibold text-hutan-900">Agen AI</p>
                </div>
                <span className="font-display text-2xl text-emas-500">+</span>
                <div className="flex flex-col items-center gap-2 rounded-2xl bg-hutan-50 p-4 text-center">
                  <Users className="size-6 text-hutan-700" aria-hidden />
                  <p className="text-sm font-semibold text-hutan-900">Koperasi</p>
                </div>
              </div>
              <div className="mt-auto">
                <div className="grow-x flex h-12 overflow-hidden rounded-2xl text-sm font-semibold">
                  <div className="flex w-[40%] items-center justify-center bg-hutan-800 text-white">Tanam 40%</div>
                  <div className="flex w-[35%] items-center justify-center bg-hutan-600 text-white">Tumbuh 35%</div>
                  <div className="flex w-[25%] items-center justify-center bg-emas-400 text-hutan-950">Pra-panen 25%</div>
                </div>
                <p className="mt-2 text-xs text-pretty text-stone-500">
                  Kalau ditolak tiga kali berturut-turut, admin yang memutuskan, dan keputusannya tercatat publik.
                </p>
              </div>
            </Card>
          </Reveal>

          <Reveal delay={120} className="h-full">
            <Card className="flex h-full flex-col gap-6 p-6 sm:p-8">
              <div>
                <p className="text-xs font-semibold tracking-[0.18em] text-emas-600 uppercase">Bagi hasil</p>
                <h2 className="mt-2 font-display text-3xl font-semibold text-balance text-hutan-950">Modal kembali dulu, baru untung dibagi</h2>
                <p className="mt-2 text-pretty text-stone-600">
                  Contoh dari proyek demo cabai merah: modal 1.000&nbsp;USDT, panen terjual 1.650&nbsp;USDT, jadi untungnya 650&nbsp;USDT.
                </p>
              </div>
              <SplitBar />
              <dl className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ["bg-hutan-800", "Modal investor", "1.000 USDT kembali utuh"],
                  ["bg-hutan-500", "Investor (40% untung)", "260 USDT, imbal hasil 26%"],
                  ["bg-emas-400", "Petani (55% untung)", "357,5 USDT di luar modal kerja"],
                  ["bg-emas-700", "Dana cadangan (5%)", "32,5 USDT untuk musim gagal panen"],
                ].map(([color, label, value]) => (
                  <div key={label} className="flex gap-2.5">
                    <span className={cn("mt-1 size-3 shrink-0 rounded-full", color)} aria-hidden />
                    <div>
                      <dt className="font-semibold text-hutan-950">{label}</dt>
                      <dd className="text-stone-600">{value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </Card>
          </Reveal>
        </Container>
      </section>

      {/* ------------------------------------------------------- Agen AI */}
      <AgentSection />

      {/* ----------------------------------------------------------- Ajakan */}
      <section className="py-16 sm:py-24">
        <Container>
          <Reveal>
            <div className="relative overflow-hidden rounded-[2rem] bg-linear-to-br from-emas-300 via-emas-400 to-emas-500 px-6 py-12 text-hutan-950 sm:px-12 sm:py-16">
              <Wheat className="absolute -right-6 -bottom-8 size-48 text-hutan-950/10" aria-hidden />
              <h2 className="max-w-2xl font-display text-3xl font-semibold text-balance sm:text-4xl">Siap ikut menanam bersama petani?</h2>
              <p className="mt-3 max-w-xl text-pretty text-hutan-950/75">
                Mulai dari nominal kecil. Semua langkahnya bisa kamu pantau sendiri, dari foto lahan sampai nota penjualan.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <ButtonLink href="/#proyek" variant="primary" size="lg">
                  Pilih proyek tanam <ArrowRight className="size-4" aria-hidden />
                </ButtonLink>
                {role === "petani" && (
                  <ButtonLink href="/create" variant="secondary" size="lg">
                    Ajukan proyek tanam
                  </ButtonLink>
                )}
              </div>
            </div>
          </Reveal>
        </Container>
      </section>
    </>
  );
}

/* ================================================================ Kenapa */

/**
 * Paragraf masalah lalu paragraf solusi, menyala kata demi kata mengikuti gulir (berlanjut dari
 * paragraf pertama ke kedua). `*kata*` = sorotan emas.
 */
const STATEMENT = [
  "Selama ini modal tanam petani kecil datang dari *tengkulak.* Panen dibeli *murah sebelum waktunya,* dan kalau gagal, petani yang *terjerat utang.* Semua risikonya ditanggung petani sendirian.",
  "BagiPanen menggantinya dengan modal yang transparan: dikunci di kontrak, cair per tahap, *risikonya ditanggung bersama investor,* dan *untungnya dibagi adil.*",
];

const STATEMENT_PARAGRAPHS = (() => {
  let index = 0;
  return STATEMENT.map((paragraph) => {
    let accent = false;
    return paragraph.split(" ").map((raw) => {
      if (raw.startsWith("*")) accent = true;
      const word = { text: raw.replaceAll("*", ""), accent, index: index++ };
      if (/\*[.,]?$/.test(raw)) accent = false;
      return word;
    });
  });
})();
const STATEMENT_WORD_COUNT = STATEMENT_PARAGRAPHS.flat().length;

const FACTS = [
  { value: "55%", label: "untung untuk petani" },
  { value: "3 tahap", label: "pencairan terverifikasi" },
  { value: "100%", label: "refund jika target gagal" },
];

function ProblemStatement() {
  const reduced = useReducedMotion();
  const [ref, progress] = useScrollProgress<HTMLElement>();
  const n = STATEMENT_WORD_COUNT;
  const lit = reduced ? n : Math.round(Math.min(1, Math.max(0, (progress - 0.06) / 0.72)) * n);
  const factsShown = reduced || progress > 0.8;

  return (
    <section id="kenapa" ref={ref} className="relative h-[230svh] bg-hutan-950 text-white">
      <div className="sticky top-28 flex h-[calc(100svh-7rem)] items-center overflow-hidden lg:top-16 lg:h-[calc(100svh-4rem)]">
        <div className="pola-bedengan absolute inset-0" aria-hidden />
        <Container className="relative">
          <p className="mb-4 text-xs font-semibold tracking-[0.18em] text-emas-300 uppercase sm:mb-6">Kenapa BagiPanen</p>
          {STATEMENT_PARAGRAPHS.map((words, p) => (
            <p
              key={p}
              className={cn(
                "max-w-4xl font-display text-[1.45rem] leading-[1.28] font-semibold tracking-tight min-[400px]:text-[1.7rem] min-[400px]:leading-[1.3] sm:text-4xl sm:leading-[1.25] lg:text-[2.75rem]",
                p > 0 && "mt-4 sm:mt-6",
              )}
            >
              {words.map((w) => (
                <span
                  key={w.index}
                  className={cn(
                    "transition-colors duration-300",
                    w.index < lit ? (w.accent ? "text-emas-300 italic" : "text-white") : w.accent ? "text-white/15 italic" : "text-white/15",
                  )}
                >
                  {w.text}{" "}
                </span>
              ))}
            </p>
          ))}
          <dl
            className={cn(
              "mt-6 grid max-w-3xl grid-cols-3 gap-3 transition duration-700 sm:mt-10 sm:gap-6",
              factsShown ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
            )}
          >
            {FACTS.map((f) => (
              <div key={f.label} className="border-l border-emas-300/40 pl-3 sm:pl-4">
                <dt className="font-display text-2xl font-semibold text-emas-300 sm:text-4xl">{f.value}</dt>
                <dd className="mt-1 text-xs leading-snug text-balance text-white/60 sm:text-sm">{f.label}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </div>
    </section>
  );
}

/* ============================================================ Cara kerja */

const STEPS: { title: string; body: string }[] = [
  {
    title: "Petani mengajukan",
    body: "Petani anggota koperasi menulis kebutuhan modal, rencana biaya, dan perkiraan panennya. Admin memeriksa dulu sebelum pendanaan dibuka.",
  },
  {
    title: "Kamu ikut mendanai",
    body: "Danai berapa pun yang kamu mau. Setiap 1 USDT jadi 1 token porsi yang mencatat bagianmu dan tidak bisa dipindahtangankan.",
  },
  {
    title: "Dana cair per tahap",
    body: "Tanam, tumbuh, pra-panen. Tiap tahap baru cair setelah foto lahan terbaru lolos pengecekan agen AI dan koperasi.",
  },
  {
    title: "Panen dibagi otomatis",
    body: "Hasil penjualan disetor ke kontrak. Modal investor kembali dulu, sisanya dibagi ke petani, investor, dan dana cadangan.",
  },
];

function HowItWorks() {
  const [register, active] = useActiveIndex(STEPS.length);
  return (
    <section id="cara-kerja" className="scroll-mt-24 border-y border-krem-200 bg-white py-16 sm:py-24">
      <Container>
        <Reveal>
          <SectionTitle
            eyebrow="Cara kerja"
            description={<>Tidak ada perantara yang memegang uangmu. Semua aturan main sudah ditulis di smart&nbsp;contract sejak awal.</>}
          >
            Dari lahan sampai bagi hasil
          </SectionTitle>
        </Reveal>

        <div className="mt-10 lg:grid lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          {/* Visual menempel (desktop) — berganti sesuai langkah yang sedang dibaca */}
          <div className="hidden lg:block">
            <div className="sticky top-24 flex h-[calc(100svh-8rem)] flex-col justify-center gap-6">
              {/* Semua visual ditumpuk di sel grid yang sama → tinggi mengikuti yang terpanjang */}
              <div className="grid w-full">
                {STEPS.map((s, i) => (
                  <div
                    key={s.title}
                    aria-hidden={i !== active}
                    className={cn(
                      "[grid-area:1/1] transition duration-700 ease-out",
                      i === active ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-6 scale-[0.97] opacity-0",
                    )}
                  >
                    <StepVisual index={i} active={i === active} />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2" aria-hidden>
                {STEPS.map((s, i) => (
                  <span
                    key={s.title}
                    className={cn("h-1.5 rounded-full transition-all duration-500", i === active ? "w-10 bg-hutan-700" : i < active ? "w-5 bg-hutan-300" : "w-5 bg-krem-300")}
                  />
                ))}
                <span className="ml-2 text-xs font-semibold text-stone-500">
                  {active + 1} / {STEPS.length}
                </span>
              </div>
            </div>
          </div>

          <ol className="flex flex-col gap-10 lg:gap-0">
            {STEPS.map((s, i) => (
              <li key={s.title} ref={register(i)} className="lg:flex lg:min-h-[72svh] lg:items-center lg:last:min-h-[56svh]">
                <Reveal className="w-full">
                  <div className="mb-6 lg:hidden">
                    {/* Di HP animasi panel dipicu saat muncul di layar (data-shown dari Reveal). */}
                    <StepVisual index={i} active={false} />
                  </div>
                  <div className={cn("transition-opacity duration-500", i === active ? "lg:opacity-100" : "lg:opacity-30")}>
                    <StepBadge index={i} />
                    <h3 className="mt-4 font-display text-2xl font-semibold text-balance text-hutan-950 sm:text-3xl">{s.title}</h3>
                    <p className="mt-3 max-w-md leading-relaxed text-pretty text-stone-600">{s.body}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}

/** Bar pembagian hasil (contoh PRD); memanjang saat induk ber-`data-shown`. */
function SplitBar() {
  return (
    <div className="grow-x flex h-12 overflow-hidden rounded-2xl text-xs font-semibold sm:text-sm">
      <div className="flex w-[60.6%] items-center justify-center bg-hutan-800 text-white">Modal 1.000</div>
      <div className="flex w-[15.8%] items-center justify-center bg-hutan-500 text-white">260</div>
      <div className="flex w-[21.7%] items-center justify-center bg-emas-400 text-hutan-950">357,5</div>
      <div className="w-[1.9%] bg-emas-700" title="Dana cadangan 32,5" />
    </div>
  );
}

/* =============================================================== Agen AI */

function AgentSection() {
  const { data: agent } = useAgentProfile();
  return (
    <section className="glow-hutan relative overflow-hidden bg-hutan-950 py-16 text-white sm:py-24">
      <div className="pola-bedengan absolute inset-0" aria-hidden />
      <Container className="relative grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
        <Reveal>
          <p className="text-xs font-semibold tracking-[0.18em] text-emas-300 uppercase">Agen AI verifikator</p>
          <h2 className="mt-2 font-display text-3xl font-semibold text-balance sm:text-4xl">Pemeriksa lapangan yang punya identitas dan rekam jejak</h2>
          <p className="mt-4 max-w-xl leading-relaxed text-pretty text-white/70">
            Agen kami terdaftar di registri identitas ERC-8004 dan memakai dompetnya sendiri, terpisah dari admin, koperasi, dan petani.
            Setiap putusan disertai alasan yang bisa dibaca siapa saja, dan statistiknya tidak bisa dihapus.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/agent" variant="gold">
              Lihat profil agen <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
          </div>
        </Reveal>
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              icon: BadgeCheck,
              label: "Identitas",
              value: agent?.configured ? `#${agent.agentId.toString()}` : "…",
              sub: agent?.configured ? (identityIsMock(agent.identityRegistry) ? "registri cadangan (lokal)" : "registri ERC-8004") : undefined,
            },
            {
              icon: ShieldCheck,
              label: "Tingkat terima",
              value: agent?.configured && agent.stats.verdicts > 0 ? formatPercent(agent.stats.approvals / agent.stats.verdicts) : "–",
              sub: agent?.configured ? `dari ${agent.stats.verdicts} foto` : undefined,
            },
            {
              icon: Bot,
              label: "Foto dicek",
              value: agent?.configured ? agent.stats.verdicts : "…",
              sub: agent?.configured ? `${agent.stats.approvals} diterima · ${agent.stats.rejections} ditolak` : undefined,
            },
            { icon: Scale, label: "Dikoreksi admin", value: agent?.configured ? agent.stats.overturned : "…", sub: "putusan AI yang dikoreksi" },
          ].map((s, i) => (
            <Reveal key={s.label} delay={i * 90}>
              <Stat variant="glass" icon={s.icon} label={s.label} value={s.value} sub={s.sub} />
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}

/* ======================================================= Kartu unggulan */

const SLIDE_MS = 3000;
const SWIPE_PX = 60;

/**
 * Posisi kartu di tumpukan menurut jaraknya dari kartu depan (r): 0 = depan (ikut jari saat digeser),
 * 1–2 = mengintip di belakang, n−1 = baru terlempar ke kiri, sisanya tersembunyi di belakang.
 */
function deckSlot(r: number, n: number, dragX: number) {
  if (r === 0) return { transform: `translateX(${dragX}px) rotate(${dragX / 28}deg)`, opacity: 1, z: 30, dim: 0 };
  if (r === 1) return { transform: "translate(7%, 0) scale(0.94) rotate(2.5deg)", opacity: 1, z: 20, dim: 0.35 };
  if (r === 2) return { transform: "translate(13%, 0) scale(0.88) rotate(5deg)", opacity: 1, z: 10, dim: 0.55 };
  if (r === n - 1) return { transform: "translate(-118%, 2%) rotate(-12deg)", opacity: 0, z: 40, dim: 0 };
  return { transform: "translate(16%, 0) scale(0.84) rotate(6deg)", opacity: 0, z: 0, dim: 0.6 };
}

/**
 * Tumpukan kartu proyek di hero: satu kartu di depan, dua mengintip di belakang. Geser ke kiri
 * (mouse/jari) → kartu depan terlempar dan kartu berikutnya maju; geser ke kanan → kartu sebelumnya
 * kembali. Otomatis tiap 3 detik, berhenti saat disorot/disentuh atau bila reduced motion.
 */
function FeaturedCarousel({ items }: { items: CampaignSummary[] }) {
  const reduced = useReducedMotion();
  const n = items.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [drag, setDrag] = useState<{ x0: number; dx: number } | null>(null);
  const moved = useRef(false);
  const current = ((index % n) + n) % n;

  useEffect(() => {
    if (reduced || paused || drag || n < 2) return;
    const t = setTimeout(() => setIndex((i) => i + 1), SLIDE_MS);
    return () => clearTimeout(t);
  }, [index, reduced, paused, drag, n]);

  const release = () => {
    if (drag && drag.dx <= -SWIPE_PX) setIndex((i) => i + 1);
    else if (drag && drag.dx >= SWIPE_PX) setIndex((i) => i - 1);
    setDrag(null);
  };

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Proyek tanam pilihan"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        className="mr-[12%] mb-8 grid cursor-grab touch-pan-y select-none active:cursor-grabbing"
        onDragStart={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          if (n < 2) return;
          moved.current = false;
          setDrag({ x0: e.clientX, dx: 0 });
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag) return;
          const dx = e.clientX - drag.x0;
          if (Math.abs(dx) > 6) moved.current = true;
          setDrag({ ...drag, dx });
        }}
        onPointerUp={release}
        onPointerCancel={() => setDrag(null)}
        onClickCapture={(e) => {
          // Seret bukan klik: jangan buka halaman proyek setelah kartu digeser.
          if (moved.current) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        {items.map((c, i) => {
          const r = (i - current + n) % n;
          const slot = deckSlot(r, n, r === 0 && drag ? drag.dx : 0);
          return (
            <div
              key={c.address}
              aria-roledescription="slide"
              aria-label={`${i + 1} dari ${n}`}
              aria-hidden={r !== 0}
              inert={r !== 0}
              className="relative [grid-area:1/1]"
              style={{
                transform: slot.transform,
                opacity: slot.opacity,
                zIndex: slot.z,
                transition: (r === 0 && drag) || reduced ? "none" : "transform 650ms cubic-bezier(0.2,0.7,0.2,1), opacity 500ms ease",
              }}
            >
              <FeaturedCampaign c={c} />
              <div
                className="pointer-events-none absolute inset-0 rounded-[2rem] bg-hutan-950 transition-opacity duration-500"
                style={{ opacity: slot.dim }}
                aria-hidden
              />
            </div>
          );
        })}
      </div>
      {n > 1 && (
        <div className="relative z-40 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setIndex((i) => i - 1)}
            aria-label="Proyek sebelumnya"
            className="grid size-9 place-items-center rounded-full border border-white/15 bg-white/5 text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <div className="flex items-center gap-1.5">
            {items.map((c, i) => (
              <button
                key={c.address}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Tampilkan proyek ${i + 1}`}
                aria-current={i === current}
                className="grid h-6 place-items-center px-0.5"
              >
                <span className={cn("block h-1.5 rounded-full transition-all duration-500", i === current ? "w-7 bg-emas-300" : "w-2.5 bg-white/30 hover:bg-white/50")} />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setIndex((i) => i + 1)}
            aria-label="Proyek berikutnya"
            className="grid size-9 place-items-center rounded-full border border-white/15 bg-white/5 text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}

/** Kartu proyek unggulan di hero (latar padat agar kartu di belakangnya tidak tembus pandang). */
function FeaturedCampaign({ c }: { c: CampaignSummary }) {
  const { data: meta } = useIpfsJson<CampaignMetadata>(c.metadataCID);
  const pct = fundedPercent(c);
  return (
    <Link
      href={`/campaign/${c.address}`}
      className="group block h-full overflow-hidden rounded-[2rem] border border-white/15 bg-hutan-900 p-3 shadow-lift transition hover:bg-hutan-800"
    >
      <div className="relative h-56 overflow-hidden rounded-3xl sm:h-64">
        <CampaignCover cid={meta?.coverImageCID} commodity={c.commodity} className="transition duration-700 group-hover:scale-105" />
        <div className="absolute inset-0 bg-linear-to-t from-hutan-950/70 to-transparent" aria-hidden />
        <div className="absolute top-3 left-3">
          <StatusBadge status={c.status} failType={c.failType} glass />
        </div>
        <p className="absolute bottom-3 left-4 flex items-center gap-1 text-xs text-white/85">
          <MapPin className="size-3.5" aria-hidden /> {c.locationName}
        </p>
      </div>
      <div className="flex flex-col gap-3 p-3 pt-4">
        <p className="text-xs font-semibold tracking-[0.18em] text-emas-300 uppercase">Proyek pilihan</p>
        <h3 className="font-display text-xl leading-snug font-semibold text-balance">{meta?.title ?? `${c.commodity} di ${c.locationName}`}</h3>
        <ProgressBar value={c.raisedAmount} max={c.targetAmount} dark />
        <div className="flex items-baseline justify-between text-sm text-white/70">
          <span>
            <span className="font-semibold text-white">{formatUsdt(c.raisedAmount)}</span> dari {formatUsdt(c.targetAmount)} USDT
          </span>
          <span className="font-semibold text-emas-300">{pct}%</span>
        </div>
        <div className="flex items-center justify-between border-t border-white/10 pt-3 text-sm">
          <span className="text-white/60">Proyeksi imbal hasil</span>
          <span className="font-semibold text-emas-200">{formatPercent(projectedInvestorReturn(c.targetAmount, c.estimatedRevenue))} / musim</span>
        </div>
      </div>
    </Link>
  );
}
