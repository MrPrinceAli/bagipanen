"use client";

import { tr, trTerm } from "@/lib/i18n";
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
  /** Nama tahap untuk ditampilkan (Tanam → Planting di EN). */
  const st = (i: unknown) => trTerm(ms(i));
  switch (e.eventName) {
    case "CampaignCreated":
      return { text: tr("Petani mengajukan proyek tanam", "The farmer proposed a crop project"), kind: "info" };
    case "CampaignApproved":
      return { text: tr("Admin menyetujui, pendanaan dibuka", "The admin approved it and funding opened"), kind: "good" };
    case "CampaignRejected":
      return { text: tr("Admin tidak menyetujui pengajuan ini", "The admin did not approve this proposal"), kind: "bad" };
    case "Funded":
      return { text: tr(`${who(a.investor)} mendanai ${usdt(a.amount)}`, `${who(a.investor)} funded ${usdt(a.amount)}`), kind: "money" };
    case "FundingSucceeded":
      return { text: tr("Target tercapai, proyek mulai berjalan", "Target reached, the project is underway"), kind: "good" };
    case "FundingFailed":
      return { text: tr("Pendanaan ditutup karena target tak tercapai", "Funding closed because the target wasn't reached"), kind: "bad" };
    case "Refunded":
      return { text: tr(`${who(a.investor)} mengambil refund ${usdt(a.amount)}`, `${who(a.investor)} took a refund of ${usdt(a.amount)}`), kind: "money" };
    case "ProofSubmitted":
      return {
        text: tr(
          `Petani mengirim bukti tahap ${ms(a.index)} (percobaan ${Number(a.attempt)})`,
          `The farmer sent proof for the ${st(a.index)} stage (attempt ${Number(a.attempt)})`,
        ),
        kind: "info",
      };
    case "VerdictRecorded":
      return {
        text: (
          <>
            {a.approved
              ? tr(`Agen AI menerima bukti tahap ${ms(a.index)}`, `The AI agent approved the ${st(a.index)} proof`)
              : tr(`Agen AI menolak bukti tahap ${ms(a.index)}`, `The AI agent rejected the ${st(a.index)} proof`)}
            <VerdictLine cid={a.reasonCID as string} ctx={{ commodity, milestone: ms(a.index) }} />
          </>
        ),
        kind: a.approved ? "good" : "bad",
      };
    case "VerifierDecided":
      return {
        text: a.approved
          ? tr(`Koperasi menyetujui bukti tahap ${ms(a.index)}`, `The cooperative approved the ${st(a.index)} proof`)
          : tr(`Koperasi menolak bukti tahap ${ms(a.index)}`, `The cooperative rejected the ${st(a.index)} proof`),
        kind: a.approved ? "good" : "bad",
      };
    case "MilestoneRejected":
      return { text: tr(`Bukti tahap ${ms(a.index)} belum lolos`, `The ${st(a.index)} proof didn't pass`), kind: "bad" };
    case "MilestoneDisputed":
      return { text: tr(`Tahap ${ms(a.index)} masuk sengketa, menunggu keputusan admin`, `The ${st(a.index)} stage is disputed, awaiting the admin's decision`), kind: "bad" };
    case "DisputeResolved":
      return {
        text: tr(
          `Admin memutuskan sengketa tahap ${ms(a.index)}: ${a.approved ? "dana dicairkan" : "ditolak final"}`,
          `The admin resolved the ${st(a.index)} dispute: ${a.approved ? "funds released" : "finally rejected"}`,
        ),
        kind: a.approved ? "good" : "bad",
      };
    case "TrancheReleased":
      return { text: tr(`Dana tahap ${ms(a.index)} cair ${usdt(a.amount)} ke petani`, `${st(a.index)} funds released: ${usdt(a.amount)} to the farmer`), kind: "money" };
    case "HarvestDeposited":
      return {
        text: (
          <>
            {tr(`Hasil panen ${usdt(a.amount)} disetor`, `Harvest proceeds of ${usdt(a.amount)} deposited`)} ·{" "}
            <a className="font-medium text-hutan-700 underline" href={ipfsUrl(a.receiptCID as string)} target="_blank" rel="noreferrer">
              {tr("lihat nota", "see receipt")}
            </a>
          </>
        ),
        kind: "money",
      };
    case "Claimed":
      return { text: tr(`${who(a.investor)} mengklaim ${usdt(a.amount)}`, `${who(a.investor)} claimed ${usdt(a.amount)}`), kind: "money" };
    case "CampaignFailed":
      return { text: tr(`Ditandai gagal panen, ${usdt(a.investorPool)} dibagikan ke investor`, `Marked as crop failure, ${usdt(a.investorPool)} shared with investors`), kind: "bad" };
    case "CampaignDefaulted":
      return { text: tr(`Ditandai gagal bayar, ${usdt(a.investorPool)} dibagikan ke investor`, `Marked as default, ${usdt(a.investorPool)} shared with investors`), kind: "bad" };
    case "CompensationAdded":
      return { text: tr(`Dana cadangan menyalurkan kompensasi ${usdt(a.amount)}`, `The reserve fund paid ${usdt(a.amount)} in compensation`), kind: "money" };
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
  if (isLoading) return <Loading>{tr("Membaca riwayat dari blockchain…", "Reading the history from the blockchain…")}</Loading>;
  if (isError) return <p className="text-sm text-stone-500">{tr("Riwayatnya belum bisa dimuat. Coba lagi sebentar.", "The history can't be loaded yet. Try again in a moment.")}</p>;
  if (!data?.length) return <p className="text-sm text-stone-500">{tr("Belum ada transaksi.", "No transactions yet.")}</p>;
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
