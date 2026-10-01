"use client";

import Link from "next/link";
import { StatusBadge, TxStatus, Usdt } from "@/components/common";
import { Button, Card, EmptyState, Notice, SectionTitle, Spinner, Stat } from "@/components/ui";
import { harvestCampaignAbi } from "@/lib/abi/HarvestCampaign";
import { IS_LOCAL } from "@/lib/config";
import { useCampaignList, useFarmerCampaigns, useIpfsJson, useMyPositions } from "@/lib/campaigns";
import { formatPercent, formatTimeLeft, formatUsdt } from "@/lib/format";
import { useRole } from "@/lib/role";
import { useTx } from "@/lib/tx";
import { type CampaignMetadata, type CampaignSummary, FailType, type Milestone, MStatus, Status } from "@/lib/types";

/** Tindakan berikutnya untuk petani, berdasarkan status kampanye & milestone aktif. */
function nextAction(c: CampaignSummary, milestones: readonly Milestone[]): { text: string; urgent: boolean } {
  const now = Math.floor(Date.now() / 1000);
  switch (c.status) {
    case Status.Draft:
      return { text: "Menunggu persetujuan admin.", urgent: false };
    case Status.Funding:
      return now > Number(c.fundingDeadline)
        ? { text: "Tenggat lewat dan target belum tercapai — pendanaan perlu ditutup.", urgent: true }
        : { text: `Pendanaan berjalan (${formatUsdt(c.raisedAmount)}/${formatUsdt(c.targetAmount)} USDT, tenggat ${formatTimeLeft(c.fundingDeadline)}).`, urgent: false };
    case Status.Active: {
      if (c.currentMilestone >= c.milestoneCount) return { text: "Semua dana tahap cair. Setor hasil panen + foto nota.", urgent: true };
      const m = milestones[c.currentMilestone];
      if (m.status === MStatus.Pending) return { text: `Unggah foto bukti milestone ${m.name}.`, urgent: true };
      if (m.status === MStatus.Rejected)
        return m.attempts < 3
          ? { text: `Bukti ${m.name} ditolak. Unggah ulang (percobaan ${m.attempts + 1}/3).`, urgent: true }
          : { text: `Bukti ${m.name} ditolak final oleh admin.`, urgent: false };
      if (m.status === MStatus.Disputed) return { text: `Milestone ${m.name} dalam sengketa — menunggu keputusan admin.`, urgent: false };
      return { text: `Bukti ${m.name} sedang diperiksa agen AI & koperasi.`, urgent: false };
    }
    case Status.Harvested:
      return { text: "Selesai — hasil panen sudah dibagi.", urgent: false };
    case Status.Failed:
      return { text: c.failType === FailType.Funding ? "Target pendanaan tidak tercapai." : "Ditandai gagal panen.", urgent: false };
    case Status.Defaulted:
      return { text: "Ditandai gagal bayar.", urgent: false };
    default:
      return { text: "Kampanye dibatalkan.", urgent: false };
  }
}

function CampaignTitle({ c }: { c: CampaignSummary }) {
  const { data: meta } = useIpfsJson<CampaignMetadata>(c.metadataCID);
  return (
    <Link href={`/campaign/${c.address}`} className="font-semibold text-stone-900 hover:text-daun-800 hover:underline">
      {meta?.title ?? `${c.commodity} · ${c.locationName}`}
    </Link>
  );
}

function FarmerDashboard({ address }: { address: `0x${string}` }) {
  const { data, isLoading } = useFarmerCampaigns(address);
  if (isLoading) return <Spinner />;
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle
        action={
          <Link href="/create" className="rounded-xl bg-daun-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-daun-800">
            + Ajukan kampanye
          </Link>
        }
      >
        Kampanye saya
      </SectionTitle>
      {!data?.length ? (
        <EmptyState title="Belum ada kampanye">Ajukan kampanye pertama Anda untuk mendapat modal tanam.</EmptyState>
      ) : (
        data.map(({ summary: c, milestones }) => {
          const next = nextAction(c, milestones);
          return (
            <Card key={c.address}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <CampaignTitle c={c} />
                <StatusBadge status={c.status} failType={c.failType} />
              </div>
              <p className="mt-1 text-sm text-stone-600">
                Dana cair {formatUsdt(c.totalReleased)} dari {formatUsdt(c.raisedAmount)} USDT · milestone{" "}
                {Math.min(c.currentMilestone + 1, c.milestoneCount)}/{c.milestoneCount}
              </p>
              <div className="mt-3">
                <Notice tone={next.urgent ? "warn" : "info"}>
                  <span className="font-semibold">Tindakan berikutnya:</span> {next.text}{" "}
                  <Link href={`/campaign/${c.address}`} className="underline">
                    Buka kampanye →
                  </Link>
                </Notice>
              </div>
            </Card>
          );
        })
      )}
    </section>
  );
}

function PositionActions({ c, claimable, shares }: { c: CampaignSummary; claimable: bigint; shares: bigint }) {
  const tx = useTx();
  const canRefund = c.status === Status.Failed && c.failType === FailType.Funding && shares > 0n;
  if (claimable === 0n && !canRefund) return null;
  return (
    <div className="mt-3 flex flex-col gap-2">
      {claimable > 0n && (
        <Button
          loading={tx.busy}
          onClick={() => tx.write({ address: c.address, abi: harvestCampaignAbi, functionName: "claim" })}
        >
          Klaim {formatUsdt(claimable)} USDT
        </Button>
      )}
      {canRefund && (
        <Button
          loading={tx.busy}
          onClick={() => tx.write({ address: c.address, abi: harvestCampaignAbi, functionName: "refund" })}
        >
          Refund {formatUsdt(shares)} USDT
        </Button>
      )}
      <TxStatus state={tx.state} successText="Dana sudah dikirim ke wallet Anda." />
    </div>
  );
}

function InvestorDashboard() {
  const { data: campaigns } = useCampaignList();
  const { data: positions, isLoading } = useMyPositions(campaigns);
  if (isLoading || !campaigns) return <Spinner />;
  const invested = (positions ?? []).reduce((s, p) => s + p.shares, 0n);
  const claimable = (positions ?? []).reduce((s, p) => s + p.claimable, 0n);
  const received = (positions ?? []).reduce((s, p) => s + p.paidOut, 0n);

  return (
    <section className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Total didanai" value={`${formatUsdt(invested)} USDT`} />
        <Stat label="Bisa diklaim" value={`${formatUsdt(claimable)} USDT`} />
        <Stat label="Sudah diterima" value={`${formatUsdt(received)} USDT`} />
      </div>
      <SectionTitle>Porsi saya</SectionTitle>
      {!positions?.length ? (
        <EmptyState title="Belum ada porsi">
          <Link href="/#kampanye" className="text-daun-700 underline">
            Lihat kampanye yang sedang mencari dana
          </Link>
        </EmptyState>
      ) : (
        positions.map(({ campaign: c, shares, claimable: cl, paidOut }) => {
          const supply = c.totalSharesAtSettle > 0n ? c.totalSharesAtSettle : c.raisedAmount;
          const pct = supply > 0n ? Number((shares * 10_000n) / supply) / 10_000 : 0;
          return (
            <Card key={c.address}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <CampaignTitle c={c} />
                <StatusBadge status={c.status} failType={c.failType} />
              </div>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="text-stone-500">Porsi</dt>
                  <dd className="font-semibold">
                    {formatUsdt(shares)} ({formatPercent(pct)})
                  </dd>
                </div>
                <div>
                  <dt className="text-stone-500">Bisa diklaim</dt>
                  <dd>
                    <Usdt value={cl} />
                  </dd>
                </div>
                <div>
                  <dt className="text-stone-500">Diterima</dt>
                  <dd className="font-semibold">{formatUsdt(paidOut)} USDT</dd>
                </div>
              </dl>
              <PositionActions c={c} claimable={cl} shares={shares} />
            </Card>
          );
        })
      )}
    </section>
  );
}

export default function DashboardPage() {
  const { role, address } = useRole();
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold text-daun-900">Dashboard</h1>
      {role === undefined ? (
        <Spinner />
      ) : role === "tamu" ? (
        <Notice tone="info">{IS_LOCAL ? "Pilih akun demo" : "Hubungkan dompet"} di header untuk melihat dashboard Anda.</Notice>
      ) : role === "petani" && address ? (
        <FarmerDashboard address={address} />
      ) : role === "investor" ? (
        <InvestorDashboard />
      ) : (
        <Notice tone="info">
          Dashboard ini untuk petani dan investor.{" "}
          {role === "koperasi" && (
            <Link href="/koperasi" className="underline">
              Buka halaman koperasi →
            </Link>
          )}
          {role === "admin" && (
            <Link href="/admin" className="underline">
              Buka halaman admin →
            </Link>
          )}
        </Notice>
      )}
    </div>
  );
}
