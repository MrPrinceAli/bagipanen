"use client";

import type { ReactNode } from "react";
import type { Address } from "viem";
import { type ActivityEntry, useCampaignActivity, useIpfsJson } from "@/lib/campaigns";
import { demoName } from "@/lib/demoAccounts";
import { formatDateTime, formatUsdt, shortAddress } from "@/lib/format";
import { ipfsUrl } from "@/lib/ipfs";
import type { Milestone, VerdictDocument } from "@/lib/types";
import { type VerdictContext, verdictText } from "@/lib/verdictText";
import { TxLink } from "../common";
import { cn, Loading } from "../ui";

function who(address: unknown): string {
  const a = address as Address;
  return demoName(a) ?? shortAddress(a);
}

function VerdictLine({ cid, ctx }: { cid: string; ctx: VerdictContext }) {
  const { data } = useIpfsJson<VerdictDocument>(cid);
  return data ? <span className="mt-0.5 block text-xs leading-relaxed text-stone-500">“{verdictText(data, ctx)}”</span> : null;
}

type Kind = "good" | "bad" | "money" | "info";

function describe(e: ActivityEntry, milestones: readonly Milestone[], commodity: string): { text: ReactNode; kind: Kind } {
  const a = e.args;
  const ms = (i: unknown) => milestones[Number(i)]?.name ?? `#${Number(i) + 1}`;
  const usdt = (v: unknown) => `${formatUsdt(v as bigint)} USDT`;
  switch (e.eventName) {
    case "CampaignCreated":
      return { text: "Petani mengajukan proyek tanam", kind: "info" };
    case "CampaignApproved":
      return { text: "Admin menyetujui, pendanaan dibuka", kind: "good" };
    case "CampaignRejected":
      return { text: "Admin tidak menyetujui pengajuan ini", kind: "bad" };
    case "Funded":
      return { text: `${who(a.investor)} mendanai ${usdt(a.amount)}`, kind: "money" };
    case "FundingSucceeded":
      return { text: "Target tercapai, proyek mulai berjalan", kind: "good" };
    case "FundingFailed":
      return { text: "Pendanaan ditutup karena target tak tercapai", kind: "bad" };
    case "Refunded":
      return { text: `${who(a.investor)} mengambil refund ${usdt(a.amount)}`, kind: "money" };
    case "ProofSubmitted":
      return { text: `Petani mengirim bukti tahap ${ms(a.index)} (percobaan ${Number(a.attempt)})`, kind: "info" };
    case "VerdictRecorded":
      return {
        text: (
          <>
            Agen AI {a.approved ? "menerima" : "menolak"} bukti tahap {ms(a.index)}
            <VerdictLine cid={a.reasonCID as string} ctx={{ commodity, milestone: ms(a.index) }} />
          </>
        ),
        kind: a.approved ? "good" : "bad",
      };
    case "VerifierDecided":
      return { text: `Koperasi ${a.approved ? "menyetujui" : "menolak"} bukti tahap ${ms(a.index)}`, kind: a.approved ? "good" : "bad" };
    case "MilestoneRejected":
      return { text: `Bukti tahap ${ms(a.index)} belum lolos`, kind: "bad" };
    case "MilestoneDisputed":
      return { text: `Tahap ${ms(a.index)} masuk sengketa, menunggu keputusan admin`, kind: "bad" };
    case "DisputeResolved":
      return { text: `Admin memutuskan sengketa tahap ${ms(a.index)}: ${a.approved ? "dana dicairkan" : "ditolak final"}`, kind: a.approved ? "good" : "bad" };
    case "TrancheReleased":
      return { text: `Dana tahap ${ms(a.index)} cair ${usdt(a.amount)} ke petani`, kind: "money" };
    case "HarvestDeposited":
      return {
        text: (
          <>
            Hasil panen {usdt(a.amount)} disetor ·{" "}
            <a className="font-medium text-hutan-700 underline" href={ipfsUrl(a.receiptCID as string)} target="_blank" rel="noreferrer">
              lihat nota
            </a>
          </>
        ),
        kind: "money",
      };
    case "Claimed":
      return { text: `${who(a.investor)} mengklaim ${usdt(a.amount)}`, kind: "money" };
    case "CampaignFailed":
      return { text: `Ditandai gagal panen, ${usdt(a.investorPool)} dibagikan ke investor`, kind: "bad" };
    case "CampaignDefaulted":
      return { text: `Ditandai gagal bayar, ${usdt(a.investorPool)} dibagikan ke investor`, kind: "bad" };
    case "CompensationAdded":
      return { text: `Dana cadangan menyalurkan kompensasi ${usdt(a.amount)}`, kind: "money" };
    default:
      return { text: e.eventName, kind: "info" };
  }
}

const DOT: Record<Kind, string> = {
  good: "bg-hutan-500",
  bad: "bg-red-500",
  money: "bg-emas-500",
  info: "bg-stone-300",
};

/** Riwayat transaksi kampanye, masing-masing dengan tautan transaksi (BscScan di testnet). */
export function ActivityLog({ campaign, milestones, commodity }: { campaign: Address; milestones: readonly Milestone[]; commodity: string }) {
  const { data, isLoading, isError } = useCampaignActivity(campaign);
  if (isLoading) return <Loading>Membaca riwayat dari blockchain…</Loading>;
  if (isError) return <p className="text-sm text-stone-500">Riwayatnya belum bisa dimuat. Coba lagi sebentar.</p>;
  if (!data?.length) return <p className="text-sm text-stone-500">Belum ada transaksi.</p>;
  return (
    <ol className="relative flex flex-col">
      {[...data].reverse().map((e, i, arr) => {
        const d = describe(e, milestones, commodity);
        return (
          <li key={e.key} className="relative flex gap-3 pb-4 last:pb-0">
            {i < arr.length - 1 && <span className="absolute top-3 bottom-0 left-[4px] w-px bg-krem-200" aria-hidden />}
            <span className={cn("relative mt-1.5 size-2.5 shrink-0 rounded-full ring-4 ring-white", DOT[d.kind])} aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="text-sm text-stone-800">{d.text}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-stone-400">
                {e.timestamp !== undefined && <span>{formatDateTime(e.timestamp)}</span>}
                <TxLink hash={e.txHash} />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
