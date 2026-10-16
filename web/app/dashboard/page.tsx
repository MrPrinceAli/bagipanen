"use client";

import { tr, trTerm } from "@/lib/i18n";
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
      return { text: tr("Pengajuanmu sedang direview admin.", "The admin is reviewing your proposal."), urgent: false };
    case Status.Funding:
      return now > Number(c.fundingDeadline)
        ? {
            text: tr(
              "Waktu pendanaan habis dan target belum tercapai. Pendanaan perlu ditutup supaya investor bisa refund.",
              "Funding has ended without reaching the target. It needs to be closed so investors can take a refund.",
            ),
            urgent: true,
          }
        : {
            text: tr(
              `Pendanaan sedang berjalan: ${formatUsdt(c.raisedAmount)} dari ${formatUsdt(c.targetAmount)} USDT, ditutup ${formatTimeLeft(c.fundingDeadline)}.`,
              `Funding in progress: ${formatUsdt(c.raisedAmount)} of ${formatUsdt(c.targetAmount)} USDT, closes in ${formatTimeLeft(c.fundingDeadline).replace(" left", "")}.`,
            ),
            urgent: false,
          };
    case Status.Active: {
      if (c.currentMilestone >= c.milestoneCount)
        return {
          text: tr(
            "Semua dana tahap sudah cair. Saatnya setor hasil panen beserta foto notanya.",
            "All stage funds are released. Time to deposit the harvest proceeds with a photo of the receipt.",
          ),
          urgent: true,
        };
      const m = milestones[c.currentMilestone];
      if (m.status === MStatus.Pending) return { text: tr(`Kirim foto bukti untuk tahap ${m.name}.`, `Send a proof photo for the ${trTerm(m.name)} stage.`), urgent: true };
      if (m.status === MStatus.Rejected)
        return m.attempts < 3
          ? {
              text: tr(
                `Bukti tahap ${m.name} ditolak. Kirim foto baru (percobaan ${m.attempts + 1} dari 3).`,
                `The ${trTerm(m.name)} proof was rejected. Send a new photo (attempt ${m.attempts + 1} of 3).`,
              ),
              urgent: true,
            }
          : { text: tr(`Bukti tahap ${m.name} ditolak final oleh admin.`, `The admin finally rejected the ${trTerm(m.name)} proof.`), urgent: false };
      if (m.status === MStatus.Disputed) return { text: tr(`Tahap ${m.name} sedang ditinjau admin.`, `The admin is reviewing the ${trTerm(m.name)} stage.`), urgent: false };
      return {
        text: tr(`Bukti tahap ${m.name} sedang dicek agen AI dan koperasi.`, `The AI agent and the cooperative are checking the ${trTerm(m.name)} proof.`),
        urgent: false,
      };
    }
    case Status.Harvested:
      return { text: tr("Selesai. Hasil panen sudah dibagi ke semua pihak.", "Done. The harvest has been shared with everyone."), urgent: false };
    case Status.Failed:
      return {
        text: c.failType === FailType.Funding ? tr("Target pendanaan tidak tercapai.", "The funding target wasn't reached.") : tr("Proyek ini ditandai gagal panen.", "This project was marked as a crop failure."),
        urgent: false,
      };
    case Status.Defaulted:
      return { text: tr("Proyek ini ditandai gagal bayar.", "This project was marked as defaulted."), urgent: false };
    default:
      return { text: tr("Pengajuan ini tidak disetujui admin.", "The admin did not approve this proposal."), urgent: false };
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
            {meta?.title ?? `${trTerm(c.commodity)} ${tr("di", "in")} ${c.locationName}`}
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
  if (isLoading) return <Loading>{tr("Memuat proyekmu…", "Loading your projects…")}</Loading>;
  return (
    <section>
      <SectionTitle
        eyebrow={tr("Proyek tanam saya", "My crop projects")}
        description={tr("Pantau tahap pencairan dan langkah berikutnya di sini.", "Track the release stages and your next steps here.")}
        action={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`/petani/${address}`} variant="secondary">
              {tr("Rapor saya", "My report card")}
            </ButtonLink>
            <ButtonLink href="/create" variant="primary">
              <Plus className="size-4" aria-hidden /> {tr("Ajukan proyek tanam", "Propose a crop project")}
            </ButtonLink>
          </div>
        }
      >
        {tr("Lahan yang sedang kamu kelola", "The fields you're working")}
      </SectionTitle>
      {!data?.length ? (
        <EmptyState icon={Sprout} title={tr("Belum ada proyek tanam", "No crop projects yet")}>
          {tr("Ajukan proyek tanam pertamamu untuk mendapatkan modal tanam.", "Propose your first crop project to get crop funding.")}
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
                    {tr(
                      `${formatUsdt(c.totalReleased)} dari ${formatUsdt(c.raisedAmount)} USDT sudah cair · tahap ${Math.min(c.currentMilestone + 1, c.milestoneCount)} dari ${c.milestoneCount}`,
                      `${formatUsdt(c.totalReleased)} of ${formatUsdt(c.raisedAmount)} USDT released · stage ${Math.min(c.currentMilestone + 1, c.milestoneCount)} of ${c.milestoneCount}`,
                    )}
                  </p>
                </div>
                <Notice tone={next.urgent ? "warn" : "info"}>
                  <span className="font-semibold">{tr("Berikutnya:", "Next:")}</span> {next.text}{" "}
                  <Link href={`/campaign/${c.address}`} className="font-semibold underline">
                    {tr("Buka proyek", "Open project")}
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
            <Coins className="size-4" aria-hidden /> {tr("Klaim", "Claim")} {formatUsdt(claimable)} USDT
          </Button>
        )}
        {canRefund && (
          <Button loading={tx.busy} onClick={() => tx.write({ address: c.address, abi: harvestCampaignAbi, functionName: "refund" })}>
            {tr("Ambil refund", "Take refund of")} {formatUsdt(shares)} USDT
          </Button>
        )}
      </div>
      <TxStatus state={tx.state} successText={tr("Dana sudah masuk ke dompetmu.", "The funds are in your wallet.")} />
    </div>
  );
}

function InvestorDashboard() {
  const { data: campaigns } = useCampaignList();
  const { data: positions, isLoading } = useMyPositions(campaigns);
  if (isLoading || !campaigns) return <Loading>{tr("Memuat porsimu…", "Loading your shares…")}</Loading>;
  const invested = (positions ?? []).reduce((s, p) => s + p.shares, 0n);
  const claimable = (positions ?? []).reduce((s, p) => s + p.claimable, 0n);
  const received = (positions ?? []).reduce((s, p) => s + p.paidOut, 0n);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat icon={HandCoins} label={tr("Total kamu danai", "Total you funded")} value={formatUsdt(invested)} sub={tr("USDT di semua proyek", "USDT across all projects")} />
        <Stat icon={PiggyBank} label={tr("Siap diklaim", "Ready to claim")} value={formatUsdt(claimable)} sub={tr("USDT, tinggal klaim", "USDT, just claim it")} />
        <Stat icon={Wallet} label={tr("Sudah diterima", "Already received")} value={formatUsdt(received)} sub={tr("USDT masuk ke dompetmu", "USDT in your wallet")} />
      </div>
      <section>
        <SectionTitle
          eyebrow={tr("Porsi saya", "My shares")}
          description={tr("Setiap porsi tercatat sebagai token atas namamu dan tidak bisa dipindahtangankan.", "Each share is recorded as a non-transferable token in your name.")}
        >
          {tr("Proyek yang kamu dukung", "Projects you support")}
        </SectionTitle>
        {!positions?.length ? (
          <EmptyState icon={HandCoins} title={tr("Kamu belum mendanai proyek apa pun", "You haven't funded any projects yet")}>
            <Link href="/#proyek" className="inline-flex items-center gap-1 font-semibold text-hutan-700 underline">
              {tr("Lihat proyek yang sedang cari dana", "See projects that are raising money")} <ArrowRight className="size-3.5" aria-hidden />
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
                      <dt className="text-xs text-stone-500">{tr("Porsimu", "Your share")}</dt>
                      <dd className="font-semibold text-hutan-950">
                        {formatUsdt(shares)} <span className="font-normal text-stone-500">({formatPercent(pct)})</span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-stone-500">{tr("Siap diklaim", "Ready to claim")}</dt>
                      <dd className={cn(cl > 0n && "text-emas-700")}>
                        <Usdt value={cl} showRupiah={false} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-stone-500">{tr("Sudah diterima", "Received")}</dt>
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
        title={isFarmer ? tr("Halo, semoga panennya melimpah", "Hi, here's to a bountiful harvest") : tr("Pantau danamu tumbuh bersama petani", "Watch your money grow with farmers")}
        description={
          isFarmer
            ? tr("Semua proyekmu ada di sini, lengkap dengan langkah yang perlu kamu lakukan berikutnya.", "All your projects are here, with the next step you need to take.")
            : tr(
                "Lihat porsimu di setiap proyek, perkembangan tahap pencairannya, dan hasil yang siap diklaim.",
                "See your share in each project, how its release stages are going, and returns ready to claim.",
              )
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
            {role === "koperasi" && <ButtonLink href="/koperasi">{tr("Buka halaman koperasi", "Open the cooperative page")}</ButtonLink>}
            {role === "admin" && <ButtonLink href="/admin">{tr("Buka halaman admin", "Open the admin page")}</ButtonLink>}
          </RoleGate>
        )}
      </PageBody>
    </>
  );
}
