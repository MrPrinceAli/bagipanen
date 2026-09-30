"use client";

import type { ReactNode } from "react";
import type { Address } from "viem";
import { type ActivityEntry, useCampaignActivity, useIpfsJson } from "@/lib/campaigns";
import { demoName } from "@/lib/demoAccounts";
import { formatDateTime, formatUsdt, shortAddress } from "@/lib/format";
import { ipfsUrl } from "@/lib/ipfs";
import type { Milestone, VerdictDocument } from "@/lib/types";
import { TxLink } from "../common";
import { Spinner } from "../ui";

function who(address: unknown): string {
  const a = address as Address;
  return demoName(a) ?? shortAddress(a);
}

function VerdictLine({ cid }: { cid: string }) {
  const { data } = useIpfsJson<VerdictDocument>(cid);
  return data ? <span className="block text-xs text-stone-500">“{data.summary_id}”</span> : null;
}

function describe(e: ActivityEntry, milestones: readonly Milestone[]): ReactNode {
  const a = e.args;
  const ms = (i: unknown) => milestones[Number(i)]?.name ?? `#${Number(i) + 1}`;
  const usdt = (v: unknown) => `${formatUsdt(v as bigint)} USDT`;
  switch (e.eventName) {
    case "CampaignCreated":
      return "Kampanye diajukan petani";
    case "CampaignApproved":
      return "Disetujui admin — pendanaan dibuka";
    case "CampaignRejected":
      return "Ditolak admin";
    case "Funded":
      return `${who(a.investor)} mendanai ${usdt(a.amount)}`;
    case "FundingSucceeded":
      return "Target tercapai — kampanye berjalan";
    case "FundingFailed":
      return "Pendanaan ditutup: target tidak tercapai";
    case "Refunded":
      return `${who(a.investor)} menerima refund ${usdt(a.amount)}`;
    case "ProofSubmitted":
      return `Bukti ${ms(a.index)} dikirim (percobaan ${Number(a.attempt)})`;
    case "VerdictRecorded":
      return (
        <>
          Agen AI {a.approved ? "menyetujui" : "menolak"} bukti {ms(a.index)}
          <VerdictLine cid={a.reasonCID as string} />
        </>
      );
    case "VerifierDecided":
      return `Koperasi ${a.approved ? "menyetujui" : "menolak"} bukti ${ms(a.index)}`;
    case "MilestoneRejected":
      return `Milestone ${ms(a.index)} ditolak`;
    case "MilestoneDisputed":
      return `Milestone ${ms(a.index)} masuk sengketa — menunggu admin`;
    case "DisputeResolved":
      return `Admin memutuskan sengketa ${ms(a.index)}: ${a.approved ? "dicairkan" : "ditolak final"}`;
    case "TrancheReleased":
      return `Dana tahap ${ms(a.index)} cair ${usdt(a.amount)} ke petani`;
    case "HarvestDeposited":
      return (
        <>
          Hasil panen {usdt(a.amount)} disetor ·{" "}
          <a className="text-daun-700 underline" href={ipfsUrl(a.receiptCID as string)} target="_blank" rel="noreferrer">
            nota
          </a>
        </>
      );
    case "Claimed":
      return `${who(a.investor)} mengklaim ${usdt(a.amount)}`;
    case "CampaignFailed":
      return `Ditandai gagal panen — ${usdt(a.investorPool)} untuk investor`;
    case "CampaignDefaulted":
      return `Ditandai gagal bayar — ${usdt(a.investorPool)} untuk investor`;
    case "CompensationAdded":
      return `Kompensasi dana cadangan ${usdt(a.amount)}`;
    default:
      return e.eventName;
  }
}

/** Riwayat transaksi kampanye, masing-masing dengan tautan transaksi (BscScan di testnet). */
export function ActivityLog({ campaign, milestones }: { campaign: Address; milestones: readonly Milestone[] }) {
  const { data, isLoading, isError } = useCampaignActivity(campaign);
  if (isLoading) return <Spinner />;
  if (isError) return <p className="text-sm text-stone-500">Riwayat transaksi tidak bisa dimuat.</p>;
  if (!data?.length) return <p className="text-sm text-stone-500">Belum ada transaksi.</p>;
  return (
    <ol className="flex flex-col divide-y divide-tanah-100">
      {[...data].reverse().map((e) => (
        <li key={e.key} className="flex flex-col gap-0.5 py-2.5">
          <div className="text-sm text-stone-800">{describe(e, milestones)}</div>
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-stone-500">
            {e.timestamp !== undefined && <span>{formatDateTime(e.timestamp)}</span>}
            <TxLink hash={e.txHash} />
          </div>
        </li>
      ))}
    </ol>
  );
}
