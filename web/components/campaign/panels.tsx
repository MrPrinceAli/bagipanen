"use client";

import { BadgeCheck, Camera, ClipboardCheck, Clock, HandCoins, Receipt, ShieldCheck, Wallet } from "lucide-react";
import { type ReactNode, useState } from "react";
import { isAddressEqual, zeroHash } from "viem";
import { useAccount } from "wagmi";
import { campaignFactoryAbi } from "@/lib/abi/CampaignFactory";
import { erc8004ReputationRegistryAbi } from "@/lib/abi/ERC8004ReputationRegistry";
import { harvestCampaignAbi } from "@/lib/abi/HarvestCampaign";
import { mockUSDTAbi } from "@/lib/abi/MockUSDT";
import { addresses, REPUTATION_REGISTRY } from "@/lib/addresses";
import { targetChain } from "@/lib/config";
import { decidedPairs, FEEDBACK_TAG, useGivenFeedback } from "@/lib/agentReputation";
import { usePosition } from "@/lib/campaigns";
import { formatPercent, formatRupiah, formatUsdt, parseUsdtInput, usdtToInput } from "@/lib/format";
import { uploadFile, uploadJson } from "@/lib/ipfs";
import { useAgentProfile } from "@/lib/registry";
import type { Role } from "@/lib/role";
import { useEffectiveNow } from "@/lib/time";
import { useTx } from "@/lib/tx";
import { type CampaignSummary, FailType, type Milestone, MStatus, Status } from "@/lib/types";
import { FilePicker, IpfsImage, Stepper, TxStatus, Usdt } from "../common";
import { Button, Card, CardTitle, cn, Field, Input, Notice } from "../ui";
import { ConnectPrompt } from "../wallet";
import { VerdictSummary } from "./Timeline";

type PanelProps = { c: CampaignSummary; milestones: readonly Milestone[]; role: Role | undefined; symbol: string };

/** Semua aksi yang tersedia untuk dompet yang terhubung, sesuai peran & status kampanye. */
export function ActionPanels(props: PanelProps) {
  const { c, milestones, role } = props;
  const { address, isConnected } = useAccount();
  const now = useEffectiveNow();
  const isFarmer = Boolean(address && isAddressEqual(address, c.farmer));
  const isCoop = Boolean(address && isAddressEqual(address, c.cooperative));
  const current = milestones[c.currentMilestone];
  const allReleased = c.currentMilestone >= c.milestoneCount;

  if (!isConnected)
    return (
      <Card className="flex flex-col gap-3">
        <CardTitle icon={Wallet} description={c.status === Status.Funding ? "Hubungkan dompetmu dulu untuk ikut mendanai proyek ini." : "Hubungkan dompetmu untuk melihat porsi atau mengklaim hasil."}>
          {c.status === Status.Funding ? "Mau ikut mendanai?" : "Punya porsi di sini?"}
        </CardTitle>
        <ConnectPrompt />
      </Card>
    );

  const panels = [];
  if (role === "admin" && c.status === Status.Draft) panels.push(<AdminReviewPanel key="admin" c={c} />);
  if (c.status === Status.Funding && now <= c.fundingDeadline && !isFarmer && !isCoop) panels.push(<FundPanel key="fund" c={c} />);
  if (c.status === Status.Funding && now > c.fundingDeadline) panels.push(<FinalizePanel key="finalize" c={c} />);
  if (!isFarmer && !isCoop) panels.push(<InvestorPanel key="investor" {...props} />);
  if (isFarmer && c.status === Status.Active && current && (current.status === MStatus.Pending || current.status === MStatus.Rejected))
    panels.push(<ProofPanel key="proof" c={c} milestone={current} />);
  if (isFarmer && c.status === Status.Active && allReleased) panels.push(<HarvestPanel key="harvest" c={c} />);
  if (
    isCoop &&
    c.status === Status.Active &&
    current &&
    !current.verifierDecided &&
    (current.status === MStatus.ProofSubmitted || current.status === MStatus.AIReviewed)
  )
    panels.push(<CooperativePanel key="coop" c={c} milestone={current} />);
  if (isCoop && REPUTATION_REGISTRY && decidedPairs(c, milestones).length > 0)
    panels.push(<AgentFeedbackPanel key="feedback" c={c} milestones={milestones} />);

  if (panels.length === 0) return null;
  return <div className="flex flex-col gap-4">{panels}</div>;
}

export function AdminReviewPanel({ c }: { c: CampaignSummary }) {
  const tx = useTx();
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const send = (fn: "approveCampaign" | "rejectCampaign") => {
    setAction(fn === "approveCampaign" ? "approve" : "reject");
    return tx.write({ address: addresses.factory!, abi: campaignFactoryAbi, functionName: fn, args: [c.address] });
  };
  return (
    <Card>
      <CardTitle icon={ClipboardCheck} description="Kalau disetujui, pendanaan langsung dibuka dan hitung mundurnya mulai berjalan.">
        Review pengajuan
      </CardTitle>
      <div className="flex flex-wrap gap-2">
        <Button loading={tx.busy && action === "approve"} disabled={tx.busy} onClick={() => send("approveCampaign")}>
          Setujui & buka pendanaan
        </Button>
        <Button variant="secondary" loading={tx.busy && action === "reject"} disabled={tx.busy} onClick={() => send("rejectCampaign")}>
          Tolak pengajuan
        </Button>
      </div>
      <div className="mt-3">
        <TxStatus state={tx.state} successText={action === "approve" ? "Pendanaan sudah dibuka." : "Pengajuan ditolak."} />
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
  if (input && (amount === null || amount === 0n)) problem = "Jumlahnya belum benar. Contoh: 250 atau 1.000.";
  else if (amount && amount > remaining) problem = `Paling banyak ${formatUsdt(remaining)} USDT, sesuai sisa target.`;
  else if (amount && pos && amount > pos.usdtBalance) problem = "Saldo mUSDT-mu kurang. Klik \"Minta mUSDT\" di atas untuk isi saldo demo.";

  const ready = Boolean(amount && amount > 0n && !problem);
  const approved = Boolean(ready && pos && pos.allowance >= amount!);
  const presets = [100n, 250n, 500n].map((v) => v * 10n ** 18n).filter((v) => v < remaining);

  return (
    <Card className="border-emas-200">
      <CardTitle icon={HandCoins} description={`Masih butuh ${formatUsdt(remaining)} USDT. Setiap 1 USDT jadi 1 token porsi atas namamu.`}>
        Ikut mendanai
      </CardTitle>
      <div className="flex flex-col gap-4">
        <Field
          label="Mau mendanai berapa?"
          htmlFor="fund-amount"
          hint={amount && ready ? `Sekitar ${formatRupiah(amount)}` : `Saldo kamu: ${pos ? formatUsdt(pos.usdtBalance) : "…"} mUSDT`}
        >
          <div className="relative">
            <Input id="fund-amount" inputMode="decimal" value={input} onChange={(e) => setInput(e.target.value)} placeholder="500" className="pr-16 text-base font-semibold" />
            <span className="absolute top-1/2 right-4 -translate-y-1/2 text-sm font-semibold text-stone-400">USDT</span>
          </div>
        </Field>
        <div className="flex flex-wrap gap-2">
          {presets.map((v) => (
            <button
              key={v.toString()}
              type="button"
              onClick={() => setInput(usdtToInput(v))}
              className="rounded-full border border-krem-300 px-3 py-1 text-sm font-medium text-hutan-800 transition hover:border-hutan-300 hover:bg-hutan-50"
            >
              {formatUsdt(v)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setInput(usdtToInput(remaining))}
            className="rounded-full border border-krem-300 px-3 py-1 text-sm font-medium text-hutan-800 transition hover:border-hutan-300 hover:bg-hutan-50"
          >
            Penuhi sisa target
          </button>
        </div>
        {problem && <Notice tone="warn">{problem}</Notice>}
        <Stepper
          steps={[
            { label: "Izinkan mUSDT", status: approved ? "done" : "active" },
            { label: "Danai", status: fundTx.state.status === "success" ? "done" : approved ? "active" : "todo" },
          ]}
        />
        {!approved ? (
          <Button
            size="lg"
            disabled={!ready}
            loading={approveTx.busy}
            onClick={() => approveTx.write({ address: addresses.usdt!, abi: mockUSDTAbi, functionName: "approve", args: [c.address, amount!] })}
          >
            1. Izinkan {amount && ready ? `${formatUsdt(amount)} ` : ""}mUSDT
          </Button>
        ) : (
          <Button
            size="lg"
            variant="gold"
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
        <p className="text-xs leading-relaxed text-stone-500">
          Langkah pertama hanya memberi izin kontrak memakai mUSDT-mu sebanyak itu. Danamu baru berpindah di langkah kedua.
        </p>
        <TxStatus state={approveTx.state} successText="Izin diberikan. Lanjut ke langkah 2." />
        <TxStatus state={fundTx.state} successText="Terima kasih! Danamu sudah tercatat." />
      </div>
    </Card>
  );
}

function FinalizePanel({ c }: { c: CampaignSummary }) {
  const tx = useTx();
  return (
    <Card>
      <CardTitle
        icon={Clock}
        description={`Target ${formatUsdt(c.targetAmount)} USDT tidak tercapai. Siapa pun boleh menutup pendanaan supaya investor bisa mengambil kembali dananya 100%.`}
      >
        Waktu pendanaan habis
      </CardTitle>
      <Button loading={tx.busy} onClick={() => tx.write({ address: c.address, abi: harvestCampaignAbi, functionName: "finalizeFunding" })}>
        Tutup pendanaan
      </Button>
      <div className="mt-3">
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

  const rows: [string, ReactNode][] = [
    ["Token porsi", `${formatUsdt(pos.shares)} ${symbol}`],
    ["Bagianmu", formatPercent(share)],
  ];
  if (pos.paidOut > 0n) rows.push(["Sudah diklaim", `${formatUsdt(pos.paidOut)} USDT`]);

  return (
    <Card className="bg-linear-to-br from-white to-hutan-50/60">
      <CardTitle icon={Wallet}>Porsimu</CardTitle>
      <dl className="flex flex-col divide-y divide-krem-200 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2 py-2">
            <dt className="text-stone-500">{k}</dt>
            <dd className="font-semibold text-hutan-950">{v}</dd>
          </div>
        ))}
      </dl>
      {pos.claimable > 0n && (
        <div className="mt-3 rounded-2xl bg-emas-50 p-4 ring-1 ring-emas-200">
          <p className="text-xs font-semibold tracking-wide text-emas-700 uppercase">Siap diklaim</p>
          <Usdt value={pos.claimable} className="mt-1 text-lg text-hutan-950" />
          <Button
            variant="gold"
            className="mt-3 w-full"
            loading={tx.busy}
            onClick={() => tx.write({ address: c.address, abi: harvestCampaignAbi, functionName: "claim" })}
          >
            Klaim {formatUsdt(pos.claimable)} USDT
          </Button>
        </div>
      )}
      {canRefund && (
        <Button className="mt-3 w-full" loading={tx.busy} onClick={() => tx.write({ address: c.address, abi: harvestCampaignAbi, functionName: "refund" })}>
          Ambil refund {formatUsdt(pos.shares)} USDT
        </Button>
      )}
      <div className="mt-3">
        <TxStatus state={tx.state} successText="Dana sudah masuk ke dompetmu." />
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
  const retry = milestone.status === MStatus.Rejected;

  if (attemptsLeft <= 0)
    return (
      <Notice tone="error">
        Kesempatan kirim bukti untuk tahap {milestone.name} sudah habis (tiga kali). Sekarang tinggal menunggu keputusan admin.
      </Notice>
    );

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
      setError(e instanceof Error ? e.message : "Fotonya gagal diunggah. Coba lagi.");
    }
  }

  return (
    <Card className="border-emas-200">
      <CardTitle
        icon={Camera}
        description={`Percobaan ${milestone.attempts + 1} dari 3. Agen AI akan mengecek lokasi, tanggal, jenis tanaman, fase, dan cuaca, lalu koperasi ikut memastikan.`}
      >
        {retry ? "Kirim ulang" : "Kirim"} bukti tahap {milestone.name}
      </CardTitle>
      {retry && milestone.aiReasonCID && (
        <div className="mb-4 rounded-2xl bg-red-50/60 p-3 ring-1 ring-red-100">
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-red-700 uppercase">Kenapa sebelumnya ditolak</p>
          <VerdictSummary cid={milestone.aiReasonCID} ctx={{ commodity: c.commodity, milestone: milestone.name }} />
        </div>
      )}
      <div className="flex flex-col gap-3">
        <Field label="Foto lahan terbaru" htmlFor="proof" hint="Ambil langsung dari galeri kamera. Foto yang sudah lewat WhatsApp biasanya kehilangan data GPS dan tanggal.">
          <FilePicker id="proof" file={file} onChange={setFile} label="Pilih foto lahan" />
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        <Button size="lg" disabled={!file} loading={uploading || tx.busy} onClick={submit}>
          {uploading ? "Mengunggah foto…" : "Kirim bukti"}
        </Button>
        <TxStatus state={tx.state} successText="Bukti terkirim. Agen AI sedang memeriksanya." />
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
      setError(e instanceof Error ? e.message : "Notanya gagal diunggah. Coba lagi.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className="border-emas-200">
      <CardTitle icon={Receipt} description="Semua dana tahap sudah cair. Setor hasil penjualan beserta foto notanya, kontrak langsung membaginya saat itu juga.">
        Setor hasil panen
      </CardTitle>
      <div className="flex flex-col gap-4">
        <Field label="Hasil penjualan (USDT)" htmlFor="harvest-amount" hint={`Saldo kamu: ${pos ? formatUsdt(pos.usdtBalance) : "…"} mUSDT`}>
          <Input id="harvest-amount" inputMode="decimal" value={input} onChange={(e) => setInput(e.target.value)} className="text-base font-semibold" />
        </Field>
        {valid && (
          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 rounded-2xl bg-krem-50 p-4 text-sm ring-1 ring-krem-200">
            <dt className="text-stone-500">Modal kembali ke investor</dt>
            <dd className="text-right">{formatUsdt(amount! < c.raisedAmount ? amount! : c.raisedAmount)} USDT</dd>
            <dt className="text-stone-500">Bagianmu (55% untung)</dt>
            <dd className="text-right font-semibold text-hutan-700">{formatUsdt(farmerShare)} USDT</dd>
            <dt className="text-stone-500">Dana cadangan (5%)</dt>
            <dd className="text-right">{formatUsdt(reserveShare)} USDT</dd>
            <dt className="border-t border-krem-200 pt-1.5 font-semibold text-hutan-950">Total untuk investor</dt>
            <dd className="border-t border-krem-200 pt-1.5 text-right font-semibold">{formatUsdt(investorPool)} USDT</dd>
          </dl>
        )}
        {valid && !enough && <Notice tone="warn">Saldo mUSDT-mu belum cukup. Untuk simulasi, klik &quot;Minta mUSDT&quot; di atas.</Notice>}
        <Field label="Foto nota penjualan" htmlFor="receipt">
          <FilePicker
            id="receipt"
            file={file}
            onChange={(f) => {
              setFile(f);
              setReceiptCid("");
            }}
            label="Pilih foto nota"
          />
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        <Stepper
          steps={[
            { label: "Unggah nota", status: receiptCid ? "done" : "active" },
            { label: "Izinkan mUSDT", status: approved ? "done" : receiptCid ? "active" : "todo" },
            { label: "Setor", status: depositTx.state.status === "success" ? "done" : receiptCid && approved ? "active" : "todo" },
          ]}
        />
        {!receiptCid ? (
          <Button size="lg" disabled={!file} loading={uploading} onClick={uploadReceipt}>
            1. Unggah nota
          </Button>
        ) : !approved ? (
          <Button
            size="lg"
            disabled={!valid || !enough}
            loading={approveTx.busy}
            onClick={() => approveTx.write({ address: addresses.usdt!, abi: mockUSDTAbi, functionName: "approve", args: [c.address, amount!] })}
          >
            2. Izinkan {valid ? formatUsdt(amount!) : ""} mUSDT
          </Button>
        ) : (
          <Button
            size="lg"
            variant="gold"
            disabled={!valid || !enough}
            loading={depositTx.busy}
            onClick={() =>
              depositTx.write({ address: c.address, abi: harvestCampaignAbi, functionName: "depositHarvest", args: [amount!, receiptCid] })
            }
          >
            3. Setor {valid ? formatUsdt(amount!) : ""} USDT
          </Button>
        )}
        <TxStatus state={approveTx.state} successText="Izin diberikan. Lanjut setor." />
        <TxStatus state={depositTx.state} successText="Hasil panen sudah disetor dan langsung dibagi." />
      </div>
    </Card>
  );
}

export function CooperativePanel({ c, milestone }: { c: CampaignSummary; milestone: Milestone }) {
  const tx = useTx();
  const [choice, setChoice] = useState<boolean | null>(null);
  const decide = (ok: boolean) => {
    setChoice(ok);
    return tx.write({ address: c.address, abi: harvestCampaignAbi, functionName: "verifierDecision", args: [ok] });
  };
  return (
    <Card className="border-emas-200">
      <CardTitle icon={ShieldCheck} description="Dana tahap ini baru cair kalau kamu dan agen AI sama-sama setuju.">
        Cek bukti tahap {milestone.name}
      </CardTitle>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <IpfsImage cid={milestone.proofCID} alt={`Foto bukti tahap ${milestone.name}`} className="h-52" />
        <div className="rounded-2xl bg-krem-50 p-4 ring-1 ring-krem-200">
          <p className="mb-2 text-xs font-semibold tracking-wide text-stone-500 uppercase">Hasil cek agen AI</p>
          {milestone.aiDecided ? (
            <VerdictSummary cid={milestone.aiReasonCID} ctx={{ commodity: c.commodity, milestone: milestone.name }} />
          ) : (
            <p className="text-sm text-stone-600">Agen AI masih memeriksa foto ini. Kamu boleh memutuskan lebih dulu.</p>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button loading={tx.busy && choice === true} disabled={tx.busy} onClick={() => decide(true)}>
          Setujui bukti
        </Button>
        <Button variant="secondary" className={cn("hover:border-red-300 hover:bg-red-50 hover:text-red-800")} loading={tx.busy && choice === false} disabled={tx.busy} onClick={() => decide(false)}>
          Tolak
        </Button>
      </div>
      <div className="mt-3">
        <TxStatus state={tx.state} successText="Keputusanmu sudah tercatat." />
      </div>
    </Card>
  );
}

/**
 * Koperasi menilai agen AI di ERC-8004 ReputationRegistry resmi: setiap tahap yang sudah diputus
 * keduanya → 100 (sepakat) atau 0 (tidak sepakat). Transaksi terpisah; tidak memengaruhi pencairan.
 */
function AgentFeedbackPanel({ c, milestones }: { c: CampaignSummary; milestones: readonly Milestone[] }) {
  const { address } = useAccount();
  const { data: agent } = useAgentProfile();
  const { data: given } = useGivenFeedback(agent?.configured ? agent.agentId : undefined, address);
  const tx = useTx();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  if (!agent?.configured || !given || !address) return null;
  const pending = decidedPairs(c, milestones).filter((p) => !given.has(p.key));
  if (pending.length === 0) return null;

  async function rate({ m, index, key }: (typeof pending)[number]) {
    setError("");
    setBusyKey(key);
    try {
      const agree = m.aiApproved === m.verifierApproved;
      // Berkas feedback ERC-8004 (field wajib spesifikasi + konteks BagiPanen) di IPFS.
      const doc = await uploadJson({
        schema: "bagipanen.agent-feedback.v1",
        agentRegistry: `eip155:${targetChain.id}:${agent!.identityRegistry}`,
        agentId: Number(agent!.agentId),
        clientAddress: `eip155:${targetChain.id}:${address}`,
        createdAt: new Date().toISOString(),
        value: agree ? 100 : 0,
        valueDecimals: 0,
        tag1: FEEDBACK_TAG,
        tag2: key,
        campaign: c.address,
        milestoneIndex: index,
        milestoneName: m.name,
        attempt: m.attempts,
        proofCID: m.proofCID,
        aiApproved: m.aiApproved,
        aiReasonCID: m.aiReasonCID,
        verifierApproved: m.verifierApproved,
      });
      await tx.write({
        address: REPUTATION_REGISTRY!,
        abi: erc8004ReputationRegistryAbi,
        functionName: "giveFeedback",
        args: [agent!.agentId, agree ? 100n : 0n, 0, FEEDBACK_TAG, key, "", `ipfs://${doc.cid}`, zeroHash],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Penilaian gagal disimpan. Coba lagi.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <Card>
      <CardTitle
        icon={BadgeCheck}
        description="Catat apakah kamu sepakat dengan putusan agen AI. Penilaian masuk ke registri reputasi ERC-8004 resmi dan bisa dibaca siapa saja. Tidak memengaruhi pencairan dana."
      >
        Nilai agen AI
      </CardTitle>
      <ul className="flex flex-col gap-2">
        {pending.map((p) => {
          const agree = p.m.aiApproved === p.m.verifierApproved;
          return (
            <li key={p.key} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-krem-50 p-3 ring-1 ring-krem-200">
              <div className="text-sm">
                <p className="font-semibold text-hutan-950">
                  Tahap {p.m.name} <span className="font-normal text-stone-500">· percobaan {p.m.attempts}</span>
                </p>
                <p className="text-stone-600">
                  Agen {p.m.aiApproved ? "menyetujui" : "menolak"}, kamu {p.m.verifierApproved ? "menyetujui" : "menolak"} →{" "}
                  <span className={cn("font-semibold", agree ? "text-hutan-700" : "text-red-700")}>{agree ? "sepakat (100)" : "tidak sepakat (0)"}</span>
                </p>
              </div>
              <Button size="sm" loading={busyKey === p.key} disabled={busyKey !== null} onClick={() => rate(p)}>
                Catat penilaian
              </Button>
            </li>
          );
        })}
      </ul>
      {error && (
        <Notice tone="error" className="mt-3">
          {error}
        </Notice>
      )}
      <div className="mt-3">
        <TxStatus state={tx.state} successText="Penilaianmu tercatat di registri reputasi ERC-8004." />
      </div>
    </Card>
  );
}
