"use client";

import { useIpfsJson } from "@/lib/campaigns";
import { formatDateTime, formatPercent } from "@/lib/format";
import { type CampaignSummary, type Milestone, MStatus, type VerdictDocument } from "@/lib/types";
import { IpfsImage, MilestoneBadge, Usdt } from "../common";
import { Badge, Card, cn, Spinner } from "../ui";

const CONDITION: Record<string, string> = { baik: "baik", sedang: "sedang", buruk: "buruk" };
const EXIF_LABEL: Record<string, string> = {
  ok: "GPS & tanggal cocok",
  missing: "tanpa data EXIF",
  mismatch: "lokasi/tanggal tidak cocok",
};

/** Ringkasan putusan agen AI dari JSON di IPFS (bagipanen.verdict.v1). */
export function VerdictSummary({ cid }: { cid: string }) {
  const { data: v, isLoading, isError } = useIpfsJson<VerdictDocument>(cid);
  if (isLoading) return <Spinner />;
  if (isError || !v) return <p className="text-xs text-stone-500">Detail putusan tidak bisa dimuat.</p>;
  const vision = v.vision ?? {};
  return (
    <div className="mt-1 flex flex-col gap-1 text-sm">
      <p className={cn("font-medium", v.approved ? "text-daun-800" : "text-red-800")}>{v.summary_id}</p>
      <div className="flex flex-wrap gap-1">
        {vision.detected_stage && <Badge>Fase: {vision.detected_stage}</Badge>}
        {vision.plant_condition && <Badge>Kondisi: {CONDITION[vision.plant_condition] ?? vision.plant_condition}</Badge>}
        {typeof vision.estimated_days_to_harvest === "number" && <Badge>Panen ±{vision.estimated_days_to_harvest} hari</Badge>}
        {typeof vision.confidence === "number" && <Badge>Yakin {formatPercent(vision.confidence)}</Badge>}
        {v.exif && <Badge tone={v.exif.status === "mismatch" ? "red" : v.exif.status === "ok" ? "green" : "yellow"}>EXIF: {EXIF_LABEL[v.exif.status]}</Badge>}
        {v.weather?.extreme && <Badge tone="red">Cuaca ekstrem</Badge>}
        {v.duplicate && <Badge tone="red">Foto duplikat</Badge>}
      </div>
      {vision.red_flags && vision.red_flags.length > 0 && <p className="text-xs text-red-700">Catatan: {vision.red_flags.join("; ")}</p>}
    </div>
  );
}

function Decision({ label, decided, approved, pendingText }: { label: string; decided: boolean; approved: boolean; pendingText: string }) {
  return (
    <p className="text-sm">
      <span className="text-stone-500">{label}: </span>
      {decided ? (
        <span className={approved ? "font-semibold text-daun-700" : "font-semibold text-red-700"}>{approved ? "✓ Setuju" : "✗ Tolak"}</span>
      ) : (
        <span className="text-stone-500">{pendingText}</span>
      )}
    </p>
  );
}

export function MilestoneTimeline({ c, milestones }: { c: CampaignSummary; milestones: readonly Milestone[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {milestones.map((m, i) => {
        const amount = (c.targetAmount * BigInt(m.bps)) / 10_000n;
        const isCurrent = i === c.currentMilestone;
        const submitted = m.status !== MStatus.Pending;
        return (
          <li key={m.name}>
            <Card className={cn(isCurrent && m.status !== MStatus.Released && "border-daun-300 ring-1 ring-daun-200")}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-stone-900">
                    {i + 1}. {m.name} <span className="font-normal text-stone-500">· {m.bps / 100}%</span>
                  </p>
                  <p className="text-sm text-stone-600">
                    {m.status === MStatus.Released ? <>Cair <Usdt value={m.releasedAmount} showRupiah={false} /></> : <>Rencana cair <Usdt value={amount} showRupiah={false} /></>}
                  </p>
                </div>
                <MilestoneBadge status={m.status} />
              </div>
              {submitted && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr]">
                  <IpfsImage cid={m.proofCID} alt={`Bukti ${m.name}`} className="h-32" />
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs text-stone-500">
                      Percobaan {m.attempts}/3 · dikirim {formatDateTime(m.submittedAt)}
                    </p>
                    <div>
                      <Decision label="Agen AI" decided={m.aiDecided} approved={m.aiApproved} pendingText="menunggu putusan…" />
                      {m.aiDecided && m.aiReasonCID && <VerdictSummary cid={m.aiReasonCID} />}
                    </div>
                    <Decision label="Koperasi" decided={m.verifierDecided} approved={m.verifierApproved} pendingText="menunggu konfirmasi…" />
                    {m.status === MStatus.Disputed && <p className="text-sm text-red-700">Ditolak 3 kali — menunggu keputusan admin.</p>}
                  </div>
                </div>
              )}
            </Card>
          </li>
        );
      })}
    </ol>
  );
}
