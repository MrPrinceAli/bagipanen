"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  CloudSun,
  Copy,
  Database,
  ExternalLink,
  FileCheck2,
  Fingerprint,
  MapPin,
  ScanEye,
  ShieldCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/BrandLogos";
import { VerdictSummary } from "@/components/campaign/Timeline";
import { AddressLink, IpfsImage, TxLink } from "@/components/common";
import { Reveal } from "@/components/scroll";
import { Container, cn, EmptyState, Loading, Notice, PageBody, PageHero, SectionTitle } from "@/components/ui";
import { REPUTATION_REGISTRY } from "@/lib/addresses";
import { useAgentReputation } from "@/lib/agentReputation";
import { useCampaignList, useIpfsJson } from "@/lib/campaigns";
import { AGENT_WORKFLOW_URL, explorerAddressUrl, REPO_URL } from "@/lib/config";
import { formatDateTime, formatPercent, shortAddress } from "@/lib/format";
import { INDONESIA_PATH, MAP_HEIGHT, MAP_WIDTH, NEIGHBORS_PATH, projectToMap } from "@/lib/indonesiaMap";
import { identityIsMock, tokenUriHref, useAgentProfile, useRecentVerdicts, type VerdictEntry } from "@/lib/registry";
import type { VerdictDocument } from "@/lib/types";

const METHOD_LABEL: Record<string, string> = {
  "vision-llm": "Penilaian foto dengan AI",
  "exif-gps-check": "Cek GPS & tanggal foto",
  "weather-open-meteo": "Cuaca 14 hari (Open-Meteo)",
  "duplicate-hash": "Deteksi foto daur ulang",
};

const PIPELINE: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Database, title: "Baca proyek", body: "Komoditas, lokasi, tahap, dan perkiraan panen dari kontrak." },
  { icon: Fingerprint, title: "Sidik jari foto", body: "Foto diunduh dari IPFS, lalu dihitung SHA-256-nya." },
  { icon: Copy, title: "Cek daur ulang", body: "Foto yang sama tidak boleh dipakai di proyek atau tahap lain." },
  { icon: MapPin, title: "GPS & tanggal", body: "Maksimal 2 km dari lahan dan diambil ≤ 7 hari sebelum dikirim." },
  { icon: CloudSun, title: "Cuaca 14 hari", body: "Hujan & suhu di koordinat lahan dari Open-Meteo." },
  { icon: ScanEye, title: "Gemini Vision", body: "Jenis tanaman, fase, kondisi, dan tingkat keyakinan." },
  { icon: FileCheck2, title: "Putusan onchain", body: "Alasan disimpan di IPFS, putusan dicatat ke kontrak." },
];

/* ============================================================ Data tambahan */

type WorkflowRun = { status: string; conclusion: string | null; created_at: string; updated_at: string; html_url: string };

/** Putaran terakhir agen di GitHub Actions (API publik, tanpa token). */
function useLastAgentRun() {
  const repo = REPO_URL.replace("https://github.com/", "");
  return useQuery({
    queryKey: ["agentLastRun"],
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: false,
    queryFn: async (): Promise<WorkflowRun | null> => {
      const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/agent.yml/runs?per_page=1`);
      if (!res.ok) return null;
      return ((await res.json()) as { workflow_runs?: WorkflowRun[] }).workflow_runs?.[0] ?? null;
    },
  });
}

function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return "baru saja";
  if (s < 3600) return `${Math.round(s / 60)} menit lalu`;
  if (s < 86400) return `${Math.round(s / 3600)} jam lalu`;
  return `${Math.round(s / 86400)} hari lalu`;
}

/* ============================================================ Aktivitas terbaru */

type Step = { icon: LucideIcon; label: string; detail: string; tone: "green" | "gold" | "sky" | "violet" | "red" | "stone" };

const TONE: Record<Step["tone"], string> = {
  green: "bg-hutan-100 text-hutan-700",
  gold: "bg-emas-100 text-emas-700",
  sky: "bg-sky-100 text-sky-700",
  violet: "bg-violet-100 text-violet-700",
  red: "bg-red-100 text-red-700",
  stone: "bg-stone-100 text-stone-500",
};

/** Langkah pemeriksaan untuk satu putusan, disusun dari dokumen putusan sungguhan di IPFS. */
function buildSteps(d: VerdictDocument): Step[] {
  const vis = d.vision;
  const w = d.weather;
  const num = (x: number | undefined | null) => (x == null ? "?" : x.toLocaleString("id-ID", { maximumFractionDigits: 1 }));
  return [
    { icon: Fingerprint, label: "Foto diterima", detail: "Diunduh dari IPFS, sidik jari SHA-256 dihitung", tone: "stone" },
    {
      icon: Copy,
      label: d.duplicate ? "Foto daur ulang!" : "Foto asli",
      detail: d.duplicate ? "Pernah dipakai di proyek atau tahap lain" : "Belum pernah dipakai sebelumnya",
      tone: d.duplicate ? "red" : "green",
    },
    {
      icon: MapPin,
      label: "GPS & tanggal",
      detail: d.exif?.status === "ok" ? `${num(d.exif.distanceKm)} km dari lahan, tanggal cocok` : d.exif?.status === "mismatch" ? "Tidak cocok dengan lahan" : "Tidak ada di foto, dicatat saja",
      tone: d.exif?.status === "mismatch" ? "red" : d.exif?.status === "ok" ? "green" : "stone",
    },
    { icon: CloudSun, label: "Cuaca 14 hari", detail: w ? `Hujan ${num(w.precip14dMm)} mm${w.extreme ? " · ada hujan ekstrem" : ""}` : "Open-Meteo", tone: "sky" },
    {
      icon: ScanEye,
      label: "Gemini Vision",
      detail: vis ? `${vis.detected_commodity ?? "?"}, fase ${vis.detected_stage ?? "?"}, kondisi ${vis.plant_condition ?? "?"}` : "Menilai isi foto",
      tone: "violet",
    },
  ];
}

/** Kartu "Aktivitas terbaru": foto bukti + langkah pemeriksaan yang tercentang satu per satu, berulang. */
function ActivityFeed({ verdict }: { verdict: VerdictEntry | undefined }) {
  const { data: doc } = useIpfsJson<VerdictDocument>(verdict?.reasonCID);
  const steps = doc ? buildSteps(doc) : [];
  const [done, setDone] = useState(0);
  const total = steps.length + 1; // + putusan

  useEffect(() => {
    if (!doc) return;
    const t = setTimeout(() => setDone((n) => (n >= total + 3 ? 0 : n + 1)), done === 0 ? 700 : 650);
    return () => clearTimeout(t);
  }, [doc, done, total]);

  const conf = doc?.vision?.confidence;
  return (
    <div className="overflow-hidden rounded-[1.75rem] bg-white/85 shadow-[0_30px_70px_-30px_rgb(19_46_34/0.45)] ring-1 ring-krem-200 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 border-b border-krem-200 px-5 py-3.5">
        <p className="flex items-center gap-2 text-sm font-semibold text-hutan-950">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-hutan-400 opacity-70" />
            <span className="relative inline-flex size-2 rounded-full bg-hutan-500" />
          </span>
          Aktivitas terbaru
        </p>
        {verdict && <span className="text-xs text-stone-500">{formatDateTime(verdict.timestamp)}</span>}
      </div>
      <div className="grid gap-0 sm:grid-cols-[11rem_1fr]">
        <div className="relative h-40 bg-hutan-100 sm:h-auto">
          {doc?.proofCID ? (
            <IpfsImage cid={doc.proofCID} alt={verdict ? `Foto bukti ${verdict.commodity} tahap ${verdict.milestoneName}` : "Foto bukti"} className="absolute inset-0 h-full rounded-none" link={false} />
          ) : (
            <div className="absolute inset-0 animate-pulse bg-hutan-100" />
          )}
          {["top-3 left-3 border-t-2 border-l-2", "top-3 right-3 border-t-2 border-r-2", "bottom-3 left-3 border-b-2 border-l-2", "right-3 bottom-3 border-r-2 border-b-2"].map((c) => (
            <span key={c} className={cn("absolute size-4 rounded-sm border-white/90", c)} aria-hidden />
          ))}
          {done > 0 && done <= steps.length && <span className="scan-line pointer-events-none absolute inset-x-0 h-10" aria-hidden />}
          {verdict && (
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-hutan-900 shadow">
              {verdict.commodity} · {verdict.milestoneName}
            </span>
          )}
        </div>
        <ol className="relative flex flex-col gap-3 p-5">
          {(doc ? steps : Array.from({ length: 5 }, () => null)).map((st, i) => {
            const on = i < done;
            return (
              <li key={i} className={cn("flex items-start gap-3 transition duration-500", on ? "opacity-100" : "opacity-35")}>
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-full transition", st && on ? TONE[st.tone] : "bg-stone-100 text-stone-400")}>
                  {st ? on ? <Check className="size-4" aria-hidden /> : <st.icon className="size-4" aria-hidden /> : null}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-hutan-950">{st?.label ?? "…"}</p>
                  <p className="truncate text-xs text-stone-500">{st?.detail ?? "memuat"}</p>
                </div>
              </li>
            );
          })}
          <li
            className={cn(
              "mt-1 flex items-center justify-between gap-3 rounded-2xl px-4 py-3 transition duration-500",
              done >= total ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
              verdict?.approved ? "bg-hutan-900 text-white" : "bg-red-600 text-white",
            )}
          >
            <span className="flex items-center gap-2 font-semibold">
              {verdict?.approved ? <Check className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
              {verdict?.approved ? "Disetujui" : "Ditolak"}
              {conf !== undefined && <span className="font-normal text-white/70">· yakin {Math.round(conf * 100)}%</span>}
            </span>
            {verdict && (
              <Link href={`/campaign/${verdict.campaign}`} className="text-xs font-semibold text-emas-300 hover:text-emas-200">
                Lihat proyek →
              </Link>
            )}
          </li>
        </ol>
      </div>
    </div>
  );
}

/* ============================================================ Cincin angka */

function Ring({ value, label, sub, tone = "gold" }: { value: number | null; label: string; sub: string; tone?: "gold" | "green" | "sky" | "stone" }) {
  const color = { gold: "#e6b043", green: "#3d855d", sky: "#0ea5e9", stone: "#a8a29e" }[tone];
  const pct = value === null ? 0 : Math.max(0, Math.min(1, value));
  return (
    <div className="flex items-center gap-4 rounded-3xl bg-white p-5 shadow-soft ring-1 ring-krem-200">
      <div
        className="relative grid size-20 shrink-0 place-items-center rounded-full"
        style={{ background: `conic-gradient(${color} ${pct * 360}deg, #efe6d3 0)` }}
        role="img"
        aria-label={`${label}: ${value === null ? "belum ada data" : formatPercent(pct)}`}
      >
        <div className="grid size-[3.9rem] place-items-center rounded-full bg-white">
          <span className="font-display text-lg font-semibold text-hutan-950">{value === null ? "–" : formatPercent(pct)}</span>
        </div>
      </div>
      <div>
        <p className="font-semibold text-hutan-950">{label}</p>
        <p className="text-xs leading-relaxed text-stone-500">{sub}</p>
      </div>
    </div>
  );
}

/* ============================================================ Peta cakupan */

function CoverageMap() {
  const { data: campaigns } = useCampaignList();
  const pins = campaigns ?? [];
  return (
    <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className="block h-auto w-full" role="img" aria-label="Lahan yang diperiksa agen">
      <path d={NEIGHBORS_PATH} fill="#ffffff" fillOpacity="0.04" />
      <path d={INDONESIA_PATH} fill="#1f4d36" stroke="#5fa27b" strokeOpacity="0.5" strokeWidth="0.6" />
      {pins.map((c) => {
        const { x, y } = projectToMap(c.latE6 / 1e6, c.lonE6 / 1e6);
        return (
          <g key={c.address}>
            <circle cx={x} cy={y} r="14" fill="#edc56a" opacity="0.18" className="animate-ping [transform-box:fill-box] [transform-origin:center]" />
            <circle cx={x} cy={y} r="5.5" fill="#edc56a" stroke="#0b1d15" strokeWidth="2" />
          </g>
        );
      })}
    </svg>
  );
}

/* ============================================================ Putusan */

function VerdictCard({ v }: { v: VerdictEntry }) {
  const { data: doc } = useIpfsJson<VerdictDocument>(v.reasonCID);
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-soft ring-1 ring-krem-200 sm:flex-row">
      <div className="relative h-44 shrink-0 bg-hutan-900 sm:h-auto sm:w-44">
        {doc?.proofCID ? (
          <IpfsImage cid={doc.proofCID} alt={`Foto bukti ${v.commodity} tahap ${v.milestoneName}`} className="absolute inset-0 h-full rounded-none" link={false} />
        ) : (
          <div className="absolute inset-0 animate-pulse bg-hutan-800" />
        )}
        <span
          className={cn(
            "absolute top-3 left-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold shadow",
            v.approved ? "bg-hutan-600 text-white" : "bg-red-600 text-white",
          )}
        >
          {v.approved ? <Check className="size-3.5" aria-hidden /> : <X className="size-3.5" aria-hidden />}
          {v.approved ? "Diterima" : "Ditolak"}
        </span>
        {doc?.vision?.confidence !== undefined && (
          <span className="absolute right-3 bottom-3 rounded-full bg-hutan-950/75 px-2 py-0.5 font-mono text-[10px] text-emas-200 backdrop-blur">
            yakin {Math.round(doc.vision.confidence * 100)}%
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <div>
          <Link href={`/campaign/${v.campaign}`} className="font-display text-lg leading-snug font-semibold text-hutan-950 hover:text-hutan-700">
            {v.commodity} · tahap {v.milestoneName}
          </Link>
          <p className="text-xs text-stone-500">
            Proyek {shortAddress(v.campaign)} · {formatDateTime(v.timestamp)}
          </p>
        </div>
        {v.reasonCID && <VerdictSummary cid={v.reasonCID} ctx={{ commodity: v.commodity, milestone: v.milestoneName }} />}
        <TxLink hash={v.txHash} className="mt-auto" />
      </div>
    </div>
  );
}

/* ============================================================ Halaman */

export default function AgentPage() {
  const { data: agent, isLoading } = useAgentProfile();
  const { data: verdicts } = useRecentVerdicts(10);
  const { data: campaigns } = useCampaignList();
  const { data: run } = useLastAgentRun();
  const coops = campaigns ? [...new Map(campaigns.map((c) => [c.cooperative.toLowerCase(), c.cooperative])).values()] : undefined;
  const { data: rep } = useAgentReputation(agent?.configured ? agent.agentId : undefined, coops);

  if (isLoading || !agent || !agent.configured)
    return (
      <>
        <PageHero eyebrow="Agen AI" title="Agen verifikator lapangan" />
        <PageBody>
          {isLoading || !agent ? (
            <Loading>Membaca identitas agen dari blockchain…</Loading>
          ) : (
            <Notice tone="warn">Agen verifikator belum diatur. Admin perlu mendaftarkan agennya dulu (di mode lokal cukup jalankan npm run dev:chain).</Notice>
          )}
        </PageBody>
      </>
    );

  const mock = identityIsMock(agent.identityRegistry);
  const card = agent.card;
  const s = agent.stats;
  const approvalRate = s.verdicts > 0 ? s.approvals / s.verdicts : null;
  const correctionRate = s.verdicts > 0 ? s.overturned / s.verdicts : null;
  const registryUrl = explorerAddressUrl(agent.identityRegistry);

  return (
    <>
      {/* ------------------------------------------------- Hero: dashboard aktivitas */}
      <section className="relative overflow-hidden border-b border-krem-200 bg-[#f6f8f4]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgb(19_46_34/0.09)_1px,transparent_1.4px)] bg-[size:22px_22px]" aria-hidden />
        <div className="pointer-events-none absolute -top-32 -left-24 size-[28rem] rounded-full bg-hutan-200/50 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -right-20 -bottom-40 size-[30rem] rounded-full bg-emas-200/60 blur-3xl" aria-hidden />
        <Container className="relative grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-hutan-800 shadow-soft ring-1 ring-hutan-200">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-hutan-400 opacity-70" />
                <span className="relative inline-flex size-2 rounded-full bg-hutan-500" />
              </span>
              Online
              {run && (
                <span className="font-normal text-stone-500">
                  · {run.status !== "completed" ? "sedang memeriksa" : `putaran terakhir ${timeAgo(run.updated_at)}`}
                </span>
              )}
            </span>
            <h1 className="mt-5 text-4xl leading-[1.08] font-extrabold tracking-tight text-balance text-hutan-950 sm:text-5xl xl:text-[3.5rem]">
              Agen AI yang memeriksa{" "}
              <span className="bg-linear-to-r from-hutan-600 via-hutan-500 to-emas-500 bg-clip-text text-transparent">setiap foto lahan</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-pretty text-stone-600">
              {card?.description ??
                "Agen ini memeriksa setiap foto bukti dari lahan sebelum dana tahap boleh cair. Identitasnya tercatat di blockchain, dan semua putusannya bisa dibaca siapa saja."}
            </p>
            <dl className="mt-6 flex flex-wrap gap-2 text-sm">
              {[
                { k: "Agen", v: `#${agent.agentId.toString()}` },
                { k: "Dompet", v: shortAddress(agent.agentWallet) },
                { k: "Registri", v: mock ? "cadangan (lokal)" : "ERC-8004 resmi" },
              ].map(({ k, v }) => (
                <div key={k} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 shadow-soft ring-1 ring-krem-200">
                  <dt className="text-stone-500">{k}</dt>
                  <dd className="font-semibold text-hutan-950">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href={AGENT_WORKFLOW_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-hutan-900 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-hutan-800"
              >
                <BrandLogo name="github" /> Log kerja agen
              </a>
              {registryUrl && (
                <a
                  href={registryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-hutan-900 shadow-soft ring-1 ring-krem-300 transition hover:bg-krem-50"
                >
                  Registri ERC-8004 <ExternalLink className="size-4" aria-hidden />
                </a>
              )}
            </div>
          </div>
          <div className="animate-fade-up [animation-delay:150ms]">
            <ActivityFeed verdict={verdicts?.[0]} />
          </div>
        </Container>
      </section>

      <div className="flex flex-col gap-16 py-14 sm:gap-20 sm:py-20">
        {/* ----------------------------------------------------------- Angka */}
        <Container>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { value: approvalRate, label: "Tingkat diterima", sub: `${s.approvals} dari ${s.verdicts} foto disetujui`, tone: "green" as const },
              {
                value: rep?.agreement ?? null,
                label: "Kesepakatan koperasi",
                sub: rep ? `${rep.count} penilaian di ERC-8004 Reputation` : "membaca registri reputasi…",
                tone: "gold" as const,
              },
              { value: s.verdicts > 0 ? s.rejections / s.verdicts : null, label: "Tingkat ditolak", sub: `${s.rejections} foto tidak lolos pemeriksaan`, tone: "sky" as const },
              { value: correctionRate, label: "Dikoreksi admin", sub: `${s.overturned} putusan dibatalkan saat sengketa`, tone: "stone" as const },
            ].map((r, i) => (
              <Reveal key={r.label} delay={i * 80}>
                <Ring {...r} />
              </Reveal>
            ))}
          </div>
        </Container>

        {/* -------------------------------------------------------- Pipeline */}
        <Container>
          <Reveal>
            <SectionTitle eyebrow="Cara kerja agen" description="Tujuh langkah yang dijalankan untuk setiap foto bukti, otomatis, tanpa campur tangan manusia.">
              Dari foto masuk sampai putusan onchain
            </SectionTitle>
          </Reveal>
          <ol className="relative mt-8 grid gap-4 lg:grid-cols-7 lg:gap-3">
            <span className="pipe-flow absolute top-9 right-[7%] left-[7%] hidden h-1 rounded-full opacity-60 lg:block" aria-hidden />
            <span className="pipe-flow-y absolute top-4 bottom-4 left-9 w-1 rounded-full opacity-50 lg:hidden" aria-hidden />
            {PIPELINE.map((p, i) => (
              <Reveal as="li" key={p.title} delay={i * 70} className="relative flex gap-4 lg:flex-col lg:items-center lg:gap-3 lg:text-center">
                <span className="relative z-10 grid size-[4.5rem] shrink-0 place-items-center rounded-2xl bg-hutan-950 text-emas-300 shadow-lift ring-4 ring-krem-50">
                  <p.icon className="size-7" aria-hidden />
                  <span className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-emas-400 font-mono text-[11px] font-bold text-hutan-950">{i + 1}</span>
                </span>
                <div className="pt-1 lg:pt-0">
                  <p className="font-semibold text-hutan-950">{p.title}</p>
                  <p className="mt-1 text-sm leading-snug text-pretty text-stone-600">{p.body}</p>
                </div>
              </Reveal>
            ))}
          </ol>
          <Reveal>
            <div className="mt-8 flex flex-col gap-3 rounded-3xl bg-hutan-950 p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <p className="max-w-3xl text-sm leading-relaxed text-pretty text-white/75">
                <span className="font-semibold text-emas-300">Aturan putusan:</span> foto diterima hanya kalau benar foto lahan, tanaman dan fasenya cocok, AI
                cukup yakin (minimal 70%), lokasi dan tanggalnya tidak bertentangan, dan foto itu belum pernah dipakai.
              </p>
              <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold">
                <BrandLogo name="gemini" /> Gemini menilai, aturan memutuskan
              </span>
            </div>
          </Reveal>
        </Container>

        {/* ------------------------------------------------------- Cakupan */}
        <Container>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <Reveal className="h-full">
              <div className="flex h-full flex-col overflow-hidden rounded-3xl bg-[radial-gradient(120%_90%_at_50%_20%,#0f3a28_0%,#0b2a1d_45%,#071710_100%)] p-5 text-white shadow-lift sm:p-6">
                <p className="text-xs font-semibold tracking-[0.18em] text-emas-300 uppercase">Wilayah kerja</p>
                <p className="mt-1 font-display text-2xl font-semibold">Lahan yang diawasi agen</p>
                <div className="my-auto py-4">
                  <CoverageMap />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(card?.bagipanen?.regions ?? []).map((r) => (
                    <span key={r} className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/85 ring-1 ring-white/10">
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </Reveal>
            <Reveal delay={100} className="h-full">
              <div className="flex h-full flex-col gap-5 rounded-3xl bg-white p-5 shadow-soft ring-1 ring-krem-200 sm:p-6">
                <div>
                  <p className="text-xs font-semibold tracking-[0.18em] text-emas-600 uppercase">Isi agent card</p>
                  <p className="mt-1 text-sm text-stone-600">Data yang diumumkan agen tentang dirinya di registri ERC-8004, bisa dibaca aplikasi lain.</p>
                </div>
                {agent.cardError ? (
                  <p className="text-sm text-red-700">{agent.cardError}</p>
                ) : !card ? (
                  <Loading />
                ) : (
                  <>
                    {[
                      { k: "Komoditas", items: card.bagipanen?.commodities ?? [], cls: "bg-emas-50 text-emas-800 ring-emas-200" },
                      { k: "Metode", items: (card.bagipanen?.methods ?? []).map((m) => METHOD_LABEL[m] ?? m), cls: "bg-hutan-50 text-hutan-800 ring-hutan-200" },
                    ].map((g) => (
                      <div key={g.k}>
                        <p className="mb-2 text-xs font-semibold tracking-wide text-stone-500 uppercase">{g.k}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {g.items.map((x) => (
                            <span key={x} className={cn("rounded-full px-2.5 py-1 text-xs font-semibold ring-1", g.cls)}>
                              {x}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    <div>
                      <p className="mb-2 text-xs font-semibold tracking-wide text-stone-500 uppercase">
                        Koperasi mitra ({card.bagipanen?.partnerCooperatives?.length ?? 0})
                      </p>
                      <ul className="grid gap-1 text-sm text-stone-700 sm:grid-cols-2">
                        {(card.bagipanen?.partnerCooperatives ?? []).map((c) => (
                          <li key={c} className="flex items-start gap-1.5">
                            <Check className="mt-0.5 size-3.5 shrink-0 text-hutan-500" aria-hidden />
                            <span className="text-pretty">{c.replace(/^Koperasi Tani /, "")}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <details className="mt-auto text-xs">
                      <summary className="cursor-pointer font-semibold text-hutan-700 hover:text-hutan-900">Lihat JSON lengkap</summary>
                      <pre className="mt-2 max-h-72 overflow-auto rounded-2xl bg-hutan-950 p-4 text-emas-100">{JSON.stringify(card, null, 2)}</pre>
                    </details>
                    {agent.tokenURI && (
                      <a
                        href={tokenUriHref(agent.tokenURI)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-[11px] break-all text-stone-500 hover:text-hutan-700"
                      >
                        {agent.tokenURI} <ExternalLink className="size-3 shrink-0" aria-hidden />
                      </a>
                    )}
                  </>
                )}
              </div>
            </Reveal>
          </div>
        </Container>

        {/* -------------------------------------------------- Reputasi ERC-8004 */}
        {REPUTATION_REGISTRY && (
          <Container>
            <Reveal>
              <div className="relative overflow-hidden rounded-[2rem] bg-linear-to-br from-emas-300 via-emas-400 to-emas-500 p-6 text-hutan-950 sm:p-10">
                <ShieldCheck className="absolute -right-8 -bottom-10 size-56 text-hutan-950/10" aria-hidden />
                <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,1.4fr)_auto]">
                  <div>
                    <p className="text-xs font-bold tracking-[0.18em] uppercase">Reputasi di ERC-8004</p>
                    <h2 className="mt-2 font-display text-3xl font-semibold text-balance sm:text-4xl">Dinilai koperasi, tercatat di registri resmi</h2>
                    <p className="mt-3 max-w-2xl leading-relaxed text-pretty text-hutan-950/75">
                      Setiap kali koperasi memutuskan satu tahap, koperasi mencatat apakah ia sepakat dengan putusan agen. Catatannya tersimpan di Reputation
                      Registry ERC-8004, terpisah dari BagiPanen, sehingga rekam jejak agen bisa dibaca aplikasi lain. Yang dihitung hanya penilaian dari{" "}
                      {coops?.length ?? "…"} koperasi pendamping proyek.
                    </p>
                    <p className="mt-4 text-sm">
                      Registri <AddressLink address={REPUTATION_REGISTRY} className="text-hutan-950" />
                    </p>
                  </div>
                  <div className="mx-auto grid size-48 place-items-center rounded-full bg-hutan-950 text-center shadow-lift ring-8 ring-hutan-950/10">
                    <div>
                      <p className="font-display text-5xl font-semibold text-emas-300">{rep?.agreement == null ? "–" : formatPercent(rep.agreement)}</p>
                      <p className="mt-1 px-6 text-xs text-white/70">{rep ? `kesepakatan dari ${rep.count} penilaian` : "memuat…"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </Container>
        )}

        {/* ------------------------------------------------------- Putusan */}
        <Container>
          <Reveal>
            <SectionTitle
              eyebrow="Jejak putusan"
              description="Sepuluh foto terakhir yang dinilai agen, lengkap dengan foto bukti, alasan, dan transaksinya."
              action={
                <Link href="/proyek" className="inline-flex items-center gap-1 text-sm font-semibold text-hutan-700 hover:text-hutan-900">
                  Lihat proyeknya <ArrowRight className="size-4" aria-hidden />
                </Link>
              }
            >
              Putusan terbaru
            </SectionTitle>
          </Reveal>
          {!verdicts ? (
            <Loading>Membaca putusan dari blockchain…</Loading>
          ) : verdicts.length === 0 ? (
            <EmptyState icon={ScanEye} title="Belum ada putusan" />
          ) : (
            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              {verdicts.map((v, i) => (
                <Reveal key={`${v.txHash}-${v.index}`} delay={(i % 2) * 80} className="h-full">
                  <VerdictCard v={v} />
                </Reveal>
              ))}
            </div>
          )}
        </Container>
      </div>
    </>
  );
}
