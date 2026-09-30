"use client";

import { IS_LOCAL, explorerTxUrl } from "@/lib/config";
import { formatRupiah, formatUsdt, shortHash } from "@/lib/format";
import { ipfsUrl } from "@/lib/ipfs";
import type { TxState } from "@/lib/tx";
import { FailType, MSTATUS_LABEL, MStatus, STATUS_LABEL, Status } from "@/lib/types";
import { Badge, cn, Spinner, type Tone } from "./ui";

/** Jumlah USDT + perkiraan rupiah (kurs tetap). */
export function Usdt({ value, className, showRupiah = true }: { value: bigint; className?: string; showRupiah?: boolean }) {
  return (
    <span className={cn("inline-flex flex-col", className)}>
      <span className="font-semibold">{formatUsdt(value)} USDT</span>
      {showRupiah && <span className="text-xs font-normal text-stone-500">≈ {formatRupiah(value)} (perkiraan)</span>}
    </span>
  );
}

const STATUS_TONE: Record<number, Tone> = {
  [Status.Draft]: "neutral",
  [Status.Funding]: "yellow",
  [Status.Active]: "green",
  [Status.Harvested]: "brown",
  [Status.Failed]: "red",
  [Status.Cancelled]: "neutral",
  [Status.Defaulted]: "red",
};

export function StatusBadge({ status, failType }: { status: number; failType?: number }) {
  let label = STATUS_LABEL[status] ?? "?";
  if (status === Status.Failed && failType === FailType.Funding) label = "Gagal (target tidak tercapai)";
  if (status === Status.Failed && failType === FailType.Crop) label = "Gagal panen";
  return <Badge tone={STATUS_TONE[status]}>{label}</Badge>;
}

const MSTATUS_TONE: Record<number, Tone> = {
  [MStatus.Pending]: "neutral",
  [MStatus.ProofSubmitted]: "blue",
  [MStatus.AIReviewed]: "yellow",
  [MStatus.Rejected]: "red",
  [MStatus.Disputed]: "red",
  [MStatus.Released]: "green",
};

export function MilestoneBadge({ status }: { status: number }) {
  return <Badge tone={MSTATUS_TONE[status]}>{MSTATUS_LABEL[status] ?? "?"}</Badge>;
}

/** Gambar dari IPFS / penyimpanan lokal. `link` = buka ukuran penuh di tab baru (matikan jika sudah di dalam tautan). */
export function IpfsImage({ cid, alt, className, link = true }: { cid: string; alt: string; className?: string; link?: boolean }) {
  if (!cid) return null;
  // eslint-disable-next-line @next/next/no-img-element -- file dari IPFS/penyimpanan lokal, bukan aset statis
  const img = <img src={ipfsUrl(cid)} alt={alt} loading="lazy" className={cn("w-full rounded-xl bg-tanah-100 object-cover", className)} />;
  if (!link) return img;
  return (
    <a href={ipfsUrl(cid)} target="_blank" rel="noreferrer" className="block">
      {img}
    </a>
  );
}

/** Tautan transaksi: BscScan di testnet, hash saja di chain lokal. */
export function TxLink({ hash }: { hash: string }) {
  const url = explorerTxUrl(hash);
  if (!url) return <span className="font-mono text-xs text-stone-500" title={hash}>tx {shortHash(hash)}</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="font-mono text-xs text-daun-700 underline">
      {shortHash(hash)} ↗
    </a>
  );
}

/** Status transaksi: menunggu, sukses dengan tautan, atau pesan error yang mudah dipahami. */
export function TxStatus({ state, successText = "Transaksi berhasil." }: { state: TxState; successText?: string }) {
  if (state.status === "idle") return null;
  if (state.status === "signing")
    return (
      <p className="flex items-center gap-2 text-sm text-stone-600">
        <Spinner /> {IS_LOCAL ? "Mengirim transaksi…" : "Menunggu tanda tangan di wallet…"}
      </p>
    );
  if (state.status === "pending")
    return (
      <p className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
        <Spinner /> Menunggu konfirmasi jaringan… <TxLink hash={state.hash} />
      </p>
    );
  if (state.status === "success")
    return (
      <p className="flex flex-wrap items-center gap-2 text-sm text-daun-700">
        ✓ {successText} <TxLink hash={state.hash} />
      </p>
    );
  return (
    <p className="text-sm text-red-700">
      ✗ {state.message} {state.hash && <TxLink hash={state.hash} />}
    </p>
  );
}

export type StepStatus = "todo" | "active" | "done";

/** Stepper transaksi dua langkah (mis. setujui mUSDT → danai). */
export function Stepper({ steps }: { steps: { label: string; status: StepStatus }[] }) {
  return (
    <ol className="flex flex-col gap-2 sm:flex-row sm:gap-4">
      {steps.map((s, i) => (
        <li key={s.label} className="flex items-center gap-2 text-sm">
          <span
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
              s.status === "done" && "bg-daun-600 text-white",
              s.status === "active" && "bg-padi-500 text-white",
              s.status === "todo" && "bg-stone-200 text-stone-600",
            )}
          >
            {s.status === "done" ? "✓" : i + 1}
          </span>
          <span className={cn(s.status === "active" ? "font-semibold text-stone-900" : "text-stone-600")}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}
