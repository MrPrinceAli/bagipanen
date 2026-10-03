"use client";

import { MapPin, Sprout } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { CampaignCard } from "@/components/CampaignCard";
import { statusLabel } from "@/components/common";
import { Reveal } from "@/components/scroll";
import { cn, EmptyState, Notice, PageBody, PageHero, Skeleton } from "@/components/ui";
import { useCampaignList, useIpfsJson } from "@/lib/campaigns";
import { HIDDEN_FROM_HOME } from "@/lib/config";
import { INDONESIA_PATH, MAP_HEIGHT, MAP_WIDTH, NEIGHBORS_PATH, projectToMap } from "@/lib/indonesiaMap";
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

/** Warna titik di peta per status. */
function dotColor(c: CampaignSummary) {
  if (c.status === Status.Funding) return "#edc56a";
  if (c.status === Status.Active) return "#8fc2a3";
  if (c.status === Status.Harvested) return "#f8f3e8";
  return "#f87171";
}

/** "Rejoso, Nganjuk, Jawa Timur" → "Jawa Timur". */
const provinceOf = (c: CampaignSummary) => c.locationName.split(",").map((s) => s.trim()).at(-1) ?? c.locationName;

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition",
        active ? "bg-hutan-900 text-white ring-hutan-900" : "bg-white text-stone-600 ring-krem-200 hover:bg-krem-100",
      )}
    >
      {children}
    </button>
  );
}

function MapTooltip({ c }: { c: CampaignSummary }) {
  const { data: meta } = useIpfsJson<CampaignMetadata>(c.metadataCID);
  const { x, y } = projectToMap(c.latE6 / 1e6, c.lonE6 / 1e6);
  const right = x > MAP_WIDTH * 0.62;
  return (
    <div
      className="pointer-events-none absolute z-10 w-56 rounded-2xl bg-white p-3 text-left shadow-lift ring-1 ring-krem-200"
      style={{
        left: `${(x / MAP_WIDTH) * 100}%`,
        top: `${(y / MAP_HEIGHT) * 100}%`,
        transform: `translate(${right ? "calc(-100% - 14px)" : "14px"}, -50%)`,
      }}
    >
      <p className="text-xs font-semibold text-emas-700">{statusLabel(c.status, c.failType)}</p>
      <p className="mt-0.5 text-sm leading-snug font-semibold text-hutan-950">{meta?.title ?? `${c.commodity} di ${c.locationName}`}</p>
      <p className="mt-1 flex items-center gap-1 text-xs text-stone-500">
        <MapPin className="size-3" aria-hidden /> {c.locationName}
      </p>
    </div>
  );
}

function ProjectMap({ items, highlight }: { items: CampaignSummary[]; highlight: (c: CampaignSummary) => boolean }) {
  const router = useRouter();
  const [hover, setHover] = useState<CampaignSummary | null>(null);
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className="block h-auto w-full" role="img" aria-label="Peta sebaran proyek tanam di Indonesia">
        <path d={NEIGHBORS_PATH} fill="rgb(255 255 255 / 0.05)" />
        <path d={INDONESIA_PATH} fill="#1b4130" stroke="#3d855d" strokeWidth={0.7} strokeLinejoin="round" />
        {items.map((c) => {
          const { x, y } = projectToMap(c.latE6 / 1e6, c.lonE6 / 1e6);
          const on = highlight(c);
          return (
            <g
              key={c.address}
              role="link"
              tabIndex={0}
              aria-label={`${c.commodity} di ${c.locationName}`}
              className="cursor-pointer outline-none"
              style={{ opacity: on ? 1 : 0.25 }}
              onMouseEnter={() => setHover(c)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(c)}
              onBlur={() => setHover(null)}
              onClick={() => router.push(`/campaign/${c.address}`)}
              onKeyDown={(e) => e.key === "Enter" && router.push(`/campaign/${c.address}`)}
            >
              {on && <circle cx={x} cy={y} r={16} fill={dotColor(c)} opacity={0.25} className="animate-ping [transform-box:fill-box] [transform-origin:center]" />}
              <circle cx={x} cy={y} r={9} fill={dotColor(c)} stroke="#0b1d15" strokeWidth={2.5} />
            </g>
          );
        })}
      </svg>
      {hover && <MapTooltip c={hover} />}
    </div>
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

  return (
    <>
      <PageHero
        eyebrow="Proyek tanam"
        title="Lahan yang didanai, dari Sumatra sampai Sulawesi"
        description="Setiap titik adalah satu musim tanam satu petani. Arahkan kursor ke titik untuk melihat proyeknya, atau klik untuk membuka detailnya."
      />
      <PageBody>
        <div className="overflow-hidden rounded-3xl bg-hutan-950 shadow-lift">
          <div className="glow-hutan p-3 sm:p-6">
            {isLoading ? <Skeleton className="aspect-[1000/383] w-full bg-white/10" /> : <ProjectMap items={visible} highlight={matches} />}
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 px-2 text-xs text-white/70">
              {[
                ["#edc56a", "Cari dana"],
                ["#8fc2a3", "Berjalan"],
                ["#f8f3e8", "Sudah panen"],
                ["#f87171", "Gagal"],
              ].map(([color, label]) => (
                <span key={label} className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full ring-2 ring-hutan-950" style={{ background: color }} aria-hidden /> {label}
                </span>
              ))}
              <span className="ml-auto text-white/45">{provinces.length} provinsi · {visible.length} proyek</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((f) => (
              <Pill key={f.key} active={status === f.key} onClick={() => setStatus(f.key)}>
                {f.label}{" "}
                <span className="ml-0.5 text-xs opacity-60">{f.key === "all" ? visible.length : visible.filter((c) => statusKey(c) === f.key).length}</span>
              </Pill>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold tracking-wide text-stone-500 uppercase">Komoditas</span>
            <Pill active={commodity === "all"} onClick={() => setCommodity("all")}>
              Semua
            </Pill>
            {commodities.map((c) => (
              <Pill key={c} active={commodity === c} onClick={() => setCommodity(c)}>
                {c}
              </Pill>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold tracking-wide text-stone-500 uppercase">Provinsi</span>
            <Pill active={province === "all"} onClick={() => setProvince("all")}>
              Semua
            </Pill>
            {provinces.map((p) => (
              <Pill key={p} active={province === p} onClick={() => setProvince(p)}>
                {p}
              </Pill>
            ))}
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
