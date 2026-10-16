"use client";

import { tr, trTerm } from "@/lib/i18n";
import { AlertOctagon, CalendarCheck, CloudRainWind, HandCoins, ShieldCheck, Target, Wheat } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type Address, isAddress } from "viem";
import { CampaignCover } from "@/components/CampaignCard";
import { FarmerAvatar } from "@/components/FarmerAvatar";
import { AddressLink, StatusBadge } from "@/components/common";
import { Badge, Card, EmptyState, Loading, Notice, PageBody, PageHero, SectionTitle, Stat } from "@/components/ui";
import { useFarmerCampaigns, useIpfsJson } from "@/lib/campaigns";
import { formatDate, formatPercent, formatRupiah, formatUsdt } from "@/lib/format";
import { useFarmerReport } from "@/lib/registry";
import type { CampaignMetadata, CampaignSummary } from "@/lib/types";

function HistoryRow({ c }: { c: CampaignSummary }) {
  const { data: meta } = useIpfsJson<CampaignMetadata>(c.metadataCID);
  return (
    <Card className="flex flex-col gap-4 sm:flex-row">
      <Link href={`/campaign/${c.address}`} className="relative block h-36 shrink-0 overflow-hidden rounded-2xl sm:h-auto sm:min-h-28 sm:w-40">
        <span className="absolute inset-0">
          <CampaignCover cid={meta?.coverImageCID} commodity={c.commodity} />
        </span>
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <Link href={`/campaign/${c.address}`} className="font-display text-lg leading-snug font-semibold text-hutan-950 hover:text-hutan-700">
            {meta?.title ?? `${trTerm(c.commodity)} ${tr("di", "in")} ${c.locationName}`}
          </Link>
          <StatusBadge status={c.status} failType={c.failType} />
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {[
            [tr("Dana terkumpul", "Raised"), `${formatUsdt(c.raisedAmount)} USDT`],
            [tr("Perkiraan jual", "Expected sales"), `${formatUsdt(c.estimatedRevenue)} USDT`],
            [tr("Hasil nyata", "Actual result"), c.harvestAmount > 0n ? `${formatUsdt(c.harvestAmount)} USDT` : "–"],
            [tr("Perkiraan panen", "Expected harvest"), formatDate(c.expectedHarvestDate)],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-stone-500">{k}</dt>
              <dd className="font-semibold text-hutan-950">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Card>
  );
}

export default function FarmerReportPage() {
  const params = useParams<{ address: string }>();
  const farmer = isAddress(params.address) ? (params.address as Address) : undefined;
  const { data: report, isLoading } = useFarmerReport(farmer);
  const { data: campaigns } = useFarmerCampaigns(farmer);

  if (!farmer || isLoading || !report || !report.registered)
    return (
      <>
        <PageHero eyebrow={tr("Rapor Petani", "Farmer report card")} title={tr("Rekam jejak petani", "Farmer track record")} />
        <PageBody>
          {!farmer ? (
            <Notice tone="error">{tr("Alamat petaninya tidak valid. Cek lagi tautannya, ya.", "That farmer address isn't valid. Please check the link.")}</Notice>
          ) : isLoading || !report ? (
            <Loading>{tr("Membaca rapor dari blockchain…", "Reading the report card from the blockchain…")}</Loading>
          ) : (
            <Notice tone="info">{tr("Alamat ini belum didaftarkan sebagai petani oleh koperasi mana pun.", "No cooperative has registered this address as a farmer yet.")}</Notice>
          )}
        </PageBody>
      </>
    );

  const s = report.stats;
  const onTime = s.harvestsCompleted > 0 ? s.onTimeHarvests / s.harvestsCompleted : null;
  const accuracy = s.totalEstimated > 0n ? Number((s.totalReported * 10_000n) / s.totalEstimated) / 10_000 : null;
  const blocked = s.defaults > 0;

  return (
    <>
      <PageHero
        eyebrow={tr("Rapor Petani", "Farmer report card")}
        title={
          <span className="flex items-center gap-4">
            <FarmerAvatar
              name={report.name}
              seed={farmer}
              commodity={campaigns?.[0]?.summary.commodity}
              className="size-16 shrink-0 drop-shadow-lg sm:size-20"
            />
            {report.name}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {tr("Didampingi", "Supported by")} {report.cooperativeName} · <AddressLink address={farmer} className="text-sm text-emas-200" />
          </span>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80">
            <ShieldCheck className="size-4 text-emas-300" aria-hidden /> {tr("Tercatat di BNB Chain, tidak bisa diubah siapa pun", "Recorded on BNB Chain, nobody can change it")}
          </span>
          {blocked && (
            <Badge tone="red" dot>
              {tr("Tidak bisa mengajukan proyek baru (pernah gagal bayar)", "Can't propose new projects (has defaulted before)")}
            </Badge>
          )}
        </div>
      </PageHero>
      <PageBody>
        <Card className="bg-linear-to-br from-white to-emas-50/60">
          <p className="max-w-3xl leading-relaxed text-stone-700">
            {tr(
              "Banyak petani kecil tidak punya riwayat kredit di bank. Rapor ini mencatat setiap musim yang didanai lewat BagiPanen, dari ketepatan waktu panen sampai seberapa akurat perkiraan hasilnya, supaya bisa jadi bukti kelayakan saat mengajukan modal berikutnya.",
              "Many small farmers have no credit history at a bank. This report card records every season funded through BagiPanen, from harvest punctuality to how accurate the yield estimate was, so it can serve as proof of trustworthiness when asking for the next round of capital.",
            )}
          </p>
        </Card>

        <section className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Stat icon={HandCoins} label={tr("Proyek didanai", "Projects funded")} value={s.campaignsFunded} />
          <Stat icon={Wheat} label={tr("Panen selesai", "Harvests completed")} value={s.harvestsCompleted} />
          <Stat
            icon={CalendarCheck}
            label={tr("Tepat waktu", "On time")}
            value={onTime === null ? "–" : formatPercent(onTime)}
            sub={
              s.harvestsCompleted > 0
                ? tr(`${s.onTimeHarvests} dari ${s.harvestsCompleted} panen`, `${s.onTimeHarvests} of ${s.harvestsCompleted} harvests`)
                : tr("belum ada panen", "no harvests yet")
            }
          />
          <Stat
            icon={Target}
            label={tr("Akurasi perkiraan", "Estimate accuracy")}
            value={accuracy === null ? "–" : formatPercent(accuracy)}
            sub={
              s.totalEstimated > 0n
                ? tr(
                    `hasil nyata ${formatUsdt(s.totalReported)} dari perkiraan ${formatUsdt(s.totalEstimated)} USDT`,
                    `actual ${formatUsdt(s.totalReported)} vs. estimated ${formatUsdt(s.totalEstimated)} USDT`,
                  )
                : tr("belum ada panen", "no harvests yet")
            }
          />
          <Stat icon={CloudRainWind} label={tr("Gagal panen", "Crop failures")} value={s.cropFailures} />
          <Stat icon={AlertOctagon} label={tr("Gagal bayar", "Defaults")} value={s.defaults} />
        </section>

        <section>
          <SectionTitle
            eyebrow={tr("Riwayat", "History")}
            description={
              s.totalReported > 0n
                ? tr(
                    `Total hasil penjualan yang sudah disetor: ${formatUsdt(s.totalReported)} USDT (sekitar ${formatRupiah(s.totalReported)}).`,
                    `Total sales proceeds deposited: ${formatUsdt(s.totalReported)} USDT (about ${formatRupiah(s.totalReported)}).`,
                  )
                : undefined
            }
          >
            {tr("Proyek yang pernah diajukan", "Projects proposed")}
          </SectionTitle>
          {!campaigns?.length ? (
            <EmptyState icon={Wheat} title={tr("Belum ada proyek tanam", "No crop projects yet")} />
          ) : (
            <div className="flex flex-col gap-4">
              {campaigns.map(({ summary: c }) => (
                <HistoryRow key={c.address} c={c} />
              ))}
            </div>
          )}
        </section>
      </PageBody>
    </>
  );
}
