"use client";

import { ArrowLeft, CalendarDays, ExternalLink, History, Landmark, MapPin, Receipt, Ruler, Sprout, TrendingUp, Wheat } from "lucide-react";
import Link from "next/link";
import { FarmerAvatar } from "@/components/FarmerAvatar";
import { useParams } from "next/navigation";
import { type Address, isAddress } from "viem";
import { CampaignCover, fundedPercent } from "@/components/CampaignCard";
import { ActivityLog } from "@/components/campaign/Activity";
import { ActionPanels } from "@/components/campaign/panels";
import { MilestoneTimeline } from "@/components/campaign/Timeline";
import { IpfsImage, StatusBadge } from "@/components/common";
import { Card, CardTitle, Container, Loading, Notice, PageBody, ProgressBar, SectionTitle, Skeleton } from "@/components/ui";
import { useCampaign, useIpfsJson } from "@/lib/campaigns";
import { explorerAddressUrl } from "@/lib/config";
import { e6ToDeg, formatArea, formatDate, formatDateTime, formatPercent, formatRupiah, formatTimeLeft, formatUsdt, googleMapsUrl, projectedInvestorReturn } from "@/lib/format";
import { useRole } from "@/lib/role";
import { useEffectiveNow } from "@/lib/time";
import { type CampaignMetadata, type CampaignSummary, FailType, Status } from "@/lib/types";


function fundingNote(c: CampaignSummary, now: bigint) {
  if (c.status === Status.Funding)
    return now > c.fundingDeadline
      ? "Waktu pendanaan sudah habis."
      : `Ditutup ${formatDateTime(c.fundingDeadline)} (${formatTimeLeft(c.fundingDeadline, Number(now) * 1000)}).`;
  if (c.status === Status.Draft) return "Masih direview admin. Pendanaan dibuka setelah disetujui.";
  if (c.status === Status.Cancelled) return "Pengajuan ini tidak disetujui admin.";
  if (c.status === Status.Failed && c.failType === FailType.Funding) return "Target tidak tercapai. Investor bisa mengambil refund 100%.";
  return `${formatUsdt(c.totalReleased)} dari ${formatUsdt(c.raisedAmount)} USDT sudah cair ke petani.`;
}

export default function CampaignPage() {
  const params = useParams<{ address: string }>();
  const address = isAddress(params.address) ? (params.address as Address) : undefined;
  const { data, isLoading, isError } = useCampaign(address);
  const { data: meta } = useIpfsJson<CampaignMetadata>(data?.summary.metadataCID);
  const { role } = useRole();
  const now = useEffectiveNow();

  if (!address || isLoading || isError || !data)
    return (
      <>
        <section className="glow-hutan bg-hutan-950 pt-10 pb-24">
          <Container>
            <Link href="/#proyek" className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white">
              <ArrowLeft className="size-4" aria-hidden /> Semua proyek
            </Link>
            {isLoading && <Skeleton className="mt-6 h-12 max-w-xl bg-white/10" />}
          </Container>
        </section>
        <PageBody>
          {!address ? (
            <Notice tone="error">Alamat proyeknya tidak valid. Cek lagi tautannya, ya.</Notice>
          ) : isLoading ? (
            <Loading>Memuat proyek dari blockchain…</Loading>
          ) : isError ? (
            <Notice tone="error">Proyek ini belum bisa dibaca dari blockchain. Coba muat ulang halaman.</Notice>
          ) : (
            <Notice tone="error">Proyek ini tidak terdaftar di BagiPanen.</Notice>
          )}
        </PageBody>
      </>
    );

  const { summary: c, milestones, symbol, farmerName, cooperativeName } = data;
  const ret = projectedInvestorReturn(c.targetAmount, c.estimatedRevenue);
  const contractUrl = explorerAddressUrl(c.address);
  const profit = c.harvestAmount >= c.raisedAmount ? c.harvestAmount - c.raisedAmount : 0n;
  const farmerShare = (profit * 5_500n) / 10_000n;
  const reserveShare = (profit * 500n) / 10_000n;
  const pct = fundedPercent(c);
  const costTotal = (meta?.costPlan ?? []).reduce((s, r) => s + r.usdt, 0);

  return (
    <>
      {/* ------------------------------------------------------------ Hero */}
      <section className="glow-hutan relative overflow-hidden bg-hutan-950 text-white">
        <div className="pola-bedengan absolute inset-0" aria-hidden />
        <Container className="relative pt-8 pb-24 sm:pb-28">
          <Link href="/#proyek" className="inline-flex items-center gap-1.5 text-sm text-white/60 transition hover:text-white">
            <ArrowLeft className="size-4" aria-hidden /> Semua proyek
          </Link>
          <div className="mt-6 grid items-center gap-8 lg:grid-cols-[1.15fr_1fr]">
            <div className="animate-fade-up">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={c.status} failType={c.failType} glass />
                <span className="text-xs text-white/50">
                  Proyek #{c.campaignId.toString()} · token {symbol}
                </span>
              </div>
              <h1 className="mt-4 font-display text-3xl leading-[1.1] font-semibold text-balance sm:text-5xl">{meta?.title ?? `${c.commodity} di ${c.locationName}`}</h1>
              <div className="mt-5 flex flex-wrap gap-2 text-sm">
                {[
                  { icon: Wheat, text: c.commodity },
                  { icon: MapPin, text: c.locationName },
                  { icon: Ruler, text: formatArea(c.landAreaM2) },
                ].map(({ icon: Icon, text }) => (
                  <span key={text} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/80">
                    <Icon className="size-3.5 text-emas-300" aria-hidden /> {text}
                  </span>
                ))}
              </div>
              <div className="mt-6 flex items-center gap-3">
                <FarmerAvatar name={farmerName || "Petani"} seed={c.farmer} commodity={c.commodity} className="size-14 shrink-0 drop-shadow-md" />
                <div className="text-sm">
                  <p>
                    <Link href={`/petani/${c.farmer}`} className="font-semibold text-white underline decoration-white/30 underline-offset-4 hover:decoration-emas-300">
                      {farmerName || "Petani"}
                    </Link>
                    <span className="text-white/60"> · didampingi {cooperativeName || "koperasi"}</span>
                  </p>
                  <Link href={`/petani/${c.farmer}`} className="text-emas-300 hover:text-emas-200">
                    Lihat Rapor Petani →
                  </Link>
                </div>
              </div>
            </div>
            <div className="h-64 overflow-hidden rounded-[2rem] shadow-lift ring-1 ring-white/15 sm:h-80">
              <CampaignCover cid={meta?.coverImageCID} commodity={c.commodity} />
            </div>
          </div>
        </Container>
      </section>

      <PageBody className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-8">
        {/* ------------------------------------------------- Kolom samping */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:order-last">
          <Card className="border-emas-200">
            <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">Terkumpul</p>
            <p className="mt-1 font-display text-4xl font-semibold text-hutan-950">
              {formatUsdt(c.raisedAmount)} <span className="font-sans text-lg font-semibold text-stone-400">USDT</span>
            </p>
            <p className="text-sm text-stone-500">
              dari target {formatUsdt(c.targetAmount)} USDT · sekitar {formatRupiah(c.targetAmount)}
            </p>
            <ProgressBar value={c.raisedAmount} max={c.targetAmount} className="mt-4" />
            <p className="mt-2 text-sm font-semibold text-emas-700">{pct}% terdanai</p>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-krem-200 pt-4 text-sm">
              <div>
                <p className="text-xs text-stone-500">Proyeksi imbal hasil</p>
                <p className="font-semibold text-hutan-700">{formatPercent(ret)} / musim</p>
              </div>
              <div>
                <p className="text-xs text-stone-500">Perkiraan panen</p>
                <p className="font-semibold text-hutan-950">{formatDate(c.expectedHarvestDate)}</p>
              </div>
            </div>
            <p className="mt-4 rounded-2xl bg-krem-50 px-3 py-2.5 text-sm text-stone-600">{fundingNote(c, now)}</p>
          </Card>
          <ActionPanels c={c} milestones={milestones} role={role} symbol={symbol} />
        </aside>

        {/* --------------------------------------------------- Kolom utama */}
        <div className="flex min-w-0 flex-col gap-8">
          {meta?.story && (
            <Card>
              <CardTitle icon={Sprout}>Cerita dari lahan</CardTitle>
              <p className="leading-relaxed whitespace-pre-line text-stone-700">{meta.story}</p>
            </Card>
          )}

          <Card>
            <CardTitle icon={TrendingUp} description="Modal investor kembali dulu, lalu untungnya dibagi 55% petani, 40% investor, dan 5% dana cadangan.">
              Lahan & proyeksi
            </CardTitle>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { icon: Ruler, label: "Luas lahan", value: formatArea(c.landAreaM2) },
                { icon: CalendarDays, label: "Perkiraan panen", value: formatDate(c.expectedHarvestDate) },
                { icon: Landmark, label: "Estimasi penjualan", value: `${formatUsdt(c.estimatedRevenue)} USDT` },
                { icon: TrendingUp, label: "Imbal hasil", value: `${formatPercent(ret)} / musim` },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-2xl bg-krem-50 p-3.5 ring-1 ring-krem-200">
                  <Icon className="size-4 text-hutan-500" aria-hidden />
                  <dt className="mt-2 text-xs text-stone-500">{label}</dt>
                  <dd className="text-sm font-semibold text-hutan-950">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-stone-600">
              <MapPin className="size-4 text-hutan-500" aria-hidden />
              {c.locationName} ({e6ToDeg(c.latE6)}, {e6ToDeg(c.lonE6)})
              <a href={googleMapsUrl(c.latE6, c.lonE6)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-hutan-700 hover:underline">
                Buka di Google Maps <ExternalLink className="size-3" aria-hidden />
              </a>
            </p>
          </Card>

          {meta?.costPlan && meta.costPlan.length > 0 && (
            <Card>
              <CardTitle icon={Receipt} description="Rincian rencana pemakaian modal dari petani.">
                Rencana biaya
              </CardTitle>
              <ul className="flex flex-col gap-3">
                {meta.costPlan.map((r) => (
                  <li key={r.item}>
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="text-stone-700">{r.item}</span>
                      <span className="font-semibold text-hutan-950">{r.usdt.toLocaleString("id-ID")} USDT</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-krem-200">
                      <div className="h-full rounded-full bg-hutan-500" style={{ width: `${costTotal ? (r.usdt / costTotal) * 100 : 0}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <section>
            <SectionTitle eyebrow="Tahap pencairan" description="Setiap tahap baru cair setelah foto lahannya disetujui agen AI dan koperasi.">
              Perjalanan dana
            </SectionTitle>
            <MilestoneTimeline c={c} milestones={milestones} />
          </section>

          {c.status === Status.Harvested && (
            <Card className="border-emas-200">
              <CardTitle icon={Wheat} description={`Panen terjual ${formatUsdt(c.harvestAmount)} USDT dan langsung dibagi oleh kontrak.`}>
                Hasil panen & bagi hasil
              </CardTitle>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-[180px_1fr]">
                <IpfsImage cid={c.receiptCID} alt="Foto nota penjualan" className="h-44" />
                <div className="flex flex-col gap-4">
                  <div className="flex h-10 overflow-hidden rounded-xl text-xs font-semibold">
                    <div className="flex items-center justify-center bg-hutan-800 text-white" style={{ width: `${(Number(c.raisedAmount) / Number(c.harvestAmount)) * 100}%` }}>
                      Modal
                    </div>
                    <div className="bg-hutan-500" style={{ width: `${(Number(c.investorPool - c.raisedAmount > 0n ? c.investorPool - c.raisedAmount : 0n) / Number(c.harvestAmount)) * 100}%` }} />
                    <div className="bg-emas-400" style={{ width: `${(Number(farmerShare) / Number(c.harvestAmount)) * 100}%` }} />
                    <div className="bg-emas-700" style={{ width: `${(Number(reserveShare) / Number(c.harvestAmount)) * 100}%` }} />
                  </div>
                  <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-sm">
                    <dt className="text-stone-500">Hasil penjualan</dt>
                    <dd className="text-right font-semibold">{formatUsdt(c.harvestAmount)} USDT</dd>
                    <dt className="text-stone-500">Keuntungan</dt>
                    <dd className="text-right">{formatUsdt(profit)} USDT</dd>
                    <dt className="text-stone-500">Bagian petani (55%)</dt>
                    <dd className="text-right">{formatUsdt(farmerShare)} USDT</dd>
                    <dt className="text-stone-500">Dana cadangan (5%)</dt>
                    <dd className="text-right">{formatUsdt(reserveShare)} USDT</dd>
                    <dt className="border-t border-krem-200 pt-1.5 font-semibold text-hutan-950">Untuk investor</dt>
                    <dd className="border-t border-krem-200 pt-1.5 text-right font-semibold text-hutan-950">{formatUsdt(c.investorPool)} USDT</dd>
                  </dl>
                </div>
              </div>
            </Card>
          )}

          <Card>
            <CardTitle
              icon={History}
              description="Setiap langkah tercatat di blockchain dan bisa dicek siapa saja."
              action={
                contractUrl && (
                  <a href={contractUrl} target="_blank" rel="noreferrer" className="hidden items-center gap-1 text-sm font-medium text-hutan-700 hover:underline sm:inline-flex">
                    Kontrak di BscScan <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                )
              }
            >
              Riwayat transaksi
            </CardTitle>
            <ActivityLog campaign={c.address} milestones={milestones} commodity={c.commodity} />
            {contractUrl && (
              <a href={contractUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-hutan-700 hover:underline sm:hidden">
                Kontrak di BscScan <ExternalLink className="size-3.5" aria-hidden />
              </a>
            )}
          </Card>
        </div>
      </PageBody>
    </>
  );
}
