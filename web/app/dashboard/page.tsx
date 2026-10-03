"use client";

import { ArrowRight, Coins, HandCoins, PiggyBank, Plus, Sprout, Wallet } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { CampaignCover } from "@/components/CampaignCard";
import { StatusBadge, TxStatus, Usdt } from "@/components/common";
import { Button, ButtonLink, Card, cn, EmptyState, Loading, Notice, PageBody, PageHero, ProgressBar, SectionTitle, Stat } from "@/components/ui";
import { RoleGate } from "@/components/wallet";
import { harvestCampaignAbi } from "@/lib/abi/HarvestCampaign";
import { useCampaignList, useFarmerCampaigns, useIpfsJson, useMyPositions } from "@/lib/campaigns";
import { formatPercent, formatTimeLeft, formatUsdt } from "@/lib/format";
import { useRole } from "@/lib/role";
import { useTx } from "@/lib/tx";
import { type CampaignMetadata, type CampaignSummary, FailType, type Milestone, MStatus, Status } from "@/lib/types";

/** Apa yang perlu dilakukan petani berikutnya, berdasarkan status kampanye & tahap aktif. */
function nextAction(c: CampaignSummary, milestones: readonly Milestone[]): { text: string; urgent: boolean } {
  const now = Math.floor(Date.now() / 1000);
  switch (c.status) {
    case Status.Draft:
      return { text: "Pengajuanmu sedang direview admin.", urgent: false };
    case Status.Funding:
      return now > Number(c.fundingDeadline)
        ? { text: "Waktu pendanaan habis dan target belum tercapai. Pendanaan perlu ditutup supaya investor bisa refund.", urgent: true }
        : {
            text: `Pendanaan sedang berjalan: ${formatUsdt(c.raisedAmount)} dari ${formatUsdt(c.targetAmount)} USDT, ditutup ${formatTimeLeft(c.fundingDeadline)}.`,
            urgent: false,
          };
    case Status.Active: {
      if (c.currentMilestone >= c.milestoneCount) return { text: "Semua dana tahap sudah cair. Saatnya setor hasil panen beserta foto notanya.", urgent: true };
      const m = milestones[c.currentMilestone];
      if (m.status === MStatus.Pending) return { text: `Kirim foto bukti untuk tahap ${m.name}.`, urgent: true };
      if (m.status === MStatus.Rejected)
        return m.attempts < 3
          ? { text: `Bukti tahap ${m.name} ditolak. Kirim foto baru (percobaan ${m.attempts + 1} dari 3).`, urgent: true }
          : { text: `Bukti tahap ${m.name} ditolak final oleh admin.`, urgent: false };
      if (m.status === MStatus.Disputed) return { text: `Tahap ${m.name} sedang ditinjau admin.`, urgent: false };
      return { text: `Bukti tahap ${m.name} sedang dicek agen AI dan koperasi.`, urgent: false };
    }
    case Status.Harvested:
      return { text: "Selesai. Hasil panen sudah dibagi ke semua pihak.", urgent: false };
    case Status.Failed:
      return { text: c.failType === FailType.Funding ? "Target pendanaan tidak tercapai." : "Proyek ini ditandai gagal panen.", urgent: false };
    case Status.Defaulted:
      return { text: "Proyek ini ditandai gagal bayar.", urgent: false };
    default:
      return { text: "Pengajuan ini tidak disetujui admin.", urgent: false };
  }
}

function CampaignRow({ c, children }: { c: CampaignSummary; children: ReactNode }) {
  const { data: meta } = useIpfsJson<CampaignMetadata>(c.metadataCID);
  return (
    <Card className="flex flex-col gap-4 sm:flex-row">
      <Link href={`/campaign/${c.address}`} className="relative block h-36 shrink-0 overflow-hidden rounded-2xl sm:h-auto sm:min-h-32 sm:w-44">
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
        {children}
      </div>
    </Card>
  );
}

function FarmerDashboard({ address }: { address: `0x${string}` }) {
  const { data, isLoading } = useFarmerCampaigns(address);
  if (isLoading) return <Loading>Memuat proyekmu…</Loading>;
  return (
    <section>
      <SectionTitle
        eyebrow="Proyek tanam saya"
        description="Pantau tahap pencairan dan langkah berikutnya di sini."
        action={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`/petani/${address}`} variant="secondary">
              Rapor saya
            </ButtonLink>
            <ButtonLink href="/create" variant="primary">
              <Plus className="size-4" aria-hidden /> Ajukan proyek tanam
            </ButtonLink>
          </div>
        }
      >
        Lahan yang sedang kamu kelola
      </SectionTitle>
      {!data?.length ? (
        <EmptyState icon={Sprout} title="Belum ada proyek tanam">
          Ajukan proyek tanam pertamamu untuk mendapatkan modal tanam.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          {data.map(({ summary: c, milestones }) => {
            const next = nextAction(c, milestones);
            return (
              <CampaignRow key={c.address} c={c}>
                <div>
                  <ProgressBar value={c.totalReleased} max={c.raisedAmount === 0n ? c.targetAmount : c.raisedAmount} />
                  <p className="mt-1.5 text-sm text-stone-600">
                    {formatUsdt(c.totalReleased)} dari {formatUsdt(c.raisedAmount)} USDT sudah cair · tahap {Math.min(c.currentMilestone + 1, c.milestoneCount)} dari{" "}
                    {c.milestoneCount}
                  </p>
                </div>
                <Notice tone={next.urgent ? "warn" : "info"}>
                  <span className="font-semibold">Berikutnya:</span> {next.text}{" "}
                  <Link href={`/campaign/${c.address}`} className="font-semibold underline">
                    Buka proyek
                  </Link>
                </Notice>
              </CampaignRow>
            );
          })}
        </div>
      )}
    </section>
  );
}

function PositionActions({ c, claimable, shares }: { c: CampaignSummary; claimable: bigint; shares: bigint }) {
  const tx = useTx();
  const canRefund = c.status === Status.Failed && c.failType === FailType.Funding && shares > 0n;
  if (claimable === 0n && !canRefund) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {claimable > 0n && (
          <Button variant="gold" loading={tx.busy} onClick={() => tx.write({ address: c.address, abi: harvestCampaignAbi, functionName: "claim" })}>
            <Coins className="size-4" aria-hidden /> Klaim {formatUsdt(claimable)} USDT
          </Button>
        )}
        {canRefund && (
          <Button loading={tx.busy} onClick={() => tx.write({ address: c.address, abi: harvestCampaignAbi, functionName: "refund" })}>
            Ambil refund {formatUsdt(shares)} USDT
          </Button>
        )}
      </div>
      <TxStatus state={tx.state} successText="Dana sudah masuk ke dompetmu." />
    </div>
  );
}

function InvestorDashboard() {
  const { data: campaigns } = useCampaignList();
  const { data: positions, isLoading } = useMyPositions(campaigns);
  if (isLoading || !campaigns) return <Loading>Memuat porsimu…</Loading>;
  const invested = (positions ?? []).reduce((s, p) => s + p.shares, 0n);
  const claimable = (positions ?? []).reduce((s, p) => s + p.claimable, 0n);
  const received = (positions ?? []).reduce((s, p) => s + p.paidOut, 0n);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat icon={HandCoins} label="Total kamu danai" value={formatUsdt(invested)} sub="USDT di semua proyek" />
        <Stat icon={PiggyBank} label="Siap diklaim" value={formatUsdt(claimable)} sub="USDT, tinggal klaim" />
        <Stat icon={Wallet} label="Sudah diterima" value={formatUsdt(received)} sub="USDT masuk ke dompetmu" />
      </div>
      <section>
        <SectionTitle eyebrow="Porsi saya" description="Setiap porsi tercatat sebagai token atas namamu dan tidak bisa dipindahtangankan.">
          Proyek yang kamu dukung
        </SectionTitle>
        {!positions?.length ? (
          <EmptyState icon={HandCoins} title="Kamu belum mendanai proyek apa pun">
            <Link href="/#proyek" className="inline-flex items-center gap-1 font-semibold text-hutan-700 underline">
              Lihat proyek yang sedang cari dana <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-4">
            {positions.map(({ campaign: c, shares, claimable: cl, paidOut }) => {
              const supply = c.totalSharesAtSettle > 0n ? c.totalSharesAtSettle : c.raisedAmount;
              const pct = supply > 0n ? Number((shares * 10_000n) / supply) / 10_000 : 0;
              return (
                <CampaignRow key={c.address} c={c}>
                  <dl className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-stone-500">Porsimu</dt>
                      <dd className="font-semibold text-hutan-950">
                        {formatUsdt(shares)} <span className="font-normal text-stone-500">({formatPercent(pct)})</span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-stone-500">Siap diklaim</dt>
                      <dd className={cn(cl > 0n && "text-emas-700")}>
                        <Usdt value={cl} showRupiah={false} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-stone-500">Sudah diterima</dt>
                      <dd className="font-semibold text-hutan-950">{formatUsdt(paidOut)} USDT</dd>
                    </div>
                  </dl>
                  <PositionActions c={c} claimable={cl} shares={shares} />
                </CampaignRow>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

export default function DashboardPage() {
  const { role, address } = useRole();
  const isFarmer = role === "petani";
  return (
    <>
      <PageHero
        eyebrow="Dashboard"
        title={isFarmer ? "Halo, semoga panennya melimpah" : "Pantau danamu tumbuh bersama petani"}
        description={
          isFarmer
            ? "Semua proyekmu ada di sini, lengkap dengan langkah yang perlu kamu lakukan berikutnya."
            : "Lihat porsimu di setiap proyek, perkembangan tahap pencairannya, dan hasil yang siap diklaim."
        }
      />
      <PageBody>
        {role === undefined ? (
          <Loading />
        ) : role === "tamu" ? (
          <RoleGate need="dashboard" role={role} />
        ) : isFarmer && address ? (
          <FarmerDashboard address={address} />
        ) : role === "investor" ? (
          <InvestorDashboard />
        ) : (
          <RoleGate need="dashboard" role={role}>
            {role === "koperasi" && <ButtonLink href="/koperasi">Buka halaman koperasi</ButtonLink>}
            {role === "admin" && <ButtonLink href="/admin">Buka halaman admin</ButtonLink>}
          </RoleGate>
        )}
      </PageBody>
    </>
  );
}
