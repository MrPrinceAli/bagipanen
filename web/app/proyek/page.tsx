"use client";

import { ChevronDown, MapPin, RotateCcw, Sprout } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CampaignCard } from "@/components/CampaignCard";
import { statusLabel } from "@/components/common";
import { Reveal } from "@/components/scroll";
import { cn, EmptyState, Notice, PageBody, PageHero, Skeleton } from "@/components/ui";
import { useCampaignList, useIpfsJson } from "@/lib/campaigns";
import { HIDDEN_FROM_HOME } from "@/lib/config";
import { INDONESIA_PATH, MAP_BOUNDS, MAP_HEIGHT, MAP_WIDTH, NEIGHBORS_PATH, projectToMap } from "@/lib/indonesiaMap";
import { type CampaignMetadata, type CampaignSummary, Status } from "@/lib/types";

const STATUS_FILTERS = [
  { key: "all", label: "Semua" },
  { key: "funding", label: "Cari dana" },
  { key: "active", label: "Berjalan" },
  { key: "done", label: "Selesai" },
] as const;
type StatusKey = (typeof STATUS_FILTERS)[number]["key"];

function statusKey(c: CampaignSummary): Exclude<StatusKey, "all"> {
  if (c.status === Status.Funding) return "funding";
  if (c.status === Status.Active) return "active";
  return "done";
}

/** Warna pin per status. */
function pinColor(c: CampaignSummary) {
  if (c.status === Status.Funding) return "#edc56a";
  if (c.status === Status.Active) return "#5fa27b";
  if (c.status === Status.Harvested) return "#f8f3e8";
  return "#ef6b5b";
}

/** "Rejoso, Nganjuk, Jawa Timur" → "Jawa Timur". */
const provinceOf = (c: CampaignSummary) => c.locationName.split(",").map((s) => s.trim()).at(-1) ?? c.locationName;

/* ===================================================================== Peta */

const PX_PER_DEG = MAP_WIDTH / (MAP_BOUNDS.lon1 - MAP_BOUNDS.lon0);
const ISLANDS = [
  { name: "SUMATRA", lat: -0.4, lon: 101.6, rot: -38 },
  { name: "KALIMANTAN", lat: -0.6, lon: 113.6, rot: 0 },
  { name: "JAWA", lat: -8.95, lon: 110.6, rot: 0 },
  { name: "SULAWESI", lat: -2.3, lon: 120.9, rot: 0 },
  { name: "MALUKU", lat: -3.6, lon: 128.6, rot: 0 },
  { name: "PAPUA", lat: -4.6, lon: 138.3, rot: 0 },
  { name: "NUSA TENGGARA", lat: -10.3, lon: 120.2, rot: 0 },
];

function MapTooltip({ c }: { c: CampaignSummary }) {
  const { data: meta } = useIpfsJson<CampaignMetadata>(c.metadataCID);
  const { x, y } = projectToMap(c.latE6 / 1e6, c.lonE6 / 1e6);
  const right = x > MAP_WIDTH * 0.62;
  return (
    <div
      className="pointer-events-none absolute z-20 w-60 rounded-2xl bg-white p-3 text-left shadow-lift ring-1 ring-krem-200"
      style={{
        left: `${(x / MAP_WIDTH) * 100}%`,
        top: `${((y - 18) / MAP_HEIGHT) * 100}%`,
        transform: `translate(${right ? "calc(-100% - 18px)" : "18px"}, -50%)`,
      }}
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: c.status === Status.Harvested ? "#8d5a1c" : undefined }}>
        <span className="size-2 rounded-full ring-1 ring-hutan-950/30" style={{ background: pinColor(c) }} aria-hidden />
        {statusLabel(c.status, c.failType)}
      </p>
      <p className="mt-1 text-sm leading-snug font-semibold text-hutan-950">{meta?.title ?? `${c.commodity} di ${c.locationName}`}</p>
      <p className="mt-1 flex items-center gap-1 text-xs text-stone-500">
        <MapPin className="size-3" aria-hidden /> {c.locationName}
      </p>
      <p className="mt-2 text-[11px] font-semibold text-hutan-700">Klik pin untuk membuka →</p>
    </div>
  );
}

function ProjectMap({ items, highlight }: { items: CampaignSummary[]; highlight: (c: CampaignSummary) => boolean }) {
  const router = useRouter();
  const [hover, setHover] = useState<CampaignSummary | null>(null);
  const lonLines = [95, 100, 105, 110, 115, 120, 125, 130, 135, 140];
  const latLines = [5, 0, -5, -10];
  const scale500 = (500 / 111.32) * PX_PER_DEG; // 500 km di khatulistiwa
  // Pin yang paling selatan digambar terakhir agar tumpukan pin tampak wajar.
  const ordered = [...items].sort((a, b) => b.latE6 - a.latE6);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className="block h-auto w-full" role="img" aria-label="Peta sebaran proyek tanam di Indonesia">
        <defs>
          <linearGradient id="map-land" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3d855d" />
            <stop offset="1" stopColor="#1f4d36" />
          </linearGradient>
          <filter id="map-lift" x="-5%" y="-5%" width="110%" height="120%">
            <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#000" floodOpacity="0.55" />
          </filter>
          <filter id="map-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.6" />
          </filter>
          <pattern id="map-waves" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(20)">
            <path d="M0 7 Q3.5 5 7 7 T14 7" stroke="#ffffff" strokeOpacity="0.035" fill="none" />
          </pattern>
        </defs>

        {/* Laut */}
        <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#map-waves)" />

        {/* Garis lintang & bujur */}
        <g stroke="#ffffff" strokeOpacity="0.06" strokeWidth="0.6" strokeDasharray="2 4">
          {lonLines.map((lon) => {
            const { x } = projectToMap(0, lon);
            return <line key={lon} x1={x} y1={0} x2={x} y2={MAP_HEIGHT} />;
          })}
          {latLines.map((lat) => {
            const { y } = projectToMap(lat, 0);
            return <line key={lat} x1={0} y1={y} x2={MAP_WIDTH} y2={y} />;
          })}
        </g>
        <g fill="#ffffff" fillOpacity="0.28" fontSize="8" fontFamily="ui-monospace, monospace">
          {lonLines.slice(1).map((lon) => (
            <text key={lon} x={projectToMap(0, lon).x + 3} y={11}>
              {lon}°BT
            </text>
          ))}
        </g>
        {(() => {
          const { y } = projectToMap(0, 0);
          return (
            <g>
              <line x1={0} y1={y} x2={MAP_WIDTH} y2={y} stroke="#edc56a" strokeOpacity="0.35" strokeWidth="0.8" strokeDasharray="6 5" />
              <text x={8} y={y - 4} fill="#edc56a" fillOpacity="0.6" fontSize="8" letterSpacing="2" fontFamily="ui-monospace, monospace">
                KHATULISTIWA 0°
              </text>
            </g>
          );
        })()}

        {/* Negara tetangga */}
        <path d={NEIGHBORS_PATH} fill="#ffffff" fillOpacity="0.045" stroke="#ffffff" strokeOpacity="0.08" strokeWidth="0.6" />

        {/* Indonesia: perairan dangkal, daratan timbul, garis pantai */}
        <path d={INDONESIA_PATH} fill="none" stroke="#3d855d" strokeOpacity="0.28" strokeWidth="7" strokeLinejoin="round" />
        <path d={INDONESIA_PATH} fill="url(#map-land)" filter="url(#map-lift)" />
        <path d={INDONESIA_PATH} fill="none" stroke="#8fc2a3" strokeOpacity="0.55" strokeWidth="0.6" strokeLinejoin="round" />

        {/* Nama pulau besar */}
        <g fill="#ffffff" fillOpacity="0.3" fontSize="10" fontWeight="700" letterSpacing="3" textAnchor="middle">
          {ISLANDS.map((l) => {
            const { x, y } = projectToMap(l.lat, l.lon);
            return (
              <text key={l.name} x={x} y={y} transform={l.rot ? `rotate(${l.rot} ${x} ${y})` : undefined}>
                {l.name}
              </text>
            );
          })}
        </g>

        {/* Mata angin */}
        <g transform={`translate(${MAP_WIDTH - 40} 44)`} opacity="0.7">
          <circle r="17" fill="#0b1d15" stroke="#ffffff" strokeOpacity="0.2" />
          <path d="M0 -13 L4 0 L0 13 L-4 0 Z" fill="#ffffff" fillOpacity="0.25" />
          <path d="M0 -13 L4 0 L-4 0 Z" fill="#edc56a" />
          <text y="-20" textAnchor="middle" fill="#edc56a" fontSize="8" fontWeight="700">
            U
          </text>
        </g>

        {/* Skala */}
        <g transform={`translate(${MAP_WIDTH - 24 - scale500} ${MAP_HEIGHT - 18})`} fill="#ffffff" fillOpacity="0.5" fontSize="8" fontFamily="ui-monospace, monospace">
          <rect width={scale500 / 2} height="3" fill="#ffffff" fillOpacity="0.55" />
          <rect x={scale500 / 2} width={scale500 / 2} height="3" fill="#ffffff" fillOpacity="0.2" />
          <text y="-4">0</text>
          <text x={scale500} y="-4" textAnchor="end">
            500 km
          </text>
        </g>

        {/* Pin proyek */}
        {ordered.map((c) => {
          const { x, y } = projectToMap(c.latE6 / 1e6, c.lonE6 / 1e6);
          const on = highlight(c);
          const isHover = hover?.address === c.address;
          const color = pinColor(c);
          return (
            <g
              key={c.address}
              role="link"
              tabIndex={0}
              aria-label={`${c.commodity} di ${c.locationName}, ${statusLabel(c.status, c.failType)}`}
              className="cursor-pointer outline-none"
              style={{ opacity: on ? 1 : 0.22, transition: "opacity .3s" }}
              onMouseEnter={() => setHover(c)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(c)}
              onBlur={() => setHover(null)}
              onClick={() => router.push(`/campaign/${c.address}`)}
              onKeyDown={(e) => e.key === "Enter" && router.push(`/campaign/${c.address}`)}
            >
              <ellipse cx={x} cy={y} rx="6" ry="2.2" fill="#000" opacity="0.55" filter="url(#map-blur)" />
              {on && c.status === Status.Funding && (
                <ellipse cx={x} cy={y} rx="10" ry="4" fill="none" stroke={color} strokeWidth="1.5" className="animate-ping [transform-box:fill-box] [transform-origin:center]" />
              )}
              <g
                transform={`translate(${x} ${y})`}
                style={{ transform: `translate(${x}px, ${y}px) scale(${isHover ? 1.3 : 1})`, transition: "transform .25s cubic-bezier(.3,1.6,.5,1)" }}
              >
                <path d="M0 0 C-1.5 -5 -9 -9.5 -9 -16.5 A9 9 0 1 1 9 -16.5 C9 -9.5 1.5 -5 0 0 Z" fill={color} stroke="#0b1d15" strokeWidth="1.6" />
                <path d="M-5.5 -20.5 A6.5 6.5 0 0 1 2 -23" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                <circle cy="-16.5" r="3.4" fill="#0b1d15" />
                <circle cy="-16.5" r="1.6" fill={color} />
              </g>
            </g>
          );
        })}
      </svg>
      {hover && <MapTooltip c={hover} />}
    </div>
  );
}

/* ================================================================ Bar filter */

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="relative flex min-w-0 flex-1 items-center sm:flex-none">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full appearance-none rounded-xl py-2 pr-9 pl-3.5 text-sm font-medium ring-1 transition outline-none focus-visible:ring-2 focus-visible:ring-hutan-500 sm:w-auto",
          value === "all" ? "bg-white text-stone-600 ring-krem-200 hover:bg-krem-50" : "bg-hutan-50 text-hutan-900 ring-hutan-300",
        )}
      >
        <option value="all">{label}: semua</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 size-4 text-stone-400" aria-hidden />
    </label>
  );
}

export default function ProjectsPage() {
  const { data: campaigns, isLoading, isError } = useCampaignList();
  const [status, setStatus] = useState<StatusKey>("all");
  const [commodity, setCommodity] = useState<string>("all");
  const [province, setProvince] = useState<string>("all");

  const visible = (campaigns ?? []).filter(
    (c) => !HIDDEN_FROM_HOME.has(c.address.toLowerCase()) && c.status !== Status.Draft && c.status !== Status.Cancelled,
  );
  const commodities = [...new Set(visible.map((c) => c.commodity))].sort();
  const provinces = [...new Set(visible.map(provinceOf))].sort();
  const matches = (c: CampaignSummary) =>
    (status === "all" || statusKey(c) === status) &&
    (commodity === "all" || c.commodity === commodity) &&
    (province === "all" || provinceOf(c) === province);
  const shown = visible.filter(matches);
  const filtered = status !== "all" || commodity !== "all" || province !== "all";

  return (
    <>
      <PageHero
        eyebrow="Proyek tanam"
        title="Lahan yang didanai, dari Sumatra sampai Sulawesi"
        description="Setiap pin adalah satu musim tanam satu petani. Arahkan kursor ke pin untuk melihat proyeknya, atau klik untuk membuka detailnya."
      />
      <PageBody>
        <div className="relative overflow-hidden rounded-3xl bg-[radial-gradient(120%_90%_at_50%_20%,#0f3a28_0%,#0b2a1d_45%,#071710_100%)] shadow-lift ring-1 ring-hutan-900">
          <div className="p-2 sm:p-4">
            {isLoading ? <Skeleton className="aspect-[1000/383] w-full bg-white/10" /> : <ProjectMap items={visible} highlight={matches} />}
          </div>
          <div className="pointer-events-none absolute top-3 left-3 rounded-2xl bg-hutan-950/60 px-3 py-2 text-white ring-1 ring-white/10 backdrop-blur sm:top-5 sm:left-5">
            <p className="font-display text-lg leading-none font-semibold sm:text-2xl">
              {visible.length} <span className="text-sm font-normal text-white/60">proyek</span>
            </p>
            <p className="mt-0.5 text-[11px] text-white/55">{provinces.length} provinsi · BSC Testnet</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-white/10 bg-hutan-950/40 px-4 py-3 text-xs text-white/75 sm:absolute sm:bottom-5 sm:left-5 sm:rounded-2xl sm:border-t-0 sm:ring-1 sm:ring-white/10 sm:backdrop-blur">
            {[
              ["#edc56a", "Cari dana"],
              ["#5fa27b", "Berjalan"],
              ["#f8f3e8", "Sudah panen"],
              ["#ef6b5b", "Gagal"],
            ].map(([color, label]) => (
              <span key={label} className="inline-flex items-center gap-1.5">
                <svg viewBox="-10 -27 20 28" className="h-3.5 w-2.5" aria-hidden>
                  <path d="M0 0 C-1.5 -5 -9 -9.5 -9 -16.5 A9 9 0 1 1 9 -16.5 C9 -9.5 1.5 -5 0 0 Z" fill={color} stroke="#0b1d15" strokeWidth="2" />
                </svg>
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Bar filter */}
        <div className="flex flex-col gap-2 rounded-2xl bg-white p-2 shadow-soft ring-1 ring-krem-200 lg:flex-row lg:items-center">
          <div className="flex gap-1 overflow-x-auto rounded-xl bg-krem-100 p-1" role="tablist" aria-label="Status proyek">
            {STATUS_FILTERS.map((f) => {
              const n = f.key === "all" ? visible.length : visible.filter((c) => statusKey(c) === f.key).length;
              return (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={status === f.key}
                  onClick={() => setStatus(f.key)}
                  className={cn(
                    "flex-1 rounded-lg px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition lg:flex-none",
                    status === f.key ? "bg-hutan-900 text-white shadow-soft" : "text-stone-600 hover:bg-white/70",
                  )}
                >
                  {f.label} <span className={cn("ml-0.5 text-xs", status === f.key ? "text-emas-300" : "text-stone-400")}>{n}</span>
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 lg:ml-2">
            <Select label="Komoditas" value={commodity} onChange={setCommodity} options={commodities} />
            <Select label="Provinsi" value={province} onChange={setProvince} options={provinces} />
          </div>
          <div className="flex items-center justify-between gap-3 px-1.5 lg:ml-auto lg:justify-end">
            <span className="text-sm text-stone-500">
              <span className="font-semibold text-hutan-950">{shown.length}</span> proyek
            </span>
            {filtered && (
              <button
                type="button"
                onClick={() => {
                  setStatus("all");
                  setCommodity("all");
                  setProvince("all");
                }}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-hutan-700 hover:bg-hutan-50"
              >
                <RotateCcw className="size-3.5" aria-hidden /> Atur ulang
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[26rem] rounded-3xl" />
            ))}
          </div>
        ) : isError ? (
          <Notice tone="error">Data proyek belum bisa dibaca dari blockchain. Cek koneksi internetmu, lalu muat ulang halaman.</Notice>
        ) : shown.length === 0 ? (
          <EmptyState icon={Sprout} title="Tidak ada proyek yang cocok dengan filter ini" />
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((c, i) => (
              <Reveal key={`${status}-${commodity}-${province}-${c.address}`} delay={(i % 3) * 80} className="h-full">
                <CampaignCard c={c} />
              </Reveal>
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}
