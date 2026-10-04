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
  { name: "Sumatra", lat: -0.4, lon: 101.6, rot: -38 },
  { name: "Kalimantan", lat: -0.6, lon: 113.6, rot: 0 },
  { name: "Jawa", lat: -8.95, lon: 110.6, rot: 0 },
  { name: "Sulawesi", lat: -2.3, lon: 120.9, rot: 0 },
  { name: "Maluku", lat: -1.9, lon: 129.4, rot: 0 },
  { name: "Papua", lat: -4.6, lon: 138.3, rot: 0 },
  { name: "Nusa Tenggara", lat: -10.9, lon: 119.2, rot: 0 },
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
  const lonLines = [100, 110, 120, 130, 140];
  const latLines = [5, -5, -10];
  const scale500 = (500 / 111.32) * PX_PER_DEG; // 500 km di khatulistiwa
  // Pin yang paling selatan digambar terakhir agar tumpukan pin tampak wajar.
  const ordered = [...items].sort((a, b) => b.latE6 - a.latE6);
  const ink = "#5c3d16";
  const serif = "var(--font-fraunces), Georgia, serif";

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className="block h-auto w-full" role="img" aria-label="Peta sebaran proyek tanam di Indonesia">
        <defs>
          <pattern id="atlas-waves" width="18" height="10" patternUnits="userSpaceOnUse">
            <path d="M0 6 Q4.5 3 9 6 T18 6" stroke="#7d93a0" strokeOpacity="0.35" fill="none" strokeWidth="0.8" />
          </pattern>
          <pattern id="atlas-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="5" stroke="#8a6a35" strokeOpacity="0.35" strokeWidth="1" />
          </pattern>
          <clipPath id="atlas-land">
            <path d={INDONESIA_PATH} />
          </clipPath>
          <filter id="map-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.6" />
          </filter>
        </defs>

        {/* Laut */}
        <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="#dfe3dc" />
        <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#atlas-waves)" />

        {/* Garis lintang & bujur */}
        <g stroke={ink} strokeOpacity="0.14" strokeWidth="0.6">
          {lonLines.map((lon) => {
            const { x } = projectToMap(0, lon);
            return <line key={lon} x1={x} y1={0} x2={x} y2={MAP_HEIGHT} />;
          })}
          {latLines.map((lat) => {
            const { y } = projectToMap(lat, 0);
            return <line key={lat} x1={0} y1={y} x2={MAP_WIDTH} y2={y} />;
          })}
        </g>
        <g fill={ink} fillOpacity="0.55" fontSize="9" fontStyle="italic" fontFamily={serif}>
          {lonLines.slice(0, -1).map((lon) => (
            <text key={lon} x={projectToMap(0, lon).x + 3} y={24}>
              {lon}° BT
            </text>
          ))}
        </g>
        {(() => {
          const { y } = projectToMap(0, 0);
          return (
            <g>
              <line x1={0} y1={y} x2={MAP_WIDTH} y2={y} stroke={ink} strokeOpacity="0.4" strokeWidth="0.8" strokeDasharray="6 4" />
              <text x={20} y={y - 4} fill={ink} fillOpacity="0.7" fontSize="9" fontStyle="italic" fontFamily={serif}>
                Khatulistiwa 0°
              </text>
            </g>
          );
        })()}

        {/* Negara tetangga */}
        <path d={NEIGHBORS_PATH} fill="#e9dfc6" stroke="#8a6a35" strokeOpacity="0.4" strokeWidth="0.6" />

        {/* Indonesia: daratan kertas, arsiran, garis pantai tinta */}
        <path d={INDONESIA_PATH} fill="#efdcae" />
        <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#atlas-hatch)" clipPath="url(#atlas-land)" opacity="0.55" />
        <path d={INDONESIA_PATH} fill="none" stroke={ink} strokeWidth="0.9" strokeLinejoin="round" />

        {/* Nama pulau besar */}
        <g fill={ink} fillOpacity="0.8" fontSize="13" fontStyle="italic" textAnchor="middle" fontFamily={serif} stroke="#efdcae" strokeWidth="3" strokeLinejoin="round" paintOrder="stroke">
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
        <g transform={`translate(${MAP_WIDTH - 50} 52)`}>
          <circle r="24" fill="#f3e7cb" stroke={ink} strokeWidth="0.8" />
          <circle r="19" fill="none" stroke={ink} strokeOpacity="0.35" strokeWidth="0.5" />
          <path d="M0 -18 L4 0 L0 18 L-4 0 Z" fill="#f3e7cb" stroke={ink} strokeWidth="0.7" />
          <path d="M-18 0 L0 -3 L18 0 L0 3 Z" fill="#f3e7cb" stroke={ink} strokeOpacity="0.5" strokeWidth="0.5" />
          <path d="M0 -18 L4 0 L-4 0 Z" fill={ink} />
          <text y="-28" textAnchor="middle" fill={ink} fontSize="11" fontStyle="italic" fontFamily={serif}>
            U
          </text>
        </g>

        {/* Skala */}
        <g transform={`translate(${MAP_WIDTH - 28 - scale500} ${MAP_HEIGHT - 24})`} fill={ink} fontSize="9" fontStyle="italic" fontFamily={serif}>
          <rect width={scale500} height="4" fill="#f3e7cb" stroke={ink} strokeWidth="0.7" />
          <rect width={scale500 / 2} height="4" fill={ink} />
          <text y="-4">0</text>
          <text x={scale500} y="-4" textAnchor="end">
            500 km
          </text>
        </g>

        {/* Bingkai ganda */}
        <rect x="6" y="6" width={MAP_WIDTH - 12} height={MAP_HEIGHT - 12} fill="none" stroke={ink} strokeWidth="1.6" />
        <rect x="11" y="11" width={MAP_WIDTH - 22} height={MAP_HEIGHT - 22} fill="none" stroke={ink} strokeWidth="0.6" />

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
              <ellipse cx={x} cy={y} rx="6" ry="2.2" fill="#3b2709" opacity="0.45" filter="url(#map-blur)" />
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
        <option value="all">{label}</option>
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
        title="Lahan yang didanai, dari berbagai penjuru Indonesia"
        description="Setiap pin adalah satu musim tanam satu petani. Arahkan kursor ke pin untuk melihat proyeknya, atau klik untuk membuka detailnya."
      />
      <PageBody>
        <div className="relative overflow-hidden rounded-3xl bg-[#f3e7cb] shadow-lift ring-1 ring-[#d9c08c]">
          <div className="p-2 sm:p-4">
            {isLoading ? <Skeleton className="aspect-[1000/383] w-full bg-[#e6d3a6]" /> : <ProjectMap items={visible} highlight={matches} />}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[#5c3d16]/25 bg-[#f6ecd4] px-4 py-3 font-display text-xs text-[#5c3d16] italic sm:absolute sm:bottom-9 sm:left-9 sm:rounded-xl sm:border sm:border-[#5c3d16]/40 sm:bg-[#f6ecd4]/90">
            <span className="w-full font-semibold not-italic">
              {visible.length} proyek · {provinces.length} provinsi
              <span className="hidden font-normal italic opacity-70 sm:inline"> · BSC Testnet</span>
            </span>
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
          <div className="grid grid-cols-4 gap-1 rounded-xl bg-krem-100 p-1 lg:flex" role="tablist" aria-label="Status proyek">
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
                    "rounded-lg px-1.5 py-1.5 text-xs font-medium whitespace-nowrap transition sm:px-3.5 sm:text-sm",
                    status === f.key ? "bg-hutan-900 text-white shadow-soft" : "text-stone-600 hover:bg-white/70",
                  )}
                >
                  {f.label} <span className={cn("ml-0.5 hidden text-xs sm:inline", status === f.key ? "text-emas-300" : "text-stone-400")}>{n}</span>
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
