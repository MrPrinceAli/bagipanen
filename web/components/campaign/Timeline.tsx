"use client";

import { Bot, Check, ExternalLink, Users, X } from "lucide-react";
import { useIpfsJson } from "@/lib/campaigns";
import { formatDateTime, formatPercent, formatUsdt } from "@/lib/format";
import { ipfsUrl } from "@/lib/ipfs";
import { type CampaignSummary, type Milestone, MStatus, type VerdictDocument } from "@/lib/types";
import { type VerdictContext, verdictText } from "@/lib/verdictText";
import { IpfsImage, MilestoneBadge } from "../common";
import { Badge, cn, Spinner } from "../ui";

const EXIF_LABEL: Record<string, string> = {
  ok: "GPS & tanggal cocok",
  missing: "Tanpa data GPS/tanggal",
  mismatch: "Lokasi/tanggal tak cocok",
};

/** Ringkasan putusan agen AI dari JSON di IPFS (bagipanen.verdict.v1). */
export function VerdictSummary({ cid, ctx }: { cid: string; ctx?: VerdictContext }) {
  const { data: v, isLoading, isError } = useIpfsJson<VerdictDocument>(cid);
  if (isLoading)
    return (
      <p className="flex items-center gap-2 text-xs text-stone-500">
        <Spinner className="size-3" /> Membuka catatan agen…
      </p>
    );
  if (isError || !v) return <p className="text-xs text-stone-500">Catatan agen belum bisa dibuka.</p>;
  const vision = v.vision ?? {};
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className={cn("leading-relaxed", v.approved ? "text-hutan-900" : "text-red-800")}>{verdictText(v, ctx)}</p>
      <div className="flex flex-wrap gap-1.5">
        {vision.detected_stage && <Badge>Fase {vision.detected_stage.toLowerCase()}</Badge>}
        {vision.plant_condition && <Badge>Kondisi {vision.plant_condition}</Badge>}
        {typeof vision.estimated_days_to_harvest === "number" && <Badge>Panen ±{vision.estimated_days_to_harvest} hari</Badge>}
        {typeof vision.confidence === "number" && <Badge>Yakin {formatPercent(vision.confidence)}</Badge>}
        {v.exif && (
          <Badge tone={v.exif.status === "mismatch" ? "red" : v.exif.status === "ok" ? "green" : "yellow"}>{EXIF_LABEL[v.exif.status]}</Badge>
        )}
        {v.weather?.extreme && <Badge tone="red">Cuaca ekstrem</Badge>}
        {v.duplicate && <Badge tone="red">Foto duplikat</Badge>}
      </div>
      {vision.red_flags && vision.red_flags.length > 0 && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-800">Catatan agen: {vision.red_flags.join("; ")}</p>
      )}
      <p className="flex flex-wrap items-center gap-x-2 text-xs text-stone-400">
        {v.agent?.model && <span>Dinilai dengan model {v.agent.model}</span>}
        <a href={ipfsUrl(cid)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-hutan-700 hover:underline">
          Catatan lengkap (JSON) <ExternalLink className="size-3" aria-hidden />
        </a>
      </p>
    </div>
  );
}

function Decision({ who, decided, approved, waiting }: { who: "ai" | "coop"; decided: boolean; approved: boolean; waiting: string }) {
  const Icon = who === "ai" ? Bot : Users;
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="size-4 text-stone-400" aria-hidden />
      <span className="text-stone-500">{who === "ai" ? "Agen AI" : "Koperasi"}</span>
      {decided ? (
        <span className={cn("inline-flex items-center gap-1 font-semibold", approved ? "text-hutan-700" : "text-red-700")}>
          {approved ? <Check className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
          {approved ? "Setuju" : "Menolak"}
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-stone-500">
          <span className="size-1.5 animate-pulse rounded-full bg-emas-500" aria-hidden /> {waiting}
        </span>
      )}
    </div>
  );
}

/** Timeline tahap pencairan (Tanam → Tumbuh → Pra-panen). */
export function MilestoneTimeline({ c, milestones }: { c: CampaignSummary; milestones: readonly Milestone[] }) {
  return (
    <ol className="relative flex flex-col">
      {milestones.map((m, i) => {
        const amount = (c.targetAmount * BigInt(m.bps)) / 10_000n;
        const isCurrent = i === c.currentMilestone && m.status !== MStatus.Released;
        const released = m.status === MStatus.Released;
        const bad = m.status === MStatus.Rejected || m.status === MStatus.Disputed;
        const submitted = m.status !== MStatus.Pending;
        const last = i === milestones.length - 1;
        return (
          <li key={m.name} className={cn("relative pl-14", !last && "pb-6")}>
            {!last && <span className={cn("absolute top-11 bottom-0 left-5 w-0.5", released ? "bg-hutan-300" : "bg-krem-300")} aria-hidden />}
            <span
              className={cn(
                "absolute top-0 left-0 flex size-10 items-center justify-center rounded-full font-display text-base font-semibold",
                released && "bg-hutan-700 text-white",
                !released && bad && "bg-red-100 text-red-700 ring-1 ring-red-200",
                !released && !bad && isCurrent && "bg-emas-400 text-hutan-950 ring-4 ring-emas-100",
                !released && !bad && !isCurrent && "bg-white text-stone-400 ring-1 ring-krem-300",
              )}
            >
              {released ? <Check className="size-5" aria-hidden /> : i + 1}
            </span>
            <div className={cn("rounded-3xl border bg-white p-5 shadow-soft", isCurrent ? "border-emas-200" : "border-krem-200")}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-display text-lg font-semibold text-hutan-950">
                    {m.name} <span className="font-sans text-sm font-medium text-stone-400">· {m.bps / 100}%</span>
                  </p>
                  <p className="text-sm text-stone-600">
                    {released ? `${formatUsdt(m.releasedAmount)} USDT sudah cair ke petani` : `${formatUsdt(amount)} USDT cair setelah bukti disetujui`}
                  </p>
                </div>
                <MilestoneBadge status={m.status} />
              </div>
              {submitted && (
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[176px_1fr]">
                  <IpfsImage cid={m.proofCID} alt={`Foto bukti tahap ${m.name}`} className="h-40 sm:h-36" />
                  <div className="flex flex-col gap-2.5">
                    <p className="text-xs text-stone-500">
                      Percobaan {m.attempts} dari 3 · dikirim {formatDateTime(m.submittedAt)}
                    </p>
                    <Decision who="ai" decided={m.aiDecided} approved={m.aiApproved} waiting="sedang memeriksa foto…" />
                    {m.aiDecided && m.aiReasonCID && (
                      <div className="rounded-2xl bg-krem-50 p-3">
                        <VerdictSummary cid={m.aiReasonCID} ctx={{ commodity: c.commodity, milestone: m.name }} />
                      </div>
                    )}
                    <Decision who="coop" decided={m.verifierDecided} approved={m.verifierApproved} waiting="belum memutuskan" />
                    {m.status === MStatus.Disputed && (
                      <p className="text-sm font-medium text-red-700">Sudah ditolak tiga kali. Sekarang admin yang akan memutuskan.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
