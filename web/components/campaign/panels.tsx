"use client";

import { useState } from "react";
import { isAddressEqual } from "viem";
import { useAccount } from "wagmi";
import { campaignFactoryAbi } from "@/lib/abi/CampaignFactory";
import { harvestCampaignAbi } from "@/lib/abi/HarvestCampaign";
import { mockUSDTAbi } from "@/lib/abi/MockUSDT";
import { addresses } from "@/lib/addresses";
import { usePosition } from "@/lib/campaigns";
import { formatPercent, formatRupiah, formatUsdt, parseUsdtInput, usdtToInput } from "@/lib/format";
import { uploadFile } from "@/lib/ipfs";
import type { Role } from "@/lib/role";
import { useNow } from "@/lib/time";
import { useTx } from "@/lib/tx";
import { type CampaignSummary, FailType, type Milestone, MStatus, Status } from "@/lib/types";
import { IpfsImage, Stepper, TxStatus, Usdt } from "../common";
import { Button, Card, Field, Input, Notice } from "../ui";
import { VerdictSummary } from "./Timeline";

type PanelProps = { c: CampaignSummary; milestones: readonly Milestone[]; role: Role | undefined; symbol: string };

/** Semua aksi yang tersedia untuk wallet yang login, sesuai peran & status kampanye. */
export function ActionPanels(props: PanelProps) {
  const { c, milestones, role } = props;
  const { address, isConnected } = useAccount();
  const now = useNow();
  const isFarmer = Boolean(address && isAddressEqual(address, c.farmer));
  const isCoop = Boolean(address && isAddressEqual(address, c.cooperative));
  const current = milestones[c.currentMilestone];
  const allReleased = c.currentMilestone >= c.milestoneCount;

  if (!isConnected) return <Notice tone="info">Hubungkan wallet (pilih akun demo di header) untuk mendanai atau melakukan aksi.</Notice>;

  const panels = [];
  if (role === "admin" && c.status === Status.Draft) panels.push(<AdminReviewPanel key="admin" c={c} />);
  if (c.status === Status.Funding && now <= Number(c.fundingDeadline) && !isFarmer && !isCoop)
    panels.push(<FundPanel key="fund" c={c} />);
  if (c.status === Status.Funding && now > Number(c.fundingDeadline)) panels.push(<FinalizePanel key="finalize" c={c} />);
  if (!isFarmer && !isCoop) panels.push(<InvestorPanel key="investor" {...props} />);
  if (isFarmer && c.status === Status.Active && current && (current.status === MStatus.Pending || current.status === MStatus.Rejected))
    panels.push(<ProofPanel key="proof" c={c} milestone={current} />);
  if (isFarmer && c.status === Status.Active && allReleased) panels.push(<HarvestPanel key="harvest" c={c} />);
  if (isCoop && c.status === Status.Active && current && !current.verifierDecided &&
    (current.status === MStatus.ProofSubmitted || current.status === MStatus.AIReviewed))
    panels.push(<CooperativePanel key="coop" c={c} milestone={current} />);

  if (panels.length === 0) return null;
  return <div className="flex flex-col gap-4">{panels}</div>;
}

function AdminReviewPanel({ c }: { c: CampaignSummary }) {
  const tx = useTx();
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const send = (fn: "approveCampaign" | "rejectCampaign") => {
    setAction(fn === "approveCampaign" ? "approve" : "reject");
    return tx.write({ address: addresses.factory!, abi: campaignFactoryAbi, functionName: fn, args: [c.address] });
  };
  return (
    <Card>
      <h3 className="font-semibold text-daun-900">Tinjauan admin</h3>
      <p className="mt-1 text-sm text-stone-600">Setujui untuk membuka pendanaan (tenggat dimulai sekarang), atau tolak pengajuan ini.</p>
      <div className="mt-3 flex gap-2">
        <Button loading={tx.busy && action === "approve"} disabled={tx.busy} onClick={() => send("approveCampaign")}>
          Setujui kampanye
        </Button>
        <Button variant="danger" loading={tx.busy && action === "reject"} disabled={tx.busy} onClick={() => send("rejectCampaign")}>
          Tolak
        </Button>
      </div>
      <div className="mt-2">
        <TxStatus state={tx.state} successText={action === "approve" ? "Pendanaan dibuka." : "Kampanye ditolak."} />
      </div>
    </Card>
  );
}

function FundPanel({ c }: { c: CampaignSummary }) {
  const { data: pos } = usePosition(c.address);
  const approveTx = useTx();
  const fundTx = useTx();
  const remaining = c.targetAmount - c.raisedAmount;
  const [input, setInput] = useState("");
  const amount = parseUsdtInput(input);

  let problem = "";
  if (input && (amount === null || amount === 0n)) problem = "Jumlah tidak valid.";
  else if (amount && amount > remaining) problem = `Maksimal sisa target: ${formatUsdt(remaining)} USDT.`;
  else if (amount && pos && amount > pos.usdtBalance) problem = "Saldo mUSDT tidak cukup. Gunakan tombol \"Minta mUSDT demo\".";

  const ready = Boolean(amount && amount > 0n && !problem);
  const approved = Boolean(ready && pos && pos.allowance >= amount!);

  return (
    <Card>
      <h3 className="font-semibold text-daun-900">Danai kampanye ini</h3>
      <p className="mt-1 text-sm text-stone-600">
        Sisa target <strong>{formatUsdt(remaining)} USDT</strong>. Anda menerima token porsi 1:1 untuk setiap USDT.
      </p>
      <div className="mt-3 flex flex-col gap-3">
        <Field label="Jumlah (USDT)" htmlFor="fund-amount" hint={amount ? `≈ ${formatRupiah(amount)} (perkiraan)` : `Saldo Anda: ${pos ? formatUsdt(pos.usdtBalance) : "–"} mUSDT`}>
          <Input id="fund-amount" inputMode="decimal" value={input} onChange={(e) => setInput(e.target.value)} placeholder="500" />
        </Field>
        <div className="flex flex-wrap gap-2">
          {[100n, 500n].map((v) => v * 10n ** 18n).filter((v) => v <= remaining).map((v) => (
            <Button key={v.toString()} size="sm" variant="ghost" onClick={() => setInput(usdtToInput(v))}>
              {formatUsdt(v)}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setInput(usdtToInput(remaining))}>
            Sisa target
          </Button>
        </div>
        {problem && <Notice tone="warn">{problem}</Notice>}
        <Stepper
          steps={[
            { label: "Setujui mUSDT", status: approved ? "done" : "active" },
            { label: "Danai", status: fundTx.state.status === "success" ? "done" : approved ? "active" : "todo" },
          ]}
        />
        {!approved ? (
          <Button
            disabled={!ready}
            loading={approveTx.busy}
            onClick={() =>
              approveTx.write({ address: addresses.usdt!, abi: mockUSDTAbi, functionName: "approve", args: [c.address, amount!] })
            }
          >
            1. Setujui {amount && ready ? `${formatUsdt(amount)} ` : ""}mUSDT
          </Button>
        ) : (
          <Button
            disabled={!ready}
            loading={fundTx.busy}
            onClick={async () => {
              const ok = await fundTx.write({ address: c.address, abi: harvestCampaignAbi, functionName: "fund", args: [amount!] });
              if (ok) setInput("");
            }}
          >
            2. Danai {formatUsdt(amount!)} USDT
          </Button>
        )}
        <TxStatus state={approveTx.state} successText="Izin mUSDT diberikan." />
        <TxStatus state={fundTx.state} successText="Terima kasih! Pendanaan tercatat." />
      </div>
    </Card>
  );
}

function FinalizePanel({ c }: { c: CampaignSummary }) {
  const tx = useTx();
  return (
    <Card>
      <h3 className="font-semibold text-daun-900">Tenggat pendanaan lewat</h3>
      <p className="mt-1 text-sm text-stone-600">
        Target {formatUsdt(c.targetAmount)} USDT tidak tercapai. Siapa pun bisa menutup pendanaan agar investor bisa refund 100%.
      </p>
      <Button
        className="mt-3"
        loading={tx.busy}
        onClick={() => tx.write({ address: c.address, abi: harvestCampaignAbi, functionName: "finalizeFunding" })}
      >
        Tutup pendanaan
      </Button>
      <div className="mt-2">
        <TxStatus state={tx.state} successText="Pendanaan ditutup. Investor sekarang bisa refund." />
      </div>
    </Card>
  );
}

function InvestorPanel({ c, symbol }: PanelProps) {
  const { data: pos } = usePosition(c.address);
  const tx = useTx();
  if (!pos || (pos.shares === 0n && pos.paidOut === 0n)) return null;

  const supply = c.totalSharesAtSettle > 0n ? c.totalSharesAtSettle : c.raisedAmount;
  const share = supply > 0n ? Number((pos.shares * 10_000n) / supply) / 10_000 : 0;
  const canRefund = c.status === Status.Failed && c.failType === FailType.Funding && pos.shares > 0n;

  return (
    <Card>
      <h3 className="font-semibold text-daun-900">Porsi saya</h3>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <dt className="text-stone-500">Token porsi</dt>
        <dd className="text-right font-semibold">
          {formatUsdt(pos.shares)} {symbol}
        </dd>
        <dt className="text-stone-500">Bagian</dt>
        <dd className="text-right font-semibold">{formatPercent(share)}</dd>
        {pos.paidOut > 0n && (
          <>
            <dt className="text-stone-500">Sudah diklaim</dt>
            <dd className="text-right font-semibold">{formatUsdt(pos.paidOut)} USDT</dd>
          </>
        )}
        {pos.claimable > 0n && (
          <>
            <dt className="text-stone-500">Bisa diklaim</dt>
            <dd className="text-right">
              <Usdt value={pos.claimable} className="items-end" />
            </dd>
          </>
        )}
      </dl>
      {pos.claimable > 0n && (
        <Button
          className="mt-3 w-full"
          loading={tx.busy}
          onClick={() => tx.write({ address: c.address, abi: harvestCampaignAbi, functionName: "claim" })}
        >
          Klaim {formatUsdt(pos.claimable)} USDT
        </Button>
      )}
      {canRefund && (
        <Button
          className="mt-3 w-full"
          loading={tx.busy}
          onClick={() => tx.write({ address: c.address, abi: harvestCampaignAbi, functionName: "refund" })}
        >
          Refund {formatUsdt(pos.shares)} USDT
        </Button>
      )}
      <div className="mt-2">
        <TxStatus state={tx.state} successText="Dana sudah dikirim ke wallet Anda." />
      </div>
    </Card>
  );
}

function ProofPanel({ c, milestone }: { c: CampaignSummary; milestone: Milestone }) {
  const tx = useTx();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const attemptsLeft = 3 - milestone.attempts;

  if (attemptsLeft <= 0)
    return <Notice tone="error">Batas 3 percobaan untuk milestone {milestone.name} habis. Menunggu keputusan admin.</Notice>;

  async function submit() {
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const { cid } = await uploadFile(file);
      setUploading(false);
      const ok = await tx.write({ address: c.address, abi: harvestCampaignAbi, functionName: "submitProof", args: [cid] });
      if (ok) setFile(null);
    } catch (e) {
      setUploading(false);
      setError(e instanceof Error ? e.message : "Gagal mengunggah foto.");
    }
  }

  return (
    <Card>
      <h3 className="font-semibold text-daun-900">
        {milestone.status === MStatus.Rejected ? "Unggah ulang" : "Unggah"} bukti milestone {milestone.name}
      </h3>
      <p className="mt-1 text-sm text-stone-600">
        Percobaan {milestone.attempts + 1} dari 3. Foto akan dinilai agen AI (lokasi, tanggal, fase tanaman, cuaca) lalu dikonfirmasi koperasi.
      </p>
      {milestone.status === MStatus.Rejected && milestone.aiReasonCID && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-stone-500 uppercase">Alasan penolakan sebelumnya</p>
          <VerdictSummary cid={milestone.aiReasonCID} />
        </div>
      )}
      <div className="mt-3 flex flex-col gap-3">
        <Field label="Foto lahan" htmlFor="proof" hint="Unggah langsung dari galeri kamera HP. Foto yang dikirim lewat WhatsApp kehilangan data GPS & tanggal (EXIF).">
          <Input id="proof" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        <Button disabled={!file} loading={uploading || tx.busy} onClick={submit}>
          {uploading ? "Mengunggah foto…" : "Kirim bukti"}
        </Button>
        <TxStatus state={tx.state} successText="Bukti terkirim. Menunggu putusan agen AI & koperasi." />
      </div>
    </Card>
  );
}

function HarvestPanel({ c }: { c: CampaignSummary }) {
  const { data: pos } = usePosition(c.address);
  const approveTx = useTx();
  const depositTx = useTx();
  const [input, setInput] = useState(usdtToInput(c.estimatedRevenue));
  const [file, setFile] = useState<File | null>(null);
  const [receiptCid, setReceiptCid] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const amount = parseUsdtInput(input);

  const valid = Boolean(amount && amount > 0n);
  const enough = Boolean(valid && pos && pos.usdtBalance >= amount!);
  const approved = Boolean(valid && pos && pos.allowance >= amount!);
  const profit = valid && amount! >= c.raisedAmount ? amount! - c.raisedAmount : 0n;
  const farmerShare = (profit * 5_500n) / 10_000n;
  const reserveShare = (profit * 500n) / 10_000n;
  const investorPool = valid ? amount! - farmerShare - reserveShare : 0n;

  async function uploadReceipt() {
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      setReceiptCid((await uploadFile(file)).cid);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengunggah nota.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <h3 className="font-semibold text-daun-900">Setor hasil panen</h3>
      <p className="mt-1 text-sm text-stone-600">
        Semua dana tahap sudah cair. Setor hasil penjualan panen beserta foto nota dari koperasi; kontrak langsung membagi hasilnya.
      </p>
      <div className="mt-3 flex flex-col gap-3">
        <Field label="Hasil penjualan (USDT)" htmlFor="harvest-amount" hint={`Saldo Anda: ${pos ? formatUsdt(pos.usdtBalance) : "–"} mUSDT`}>
          <Input id="harvest-amount" inputMode="decimal" value={input} onChange={(e) => setInput(e.target.value)} />
        </Field>
        {valid && (
          <dl className="grid grid-cols-2 gap-1 rounded-xl bg-tanah-50 p-3 text-sm">
            <dt className="text-stone-500">Modal kembali ke investor</dt>
            <dd className="text-right">{formatUsdt(amount! < c.raisedAmount ? amount! : c.raisedAmount)} USDT</dd>
            <dt className="text-stone-500">Bagian petani (55% untung)</dt>
            <dd className="text-right">{formatUsdt(farmerShare)} USDT</dd>
            <dt className="text-stone-500">Dana cadangan (5%)</dt>
            <dd className="text-right">{formatUsdt(reserveShare)} USDT</dd>
            <dt className="font-semibold text-stone-700">Pool investor</dt>
            <dd className="text-right font-semibold">{formatUsdt(investorPool)} USDT</dd>
          </dl>
        )}
        {valid && !enough && <Notice tone="warn">Saldo mUSDT kurang. Gunakan tombol &quot;Minta mUSDT demo&quot; untuk simulasi hasil penjualan.</Notice>}
        <Field label="Foto nota penjualan" htmlFor="receipt">
          <Input id="receipt" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setReceiptCid(""); }} />
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        <Stepper
          steps={[
            { label: "Unggah nota", status: receiptCid ? "done" : "active" },
            { label: "Setujui mUSDT", status: approved ? "done" : receiptCid ? "active" : "todo" },
            { label: "Setor hasil panen", status: depositTx.state.status === "success" ? "done" : receiptCid && approved ? "active" : "todo" },
          ]}
        />
        {!receiptCid ? (
          <Button disabled={!file} loading={uploading} onClick={uploadReceipt}>
            1. Unggah nota
          </Button>
        ) : !approved ? (
          <Button
            disabled={!valid || !enough}
            loading={approveTx.busy}
            onClick={() =>
              approveTx.write({ address: addresses.usdt!, abi: mockUSDTAbi, functionName: "approve", args: [c.address, amount!] })
            }
          >
            2. Setujui {valid ? formatUsdt(amount!) : ""} mUSDT
          </Button>
        ) : (
          <Button
            disabled={!valid || !enough}
            loading={depositTx.busy}
            onClick={() =>
              depositTx.write({
                  address: c.address,
                  abi: harvestCampaignAbi,
                  functionName: "depositHarvest",
                  args: [amount!, receiptCid],
                })
            }
          >
            3. Setor {valid ? formatUsdt(amount!) : ""} USDT
          </Button>
        )}
        <TxStatus state={approveTx.state} successText="Izin mUSDT diberikan." />
        <TxStatus state={depositTx.state} successText="Hasil panen disetor dan sudah dibagi." />
      </div>
    </Card>
  );
}

function CooperativePanel({ c, milestone }: { c: CampaignSummary; milestone: Milestone }) {
  const tx = useTx();
  const [choice, setChoice] = useState<boolean | null>(null);
  const decide = (ok: boolean) => {
    setChoice(ok);
    return tx.write({ address: c.address, abi: harvestCampaignAbi, functionName: "verifierDecision", args: [ok] });
  };
  return (
    <Card>
      <h3 className="font-semibold text-daun-900">Verifikasi koperasi: {milestone.name}</h3>
      <p className="mt-1 text-sm text-stone-600">Dana tahap cair hanya jika agen AI dan koperasi sama-sama setuju.</p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <IpfsImage cid={milestone.proofCID} alt={`Bukti ${milestone.name}`} className="h-48" />
        <div>
          <p className="text-xs font-semibold text-stone-500 uppercase">Putusan agen AI</p>
          {milestone.aiDecided ? <VerdictSummary cid={milestone.aiReasonCID} /> : <p className="text-sm text-stone-600">Belum ada — agen sedang memeriksa.</p>}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button loading={tx.busy && choice === true} disabled={tx.busy} onClick={() => decide(true)}>
          Setujui
        </Button>
        <Button variant="danger" loading={tx.busy && choice === false} disabled={tx.busy} onClick={() => decide(false)}>
          Tolak
        </Button>
      </div>
      <div className="mt-2">
        <TxStatus state={tx.state} successText="Keputusan koperasi tercatat." />
      </div>
    </Card>
  );
}
