"use client";

import { ArrowRight, Bot, Check, ExternalLink, FileCode2, HandCoins, Landmark, LockKeyhole, Sprout, Wheat } from "lucide-react";
import Link from "next/link";
import { AddressLink, StatusBadge } from "@/components/common";
import { Reveal } from "@/components/scroll";
import { Card, CardTitle, cn, Loading, PageBody, PageHero, SectionTitle, Stat } from "@/components/ui";
import { addresses, currentDeployment, REPUTATION_REGISTRY } from "@/lib/addresses";
import { useIpfsJson } from "@/lib/campaigns";
import { AGENT_WORKFLOW_URL, explorerAddressUrl, IS_LOCAL, REPO_URL } from "@/lib/config";
import { formatRupiah, formatUsdt } from "@/lib/format";
import { useAgentProfile } from "@/lib/registry";
import { useTransparency } from "@/lib/transparency";
import type { CampaignMetadata } from "@/lib/types";

type Project = NonNullable<ReturnType<typeof useTransparency>["data"]>["projects"][number];

const GUARANTEES = [
  "Dana investor dikunci di kontrak proyek. Admin pun tidak punya fungsi untuk menariknya.",
  "Dana cair per tahap (40% / 35% / 25%) hanya jika agen AI dan koperasi sama-sama setuju.",
  "Target tidak tercapai sampai tenggat → setiap investor bisa refund 100%.",
  "Saat panen, modal investor kembali dulu. Untungnya dibagi 55% petani, 40% investor, 5% dana cadangan.",
  "Gagal panen → sisa dana yang belum cair otomatis jadi milik investor, dan bisa ditambah kompensasi dari dana cadangan.",
  "Dana cadangan hanya bisa disalurkan ke proyek resmi yang gagal, tidak ke alamat lain.",
];

const FLOW = [
  { icon: HandCoins, title: "Investor", body: "setor mUSDT, dapat token porsi" },
  { icon: LockKeyhole, title: "Kontrak proyek", body: "dana dikunci (escrow)" },
  { icon: Sprout, title: "Petani", body: "cair per tahap setelah dua kunci" },
  { icon: Wheat, title: "Hasil panen", body: "disetor kembali ke kontrak" },
  { icon: Landmark, title: "Bagi hasil", body: "modal dulu, lalu 55 / 40 / 5" },
];

function ProjectRow({ p }: { p: Project }) {
  const c = p.summary;
  const { data: meta } = useIpfsJson<CampaignMetadata>(c.metadataCID);
  const url = explorerAddressUrl(c.address);
  return (
    <div className="grid gap-3 border-t border-krem-200 py-4 first:border-t-0 md:grid-cols-[1.6fr_repeat(4,1fr)] md:items-center md:gap-4">
      <div className="min-w-0">
        <Link href={`/campaign/${c.address}`} className="font-semibold text-hutan-950 hover:text-hutan-700">
          {meta?.title ?? `${c.commodity} di ${c.locationName}`}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-500">
          <StatusBadge status={c.status} failType={c.failType} />
          {url && (
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-hutan-700">
              kontrak <ExternalLink className="size-3" aria-hidden />
            </a>
          )}
        </div>
      </div>
      {[
        ["Didanai", c.raisedAmount],
        ["Cair ke petani", p.released],
        ["Di kontrak sekarang", p.escrow],
        ["Hasil panen", c.harvestAmount],
      ].map(([k, v]) => (
        <div key={k as string} className="flex items-baseline justify-between gap-2 md:block md:text-right">
          <span className="text-xs text-stone-500 md:hidden">{k as string}</span>
          <span className={cn("font-semibold tabular-nums", (v as bigint) > 0n ? "text-hutan-950" : "text-stone-400")}>
            {(v as bigint) > 0n ? formatUsdt(v as bigint) : "–"}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function TransparencyPage() {
  const { data, isLoading } = useTransparency();
  const { data: agent } = useAgentProfile();
  const t = data?.totals;

  const contracts = [
    { name: "CampaignFactory", note: "pendaftaran koperasi & petani, pembuat proyek", address: addresses.factory },
    { name: "mUSDT (MockUSDT)", note: "stablecoin demo testnet, 18 desimal", address: addresses.usdt },
    { name: "ReservePool", note: "dana cadangan 5%", address: addresses.reservePool },
    { name: "ReputationBook", note: "Rapor Petani & statistik agen", address: addresses.reputationBook },
    { name: "CampaignDeployer", note: "pembuat kontrak tiap proyek", address: currentDeployment?.campaignDeployer },
    { name: "ERC-8004 IdentityRegistry", note: "identitas agen AI (registri resmi)", address: agent?.identityRegistry },
    { name: "ERC-8004 ReputationRegistry", note: "penilaian koperasi untuk agen (registri resmi)", address: REPUTATION_REGISTRY },
    { name: "Wallet agen AI", note: agent?.configured ? `agen #${agent.agentId}` : "agen verifikator", address: agent?.agentWallet },
  ].filter((x) => x.address);

  return (
    <>
      <PageHero
        eyebrow="Transparansi"
        title="Ke mana uangnya pergi? Semua bisa dicek"
        description="Angka di halaman ini dibaca langsung dari smart contract di BNB Chain setiap kali dibuka, bukan dari database kami. Termasuk proyek uji coba awal yang tidak tampil di beranda."
      />
      <PageBody>
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat icon={HandCoins} label="Didanai investor" value={t ? formatUsdt(t.funded) : "…"} sub={t ? `USDT · sekitar ${formatRupiah(t.funded)}` : undefined} />
          <Stat icon={Sprout} label="Sudah cair ke petani" value={t ? formatUsdt(t.released) : "…"} sub="USDT, per tahap setelah dua kunci" />
          <Stat icon={LockKeyhole} label="Masih di kontrak" value={t ? formatUsdt(t.escrow) : "…"} sub="USDT: escrow + bagian yang belum diklaim" />
          <Stat icon={Wheat} label="Hasil panen disetor" value={t ? formatUsdt(t.harvest) : "…"} sub="USDT, dibagi otomatis oleh kontrak" />
        </section>

        <Reveal>
          <Card>
            <CardTitle icon={ArrowRight} description="Uang tidak pernah singgah di rekening BagiPanen. Semua perpindahan terjadi di kontrak dan tercatat publik.">
              Aliran dana
            </CardTitle>
            <ol className="grid gap-3 sm:grid-cols-5">
              {FLOW.map((f, i) => (
                <li key={f.title} className="relative flex flex-col items-center gap-2 rounded-2xl bg-krem-50 p-4 text-center ring-1 ring-krem-200">
                  <f.icon className="size-6 text-hutan-700" aria-hidden />
                  <p className="text-sm font-semibold text-hutan-950">{f.title}</p>
                  <p className="text-xs leading-snug text-balance text-stone-600">{f.body}</p>
                  {i < FLOW.length - 1 && (
                    <ArrowRight className="absolute top-1/2 -right-3 z-10 hidden size-4 -translate-y-1/2 text-emas-500 sm:block" aria-hidden />
                  )}
                </li>
              ))}
            </ol>
          </Card>
        </Reveal>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <Reveal className="h-full">
            <Card className="flex h-full flex-col gap-4">
              <CardTitle icon={Landmark} description="5% dari setiap keuntungan panen masuk ke sini, untuk menolong investor saat ada gagal panen.">
                Dana cadangan
              </CardTitle>
              <dl className="grid grid-cols-3 gap-3 text-center">
                {[
                  ["Saldo", data?.reserve.balance],
                  ["Total masuk", data?.reserve.contributed],
                  ["Kompensasi keluar", data?.reserve.compensated],
                ].map(([k, v]) => (
                  <div key={k as string} className="rounded-2xl bg-hutan-50 p-3 ring-1 ring-hutan-100">
                    <dd className="font-display text-xl font-semibold text-hutan-900">{v === undefined ? "…" : formatUsdt(v as bigint)}</dd>
                    <dt className="mt-0.5 text-xs text-stone-600">{k as string}</dt>
                  </div>
                ))}
              </dl>
              <p className="text-xs text-stone-500">Satuan USDT. Admin hanya bisa menyalurkan dana ini ke kontrak proyek resmi yang gagal.</p>
            </Card>
          </Reveal>
          <Reveal delay={100} className="h-full">
            <Card className="h-full">
              <CardTitle icon={Check} description="Aturan ini ditulis di kode kontrak yang terverifikasi di BscScan. Tidak ada yang bisa mengubahnya diam-diam.">
                Yang dijamin kontrak
              </CardTitle>
              <ul className="flex flex-col gap-2.5 text-sm text-stone-700">
                {GUARANTEES.map((g) => (
                  <li key={g} className="flex gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-hutan-600" aria-hidden />
                    <span className="text-pretty">{g}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
        </div>

        <section>
          <SectionTitle eyebrow="Per proyek" description="Satuan USDT. Klik judul untuk melihat timeline, foto bukti, dan riwayat transaksinya.">
            Rincian dana setiap proyek
          </SectionTitle>
          <Card className="py-2 sm:py-2">
            {isLoading || !data ? (
              <div className="py-6">
                <Loading>Membaca kontrak setiap proyek…</Loading>
              </div>
            ) : (
              <>
                <div className="hidden gap-4 border-b border-krem-200 py-3 text-xs font-semibold tracking-wide text-stone-500 uppercase md:grid md:grid-cols-[1.6fr_repeat(4,1fr)]">
                  <span>Proyek</span>
                  <span className="text-right">Didanai</span>
                  <span className="text-right">Cair ke petani</span>
                  <span className="text-right">Di kontrak</span>
                  <span className="text-right">Hasil panen</span>
                </div>
                {data.projects.map((p) => (
                  <ProjectRow key={p.summary.address} p={p} />
                ))}
              </>
            )}
          </Card>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardTitle icon={FileCode2} description={IS_LOCAL ? "Mode lokal (Anvil)." : "Semua kontrak BagiPanen sudah terverifikasi kode sumbernya di BscScan testnet."}>
              Kontrak & registri
            </CardTitle>
            <dl className="flex flex-col divide-y divide-krem-200 text-sm">
              {contracts.map((x) => (
                <div key={x.name} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
                  <div>
                    <dt className="font-semibold text-hutan-950">{x.name}</dt>
                    <dd className="text-xs text-stone-500">{x.note}</dd>
                  </div>
                  <AddressLink address={x.address!} />
                </div>
              ))}
            </dl>
          </Card>
          <Card className="flex flex-col gap-4">
            <CardTitle icon={Bot} description="Agen berjalan di cloud (GitHub Actions) dan log setiap putarannya terbuka untuk publik.">
              Agen AI & kode sumber
            </CardTitle>
            <ul className="flex flex-col gap-2 text-sm">
              <li>
                <Link href="/agent" className="inline-flex items-center gap-1.5 font-semibold text-hutan-700 hover:text-hutan-900">
                  Profil, reputasi & putusan agen <ArrowRight className="size-4" aria-hidden />
                </Link>
              </li>
              <li>
                <a href={AGENT_WORKFLOW_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-hutan-700 hover:text-hutan-900">
                  Log kerja agen di GitHub Actions <ExternalLink className="size-3.5" aria-hidden />
                </a>
              </li>
              <li>
                <a href={REPO_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-hutan-700 hover:text-hutan-900">
                  Kode sumber lengkap <ExternalLink className="size-3.5" aria-hidden />
                </a>
              </li>
            </ul>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
