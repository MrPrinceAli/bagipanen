"use client";

import { AlertOctagon, CalendarCheck, CloudRainWind, HandCoins, ShieldCheck, Target, Wheat } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type Address, isAddress } from "viem";
import { CampaignCover } from "@/components/CampaignCard";
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
            {meta?.title ?? `${c.commodity} di ${c.locationName}`}
          </Link>
          <StatusBadge status={c.status} failType={c.failType} />
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {[
            ["Dana terkumpul", `${formatUsdt(c.raisedAmount)} USDT`],
            ["Perkiraan jual", `${formatUsdt(c.estimatedRevenue)} USDT`],
            ["Hasil nyata", c.harvestAmount > 0n ? `${formatUsdt(c.harvestAmount)} USDT` : "–"],
            ["Perkiraan panen", formatDate(c.expectedHarvestDate)],
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
        <PageHero eyebrow="Rapor Petani" title="Rekam jejak petani" />
        <PageBody>
          {!farmer ? (
            <Notice tone="error">Alamat petaninya tidak valid. Cek lagi tautannya, ya.</Notice>
          ) : isLoading || !report ? (
            <Loading>Membaca rapor dari blockchain…</Loading>
          ) : (
            <Notice tone="info">Alamat ini belum didaftarkan sebagai petani oleh koperasi mana pun.</Notice>
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
        eyebrow="Rapor Petani"
        title={report.name}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            Didampingi {report.cooperativeName} · <AddressLink address={farmer} className="text-sm text-emas-200" />
          </span>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80">
            <ShieldCheck className="size-4 text-emas-300" aria-hidden /> Tercatat di BNB Chain, tidak bisa diubah siapa pun
          </span>
          {blocked && (
            <Badge tone="red" dot>
              Tidak bisa mengajukan kampanye baru (pernah gagal bayar)
            </Badge>
          )}
        </div>
      </PageHero>
      <PageBody>
        <Card className="bg-linear-to-br from-white to-emas-50/60">
          <p className="max-w-3xl leading-relaxed text-stone-700">
            Banyak petani kecil tidak punya riwayat kredit di bank. Rapor ini mencatat setiap musim yang didanai lewat BagiPanen, dari ketepatan
            waktu panen sampai seberapa akurat perkiraan hasilnya, supaya bisa jadi bukti kelayakan saat mengajukan modal berikutnya.
          </p>
        </Card>

        <section className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Stat icon={HandCoins} label="Kampanye didanai" value={s.campaignsFunded} />
          <Stat icon={Wheat} label="Panen selesai" value={s.harvestsCompleted} />
          <Stat
            icon={CalendarCheck}
            label="Tepat waktu"
            value={onTime === null ? "–" : formatPercent(onTime)}
            sub={s.harvestsCompleted > 0 ? `${s.onTimeHarvests} dari ${s.harvestsCompleted} panen` : "belum ada panen"}
          />
          <Stat
            icon={Target}
            label="Akurasi perkiraan"
            value={accuracy === null ? "–" : formatPercent(accuracy)}
            sub={s.totalEstimated > 0n ? `hasil nyata ${formatUsdt(s.totalReported)} dari perkiraan ${formatUsdt(s.totalEstimated)} USDT` : "belum ada panen"}
          />
          <Stat icon={CloudRainWind} label="Gagal panen" value={s.cropFailures} />
          <Stat icon={AlertOctagon} label="Gagal bayar" value={s.defaults} />
        </section>

        <section>
          <SectionTitle
            eyebrow="Riwayat"
            description={s.totalReported > 0n ? `Total hasil penjualan yang sudah disetor: ${formatUsdt(s.totalReported)} USDT (sekitar ${formatRupiah(s.totalReported)}).` : undefined}
          >
            Kampanye yang pernah diajukan
          </SectionTitle>
          {!campaigns?.length ? (
            <EmptyState icon={Wheat} title="Belum ada kampanye" />
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
