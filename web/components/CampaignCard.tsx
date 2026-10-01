"use client";

import { Clock, MapPin, Sprout } from "lucide-react";
import Link from "next/link";
import { useIpfsJson } from "@/lib/campaigns";
import { formatPercent, formatRupiah, formatTimeLeft, formatUsdt, projectedInvestorReturn } from "@/lib/format";
import { type CampaignMetadata, type CampaignSummary, Status } from "@/lib/types";
import { IpfsImage, StatusBadge } from "./common";
import { cn, ProgressBar } from "./ui";

export function fundedPercent(c: CampaignSummary) {
  return c.targetAmount === 0n ? 0 : Math.min(100, Math.round(Number((c.raisedAmount * 1000n) / c.targetAmount) / 10));
}

/** Keterangan singkat kondisi kampanye untuk kartu. */
export function campaignMoment(c: CampaignSummary): { label: string; value: string } {
  if (c.status === Status.Funding) return { label: "Sisa waktu", value: formatTimeLeft(c.fundingDeadline) };
  if (c.status === Status.Active)
    return c.currentMilestone >= c.milestoneCount
      ? { label: "Tahap", value: "Menunggu panen" }
      : { label: "Tahap", value: `${c.currentMilestone + 1} dari ${c.milestoneCount}` };
  if (c.status === Status.Harvested) return { label: "Hasil panen", value: `${formatUsdt(c.harvestAmount)} USDT` };
  if (c.status === Status.Draft) return { label: "Status", value: "Direview admin" };
  return { label: "Status", value: "Selesai" };
}

export function CampaignCover({ cid, commodity, className }: { cid?: string; commodity: string; className?: string }) {
  if (cid) return <IpfsImage cid={cid} alt={`Lahan ${commodity}`} className={cn("h-full rounded-none", className)} link={false} />;
  return (
    <div className={cn("flex h-full items-center justify-center bg-linear-to-br from-hutan-700 to-hutan-950", className)} aria-hidden>
      <Sprout className="size-12 text-emas-300/70" />
    </div>
  );
}

export function CampaignCard({ c }: { c: CampaignSummary }) {
  const { data: meta } = useIpfsJson<CampaignMetadata>(c.metadataCID);
  const ret = projectedInvestorReturn(c.targetAmount, c.estimatedRevenue);
  const pct = fundedPercent(c);
  const moment = campaignMoment(c);

  return (
    <Link
      href={`/campaign/${c.address}`}
      className="group flex flex-col overflow-hidden rounded-3xl border border-krem-200 bg-white shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-lift"
    >
      <div className="relative h-52 overflow-hidden bg-krem-200">
        <CampaignCover cid={meta?.coverImageCID} commodity={c.commodity} className="transition duration-700 group-hover:scale-105" />
        <div className="absolute inset-0 bg-linear-to-t from-hutan-950/80 via-hutan-950/10 to-transparent" aria-hidden />
        <div className="absolute top-3 left-3">
          <StatusBadge status={c.status} failType={c.failType} glass />
        </div>
        <div className="absolute inset-x-4 bottom-3 flex items-center justify-between gap-2 text-white">
          <span className="rounded-full bg-emas-400 px-2.5 py-0.5 text-xs font-bold text-hutan-950">{c.commodity}</span>
          <span className="flex items-center gap-1 truncate text-xs text-white/85">
            <MapPin className="size-3.5 shrink-0" aria-hidden /> {c.locationName}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <h3 className="font-display text-lg leading-snug font-semibold text-hutan-950 transition group-hover:text-hutan-700">
          {meta?.title ?? `${c.commodity} di ${c.locationName}`}
        </h3>
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="text-stone-600">
              <span className="font-semibold text-hutan-950">{formatUsdt(c.raisedAmount)} USDT</span> terkumpul
            </span>
            <span className="font-semibold text-emas-700">{pct}%</span>
          </div>
          <ProgressBar value={c.raisedAmount} max={c.targetAmount} />
          <p className="text-xs text-stone-500">
            Target {formatUsdt(c.targetAmount)} USDT · sekitar {formatRupiah(c.targetAmount)}
          </p>
        </div>
        <div className="mt-auto grid grid-cols-2 gap-3 border-t border-krem-200 pt-4">
          <div>
            <p className="text-xs text-stone-500">Proyeksi imbal hasil</p>
            <p className="font-semibold text-hutan-700">{formatPercent(ret)} / musim</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-stone-500">{moment.label}</p>
            <p className="flex items-center justify-end gap-1 font-semibold text-hutan-950">
              {c.status === Status.Funding && <Clock className="size-3.5 text-emas-600" aria-hidden />}
              {moment.value}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
