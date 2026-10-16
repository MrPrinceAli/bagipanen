"use client";

import { getLang, tr, trTerm } from "@/lib/i18n";
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
import { PoweredBy } from "@/components/BrandLogos";
import { CardSlider } from "@/components/CardSlider";
import { StepBadge, StepVisual } from "@/components/HowItWorksVisuals";
import { GeminiVisionCard, OpenMeteoCard } from "@/components/TechCards";
import { StatusBadge } from "@/components/common";
import { Reveal, useReducedMotion, useScrollProgress } from "@/components/scroll";
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
  { key: "all", label: ["Semua", "All"] },
  { key: "funding", label: ["Cari dana", "Funding"] },
  { key: "active", label: ["Berjalan", "Running"] },
  { key: "done", label: ["Selesai", "Done"] },
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
                {IS_LOCAL ? tr("Mode demo lokal", "Local demo mode") : tr("Sudah berjalan di BNB Smart Chain Testnet", "Live on BNB Smart Chain Testnet")}
              </span>
              <h1 className="mt-6 font-display text-[2.15rem] leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl xl:text-[3.4rem]">
                {tr("Tanpa ijon, tanpa tengkulak.", "No ijon, no middlemen.")}{" "}
                <span className="box-decoration-clone bg-linear-to-r from-emas-200 via-emas-300 to-emas-500 bg-clip-text pe-[0.12em] text-transparent italic">
                  {tr("Hasil panen dibagi smart\u00a0contract.", "The harvest is split by smart\u00a0contract.")}
                </span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-pretty text-white/75">
                {tr(
                  "Pendanaan modal tanam berbasis RWA di BNB\u00a0Chain. Investor mendanai petani sejak awal musim tanam dan mendapat bagian hasil panen saat proyek berhasil. Agen AI beridentitas ERC-8004 bersama koperasi memverifikasi setiap tahap, sehingga penggunaan modal sampai pembagian hasil tercatat transparan.",
                  "RWA-based crop financing on BNB\u00a0Chain. Investors back farmers from the start of the planting season and earn a share of the harvest when the project succeeds. An ERC-8004 AI agent and the cooperative verify every stage, so everything from how the capital is used to how the harvest is shared is recorded in the open.",
                )}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/#proyek" variant="gold" size="lg">
                  {tr("Lihat proyek tanam", "See crop projects")} <ArrowRight className="size-4" aria-hidden />
                </ButtonLink>
                {role === "petani" ? (
                  <ButtonLink href="/create" variant="light" size="lg">
                    {tr("Ajukan proyek tanam", "Propose a crop project")}
                  </ButtonLink>
                ) : (
                  <ButtonLink href="/#cara-kerja" variant="light" size="lg">
                    {tr("Begini cara kerjanya", "See how it works")}
                  </ButtonLink>
                )}
              </div>
              <ul aria-label={tr("Teknologi yang dipakai", "Technologies used")} className="mt-8 flex flex-wrap gap-2">
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
          {tr("Gulir untuk lanjut", "Scroll to continue")}
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
              label: tr("Dana tersalurkan", "Funds deployed"),
              value: campaigns ? formatUsdt(totalFunded) : "…",
              sub: campaigns ? `USDT · ${tr("sekitar", "about")} ${formatRupiah(totalFunded)}` : tr("memuat dari blockchain", "loading from the blockchain"),
            },
            {
              icon: Wheat,
              label: tr("Proyek aktif", "Active projects"),
              value: campaigns ? activeCount : "…",
              sub: campaigns
                ? tr(`cari dana atau berjalan, dari ${visible.length} proyek`, `funding or running, out of ${visible.length} projects`)
                : tr("memuat…", "loading…"),
            },
            {
              icon: Landmark,
              label: tr("Dana cadangan", "Reserve fund"),
              value: reserve === undefined ? "…" : formatUsdt(reserve),
              sub: tr("USDT untuk kompensasi gagal panen", "USDT to compensate crop failures"),
            },
            {
              icon: Users,
              label: tr("Petani", "Farmers"),
              value: regs ? regs.farmers.length : "…",
              sub: regs ? tr(`didampingi ${regs.cooperatives.length} koperasi`, `supported by ${regs.cooperatives.length} cooperatives`) : tr("memuat…", "loading…"),
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
              eyebrow={tr("Proyek tanam", "Crop projects")}
              description={tr(
                "Setiap proyek adalah satu musim tanam satu petani, lengkap dengan rencana biaya dan perkiraan panennya.",
                "Each project is one growing season of one farmer, complete with a cost plan and a harvest estimate.",
              )}
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
                        {tr(f.label[0], f.label[1])} <span className={cn("ml-0.5 text-xs", filter === f.key ? "text-emas-300" : "text-stone-400")}>{n}</span>
                      </button>
                    );
                  })}
                </div>
              }
            >
              {tr("Pilih petani yang mau kamu dukung", "Choose a farmer to support")}
            </SectionTitle>
          </Reveal>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[26rem] rounded-3xl" />
              ))}
            </div>
          ) : isError ? (
            <Notice tone="error">
              {tr(
                "Data proyek belum bisa dibaca dari blockchain. Cek koneksi internetmu, lalu muat ulang halaman.",
                "Project data can't be read from the blockchain yet. Check your internet connection, then reload the page.",
              )}
            </Notice>
          ) : shown.length === 0 ? (
            <EmptyState icon={Sprout} title={
                visible.length === 0
                  ? tr("Belum ada proyek tanam yang dibuka", "No crop projects are open yet")
                  : tr("Belum ada proyek di kategori ini", "No projects in this category yet")
              }>
              {role === "petani" ? (
                <Link href="/create" className="font-semibold text-hutan-700 underline">
                  {tr("Ajukan proyek tanam pertamamu", "Propose your first crop project")}
                </Link>
              ) : (
                tr(
                  "Proyek baru muncul di sini setelah petani mengajukan dan admin menyetujuinya.",
                  "New projects appear here after a farmer proposes them and the admin approves.",
                )
              )}
            </EmptyState>
          ) : (
            <CardSlider
              key={filter}
              label={tr("Daftar proyek tanam", "Crop projects")}
              footer={
                <Link href="/proyek" className="inline-flex items-center gap-1 text-sm font-semibold text-hutan-700 hover:text-hutan-900">
                  {tr("Lihat semua di peta", "See all on the map")} <ArrowRight className="size-4" aria-hidden />
                </Link>
              }
            >
              {shown.map((c, i) => (
                <Reveal key={c.address} delay={(i % 3) * 90} className="h-full">
                  <CampaignCard c={c} />
                </Reveal>
              ))}
            </CardSlider>
          )}

          {drafts.length > 0 && (role === "admin" || role === "petani") && (
            <div className="mt-12">
              <h3 className="mb-4 font-display text-xl font-semibold text-hutan-950">{tr("Menunggu review admin", "Awaiting admin review")} ({drafts.length})</h3>
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
              <PoweredBy items={[{ badge: "ERC-8004", label: tr("Agen #2544", "Agent #2544") }, { logo: "bnb", label: "BNB Smart Chain" }]} />
              <div>
                <p className="text-xs font-semibold tracking-[0.18em] text-emas-600 uppercase">{tr("Dua kunci pencairan", "Two-key release")}</p>
                <h2 className="mt-2 font-display text-3xl font-semibold text-balance text-hutan-950">{tr("Uang baru keluar kalau dua pihak setuju", "Money only moves when both sides agree")}</h2>
                <p className="mt-2 text-pretty text-stone-600">
                  {tr(
                    "Agen AI memeriksa foto: lokasi GPS, tanggal, jenis tanaman, fase tumbuh, sampai cuaca 14 hari terakhir. Koperasi yang kenal lahannya ikut memastikan. Kalau salah satu menolak, dananya tetap terkunci.",
                    "The AI agent checks each photo: GPS location, date, crop type, growth stage, even the last 14 days of weather. The cooperative, who knows the land, confirms too. If either one says no, the funds stay locked.",
                  )}
                </p>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="flex flex-col items-center gap-2 rounded-2xl bg-hutan-50 p-4 text-center">
                  <Bot className="size-6 text-hutan-700" aria-hidden />
                  <p className="text-sm font-semibold text-hutan-900">{tr("Agen AI", "AI agent")}</p>
                </div>
                <span className="font-display text-2xl text-emas-500">+</span>
                <div className="flex flex-col items-center gap-2 rounded-2xl bg-hutan-50 p-4 text-center">
                  <Users className="size-6 text-hutan-700" aria-hidden />
                  <p className="text-sm font-semibold text-hutan-900">{tr("Koperasi", "Cooperative")}</p>
                </div>
              </div>
              <div className="mt-auto">
                <div className="grow-x flex h-12 overflow-hidden rounded-2xl text-sm font-semibold">
                  <div className="flex w-[40%] items-center justify-center bg-hutan-800 text-white">{tr("Tanam", "Planting")} 40%</div>
                  <div className="flex w-[35%] items-center justify-center bg-hutan-600 text-white">{tr("Tumbuh", "Growing")} 35%</div>
                  <div className="flex w-[25%] items-center justify-center bg-emas-400 text-hutan-950">{tr("Pra-panen", "Pre-harvest")} 25%</div>
                </div>
                <p className="mt-2 text-xs text-pretty text-stone-500">
                  {tr(
                    "Kalau ditolak tiga kali berturut-turut, admin yang memutuskan, dan keputusannya tercatat publik.",
                    "If a stage is rejected three times in a row, the admin decides, and the decision is recorded publicly.",
                  )}
                </p>
              </div>
            </Card>
          </Reveal>

          <Reveal delay={120} className="h-full">
            <Card className="flex h-full flex-col gap-6 p-6 sm:p-8">
              <PoweredBy items={[{ logo: "solidity" }, { logo: "openzeppelin", label: "OpenZeppelin v5" }, { logo: "bnb" }]} />
              <div>
                <p className="text-xs font-semibold tracking-[0.18em] text-emas-600 uppercase">{tr("Bagi hasil", "Profit sharing")}</p>
                <h2 className="mt-2 font-display text-3xl font-semibold text-balance text-hutan-950">{tr("Modal kembali dulu, baru untung dibagi", "Capital comes back first, then profit is shared")}</h2>
                <p className="mt-2 text-pretty text-stone-600">
                  {tr(
                    "Contoh dari proyek demo cabai merah: modal 1.000\u00a0USDT, panen terjual 1.650\u00a0USDT, jadi untungnya 650\u00a0USDT.",
                    "Example from the red chili demo project: 1,000\u00a0USDT of capital, the harvest sold for 1,650\u00a0USDT, so the profit is 650\u00a0USDT.",
                  )}
                </p>
              </div>
              <SplitBar />
              <dl className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ["bg-hutan-800", tr("Modal investor", "Investor capital"), tr("1.000 USDT kembali utuh", "1,000 USDT returned in full")],
                  ["bg-hutan-500", tr("Investor (40% untung)", "Investors (40% of profit)"), tr("260 USDT, imbal hasil 26%", "260 USDT, a 26% return")],
                  ["bg-emas-400", tr("Petani (55% untung)", "Farmer (55% of profit)"), tr("357,5 USDT di luar modal kerja", "357.5 USDT on top of working capital")],
                  ["bg-emas-700", tr("Dana cadangan (5%)", "Reserve fund (5%)"), tr("32,5 USDT untuk musim gagal panen", "32.5 USDT for crop-failure seasons")],
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
          <Reveal className="h-full">
            <GeminiVisionCard />
          </Reveal>
          <Reveal delay={120} className="h-full">
            <OpenMeteoCard />
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
              <h2 className="max-w-2xl font-display text-3xl font-semibold text-balance sm:text-4xl">{tr("Siap ikut menanam bersama petani?", "Ready to grow with farmers?")}</h2>
              <p className="mt-3 max-w-xl text-pretty text-hutan-950/75">
                {tr(
                  "Mulai dari nominal kecil. Semua langkahnya bisa kamu pantau sendiri, dari foto lahan sampai nota penjualan.",
                  "Start small. You can follow every step yourself, from field photos to the sales receipt.",
                )}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <ButtonLink href="/#proyek" variant="primary" size="lg">
                  {tr("Pilih proyek tanam", "Choose a crop project")} <ArrowRight className="size-4" aria-hidden />
                </ButtonLink>
                {role === "petani" && (
                  <ButtonLink href="/create" variant="secondary" size="lg">
                    {tr("Ajukan proyek tanam", "Propose a crop project")}
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
const STATEMENT = {
  id: [
    "Selama ini modal tanam petani kecil datang dari *tengkulak.* Panen dibeli *murah sebelum waktunya,* dan kalau gagal, petani yang *terjerat utang.* Semua risikonya ditanggung petani sendirian.",
    "BagiPanen menggantinya dengan modal yang transparan: dikunci di kontrak, cair per tahap, *risikonya ditanggung bersama investor,* dan *untungnya dibagi adil.*",
  ],
  en: [
    "Until now, small farmers' working capital has come from *middlemen.* The harvest is bought *cheap, before it's even grown,* and when it fails, the farmer is *left in debt.* All the risk falls on the farmer alone.",
    "BagiPanen replaces that with transparent capital: locked in a contract, released stage by stage, *with the risk shared by investors,* and *the profit split fairly.*",
  ],
};

function statementParagraphs() {
  let index = 0;
  return STATEMENT[getLang()].map((paragraph) => {
    let accent = false;
    return paragraph.split(" ").map((raw) => {
      if (raw.startsWith("*")) accent = true;
      const word = { text: raw.replaceAll("*", ""), accent, index: index++ };
      if (/\*[.,]?$/.test(raw)) accent = false;
      return word;
    });
  });
}

const facts = () => [
  { value: "55%", label: tr("untung untuk petani", "profit to the farmer") },
  { value: tr("3 tahap", "3 stages"), label: tr("pencairan terverifikasi", "verified releases") },
  { value: "100%", label: tr("refund jika target gagal", "refund if the target fails") },
];

function ProblemStatement() {
  const reduced = useReducedMotion();
  const [ref, progress] = useScrollProgress<HTMLElement>();
  const [paragraphs] = useState(statementParagraphs);
  const n = paragraphs.flat().length;
  const lit = reduced ? n : Math.round(Math.min(1, Math.max(0, (progress - 0.06) / 0.72)) * n);
  const factsShown = reduced || progress > 0.8;

  return (
    <section id="kenapa" ref={ref} className="relative h-[230svh] bg-hutan-950 text-white">
      <div className="sticky top-28 flex h-[calc(100svh-7rem)] items-center overflow-hidden lg:top-16 lg:h-[calc(100svh-4rem)]">
        <div className="pola-bedengan absolute inset-0" aria-hidden />
        <Container className="relative">
          <p className="mb-4 text-xs font-semibold tracking-[0.18em] text-emas-300 uppercase sm:mb-6">{tr("Kenapa BagiPanen", "Why BagiPanen")}</p>
          {paragraphs.map((words, p) => (
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
            {facts().map((f) => (
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

const steps = (): { title: string; body: string }[] => [
  {
    title: tr("Petani mengajukan", "A farmer proposes"),
    body: tr(
      "Petani anggota koperasi menulis kebutuhan modal, rencana biaya, dan perkiraan panennya. Admin memeriksa dulu sebelum pendanaan dibuka.",
      "A cooperative member farmer writes down the capital needed, a cost plan, and the harvest estimate. The admin reviews it before funding opens.",
    ),
  },
  {
    title: tr("Kamu ikut mendanai", "You fund it"),
    body: tr(
      "Danai berapa pun yang kamu mau. Setiap 1 USDT jadi 1 token porsi yang mencatat bagianmu dan tidak bisa dipindahtangankan.",
      "Fund any amount you like. Every 1 USDT becomes 1 non-transferable share token that records your portion.",
    ),
  },
  {
    title: tr("Dana cair per tahap", "Funds released in stages"),
    body: tr(
      "Tanam, tumbuh, pra-panen. Tiap tahap baru cair setelah foto lahan terbaru lolos pengecekan agen AI dan koperasi.",
      "Planting, growing, pre-harvest. Each stage is released only after a fresh field photo passes the AI agent and the cooperative.",
    ),
  },
  {
    title: tr("Panen dibagi otomatis", "Harvest split automatically"),
    body: tr(
      "Hasil penjualan disetor ke kontrak. Modal investor kembali dulu, sisanya dibagi ke petani, investor, dan dana cadangan.",
      "Sales proceeds are deposited into the contract. Investors get their capital back first, and the rest is split between the farmer, investors, and the reserve fund.",
    ),
  },
];

/** Latar & warna teks tiap adegan layar penuh (selaras dengan gaya panelnya). */
const SCENES = [
  { bg: "scene-paper", title: "text-[#2c1d0c]", body: "text-[#4a3418]", num: "text-[#2c1d0c]/[0.09]", nav: "dark" },
  { bg: "scene-neon", title: "text-white", body: "text-white/70", num: "text-emas-300/[0.07]", nav: "light" },
  { bg: "scene-field", title: "text-hutan-950", body: "text-hutan-900/80", num: "text-hutan-900/[0.08]", nav: "dark" },
  { bg: "scene-brutal", title: "text-hutan-950", body: "text-hutan-950/80", num: "text-transparent [-webkit-text-stroke:3px_rgb(11_29_21/0.2)]", nav: "dark" },
] as const;

/**
 * Cara kerja sebagai pengalaman layar penuh: panggung menempel selama 4 layar gulir; tiap langkah
 * adalah adegan dengan latarnya sendiri yang menyapu naik menutupi adegan sebelumnya. Panel
 * bergerak sedikit mengikuti gulir, dan navigasi titik di kanan bisa diklik untuk lompat.
 */
function HowItWorks() {
  const reduced = useReducedMotion();
  const [ref, progress] = useScrollProgress<HTMLDivElement>(400);
  const STEPS = steps();
  const n = STEPS.length;
  const active = Math.min(n - 1, Math.floor(progress * n));
  const local = progress * n - active;
  const lightNav = SCENES[active].nav === "light";

  const jump = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const span = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + (span * (i + 0.2)) / n, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <section id="cara-kerja" className="scroll-mt-24 bg-white">
      <Container className="pt-16 pb-10 sm:pt-24 sm:pb-14">
        <Reveal>
          <SectionTitle
            eyebrow={tr("Cara kerja", "How it works")}
            description={tr(
              "Tidak ada perantara yang memegang uangmu. Semua aturan main sudah ditulis di smart\u00a0contract sejak awal.",
              "No middleman holds your money. All the rules are written into the smart\u00a0contract from day one.",
            )}
          >
            {tr("Dari lahan sampai bagi hasil", "From the field to the profit split")}
          </SectionTitle>
        </Reveal>
      </Container>

      <div ref={ref} className="relative" style={{ height: `${n * 100}svh` }}>
        <div className="sticky top-28 h-[calc(100svh-7rem)] overflow-hidden lg:top-16 lg:h-[calc(100svh-4rem)]">
          {STEPS.map((s, i) => {
            const t = SCENES[i];
            const state = i === active ? "on" : i < active ? "past" : "next";
            return (
              <div
                key={s.title}
                data-state={state}
                aria-hidden={i !== active}
                className={cn("scene absolute inset-0", t.bg)}
                style={{ zIndex: i + 1 }}
              >
                <span
                  aria-hidden
                  className={cn("scene-number pointer-events-none absolute -right-2 -bottom-4 font-display font-black select-none sm:-right-6 sm:-bottom-10", t.num)}
                >
                  0{i + 1}
                </span>
                <Container className="relative grid h-full grid-cols-1 content-center items-center gap-5 py-5 pr-12 sm:gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16 lg:pr-20">
                  <div>
                    <StepBadge index={i} />
                    <h3 className={cn("mt-3 font-display text-3xl leading-[1.05] font-semibold tracking-tight text-balance sm:mt-5 sm:text-5xl xl:text-6xl", t.title)}>
                      {s.title}
                    </h3>
                    <p className={cn("mt-3 max-w-md text-sm leading-relaxed text-pretty sm:mt-5 sm:text-lg", t.body)}>{s.body}</p>
                  </div>
                  <div
                    className="mx-auto w-full max-w-xl transition-transform duration-300 ease-out max-sm:[&_.how-panel]:min-h-[20rem] max-sm:[&_.how-panel]:p-4"
                    style={i === active && !reduced ? { transform: `translateY(${(0.5 - local) * 48}px)` } : undefined}
                  >
                    <StepVisual index={i} active={i === active} />
                  </div>
                </Container>
              </div>
            );
          })}

          {/* Navigasi titik: posisi langkah & lompat langsung */}
          <nav aria-label={tr("Langkah cara kerja", "How-it-works steps")} className="absolute top-1/2 right-3 z-20 flex -translate-y-1/2 flex-col gap-2.5 sm:right-6">
            {STEPS.map((s, i) => (
              <button
                key={s.title}
                type="button"
                onClick={() => jump(i)}
                aria-label={`${tr("Langkah", "Step")} ${i + 1}: ${s.title}`}
                aria-current={i === active ? "step" : undefined}
                className="group flex items-center justify-end gap-2"
              >
                <span
                  className={cn(
                    "hidden text-xs font-semibold whitespace-nowrap opacity-0 transition group-hover:opacity-100 lg:inline",
                    i === active && "opacity-100",
                    lightNav ? "text-white/80" : "text-hutan-950/70",
                  )}
                >
                  {s.title}
                </span>
                <span
                  className={cn(
                    "block rounded-full transition-all duration-500",
                    i === active ? "h-8 w-2.5" : "size-2.5",
                    lightNav ? (i === active ? "bg-emas-300" : "bg-white/35") : i === active ? "bg-hutan-900" : "bg-hutan-900/30",
                  )}
                />
              </button>
            ))}
          </nav>

          {/* Garis progres di dasar panggung */}
          <div className="absolute inset-x-0 bottom-0 z-20 h-1 bg-black/10">
            <div className={cn("h-full transition-[width] duration-150", lightNav ? "bg-emas-300" : "bg-hutan-800")} style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Bar pembagian hasil (contoh PRD); memanjang saat induk ber-`data-shown`. */
function SplitBar() {
  return (
    <div className="grow-x flex h-12 overflow-hidden rounded-2xl text-xs font-semibold sm:text-sm">
      <div className="flex w-[60.6%] items-center justify-center bg-hutan-800 text-white">{tr("Modal 1.000", "Capital 1,000")}</div>
      <div className="flex w-[15.8%] items-center justify-center bg-hutan-500 text-white">260</div>
      <div className="flex w-[21.7%] items-center justify-center bg-emas-400 text-hutan-950">{tr("357,5", "357.5")}</div>
      <div className="w-[1.9%] bg-emas-700" title={tr("Dana cadangan 32,5", "Reserve fund 32.5")} />
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
          <p className="text-xs font-semibold tracking-[0.18em] text-emas-300 uppercase">{tr("Agen AI verifikator", "AI verifier agent")}</p>
          <h2 className="mt-2 font-display text-3xl font-semibold text-balance sm:text-4xl">{tr("Pemeriksa lapangan yang punya identitas dan rekam jejak", "A field inspector with an identity and a track record")}</h2>
          <p className="mt-4 max-w-xl leading-relaxed text-pretty text-white/70">
            {tr(
              "Agen kami terdaftar di registri identitas ERC-8004 dan memakai dompetnya sendiri, terpisah dari admin, koperasi, dan petani. Setiap putusan disertai alasan yang bisa dibaca siapa saja, dan statistiknya tidak bisa dihapus.",
              "Our agent is registered in the ERC-8004 identity registry and uses its own wallet, separate from the admin, cooperatives, and farmers. Every verdict comes with reasons anyone can read, and its statistics can't be erased.",
            )}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/agent" variant="gold">
              {tr("Lihat profil agen", "View agent profile")} <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
          </div>
        </Reveal>
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              icon: BadgeCheck,
              label: tr("Identitas", "Identity"),
              value: agent?.configured ? `#${agent.agentId.toString()}` : "…",
              sub: agent?.configured
                ? identityIsMock(agent.identityRegistry)
                  ? tr("registri cadangan (lokal)", "fallback registry (local)")
                  : tr("registri ERC-8004", "ERC-8004 registry")
                : undefined,
            },
            {
              icon: ShieldCheck,
              label: tr("Tingkat terima", "Approval rate"),
              value: agent?.configured && agent.stats.verdicts > 0 ? formatPercent(agent.stats.approvals / agent.stats.verdicts) : "–",
              sub: agent?.configured ? tr(`dari ${agent.stats.verdicts} foto`, `of ${agent.stats.verdicts} photos`) : undefined,
            },
            {
              icon: Bot,
              label: tr("Foto dicek", "Photos checked"),
              value: agent?.configured ? agent.stats.verdicts : "…",
              sub: agent?.configured
                ? tr(`${agent.stats.approvals} diterima · ${agent.stats.rejections} ditolak`, `${agent.stats.approvals} approved · ${agent.stats.rejections} rejected`)
                : undefined,
            },
            {
              icon: Scale,
              label: tr("Dikoreksi admin", "Overruled by admin"),
              value: agent?.configured ? agent.stats.overturned : "…",
              sub: tr("putusan AI yang dikoreksi", "AI verdicts corrected"),
            },
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
      aria-label={tr("Proyek tanam pilihan", "Featured crop projects")}
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
          e.currentTarget.dataset.moved = "0";
          setDrag({ x0: e.clientX, dx: 0 });
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag) return;
          const dx = e.clientX - drag.x0;
          if (Math.abs(dx) > 6) {
            moved.current = true;
            // Ditandai di DOM agar loader navigasi tidak menganggap seretan sebagai klik tautan.
            e.currentTarget.dataset.moved = "1";
          }
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
              aria-label={tr(`${i + 1} dari ${n}`, `${i + 1} of ${n}`)}
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
            aria-label={tr("Proyek sebelumnya", "Previous project")}
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
                aria-label={tr(`Tampilkan proyek ${i + 1}`, `Show project ${i + 1}`)}
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
            aria-label={tr("Proyek berikutnya", "Next project")}
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
        <p className="text-xs font-semibold tracking-[0.18em] text-emas-300 uppercase">{tr("Proyek pilihan", "Featured project")}</p>
        <h3 className="font-display text-xl leading-snug font-semibold text-balance">{meta?.title ?? `${trTerm(c.commodity)} ${tr("di", "in")} ${c.locationName}`}</h3>
        <ProgressBar value={c.raisedAmount} max={c.targetAmount} dark />
        <div className="flex items-baseline justify-between text-sm text-white/70">
          <span>
            <span className="font-semibold text-white">{formatUsdt(c.raisedAmount)}</span> {tr("dari", "of")} {formatUsdt(c.targetAmount)} USDT
          </span>
          <span className="font-semibold text-emas-300">{pct}%</span>
        </div>
        <div className="flex items-center justify-between border-t border-white/10 pt-3 text-sm">
          <span className="text-white/60">{tr("Proyeksi imbal hasil", "Projected return")}</span>
          <span className="font-semibold text-emas-200">{formatPercent(projectedInvestorReturn(c.targetAmount, c.estimatedRevenue))} / {tr("musim", "season")}</span>
        </div>
      </div>
    </Link>
  );
}
