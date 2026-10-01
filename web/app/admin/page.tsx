"use client";

import Link from "next/link";
import { useState } from "react";
import { isAddressEqual } from "viem";
import { CampaignLink } from "@/components/CampaignLink";
import { AdminReviewPanel } from "@/components/campaign/panels";
import { VerdictSummary } from "@/components/campaign/Timeline";
import { AddressInput, ConfirmButton, IpfsImage, parseAddressInput, StatusBadge, TxStatus, Usdt } from "@/components/common";
import { Badge, Button, Card, EmptyState, Field, Input, Notice, SectionTitle, Select, Spinner, Stat } from "@/components/ui";
import { IS_LOCAL } from "@/lib/config";
import { campaignFactoryAbi } from "@/lib/abi/CampaignFactory";
import { harvestCampaignAbi } from "@/lib/abi/HarvestCampaign";
import { reservePoolAbi } from "@/lib/abi/ReservePool";
import { addresses } from "@/lib/addresses";
import { useReserveBalance } from "@/lib/campaigns";
import { formatDate, formatUsdt, parseUsdtInput, shortAddress } from "@/lib/format";
import { identityIsMock, useAgentProfile, useAllCampaigns, useRegistrations } from "@/lib/registry";
import { useEffectiveNow } from "@/lib/time";
import { useRole } from "@/lib/role";
import { useTx } from "@/lib/tx";
import { type CampaignSummary, FailType, type Milestone, MStatus, Status } from "@/lib/types";

const DEFAULT_GRACE = 30n * 86_400n;

type Row = { summary: CampaignSummary; milestones: readonly Milestone[] };

function DisputeCard({ summary: c, milestones }: Row) {
  const tx = useTx();
  const [choice, setChoice] = useState<boolean | null>(null);
  const m = milestones[c.currentMilestone];
  const resolve = (ok: boolean) => {
    setChoice(ok);
    return tx.write({ address: c.address, abi: harvestCampaignAbi, functionName: "resolveDispute", args: [ok] });
  };
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <CampaignLink c={c} />
        <Badge tone="red">Sengketa · {m.name}</Badge>
      </div>
      <p className="mt-1 text-sm text-stone-600">Ditolak {m.attempts} kali. Keputusan admin bersifat final dan tercatat onchain.</p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr]">
        <IpfsImage cid={m.proofCID} alt={`Bukti terakhir ${m.name}`} className="h-32" />
        <div className="text-sm">
          <p className="text-xs font-semibold text-stone-500 uppercase">Putusan AI terakhir</p>
          {m.aiReasonCID ? <VerdictSummary cid={m.aiReasonCID} /> : <p className="text-stone-500">–</p>}
          <p className="mt-2">
            <span className="text-stone-500">Koperasi: </span>
            {m.verifierApproved ? "✓ Setuju" : "✗ Tolak"}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button loading={tx.busy && choice === true} disabled={tx.busy} onClick={() => resolve(true)}>
          Setujui & cairkan dana tahap
        </Button>
        <ConfirmButton loading={tx.busy && choice === false} disabled={tx.busy} onConfirm={() => resolve(false)}>
          Tolak final
        </ConfirmButton>
      </div>
      <div className="mt-2">
        <TxStatus state={tx.state} successText={choice ? "Dana tahap dicairkan." : "Milestone ditolak final."} />
      </div>
    </Card>
  );
}

function ActiveCard({ summary: c, milestones, now }: Row & { now: bigint }) {
  const failTx = useTx();
  const defaultTx = useTx();
  const m = milestones[c.currentMilestone];
  const defaultAt = c.expectedHarvestDate + DEFAULT_GRACE;
  const canDefault = now > defaultAt;
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <CampaignLink c={c} />
        <StatusBadge status={c.status} failType={c.failType} />
      </div>
      <p className="mt-1 text-sm text-stone-600">
        Cair {formatUsdt(c.totalReleased)} / {formatUsdt(c.raisedAmount)} USDT · {m ? `milestone ${m.name}` : "semua milestone cair, menunggu setoran panen"} · perkiraan
        panen {formatDate(c.expectedHarvestDate)}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <ConfirmButton size="sm" loading={failTx.busy} onConfirm={() => failTx.write({ address: c.address, abi: harvestCampaignAbi, functionName: "markFailed" })}>
          Tandai gagal panen
        </ConfirmButton>
        <ConfirmButton
          size="sm"
          variant="secondary"
          disabled={!canDefault}
          loading={defaultTx.busy}
          onConfirm={() => defaultTx.write({ address: c.address, abi: harvestCampaignAbi, functionName: "markDefault" })}
        >
          Tandai gagal bayar
        </ConfirmButton>
      </div>
      {!canDefault && <p className="mt-1 text-xs text-stone-500">Gagal bayar baru bisa ditandai setelah {formatDate(defaultAt)} (perkiraan panen + 30 hari).</p>}
      <div className="mt-2 flex flex-col gap-1">
        <TxStatus state={failTx.state} successText="Ditandai gagal panen. Sisa dana kini bisa diklaim investor." />
        <TxStatus state={defaultTx.state} successText="Ditandai gagal bayar. Petani diblokir membuat kampanye baru." />
      </div>
    </Card>
  );
}

function FinalizeCard({ summary: c }: Row) {
  const tx = useTx();
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <CampaignLink c={c} />
        <StatusBadge status={c.status} />
      </div>
      <p className="mt-1 text-sm text-stone-600">
        Tenggat lewat, terkumpul {formatUsdt(c.raisedAmount)} dari {formatUsdt(c.targetAmount)} USDT.
      </p>
      <Button className="mt-3" size="sm" loading={tx.busy} onClick={() => tx.write({ address: c.address, abi: harvestCampaignAbi, functionName: "finalizeFunding" })}>
        Tutup pendanaan (investor refund 100%)
      </Button>
      <div className="mt-2">
        <TxStatus state={tx.state} successText="Pendanaan ditutup." />
      </div>
    </Card>
  );
}

function ReserveSection({ eligible }: { eligible: Row[] }) {
  const { data: balance } = useReserveBalance();
  const tx = useTx();
  const [target, setTarget] = useState("");
  const [amount, setAmount] = useState("");
  const wei = parseUsdtInput(amount);
  const selected = eligible.find((r) => r.summary.address === target);
  const tooMuch = wei !== null && balance !== undefined && wei > balance;

  return (
    <Card>
      <SectionTitle>Dana cadangan</SectionTitle>
      <div className="mb-3">
        <Usdt value={balance ?? 0n} />
      </div>
      <p className="mb-3 text-sm text-stone-600">
        Kompensasi hanya bisa dikirim ke kampanye yang gagal panen atau gagal bayar, dan langsung menambah pool klaim investor.
      </p>
      {eligible.length === 0 ? (
        <EmptyState title="Tidak ada kampanye yang bisa diberi kompensasi" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Kampanye" htmlFor="comp-campaign">
            <Select id="comp-campaign" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Pilih kampanye…</option>
              {eligible.map(({ summary: c }) => (
                <option key={c.address} value={c.address}>
                  #{c.campaignId.toString()} {c.commodity} · {c.status === Status.Defaulted ? "gagal bayar" : "gagal panen"} · pool {formatUsdt(c.investorPool)} USDT
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Jumlah (USDT)" htmlFor="comp-amount">
            <Input id="comp-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="20" />
          </Field>
        </div>
      )}
      {tooMuch && <div className="mt-2"><Notice tone="warn">Melebihi saldo dana cadangan.</Notice></div>}
      {eligible.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          <Button
            disabled={!selected || !wei || wei === 0n || tooMuch}
            loading={tx.busy}
            onClick={async () => {
              const ok = await tx.write({
                address: addresses.reservePool!,
                abi: reservePoolAbi,
                functionName: "compensate",
                args: [selected!.summary.address, wei!],
              });
              if (ok) setAmount("");
            }}
          >
            Kirim kompensasi
          </Button>
          <TxStatus state={tx.state} successText="Kompensasi terkirim; investor bisa klaim lagi." />
        </div>
      )}
    </Card>
  );
}

function CooperativeSection() {
  const { data: regs } = useRegistrations();
  const tx = useTx();
  const [wallet, setWallet] = useState("");
  const [name, setName] = useState("");
  const addr = parseAddressInput(wallet);

  return (
    <Card>
      <SectionTitle>Koperasi</SectionTitle>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Wallet koperasi" htmlFor="coop-wallet">
          <AddressInput id="coop-wallet" value={wallet} onChange={setWallet} />
        </Field>
        <Field label="Nama koperasi" htmlFor="coop-name">
          <Input id="coop-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Koperasi Tani Makmur, Garut" />
        </Field>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <Button
          disabled={!addr || !name.trim()}
          loading={tx.busy}
          onClick={async () => {
            const ok = await tx.write({ address: addresses.factory!, abi: campaignFactoryAbi, functionName: "registerCooperative", args: [addr!, name.trim()] });
            if (ok) {
              setWallet("");
              setName("");
            }
          }}
        >
          Daftarkan koperasi
        </Button>
        <TxStatus state={tx.state} successText="Koperasi terdaftar." />
      </div>
      <ul className="mt-4 divide-y divide-tanah-100 text-sm">
        {(regs?.cooperatives ?? []).map((c) => {
          const members = regs!.farmers.filter((f) => f.cooperative && isAddressEqual(f.cooperative, c.address)).length;
          return (
            <li key={c.address} className="flex items-center justify-between gap-2 py-2">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="font-mono text-xs text-stone-500">{shortAddress(c.address)}</p>
              </div>
              <span className="text-xs text-stone-500">{members} petani</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function AgentSection() {
  const { data: agent } = useAgentProfile();
  const tx = useTx();
  const [registry, setRegistry] = useState("");
  const [agentId, setAgentId] = useState("");
  const [wallet, setWallet] = useState("");
  const reg = parseAddressInput(registry || agent?.identityRegistry || "");
  const w = parseAddressInput(wallet);
  const id = /^\d+$/.test(agentId.trim()) ? BigInt(agentId.trim()) : null;

  return (
    <Card>
      <SectionTitle action={<Link href="/agent" className="text-sm text-daun-700 underline">Profil agen →</Link>}>Konfigurasi agen AI</SectionTitle>
      {agent && (
        <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-stone-500">Status</dt>
          <dd>{agent.isAgent ? <Badge tone="green">Aktif</Badge> : <Badge tone="red">Belum dikonfigurasi</Badge>}</dd>
          <dt className="text-stone-500">Registri</dt>
          <dd className="font-mono text-xs break-all">
            {agent.identityRegistry} {identityIsMock(agent.identityRegistry) ? "(MockAgentIdentity)" : "(ERC-8004)"}
          </dd>
          <dt className="text-stone-500">ID agen</dt>
          <dd>#{agent.agentId.toString()}</dd>
          <dt className="text-stone-500">Wallet agen</dt>
          <dd className="font-mono text-xs break-all">{agent.agentWallet}</dd>
        </dl>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Registri identitas" htmlFor="agent-registry" hint="Kosong = registri saat ini">
          <AddressInput id="agent-registry" value={registry} onChange={setRegistry} placeholder={agent?.identityRegistry ?? "0x…"} />
        </Field>
        <Field label="ID agen" htmlFor="agent-id">
          <Input id="agent-id" inputMode="numeric" value={agentId} onChange={(e) => setAgentId(e.target.value)} placeholder="1" />
        </Field>
        <Field label="Wallet agen" htmlFor="agent-wallet" hint="Harus pemilik ID agen & bukan admin/koperasi/petani">
          <AddressInput id="agent-wallet" value={wallet} onChange={setWallet} />
        </Field>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <Button
          disabled={!reg || id === null || !w}
          loading={tx.busy}
          onClick={() => tx.write({ address: addresses.factory!, abi: campaignFactoryAbi, functionName: "setAgent", args: [reg!, id!, w!] })}
        >
          Simpan konfigurasi agen
        </Button>
        <TxStatus state={tx.state} successText="Agen dikonfigurasi." />
      </div>
    </Card>
  );
}

export default function AdminPage() {
  const { role } = useRole();
  const { data: rows, isLoading } = useAllCampaigns();
  const now = useEffectiveNow();

  if (role === undefined) return <Spinner />;
  if (role !== "admin") return <Notice tone="info">Halaman ini khusus admin. {role === "tamu" ? `${IS_LOCAL ? "Pilih akun" : "Hubungkan dompet"} Admin di header.` : "Wallet Anda bukan admin."}</Notice>;

  const all = rows ?? [];
  const drafts = all.filter((r) => r.summary.status === Status.Draft);
  const disputes = all.filter((r) => r.summary.status === Status.Active && r.milestones[r.summary.currentMilestone]?.status === MStatus.Disputed);
  const active = all.filter((r) => r.summary.status === Status.Active);
  const expired = all.filter((r) => r.summary.status === Status.Funding && now > r.summary.fundingDeadline);
  const eligible = all.filter(
    (r) => (r.summary.status === Status.Failed && r.summary.failType === FailType.Crop) || r.summary.status === Status.Defaulted,
  );

  const nav = [
    ["#persetujuan", `Persetujuan (${drafts.length})`],
    ["#sengketa", `Sengketa (${disputes.length})`],
    ["#berjalan", `Berjalan (${active.length})`],
    ["#cadangan", "Dana cadangan"],
    ["#koperasi", "Koperasi"],
    ["#agen", "Agen"],
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-daun-900">Admin</h1>
        <p className="text-sm text-stone-600">Admin tidak bisa menarik dana escrow — hanya menjalankan aturan yang ada di kontrak.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Menunggu persetujuan" value={drafts.length} />
        <Stat label="Sengketa" value={disputes.length} />
        <Stat label="Berjalan" value={active.length} />
        <Stat label="Bisa dikompensasi" value={eligible.length} />
      </div>
      <nav className="-mx-1 flex gap-1 overflow-x-auto">
        {nav.map(([href, label]) => (
          <a key={href} href={href} className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-stone-700 ring-1 ring-tanah-200 hover:bg-tanah-100">
            {label}
          </a>
        ))}
      </nav>
      {isLoading && <Spinner />}

      <section id="persetujuan" className="scroll-mt-28">
        <SectionTitle>Kampanye menunggu persetujuan</SectionTitle>
        {drafts.length === 0 ? (
          <EmptyState title="Tidak ada pengajuan baru" />
        ) : (
          <div className="flex flex-col gap-4">
            {drafts.map(({ summary: c }) => (
              <div key={c.address} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <CampaignLink c={c} />
                  <span className="text-xs text-stone-500">
                    target {formatUsdt(c.targetAmount)} USDT · estimasi jual {formatUsdt(c.estimatedRevenue)} USDT
                  </span>
                </div>
                <AdminReviewPanel c={c} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="sengketa" className="scroll-mt-28">
        <SectionTitle>Sengketa milestone</SectionTitle>
        {disputes.length === 0 ? (
          <EmptyState title="Tidak ada sengketa" />
        ) : (
          <div className="flex flex-col gap-4">
            {disputes.map((r) => (
              <DisputeCard key={r.summary.address} {...r} />
            ))}
          </div>
        )}
      </section>

      <section id="berjalan" className="scroll-mt-28">
        <SectionTitle>Kampanye berjalan</SectionTitle>
        {active.length === 0 && expired.length === 0 ? (
          <EmptyState title="Tidak ada kampanye berjalan" />
        ) : (
          <div className="flex flex-col gap-4">
            {expired.map((r) => (
              <FinalizeCard key={r.summary.address} {...r} />
            ))}
            {active.map((r) => (
              <ActiveCard key={r.summary.address} {...r} now={now} />
            ))}
          </div>
        )}
      </section>

      <section id="cadangan" className="scroll-mt-28">
        <ReserveSection eligible={eligible} />
      </section>
      <section id="koperasi" className="scroll-mt-28">
        <CooperativeSection />
      </section>
      <section id="agen" className="scroll-mt-28">
        <AgentSection />
      </section>
    </div>
  );
}
