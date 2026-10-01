"use client";

import { AlertTriangle, Check, CheckCircle2, ExternalLink, ImageUp, Loader2, XCircle } from "lucide-react";
import { type ReactNode, useEffect, useId, useState } from "react";
import { getAddress, isAddress } from "viem";
import { explorerAddressUrl, explorerTxUrl, IS_LOCAL } from "@/lib/config";
import { formatRupiah, formatUsdt, shortAddress, shortHash } from "@/lib/format";
import { ipfsUrl } from "@/lib/ipfs";
import type { TxState } from "@/lib/tx";
import { FailType, MSTATUS_LABEL, MStatus, STATUS_LABEL, Status } from "@/lib/types";
import { useToast } from "./Toast";
import { Badge, Button, type ButtonVariant, cn, Input, type Tone } from "./ui";

/** Jumlah USDT + perkiraan rupiah (kurs tetap). */
export function Usdt({ value, className, showRupiah = true }: { value: bigint; className?: string; showRupiah?: boolean }) {
  return (
    <span className={cn("inline-flex flex-col", className)}>
      <span className="font-semibold">{formatUsdt(value)} USDT</span>
      {showRupiah && <span className="text-xs font-normal text-stone-500">sekitar {formatRupiah(value)}</span>}
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

export function statusLabel(status: number, failType?: number) {
  if (status === Status.Failed && failType === FailType.Funding) return "Target tak tercapai";
  if (status === Status.Failed && failType === FailType.Crop) return "Gagal panen";
  return STATUS_LABEL[status] ?? "?";
}

export function StatusBadge({ status, failType, glass = false }: { status: number; failType?: number; glass?: boolean }) {
  return (
    <Badge tone={glass ? "glass" : STATUS_TONE[status]} dot>
      {statusLabel(status, failType)}
    </Badge>
  );
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
  return (
    <Badge tone={MSTATUS_TONE[status]} dot>
      {MSTATUS_LABEL[status] ?? "?"}
    </Badge>
  );
}

/** Gambar dari IPFS / penyimpanan lokal. `link` = buka ukuran penuh di tab baru (matikan jika sudah di dalam tautan). */
export function IpfsImage({ cid, alt, className, link = true }: { cid: string; alt: string; className?: string; link?: boolean }) {
  if (!cid) return null;
  // eslint-disable-next-line @next/next/no-img-element -- file dari IPFS/penyimpanan lokal, bukan aset statis
  const img = <img src={ipfsUrl(cid)} alt={alt} loading="lazy" className={cn("w-full rounded-2xl bg-krem-200 object-cover", className)} />;
  if (!link) return img;
  return (
    <a href={ipfsUrl(cid)} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl transition hover:opacity-90" title="Buka ukuran penuh">
      {img}
    </a>
  );
}

/** Tautan transaksi: BscScan di testnet, hash saja di chain lokal. */
export function TxLink({ hash, className }: { hash: string; className?: string }) {
  const url = explorerTxUrl(hash);
  if (!url)
    return (
      <span className={cn("font-mono text-xs text-stone-500", className)} title={hash}>
        tx {shortHash(hash)}
      </span>
    );
  return (
    <a href={url} target="_blank" rel="noreferrer" className={cn("inline-flex items-center gap-1 font-mono text-xs text-hutan-700 hover:text-hutan-900 hover:underline", className)}>
      {shortHash(hash)} <ExternalLink className="size-3" aria-hidden />
    </a>
  );
}

/** Alamat dompet/kontrak, menaut ke BscScan di testnet. */
export function AddressLink({ address, full = false, className }: { address: string; full?: boolean; className?: string }) {
  const url = explorerAddressUrl(address);
  const text = full ? address : shortAddress(address);
  if (!url) return <span className={cn("font-mono text-xs break-all", className)}>{text}</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className={cn("inline-flex items-center gap-1 font-mono text-xs break-all text-hutan-700 hover:underline", className)}>
      {text} <ExternalLink className="size-3 shrink-0" aria-hidden />
    </a>
  );
}

/** Status transaksi: menunggu tanda tangan, menunggu jaringan, berhasil, atau gagal dengan pesan yang jelas. */
export function TxStatus({ state, successText = "Transaksi berhasil." }: { state: TxState; successText?: string }) {
  const toast = useToast();
  const successHash = state.status === "success" ? state.hash : undefined;
  // Pesan sukses juga dikirim sebagai toast, karena komponen ini bisa hilang setelah data diperbarui.
  useEffect(() => {
    if (successHash) toast?.push({ text: successText, hash: successHash });
  }, [successHash, successText, toast]);

  if (state.status === "idle") return null;
  if (state.status === "signing")
    return (
      <p className="flex items-center gap-2 text-sm text-stone-600">
        <Loader2 className="size-4 animate-spin" aria-hidden /> {IS_LOCAL ? "Mengirim transaksi…" : "Konfirmasi di dompetmu dulu, ya…"}
      </p>
    );
  if (state.status === "pending")
    return (
      <p className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Menunggu jaringan mengonfirmasi… <TxLink hash={state.hash} />
      </p>
    );
  if (state.status === "success")
    return (
      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-hutan-700">
        <CheckCircle2 className="size-4" aria-hidden /> {successText} <TxLink hash={state.hash} />
      </p>
    );
  return (
    <p className="flex flex-wrap items-start gap-2 text-sm text-red-700">
      <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span className="flex-1">
        {state.message} {state.hash && <TxLink hash={state.hash} />}
      </span>
    </p>
  );
}

export type StepStatus = "todo" | "active" | "done";

/** Langkah transaksi berurutan (mis. izinkan mUSDT → danai). */
export function Stepper({ steps }: { steps: { label: string; status: StepStatus }[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
      {steps.map((s, i) => (
        <li key={s.label} className="flex items-center gap-2 text-sm">
          {i > 0 && <span className={cn("h-px w-4 sm:w-6", s.status === "todo" ? "bg-krem-300" : "bg-hutan-300")} aria-hidden />}
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
              s.status === "done" && "bg-hutan-600 text-white",
              s.status === "active" && "bg-emas-400 text-hutan-950 ring-4 ring-emas-100",
              s.status === "todo" && "bg-krem-200 text-stone-500",
            )}
          >
            {s.status === "done" ? <Check className="size-3.5" aria-hidden /> : i + 1}
          </span>
          <span className={cn(s.status === "active" ? "font-semibold text-hutan-950" : s.status === "done" ? "text-hutan-800" : "text-stone-500")}>
            {s.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Tombol dengan konfirmasi dua kali klik untuk aksi yang tidak bisa dibatalkan
 * (mis. tandai gagal panen). Klik pertama meminta konfirmasi, klik kedua menjalankan.
 */
export function ConfirmButton({
  children,
  confirmText = "Yakin? Klik sekali lagi",
  onConfirm,
  variant = "danger",
  loading,
  disabled,
  size,
}: {
  children: ReactNode;
  confirmText?: string;
  onConfirm: () => unknown;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Button
      variant={variant}
      size={size}
      loading={loading}
      disabled={disabled}
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        void onConfirm();
      }}
    >
      {armed ? (
        <>
          <AlertTriangle className="size-4" aria-hidden /> {confirmText}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

/** Validasi alamat dompet dari input pengguna. */
export function parseAddressInput(value: string): `0x${string}` | null {
  const v = value.trim();
  return isAddress(v, { strict: false }) ? getAddress(v) : null;
}

export function AddressInput({ id, value, onChange, placeholder = "0x…" }: { id: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const invalid = value.trim() !== "" && parseAddressInput(value) === null;
  return (
    <div className="flex flex-col gap-1">
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} spellCheck={false} className="font-mono" />
      {invalid && <p className="text-xs text-red-700">Alamat dompetnya belum benar. Cek lagi, ya.</p>}
    </div>
  );
}

/** Pemilih foto bergaya kotak unggah, dengan nama file terpilih. */
export function FilePicker({
  id,
  file,
  onChange,
  label = "Pilih foto",
  hint = "JPEG, PNG, atau WebP",
}: {
  id?: string;
  file: File | null;
  onChange: (f: File | null) => void;
  label?: string;
  hint?: string;
}) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <label
      htmlFor={inputId}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-3.5 transition",
        file ? "border-hutan-300 bg-hutan-50/60" : "border-krem-300 bg-krem-50 hover:border-hutan-300 hover:bg-hutan-50/40",
      )}
    >
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", file ? "bg-hutan-600 text-white" : "bg-white text-hutan-700 ring-1 ring-krem-300")}>
        {file ? <Check className="size-5" aria-hidden /> : <ImageUp className="size-5" aria-hidden />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-hutan-950">{file ? file.name : label}</span>
        <span className="block text-xs text-stone-500">{file ? `${(file.size / 1024 / 1024).toLocaleString("id-ID", { maximumFractionDigits: 1 })} MB · klik untuk ganti` : hint}</span>
      </span>
      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}
