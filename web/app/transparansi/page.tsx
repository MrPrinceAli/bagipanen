"use client";

import { tr, trTerm } from "@/lib/i18n";
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

const guarantees = () => [
  tr(
    "Dana investor dikunci di kontrak proyek. Admin pun tidak punya fungsi untuk menariknya.",
    "Investor funds are locked in the project contract. Not even the admin has a function to withdraw them.",
  ),
  tr(
    "Dana cair per tahap (40% / 35% / 25%) hanya jika agen AI dan koperasi sama-sama setuju.",
    "Funds are released stage by stage (40% / 35% / 25%) only when both the AI agent and the cooperative agree.",
  ),
  tr("Target tidak tercapai sampai tenggat → setiap investor bisa refund 100%.", "Target not reached by the deadline → every investor can get a 100% refund."),
  tr(
    "Saat panen, modal investor kembali dulu. Untungnya dibagi 55% petani, 40% investor, 5% dana cadangan.",
    "At harvest, investor capital comes back first. The profit is split 55% farmer, 40% investors, 5% reserve fund.",
  ),
  tr(
    "Gagal panen → sisa dana yang belum cair otomatis jadi milik investor, dan bisa ditambah kompensasi dari dana cadangan.",
    "Crop failure → unreleased funds automatically go to investors, topped up by compensation from the reserve fund.",
  ),
  tr(
    "Dana cadangan hanya bisa disalurkan ke proyek resmi yang gagal, tidak ke alamat lain.",
    "The reserve fund can only pay out to official projects that failed, never to any other address.",
  ),
];

const flow = () => [
  { icon: HandCoins, title: "Investor", body: tr("setor mUSDT, dapat token porsi", "deposit mUSDT, get share tokens") },
  { icon: LockKeyhole, title: tr("Kontrak proyek", "Project contract"), body: tr("dana dikunci (escrow)", "funds locked (escrow)") },
  { icon: Sprout, title: tr("Petani", "Farmer"), body: tr("cair per tahap setelah dua kunci", "released per stage after two keys") },
  { icon: Wheat, title: tr("Hasil panen", "Harvest"), body: tr("disetor kembali ke kontrak", "deposited back into the contract") },
  { icon: Landmark, title: tr("Bagi hasil", "Profit split"), body: tr("modal dulu, lalu 55 / 40 / 5", "capital first, then 55 / 40 / 5") },
];

function ProjectRow({ p }: { p: Project }) {
  const c = p.summary;
  const { data: meta } = useIpfsJson<CampaignMetadata>(c.metadataCID);
  const url = explorerAddressUrl(c.address);
  return (
    <div className="grid gap-3 border-t border-krem-200 py-4 first:border-t-0 md:grid-cols-[1.6fr_repeat(4,1fr)] md:items-center md:gap-4">
      <div className="min-w-0">
        <Link href={`/campaign/${c.address}`} className="font-semibold text-hutan-950 hover:text-hutan-700">
          {meta?.title ?? `${trTerm(c.commodity)} ${tr("di", "in")} ${c.locationName}`}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-500">
          <StatusBadge status={c.status} failType={c.failType} />
          {url && (
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-hutan-700">
              {tr("kontrak", "contract")} <ExternalLink className="size-3" aria-hidden />
            </a>
          )}
        </div>
      </div>
      {[
        [tr("Didanai", "Funded"), c.raisedAmount],
        [tr("Cair ke petani", "Released to farmer"), p.released],
        [tr("Di kontrak sekarang", "In the contract now"), p.escrow],
        [tr("Hasil panen", "Harvest"), c.harvestAmount],
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
  const FLOWS = flow();

  const contracts = [
    { name: "CampaignFactory", note: tr("pendaftaran koperasi & petani, pembuat proyek", "registers cooperatives & farmers, creates projects"), address: addresses.factory },
    { name: "mUSDT (MockUSDT)", note: tr("stablecoin demo testnet, 18 desimal", "testnet demo stablecoin, 18 decimals"), address: addresses.usdt },
    { name: "ReservePool", note: tr("dana cadangan 5%", "5% reserve fund"), address: addresses.reservePool },
    { name: "ReputationBook", note: tr("Rapor Petani & statistik agen", "farmer report cards & agent stats"), address: addresses.reputationBook },
    { name: "CampaignDeployer", note: tr("pembuat kontrak tiap proyek", "deploys each project's contract"), address: currentDeployment?.campaignDeployer },
    { name: "ERC-8004 IdentityRegistry", note: tr("identitas agen AI (registri resmi)", "AI agent identity (official registry)"), address: agent?.identityRegistry },
    { name: "ERC-8004 ReputationRegistry", note: tr("penilaian koperasi untuk agen (registri resmi)", "cooperative ratings of the agent (official registry)"), address: REPUTATION_REGISTRY },
    { name: tr("Wallet agen AI", "AI agent wallet"), note: agent?.configured ? tr(`agen #${agent.agentId}`, `agent #${agent.agentId}`) : tr("agen verifikator", "verifier agent"), address: agent?.agentWallet },
  ].filter((x) => x.address);

  return (
    <>
      <PageHero
        eyebrow={tr("Transparansi", "Transparency")}
        title={tr("Ke mana uangnya pergi? Semua bisa dicek", "Where does the money go? You can check it all")}
        description={tr(
          "Angka di halaman ini dibaca langsung dari smart contract di BNB Chain setiap kali dibuka, bukan dari database kami. Termasuk proyek uji coba awal yang tidak tampil di beranda.",
          "The numbers on this page are read straight from the smart contracts on BNB Chain every time it opens, not from our database. That includes early test projects that don't appear on the home page.",
        )}
      />
      <PageBody>
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat icon={HandCoins} label={tr("Didanai investor", "Funded by investors")} value={t ? formatUsdt(t.funded) : "…"} sub={t ? `USDT · ${tr("sekitar", "about")} ${formatRupiah(t.funded)}` : undefined} />
          <Stat icon={Sprout} label={tr("Sudah cair ke petani", "Released to farmers")} value={t ? formatUsdt(t.released) : "…"} sub={tr("USDT, per tahap setelah dua kunci", "USDT, per stage after two keys")} />
          <Stat icon={LockKeyhole} label={tr("Masih di kontrak", "Still in contracts")} value={t ? formatUsdt(t.escrow) : "…"} sub={tr("USDT: escrow + bagian yang belum diklaim", "USDT: escrow + unclaimed shares")} />
          <Stat icon={Wheat} label={tr("Hasil panen disetor", "Harvest deposited")} value={t ? formatUsdt(t.harvest) : "…"} sub={tr("USDT, dibagi otomatis oleh kontrak", "USDT, split automatically by the contract")} />
        </section>

        <Reveal>
          <Card>
            <CardTitle
              icon={ArrowRight}
              description={tr(
                "Uang tidak pernah singgah di rekening BagiPanen. Semua perpindahan terjadi di kontrak dan tercatat publik.",
                "The money never passes through a BagiPanen bank account. Every movement happens in the contracts and is recorded publicly.",
              )}
            >
              {tr("Aliran dana", "Money flow")}
            </CardTitle>
            <ol className="grid gap-3 sm:grid-cols-5">
              {FLOWS.map((f, i) => (
                <li key={f.title} className="relative flex flex-col items-center gap-2 rounded-2xl bg-krem-50 p-4 text-center ring-1 ring-krem-200">
                  <f.icon className="size-6 text-hutan-700" aria-hidden />
                  <p className="text-sm font-semibold text-hutan-950">{f.title}</p>
                  <p className="text-xs leading-snug text-balance text-stone-600">{f.body}</p>
                  {i < FLOWS.length - 1 && (
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
              <CardTitle
                icon={Landmark}
                description={tr(
                  "5% dari setiap keuntungan panen masuk ke sini, untuk menolong investor saat ada gagal panen.",
                  "5% of every harvest profit goes here, to help investors when a crop fails.",
                )}
              >
                {tr("Dana cadangan", "Reserve fund")}
              </CardTitle>
              <dl className="grid grid-cols-3 gap-3 text-center">
                {[
                  [tr("Saldo", "Balance"), data?.reserve.balance],
                  [tr("Total masuk", "Total in"), data?.reserve.contributed],
                  [tr("Kompensasi keluar", "Compensation paid"), data?.reserve.compensated],
                ].map(([k, v]) => (
                  <div key={k as string} className="rounded-2xl bg-hutan-50 p-3 ring-1 ring-hutan-100">
                    <dd className="font-display text-xl font-semibold text-hutan-900">{v === undefined ? "…" : formatUsdt(v as bigint)}</dd>
                    <dt className="mt-0.5 text-xs text-stone-600">{k as string}</dt>
                  </div>
                ))}
              </dl>
              <p className="text-xs text-stone-500">{tr("Satuan USDT. Admin hanya bisa menyalurkan dana ini ke kontrak proyek resmi yang gagal.", "In USDT. The admin can only pay this out to official project contracts that failed.")}</p>
            </Card>
          </Reveal>
          <Reveal delay={100} className="h-full">
            <Card className="h-full">
              <CardTitle
                icon={Check}
                description={tr(
                  "Aturan ini ditulis di kode kontrak yang terverifikasi di BscScan. Tidak ada yang bisa mengubahnya diam-diam.",
                  "These rules are written in contract code verified on BscScan. Nobody can change them quietly.",
                )}
              >
                {tr("Yang dijamin kontrak", "What the contracts guarantee")}
              </CardTitle>
              <ul className="flex flex-col gap-2.5 text-sm text-stone-700">
                {guarantees().map((g) => (
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
          <SectionTitle
            eyebrow={tr("Per proyek", "Per project")}
            description={tr(
              "Satuan USDT. Klik judul untuk melihat timeline, foto bukti, dan riwayat transaksinya.",
              "In USDT. Click a title to see its timeline, proof photos, and transaction history.",
            )}
          >
            {tr("Rincian dana setiap proyek", "Funds for every project")}
          </SectionTitle>
          <Card className="py-2 sm:py-2">
            {isLoading || !data ? (
              <div className="py-6">
                <Loading>{tr("Membaca kontrak setiap proyek…", "Reading every project contract…")}</Loading>
              </div>
            ) : (
              <>
                <div className="hidden gap-4 border-b border-krem-200 py-3 text-xs font-semibold tracking-wide text-stone-500 uppercase md:grid md:grid-cols-[1.6fr_repeat(4,1fr)]">
                  <span>{tr("Proyek", "Project")}</span>
                  <span className="text-right">{tr("Didanai", "Funded")}</span>
                  <span className="text-right">{tr("Cair ke petani", "Released to farmer")}</span>
                  <span className="text-right">{tr("Di kontrak", "In contract")}</span>
                  <span className="text-right">{tr("Hasil panen", "Harvest")}</span>
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
            <CardTitle
              icon={FileCode2}
              description={
                IS_LOCAL
                  ? tr("Mode lokal (Anvil).", "Local mode (Anvil).")
                  : tr("Semua kontrak BagiPanen sudah terverifikasi kode sumbernya di BscScan testnet.", "All BagiPanen contracts have verified source code on BscScan testnet.")
              }
            >
              {tr("Kontrak & registri", "Contracts & registries")}
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
            <CardTitle
              icon={Bot}
              description={tr(
                "Agen berjalan di cloud (GitHub Actions) dan log setiap putarannya terbuka untuk publik.",
                "The agent runs in the cloud (GitHub Actions), and the log of every round is public.",
              )}
            >
              {tr("Agen AI & kode sumber", "AI agent & source code")}
            </CardTitle>
            <ul className="flex flex-col gap-2 text-sm">
              <li>
                <Link href="/agent" className="inline-flex items-center gap-1.5 font-semibold text-hutan-700 hover:text-hutan-900">
                  {tr("Profil, reputasi & putusan agen", "Agent profile, reputation & verdicts")} <ArrowRight className="size-4" aria-hidden />
                </Link>
              </li>
              <li>
                <a href={AGENT_WORKFLOW_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-hutan-700 hover:text-hutan-900">
                  {tr("Log kerja agen di GitHub Actions", "Agent work log on GitHub Actions")} <ExternalLink className="size-3.5" aria-hidden />
                </a>
              </li>
              <li>
                <a href={REPO_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-hutan-700 hover:text-hutan-900">
                  {tr("Kode sumber lengkap", "Full source code")} <ExternalLink className="size-3.5" aria-hidden />
                </a>
              </li>
            </ul>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
