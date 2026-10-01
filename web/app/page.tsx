"use client";

import {
  ArrowRight,
  BadgeCheck,
  Bot,
  Camera,
  FileSignature,
  HandCoins,
  Landmark,
  LockKeyhole,
  MapPin,
  PieChart,
  Scale,
  ScrollText,
  ShieldCheck,
  Sprout,
  Users,
  Wheat,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { CampaignCard, CampaignCover, fundedPercent } from "@/components/CampaignCard";
import { StatusBadge } from "@/components/common";
import { ButtonLink, Card, Container, cn, EmptyState, IconBubble, Notice, ProgressBar, SectionTitle, Skeleton, Stat } from "@/components/ui";
import { useCampaignList, useIpfsJson, useReserveBalance } from "@/lib/campaigns";
import { IS_LOCAL } from "@/lib/config";
import { formatPercent, formatRupiah, formatUsdt, projectedInvestorReturn } from "@/lib/format";
import { identityIsMock, useAgentProfile, useRegistrations } from "@/lib/registry";
import { useRole } from "@/lib/role";
import { type CampaignMetadata, type CampaignSummary, FailType, Status } from "@/lib/types";
import heroImage from "@/public/hero-lahan.jpg";

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
  const { data: agent } = useAgentProfile();
  const { data: regs } = useRegistrations();
  const { role } = useRole();
  const [filter, setFilter] = useState<FilterKey>("all");

  const all = campaigns ?? [];
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
  const featured =
    visible.find((c) => c.status === Status.Funding) ?? visible.find((c) => c.status === Status.Active) ?? visible[0];

  return (
    <>
      {/* ------------------------------------------------------------ Hero */}
      <section className="relative isolate overflow-hidden bg-hutan-950 text-white">
        <Image
          src={heroImage}
          alt=""
          fill
          sizes="100vw"
          placeholder="blur"
          loading="eager"
          fetchPriority="high"
          className="-z-20 object-cover object-center opacity-45"
        />
        <div className="absolute inset-0 -z-10 bg-linear-to-b from-hutan-950/70 via-hutan-950/70 to-hutan-950" aria-hidden />
        <div className="glow-hutan absolute inset-0 -z-10" aria-hidden />

        <Container className="pt-14 pb-12 sm:pt-20 lg:pt-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1.25fr_1fr]">
            <div className="animate-fade-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emas-300 opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-emas-300" />
                </span>
                {IS_LOCAL ? "Mode demo lokal" : "Sudah berjalan di BNB Smart Chain Testnet"}
              </span>
              <h1 className="mt-6 font-display text-[2.6rem] leading-[1.02] font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl">
                Modal tanam tanpa ijon.{" "}
                <span className="bg-linear-to-r from-emas-200 via-emas-300 to-emas-500 bg-clip-text text-transparent italic">Panen dibagi adil.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-pretty text-white/75">
                Kamu ikut mendanai satu musim tanam petani. Uangnya dikunci di smart contract dan baru cair per tahap setelah foto lahan
                dicek agen AI dan koperasi. Begitu panen terjual, modalmu kembali duluan, lalu untungnya dibagi.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/#kampanye" variant="gold" size="lg">
                  Lihat kampanye <ArrowRight className="size-4" aria-hidden />
                </ButtonLink>
                {role === "petani" ? (
                  <ButtonLink href="/create" variant="light" size="lg">
                    Ajukan kampanye
                  </ButtonLink>
                ) : (
                  <ButtonLink href="/#cara-kerja" variant="light" size="lg">
                    Begini cara kerjanya
                  </ButtonLink>
                )}
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/65">
                <li className="flex items-center gap-2">
                  <LockKeyhole className="size-4 text-emas-300" aria-hidden /> Dana dikunci di kontrak
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-emas-300" aria-hidden /> Dicek AI dan koperasi
                </li>
                <li className="flex items-center gap-2">
                  <ScrollText className="size-4 text-emas-300" aria-hidden /> Semua tercatat terbuka
                </li>
              </ul>
            </div>

            <div className="animate-fade-up [animation-delay:150ms]">
              {featured ? <FeaturedCampaign c={featured} /> : <Skeleton className="h-96 bg-white/10" />}
            </div>
          </div>

          <div className="mt-14 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              variant="glass"
              icon={HandCoins}
              label="Dana tersalurkan"
              value={campaigns ? `${formatUsdt(totalFunded)}` : "…"}
              sub={campaigns ? `USDT · sekitar ${formatRupiah(totalFunded)}` : "memuat dari blockchain"}
            />
            <Stat
              variant="glass"
              icon={Wheat}
              label="Kampanye aktif"
              value={campaigns ? activeCount : "…"}
              sub={campaigns ? `cari dana atau berjalan, dari ${visible.length} kampanye` : "memuat…"}
            />
            <Stat
              variant="glass"
              icon={Landmark}
              label="Dana cadangan"
              value={reserve === undefined ? "…" : formatUsdt(reserve)}
              sub="USDT untuk kompensasi gagal panen"
            />
            <Stat
              variant="glass"
              icon={Users}
              label="Petani"
              value={regs ? regs.farmers.length : "…"}
              sub={regs ? `didampingi ${regs.cooperatives.length} koperasi` : "memuat…"}
            />
          </div>
        </Container>
      </section>

      {/* ------------------------------------------------------- Kampanye */}
      <section id="kampanye" className="scroll-mt-24 py-16 sm:py-20">
        <Container>
          <SectionTitle
            eyebrow="Kampanye"
            description="Setiap kampanye adalah satu musim tanam satu petani, lengkap dengan rencana biaya dan perkiraan panennya."
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

          {isLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[26rem] rounded-3xl" />
              ))}
            </div>
          ) : isError ? (
            <Notice tone="error">Data kampanye belum bisa dibaca dari blockchain. Cek koneksi internetmu, lalu muat ulang halaman.</Notice>
          ) : shown.length === 0 ? (
            <EmptyState icon={Sprout} title={visible.length === 0 ? "Belum ada kampanye yang dibuka" : "Belum ada kampanye di kategori ini"}>
              {role === "petani" ? (
                <Link href="/create" className="font-semibold text-hutan-700 underline">
                  Ajukan kampanye pertamamu
                </Link>
              ) : (
                "Kampanye baru muncul di sini setelah petani mengajukan dan admin menyetujuinya."
              )}
            </EmptyState>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((c) => (
                <CampaignCard key={c.address} c={c} />
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
      <section id="cara-kerja" className="scroll-mt-24 border-y border-krem-200 bg-white py-16 sm:py-20">
        <Container>
          <SectionTitle eyebrow="Cara kerja" description="Tidak ada perantara yang memegang uangmu. Semua aturan main sudah ditulis di smart contract sejak awal.">
            Dari lahan sampai bagi hasil
          </SectionTitle>
          <ol className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: FileSignature,
                title: "Petani mengajukan",
                body: "Petani anggota koperasi menulis kebutuhan modal, rencana biaya, dan perkiraan panennya. Admin memeriksa dulu sebelum pendanaan dibuka.",
              },
              {
                icon: HandCoins,
                title: "Kamu ikut mendanai",
                body: "Danai berapa pun yang kamu mau. Setiap 1 USDT jadi 1 token porsi yang mencatat bagianmu dan tidak bisa dipindahtangankan.",
              },
              {
                icon: Camera,
                title: "Dana cair per tahap",
                body: "Tanam, tumbuh, pra-panen. Tiap tahap baru cair setelah foto lahan terbaru lolos pengecekan agen AI dan koperasi.",
              },
              {
                icon: PieChart,
                title: "Panen dibagi otomatis",
                body: "Hasil penjualan disetor ke kontrak. Modal investor kembali dulu, sisanya dibagi ke petani, investor, dan dana cadangan.",
              },
            ].map((s, i) => (
              <li key={s.title} className="relative flex flex-col gap-4 rounded-3xl border border-krem-200 bg-krem-50 p-6">
                <div className="flex items-center justify-between">
                  <IconBubble icon={s.icon} />
                  <span className="font-display text-4xl font-semibold text-krem-300">0{i + 1}</span>
                </div>
                <div>
                  <h3 className="font-display text-xl font-semibold text-hutan-950">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-stone-600">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* ------------------------------------------------- Dua kunci + bagi hasil */}
      <section className="py-16 sm:py-20">
        <Container className="grid gap-6 lg:grid-cols-2">
          <Card className="flex flex-col gap-6 p-6 sm:p-8">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-emas-600 uppercase">Dua kunci pencairan</p>
              <h2 className="mt-2 font-display text-3xl font-semibold text-hutan-950">Uang baru keluar kalau dua pihak setuju</h2>
              <p className="mt-2 text-stone-600">
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
            <div>
              <div className="flex h-12 overflow-hidden rounded-2xl text-sm font-semibold">
                <div className="flex w-[40%] items-center justify-center bg-hutan-800 text-white">Tanam 40%</div>
                <div className="flex w-[35%] items-center justify-center bg-hutan-600 text-white">Tumbuh 35%</div>
                <div className="flex w-[25%] items-center justify-center bg-emas-400 text-hutan-950">Pra-panen 25%</div>
              </div>
              <p className="mt-2 text-xs text-stone-500">Kalau ditolak tiga kali berturut-turut, admin yang memutuskan, dan keputusannya tercatat publik.</p>
            </div>
          </Card>

          <Card className="flex flex-col gap-6 p-6 sm:p-8">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-emas-600 uppercase">Bagi hasil</p>
              <h2 className="mt-2 font-display text-3xl font-semibold text-hutan-950">Modal kembali dulu, baru untung dibagi</h2>
              <p className="mt-2 text-stone-600">
                Contoh dari kampanye demo cabai merah: modal 1.000 USDT, panen terjual 1.650 USDT, jadi untungnya 650 USDT.
              </p>
            </div>
            <div className="flex h-12 overflow-hidden rounded-2xl text-xs font-semibold sm:text-sm">
              <div className="flex w-[60.6%] items-center justify-center bg-hutan-800 text-white">Modal 1.000</div>
              <div className="flex w-[15.8%] items-center justify-center bg-hutan-500 text-white">260</div>
              <div className="flex w-[21.7%] items-center justify-center bg-emas-400 text-hutan-950">357,5</div>
              <div className="w-[1.9%] bg-emas-700" title="Dana cadangan 32,5" />
            </div>
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
        </Container>
      </section>

      {/* ------------------------------------------------------- Agen AI */}
      <section className="glow-hutan relative overflow-hidden bg-hutan-950 py-16 text-white sm:py-20">
        <div className="pola-bedengan absolute inset-0" aria-hidden />
        <Container className="relative grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-emas-300 uppercase">Agen AI verifikator</p>
            <h2 className="mt-2 font-display text-3xl font-semibold text-balance sm:text-4xl">Pemeriksa lapangan yang punya identitas dan rekam jejak</h2>
            <p className="mt-4 max-w-xl leading-relaxed text-white/70">
              Agen kami terdaftar di registri identitas ERC-8004 dan memakai dompetnya sendiri, terpisah dari admin, koperasi, dan petani.
              Setiap putusan disertai alasan yang bisa dibaca siapa saja, dan statistiknya tidak bisa dihapus.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href="/agent" variant="gold">
                Lihat profil agen <ArrowRight className="size-4" aria-hidden />
              </ButtonLink>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Stat
              variant="glass"
              icon={BadgeCheck}
              label="Identitas"
              value={agent?.configured ? `#${agent.agentId.toString()}` : "…"}
              sub={agent?.configured ? (identityIsMock(agent.identityRegistry) ? "registri cadangan (lokal)" : "registri ERC-8004") : undefined}
            />
            <Stat
              variant="glass"
              icon={ShieldCheck}
              label="Tingkat terima"
              value={agent?.configured && agent.stats.verdicts > 0 ? formatPercent(agent.stats.approvals / agent.stats.verdicts) : "–"}
              sub={agent?.configured ? `dari ${agent.stats.verdicts} foto` : undefined}
            />
            <Stat
              variant="glass"
              icon={Bot}
              label="Foto dicek"
              value={agent?.configured ? agent.stats.verdicts : "…"}
              sub={agent?.configured ? `${agent.stats.approvals} diterima · ${agent.stats.rejections} ditolak` : undefined}
            />
            <Stat
              variant="glass"
              icon={Scale}
              label="Dikoreksi admin"
              value={agent?.configured ? agent.stats.overturned : "…"}
              sub="putusan AI yang dikoreksi"
            />
          </div>
        </Container>
      </section>

      {/* ----------------------------------------------------------- Ajakan */}
      <section className="py-16 sm:py-20">
        <Container>
          <div className="relative overflow-hidden rounded-[2rem] bg-linear-to-br from-emas-300 via-emas-400 to-emas-500 px-6 py-12 text-hutan-950 sm:px-12">
            <Wheat className="absolute -right-6 -bottom-8 size-48 text-hutan-950/10" aria-hidden />
            <h2 className="max-w-2xl font-display text-3xl font-semibold text-balance sm:text-4xl">Siap ikut menanam bersama petani?</h2>
            <p className="mt-3 max-w-xl text-hutan-950/75">
              Mulai dari nominal kecil. Semua langkahnya bisa kamu pantau sendiri, dari foto lahan sampai nota penjualan.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href="/#kampanye" variant="primary" size="lg">
                Pilih kampanye <ArrowRight className="size-4" aria-hidden />
              </ButtonLink>
              {role === "petani" && (
                <ButtonLink href="/create" variant="secondary" size="lg">
                  Ajukan kampanye
                </ButtonLink>
              )}
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}

/** Kartu kampanye unggulan di hero (gaya kaca). */
function FeaturedCampaign({ c }: { c: CampaignSummary }) {
  const { data: meta } = useIpfsJson<CampaignMetadata>(c.metadataCID);
  const pct = fundedPercent(c);
  return (
    <Link
      href={`/campaign/${c.address}`}
      className="group block overflow-hidden rounded-[2rem] border border-white/15 bg-white/[0.07] p-3 shadow-lift backdrop-blur-xl transition hover:bg-white/10"
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
        <p className="text-xs font-semibold tracking-[0.18em] text-emas-300 uppercase">Kampanye pilihan</p>
        <h3 className="font-display text-xl leading-snug font-semibold">{meta?.title ?? `${c.commodity} di ${c.locationName}`}</h3>
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
