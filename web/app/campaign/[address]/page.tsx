"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { type Address, isAddress } from "viem";
import { ActivityLog } from "@/components/campaign/Activity";
import { ActionPanels } from "@/components/campaign/panels";
import { MilestoneTimeline } from "@/components/campaign/Timeline";
import { IpfsImage, StatusBadge, Usdt } from "@/components/common";
import { Card, Notice, ProgressBar, SectionTitle, Spinner } from "@/components/ui";
import { useCampaign, useIpfsJson } from "@/lib/campaigns";
import { explorerAddressUrl } from "@/lib/config";
import {
  e6ToDeg,
  formatArea,
  formatDate,
  formatDateTime,
  formatPercent,
  formatTimeLeft,
  formatUsdt,
  googleMapsUrl,
  projectedInvestorReturn,
} from "@/lib/format";
import { useRole } from "@/lib/role";
import { useEffectiveNow } from "@/lib/time";
import { type CampaignMetadata, FailType, Status } from "@/lib/types";

export default function CampaignPage() {
  const params = useParams<{ address: string }>();
  const address = isAddress(params.address) ? (params.address as Address) : undefined;
  const { data, isLoading, isError } = useCampaign(address);
  const { data: meta } = useIpfsJson<CampaignMetadata>(data?.summary.metadataCID);
  const { role } = useRole();
  const now = useEffectiveNow();

  if (!address) return <Notice tone="error">Alamat kampanye tidak valid.</Notice>;
  if (isLoading)
    return (
      <p className="flex items-center gap-2 text-sm text-stone-500">
        <Spinner /> Memuat kampanye…
      </p>
    );
  if (isError) return <Notice tone="error">Gagal membaca kampanye dari blockchain.</Notice>;
  if (!data) return <Notice tone="error">Kampanye tidak ditemukan di BagiPanen.</Notice>;

  const { summary: c, milestones, symbol, farmerName, cooperativeName } = data;
  const ret = projectedInvestorReturn(c.targetAmount, c.estimatedRevenue);
  const contractUrl = explorerAddressUrl(c.address);
  const profit = c.harvestAmount >= c.raisedAmount ? c.harvestAmount - c.raisedAmount : 0n;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="lg:w-3/5">
          {meta?.coverImageCID ? (
            <IpfsImage cid={meta.coverImageCID} alt={`Lahan ${c.commodity}`} className="h-56 sm:h-72" />
          ) : (
            <div className="flex h-56 items-center justify-center rounded-xl bg-daun-50 text-6xl" aria-hidden>
              🌱
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 lg:w-2/5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={c.status} failType={c.failType} />
            <span className="text-xs text-stone-500">
              Kampanye #{c.campaignId.toString()} · token {symbol}
            </span>
          </div>
          <h1 className="text-2xl leading-tight font-extrabold text-daun-900">{meta?.title ?? c.commodity}</h1>
          <p className="text-sm text-stone-600">
            {c.commodity} · {c.locationName}
          </p>
          <p className="text-sm text-stone-700">
            Petani{" "}
            <Link href={`/petani/${c.farmer}`} className="font-semibold text-daun-700 underline">
              {farmerName || "—"}
            </Link>{" "}
            · didampingi <strong>{cooperativeName || "—"}</strong>
          </p>
          <Link href={`/petani/${c.farmer}`} className="text-sm text-daun-700 underline">
            Lihat Rapor Petani →
          </Link>
          <Card className="mt-2">
            <ProgressBar value={c.raisedAmount} max={c.targetAmount} />
            <div className="mt-2 flex items-end justify-between gap-2">
              <div>
                <p className="text-xs text-stone-500">Terkumpul</p>
                <Usdt value={c.raisedAmount} />
              </div>
              <div className="text-right">
                <p className="text-xs text-stone-500">Target</p>
                <Usdt value={c.targetAmount} className="items-end" />
              </div>
            </div>
            <p className="mt-2 text-sm text-stone-600">
              {c.status === Status.Funding
                ? `Tenggat pendanaan ${formatDateTime(c.fundingDeadline)} (${formatTimeLeft(c.fundingDeadline, Number(now) * 1000)})`
                : c.status === Status.Draft
                  ? "Menunggu persetujuan admin sebelum pendanaan dibuka."
                  : c.status === Status.Failed && c.failType === FailType.Funding
                    ? "Target tidak tercapai — investor bisa refund 100%."
                    : `Dana cair ${formatUsdt(c.totalReleased)} dari ${formatUsdt(c.raisedAmount)} USDT`}
            </p>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="flex flex-col gap-6 lg:col-span-3">
          {meta?.story && (
            <Card>
              <SectionTitle>Cerita</SectionTitle>
              <p className="text-sm whitespace-pre-line text-stone-700">{meta.story}</p>
            </Card>
          )}
          <Card>
            <SectionTitle>Detail lahan & proyeksi</SectionTitle>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-stone-500">Luas lahan</dt>
                <dd className="font-medium">{formatArea(c.landAreaM2)}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Perkiraan panen</dt>
                <dd className="font-medium">{formatDate(c.expectedHarvestDate)}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Estimasi penjualan</dt>
                <dd>
                  <Usdt value={c.estimatedRevenue} />
                </dd>
              </div>
              <div>
                <dt className="text-stone-500">Proyeksi imbal hasil investor</dt>
                <dd className="font-semibold text-daun-700">{formatPercent(ret)} / musim</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-stone-500">Lokasi</dt>
                <dd>
                  {c.locationName} ({e6ToDeg(c.latE6)}, {e6ToDeg(c.lonE6)}) ·{" "}
                  <a href={googleMapsUrl(c.latE6, c.lonE6)} target="_blank" rel="noreferrer" className="text-daun-700 underline">
                    Buka di Google Maps ↗
                  </a>
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-stone-500">
              Bagi hasil: modal kembali ke investor dulu, lalu keuntungan 55% petani · 40% investor · 5% dana cadangan.
            </p>
          </Card>

          {meta?.costPlan && meta.costPlan.length > 0 && (
            <Card>
              <SectionTitle>Rencana biaya</SectionTitle>
              <ul className="divide-y divide-tanah-100 text-sm">
                {meta.costPlan.map((r) => (
                  <li key={r.item} className="flex justify-between py-1.5">
                    <span>{r.item}</span>
                    <span className="font-medium">{r.usdt.toLocaleString("id-ID")} USDT</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <section>
            <SectionTitle>Milestone pencairan</SectionTitle>
            <MilestoneTimeline c={c} milestones={milestones} />
          </section>

          {c.status === Status.Harvested && (
            <Card>
              <SectionTitle>Hasil panen & bagi hasil</SectionTitle>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr]">
                <IpfsImage cid={c.receiptCID} alt="Nota penjualan" className="h-32" />
                <dl className="grid grid-cols-2 gap-1 text-sm">
                  <dt className="text-stone-500">Hasil penjualan</dt>
                  <dd className="text-right font-semibold">{formatUsdt(c.harvestAmount)} USDT</dd>
                  <dt className="text-stone-500">Keuntungan</dt>
                  <dd className="text-right">{formatUsdt(profit)} USDT</dd>
                  <dt className="text-stone-500">Bagian petani</dt>
                  <dd className="text-right">{formatUsdt((profit * 5_500n) / 10_000n)} USDT</dd>
                  <dt className="text-stone-500">Dana cadangan</dt>
                  <dd className="text-right">{formatUsdt((profit * 500n) / 10_000n)} USDT</dd>
                  <dt className="font-semibold text-stone-700">Pool investor</dt>
                  <dd className="text-right font-semibold">{formatUsdt(c.investorPool)} USDT</dd>
                </dl>
              </div>
            </Card>
          )}
        </div>

        <aside className="flex flex-col gap-4 lg:col-span-2">
          <ActionPanels c={c} milestones={milestones} role={role} symbol={symbol} />
          <Card>
            <SectionTitle>Riwayat transaksi</SectionTitle>
            <ActivityLog campaign={c.address} milestones={milestones} />
            {contractUrl && (
              <a href={contractUrl} target="_blank" rel="noreferrer" className="mt-2 block text-xs text-daun-700 underline">
                Kontrak kampanye di BscScan ↗
              </a>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
