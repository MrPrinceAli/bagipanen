"use client";

import { tr, trTerm } from "@/lib/i18n";
import { ArrowRight, CloudRainWind, HandCoins, MapPin, ShieldCheck, Users, Wheat } from "lucide-react";
import Link from "next/link";
import { type Address, isAddressEqual } from "viem";
import { AddressLink } from "@/components/common";
import { FarmerAvatar } from "@/components/FarmerAvatar";
import { Reveal } from "@/components/scroll";
import { Badge, Card, EmptyState, Loading, PageBody, PageHero, SectionTitle, Stat } from "@/components/ui";
import { useCampaignList } from "@/lib/campaigns";
import { formatPercent } from "@/lib/format";
import { useFarmerDirectory } from "@/lib/registry";
import type { CampaignSummary } from "@/lib/types";

type FarmerRow = NonNullable<ReturnType<typeof useFarmerDirectory>["data"]>["farmers"][number];

function FarmerCard({ f, campaigns }: { f: FarmerRow; campaigns: CampaignSummary[] }) {
  const s = f.stats;
  const latest = campaigns[0];
  const commodities = [...new Set(campaigns.map((c) => c.commodity))];
  const onTime = s.harvestsCompleted > 0 ? formatPercent(s.onTimeHarvests / s.harvestsCompleted) : "–";
  return (
    <Link
      href={`/petani/${f.address}`}
      className="group flex h-full flex-col gap-4 rounded-3xl border border-krem-200 bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div className="flex items-start gap-3">
        <FarmerAvatar name={f.name || tr("Petani", "Farmer")} seed={f.address} commodity={campaigns[0]?.commodity} className="size-20 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg leading-snug font-semibold text-hutan-950">{f.name || tr("Petani", "Farmer")}</p>
          <p className="truncate text-sm text-stone-500">{f.cooperativeName || tr("Koperasi", "Cooperative")}</p>
        </div>
        {s.defaults > 0 && (
          <Badge tone="red" dot>
            {tr("Diblokir", "Blocked")}
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
        {latest && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5 text-hutan-500" aria-hidden /> {latest.locationName}
          </span>
        )}
        {commodities.map((c) => (
          <Badge key={c} tone="brown">
            {trTerm(c)}
          </Badge>
        ))}
      </div>
      <dl className="mt-auto grid grid-cols-4 gap-2 rounded-2xl bg-krem-50 p-3 text-center ring-1 ring-krem-200">
        {[
          [tr("Didanai", "Funded"), s.campaignsFunded],
          [tr("Panen", "Harvests"), s.harvestsCompleted],
          [tr("Tepat waktu", "On time"), onTime],
          [tr("Gagal", "Failed"), s.cropFailures + s.defaults],
        ].map(([k, v]) => (
          <div key={k as string}>
            <dd className="font-display text-lg font-semibold text-hutan-950">{v}</dd>
            <dt className="text-[11px] leading-tight text-stone-500">{k}</dt>
          </div>
        ))}
      </dl>
      <span className="inline-flex items-center gap-1 text-sm font-semibold text-hutan-700 group-hover:text-hutan-900">
        {tr("Lihat Rapor Petani", "View report card")} <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  );
}

export default function FarmerDirectoryPage() {
  const { data, isLoading } = useFarmerDirectory();
  const { data: campaigns } = useCampaignList();

  const byFarmer = (a: Address) => (campaigns ?? []).filter((c) => isAddressEqual(c.farmer, a));
  const farmers = [...(data?.farmers ?? [])].sort(
    (a, b) => b.stats.harvestsCompleted - a.stats.harvestsCompleted || b.stats.campaignsFunded - a.stats.campaignsFunded,
  );
  const total = farmers.reduce(
    (acc, f) => ({
      harvests: acc.harvests + f.stats.harvestsCompleted,
      funded: acc.funded + f.stats.campaignsFunded,
      failures: acc.failures + f.stats.cropFailures + f.stats.defaults,
    }),
    { harvests: 0, funded: 0, failures: 0 },
  );

  return (
    <>
      <PageHero
        eyebrow={tr("Petani & koperasi", "Farmers & cooperatives")}
        title={tr("Rapor Petani yang bisa dicek siapa saja", "Farmer report cards anyone can check")}
        description={tr(
          "Banyak petani kecil tidak punya riwayat kredit di bank. Setiap musim yang didanai lewat BagiPanen tercatat di blockchain: berapa kali didanai, berapa yang panen tepat waktu, sampai yang gagal. Catatan ini tidak bisa diubah, termasuk oleh admin.",
          "Many small farmers have no credit history at a bank. Every season funded through BagiPanen is recorded on the blockchain: how often they were funded, how many harvests came in on time, and which ones failed. Nobody can change these records, not even the admin.",
        )}
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80">
          <ShieldCheck className="size-4 text-emas-300" aria-hidden /> Ditulis otomatis oleh kontrak ReputationBook
        </span>
      </PageHero>
      <PageBody>
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat
            icon={Users}
            label={tr("Petani", "Farmers")}
            value={data ? farmers.length : "…"}
            sub={data ? tr(`didampingi ${data.cooperatives.length} koperasi`, `supported by ${data.cooperatives.length} cooperatives`) : undefined}
          />
          <Stat icon={HandCoins} label={tr("Musim didanai", "Seasons funded")} value={data ? total.funded : "…"} />
          <Stat icon={Wheat} label={tr("Panen selesai", "Harvests completed")} value={data ? total.harvests : "…"} />
          <Stat icon={CloudRainWind} label={tr("Gagal panen / bayar", "Crop failures / defaults")} value={data ? total.failures : "…"} sub={tr("tetap tercatat apa adanya", "recorded as they happened")} />
        </section>

        <section>
          <SectionTitle
            eyebrow={tr("Direktori", "Directory")}
            description={tr("Klik kartu untuk melihat Rapor lengkap dan riwayat setiap musimnya.", "Click a card to see the full report card and the history of every season.")}
          >
            {tr("Petani mitra BagiPanen", "BagiPanen partner farmers")}
          </SectionTitle>
          {isLoading || !data ? (
            <Loading>{tr("Membaca data petani dari blockchain…", "Reading farmer data from the blockchain…")}</Loading>
          ) : farmers.length === 0 ? (
            <EmptyState icon={Users} title={tr("Belum ada petani terdaftar", "No farmers registered yet")} />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {farmers.map((f, i) => (
                <Reveal key={f.address} delay={(i % 3) * 80} className="h-full">
                  <FarmerCard f={f} campaigns={byFarmer(f.address)} />
                </Reveal>
              ))}
            </div>
          )}
        </section>

        {data && data.cooperatives.length > 0 && (
          <section>
            <SectionTitle
              eyebrow={tr("Koperasi", "Cooperatives")}
              description={tr(
                "Koperasi mendaftarkan petani anggotanya dan menjadi kunci kedua pencairan dana, setelah agen AI.",
                "Cooperatives register their member farmers and hold the second key for releasing funds, after the AI agent.",
              )}
            >
              {tr("Koperasi pendamping", "Partner cooperatives")}
            </SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.cooperatives.map((c) => {
                const members = farmers.filter((f) => f.cooperative && isAddressEqual(f.cooperative, c.address)).length;
                const projects = (campaigns ?? []).filter((x) => isAddressEqual(x.cooperative, c.address)).length;
                return (
                  <Card key={c.address} className="flex flex-col gap-2">
                    <p className="font-semibold text-hutan-950">{c.name}</p>
                    <p className="text-sm text-stone-600">
                      {tr(`${members} petani anggota · ${projects} proyek`, `${members} member farmers · ${projects} projects`)}
                    </p>
                    <AddressLink address={c.address} className="text-xs text-stone-500" />
                  </Card>
                );
              })}
            </div>
          </section>
        )}
      </PageBody>
    </>
  );
}
