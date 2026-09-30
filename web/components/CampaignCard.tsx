"use client";

import Link from "next/link";
import { useIpfsJson } from "@/lib/campaigns";
import { formatPercent, formatRupiah, formatTimeLeft, formatUsdt, projectedInvestorReturn } from "@/lib/format";
import { type CampaignMetadata, type CampaignSummary, Status } from "@/lib/types";
import { IpfsImage, StatusBadge } from "./common";
import { ProgressBar } from "./ui";

export function CampaignCard({ c }: { c: CampaignSummary }) {
  const { data: meta } = useIpfsJson<CampaignMetadata>(c.metadataCID);
  const ret = projectedInvestorReturn(c.targetAmount, c.estimatedRevenue);

  return (
    <Link
      href={`/campaign/${c.address}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-tanah-200 bg-white shadow-sm transition hover:border-daun-300 hover:shadow"
    >
      {meta?.coverImageCID ? (
        <IpfsImage cid={meta.coverImageCID} alt={`Lahan ${c.commodity}`} className="h-40 rounded-none" link={false} />
      ) : (
        <div className="flex h-40 items-center justify-center bg-daun-50 text-5xl" aria-hidden>
          🌱
        </div>
      )}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-stone-900 group-hover:text-daun-800">{meta?.title ?? c.commodity}</h3>
            <p className="text-sm text-stone-500">
              {c.commodity} · {c.locationName}
            </p>
          </div>
          <StatusBadge status={c.status} failType={c.failType} />
        </div>
        <div className="flex flex-col gap-1.5">
          <ProgressBar value={c.raisedAmount} max={c.targetAmount} />
          <p className="text-sm text-stone-700">
            <span className="font-semibold">{formatUsdt(c.raisedAmount)}</span> dari {formatUsdt(c.targetAmount)} USDT
            <span className="text-stone-500"> · ≈ {formatRupiah(c.targetAmount)}</span>
          </p>
        </div>
        <div className="mt-auto flex items-center justify-between text-sm">
          <span className="text-stone-600">
            Proyeksi imbal hasil <span className="font-semibold text-daun-700">{formatPercent(ret)}</span>
          </span>
          <span className="text-xs text-stone-500">
            {c.status === Status.Funding
              ? `Tenggat ${formatTimeLeft(c.fundingDeadline)}`
              : c.status === Status.Active
                ? `Milestone ${Math.min(c.currentMilestone + 1, c.milestoneCount)}/${c.milestoneCount}`
                : null}
          </span>
        </div>
      </div>
    </Link>
  );
}
