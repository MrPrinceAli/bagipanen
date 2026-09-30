"use client";

import { useParams } from "next/navigation";
import { type Address, isAddress } from "viem";
import { CampaignLink } from "@/components/CampaignLink";
import { StatusBadge, Usdt } from "@/components/common";
import { Badge, Card, EmptyState, Notice, SectionTitle, Spinner, Stat } from "@/components/ui";
import { useFarmerCampaigns } from "@/lib/campaigns";
import { explorerAddressUrl } from "@/lib/config";
import { formatDate, formatPercent, formatUsdt, shortAddress } from "@/lib/format";
import { useFarmerReport } from "@/lib/registry";

export default function FarmerReportPage() {
  const params = useParams<{ address: string }>();
  const farmer = isAddress(params.address) ? (params.address as Address) : undefined;
  const { data: report, isLoading } = useFarmerReport(farmer);
  const { data: campaigns } = useFarmerCampaigns(farmer);

  if (!farmer) return <Notice tone="error">Alamat petani tidak valid.</Notice>;
  if (isLoading || !report) return <Spinner />;
  if (!report.registered) return <Notice tone="info">Alamat ini belum didaftarkan sebagai petani oleh koperasi mana pun.</Notice>;

  const s = report.stats;
  const onTime = s.harvestsCompleted > 0 ? s.onTimeHarvests / s.harvestsCompleted : null;
  const accuracy = s.totalEstimated > 0n ? Number((s.totalReported * 10_000n) / s.totalEstimated) / 10_000 : null;
  const blocked = s.defaults > 0;
  const url = explorerAddressUrl(farmer);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold tracking-wide text-tanah-600 uppercase">Rapor Petani</p>
        <h1 className="text-2xl font-extrabold text-daun-900">{report.name}</h1>
        <p className="text-sm text-stone-600">
          Didampingi <strong>{report.cooperativeName}</strong> ·{" "}
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" className="font-mono text-daun-700 underline">
              {shortAddress(farmer)} ↗
            </a>
          ) : (
            <span className="font-mono">{shortAddress(farmer)}</span>
          )}
        </p>
        {blocked && (
          <div className="mt-1">
            <Badge tone="red">Diblokir membuat kampanye baru (pernah gagal bayar)</Badge>
          </div>
        )}
      </div>

      <Notice tone="success">
        Rekam jejak ini tercatat di BNB Chain dan tidak bisa diubah siapa pun, sebagai riwayat kredit alternatif bagi petani.
      </Notice>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Kampanye didanai" value={s.campaignsFunded} />
        <Stat label="Panen selesai" value={s.harvestsCompleted} />
        <Stat label="Tepat waktu" value={onTime === null ? "–" : formatPercent(onTime)} sub={`${s.onTimeHarvests} dari ${s.harvestsCompleted} panen`} />
        <Stat
          label="Akurasi estimasi"
          value={accuracy === null ? "–" : formatPercent(accuracy)}
          sub={s.totalEstimated > 0n ? `hasil aktual ${formatUsdt(s.totalReported)} ÷ estimasi ${formatUsdt(s.totalEstimated)} USDT` : "belum ada panen"}
        />
        <Stat label="Gagal panen" value={s.cropFailures} />
        <Stat label="Gagal bayar" value={s.defaults} />
      </section>

      <section>
        <SectionTitle>Riwayat kampanye</SectionTitle>
        {!campaigns?.length ? (
          <EmptyState title="Belum ada kampanye" />
        ) : (
          <div className="flex flex-col gap-3">
            {campaigns.map(({ summary: c }) => (
              <Card key={c.address}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <CampaignLink c={c} />
                  <StatusBadge status={c.status} failType={c.failType} />
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-stone-500">Modal</dt>
                    <dd className="font-medium">{formatUsdt(c.raisedAmount)} USDT</dd>
                  </div>
                  <div>
                    <dt className="text-stone-500">Estimasi jual</dt>
                    <dd className="font-medium">{formatUsdt(c.estimatedRevenue)} USDT</dd>
                  </div>
                  <div>
                    <dt className="text-stone-500">Hasil aktual</dt>
                    <dd className="font-medium">{c.harvestAmount > 0n ? `${formatUsdt(c.harvestAmount)} USDT` : "–"}</dd>
                  </div>
                  <div>
                    <dt className="text-stone-500">Perkiraan panen</dt>
                    <dd className="font-medium">{formatDate(c.expectedHarvestDate)}</dd>
                  </div>
                </dl>
              </Card>
            ))}
          </div>
        )}
      </section>

      {s.totalReported > 0n && (
        <p className="text-xs text-stone-500">
          Total hasil penjualan yang disetor: <Usdt value={s.totalReported} />
        </p>
      )}
    </div>
  );
}
