"use client";

import { Bot, Building2, ClipboardList, Gavel, Landmark, Scale, Sprout } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { isAddressEqual } from "viem";
import { CampaignLink } from "@/components/CampaignLink";
import { AdminReviewPanel } from "@/components/campaign/panels";
import { VerdictSummary } from "@/components/campaign/Timeline";
import { AddressInput, AddressLink, ConfirmButton, IpfsImage, parseAddressInput, StatusBadge, TxStatus, Usdt } from "@/components/common";
import { Badge, Button, Card, CardTitle, EmptyState, Field, Input, Loading, Notice, PageBody, PageHero, SectionTitle, Select, Stat } from "@/components/ui";
import { RoleGate } from "@/components/wallet";
import { campaignFactoryAbi } from "@/lib/abi/CampaignFactory";
import { harvestCampaignAbi } from "@/lib/abi/HarvestCampaign";
import { reservePoolAbi } from "@/lib/abi/ReservePool";
import { addresses } from "@/lib/addresses";
import { useReserveBalance } from "@/lib/campaigns";
import { formatDate, formatUsdt, parseUsdtInput, shortAddress } from "@/lib/format";
import { identityIsMock, useAgentProfile, useAllCampaigns, useRegistrations } from "@/lib/registry";
import { useRole } from "@/lib/role";
import { useEffectiveNow } from "@/lib/time";
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
    <Card className="border-red-200">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <CampaignLink c={c} />
        <Badge tone="red" dot>
          Sengketa · {m.name}
        </Badge>
      </div>
      <p className="mt-1 text-sm text-stone-600">Bukti tahap ini sudah ditolak {m.attempts} kali. Keputusanmu final dan tercatat di blockchain.</p>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[200px_1fr]">
        <IpfsImage cid={m.proofCID} alt={`Bukti terakhir tahap ${m.name}`} className="h-40" />
        <div className="flex flex-col gap-3 rounded-2xl bg-krem-50 p-4 ring-1 ring-krem-200">
          <div>
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-stone-500 uppercase">Putusan AI terakhir</p>
            {m.aiReasonCID ? <VerdictSummary cid={m.aiReasonCID} ctx={{ commodity: c.commodity, milestone: m.name }} /> : <p className="text-sm text-stone-500">Belum ada.</p>}
          </div>
          <p className="text-sm">
            <span className="text-stone-500">Koperasi: </span>
            <span className="font-semibold">{m.verifierApproved ? "setuju" : "menolak"}</span>
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button loading={tx.busy && choice === true} disabled={tx.busy} onClick={() => resolve(true)}>
          Setujui & cairkan dana tahap
        </Button>
        <ConfirmButton loading={tx.busy && choice === false} disabled={tx.busy} onConfirm={() => resolve(false)}>
          Tolak final
        </ConfirmButton>
      </div>
      <div className="mt-3">
        <TxStatus state={tx.state} successText={choice ? "Dana tahap dicairkan." : "Tahap ini ditolak final."} />
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
        {formatUsdt(c.totalReleased)} dari {formatUsdt(c.raisedAmount)} USDT sudah cair · {m ? `tahap ${m.name}` : "semua tahap cair, menunggu setoran panen"} · perkiraan
        panen {formatDate(c.expectedHarvestDate)}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
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
      {!canDefault && (
        <p className="mt-2 text-xs text-stone-500">Gagal bayar baru bisa ditandai mulai {formatDate(defaultAt)}, yaitu 30 hari setelah perkiraan panen.</p>
      )}
      <div className="mt-3 flex flex-col gap-1">
        <TxStatus state={failTx.state} successText="Ditandai gagal panen. Sisa dana sekarang bisa diklaim investor." />
        <TxStatus state={defaultTx.state} successText="Ditandai gagal bayar. Petani tidak bisa mengajukan proyek baru." />
      </div>
    </Card>
  );
}

function FinalizeCard({ summary: c }: Row) {
  const tx = useTx();
  return (
    <Card className="border-emas-200">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <CampaignLink c={c} />
        <StatusBadge status={c.status} />
      </div>
      <p className="mt-1 text-sm text-stone-600">
        Waktu pendanaan habis. Terkumpul {formatUsdt(c.raisedAmount)} dari {formatUsdt(c.targetAmount)} USDT.
      </p>
      <Button className="mt-4" size="sm" loading={tx.busy} onClick={() => tx.write({ address: c.address, abi: harvestCampaignAbi, functionName: "finalizeFunding" })}>
        Tutup pendanaan & buka refund
      </Button>
      <div className="mt-3">
        <TxStatus state={tx.state} successText="Pendanaan ditutup. Investor bisa refund 100%." />
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
      <CardTitle
        icon={Landmark}
        description="Kompensasi hanya bisa dikirim ke proyek yang gagal panen atau gagal bayar, dan langsung menambah dana yang bisa diklaim investor."
      >
        Dana cadangan
      </CardTitle>
      <div className="mb-5 rounded-2xl bg-hutan-950 p-5 text-white">
        <p className="text-xs font-semibold tracking-wide text-white/60 uppercase">Saldo saat ini</p>
        <Usdt value={balance ?? 0n} className="mt-1 font-display text-3xl [&>span:last-child]:font-sans [&>span:last-child]:text-white/60" />
      </div>
      {eligible.length === 0 ? (
        <EmptyState title="Belum ada proyek yang perlu kompensasi" />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Proyek" htmlFor="comp-campaign">
              <Select id="comp-campaign" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">Pilih proyek…</option>
                {eligible.map(({ summary: c }) => (
                  <option key={c.address} value={c.address}>
                    #{c.campaignId.toString()} {c.commodity} · {c.status === Status.Defaulted ? "gagal bayar" : "gagal panen"} · {formatUsdt(c.investorPool)} USDT untuk investor
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Jumlah (USDT)" htmlFor="comp-amount">
              <Input id="comp-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="20" />
            </Field>
          </div>
          {tooMuch && (
            <Notice tone="warn" className="mt-3">
              Jumlahnya melebihi saldo dana cadangan.
            </Notice>
          )}
          <div className="mt-4 flex flex-col gap-2">
            <Button
              className="self-start"
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
            <TxStatus state={tx.state} successText="Kompensasi terkirim. Investor bisa klaim lagi." />
          </div>
        </>
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
      <CardTitle icon={Building2} description="Koperasi mendaftarkan petani anggotanya dan menjadi kunci kedua pencairan dana.">
        Koperasi
      </CardTitle>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Alamat dompet koperasi" htmlFor="coop-wallet">
          <AddressInput id="coop-wallet" value={wallet} onChange={setWallet} />
        </Field>
        <Field label="Nama koperasi" htmlFor="coop-name">
          <Input id="coop-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Koperasi Tani Makmur, Garut" />
        </Field>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <Button
          className="self-start"
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
        <TxStatus state={tx.state} successText="Koperasi berhasil didaftarkan." />
      </div>
      {(regs?.cooperatives ?? []).length > 0 && (
        <ul className="mt-5 flex flex-col divide-y divide-krem-200 border-t border-krem-200 text-sm">
          {(regs?.cooperatives ?? []).map((c) => {
            const members = regs!.farmers.filter((f) => f.cooperative && isAddressEqual(f.cooperative, c.address)).length;
            return (
              <li key={c.address} className="flex items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-semibold text-hutan-950">{c.name}</p>
                  <p className="font-mono text-xs text-stone-500">{shortAddress(c.address)}</p>
                </div>
                <Badge tone="green">{members} petani</Badge>
              </li>
            );
          })}
        </ul>
      )}
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
      <CardTitle
        icon={Bot}
        description="Hubungkan agen AI verifikator dengan identitasnya di registri."
        action={
          <Link href="/agent" className="text-sm font-semibold text-hutan-700 hover:underline">
            Profil agen →
          </Link>
        }
      >
        Agen AI
      </CardTitle>
      {agent && (
        <dl className="mb-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl bg-krem-50 p-4 text-sm ring-1 ring-krem-200">
          <dt className="text-stone-500">Status</dt>
          <dd>{agent.isAgent ? <Badge tone="green" dot>Aktif</Badge> : <Badge tone="red" dot>Belum diatur</Badge>}</dd>
          <dt className="text-stone-500">Registri</dt>
          <dd className="flex flex-wrap items-center gap-2">
            <AddressLink address={agent.identityRegistry} />
            <span className="text-xs text-stone-500">{identityIsMock(agent.identityRegistry) ? "MockAgentIdentity" : "ERC-8004"}</span>
          </dd>
          <dt className="text-stone-500">ID agen</dt>
          <dd className="font-semibold">#{agent.agentId.toString()}</dd>
          <dt className="text-stone-500">Dompet agen</dt>
          <dd>
            <AddressLink address={agent.agentWallet} />
          </dd>
        </dl>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Registri identitas" htmlFor="agent-registry" hint="Kosongkan untuk memakai registri sekarang">
          <AddressInput id="agent-registry" value={registry} onChange={setRegistry} placeholder={agent?.identityRegistry ?? "0x…"} />
        </Field>
        <Field label="ID agen" htmlFor="agent-id">
          <Input id="agent-id" inputMode="numeric" value={agentId} onChange={(e) => setAgentId(e.target.value)} placeholder="1" />
        </Field>
        <Field label="Dompet agen" htmlFor="agent-wallet" hint="Harus pemilik ID agen itu, dan bukan dompet admin, koperasi, atau petani">
          <AddressInput id="agent-wallet" value={wallet} onChange={setWallet} />
        </Field>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <Button
          className="self-start"
          disabled={!reg || id === null || !w}
          loading={tx.busy}
          onClick={() => tx.write({ address: addresses.factory!, abi: campaignFactoryAbi, functionName: "setAgent", args: [reg!, id!, w!] })}
        >
          Simpan konfigurasi agen
        </Button>
        <TxStatus state={tx.state} successText="Konfigurasi agen tersimpan." />
      </div>
    </Card>
  );
}

export default function AdminPage() {
  const { role } = useRole();
  const { data: rows, isLoading } = useAllCampaigns();
  const now = useEffectiveNow();

  if (role !== "admin")
    return (
      <>
        <PageHero eyebrow="Admin" title="Pusat kendali BagiPanen" description="Tempat admin meninjau pengajuan, memutuskan sengketa, dan mengelola dana cadangan." />
        <PageBody>{role === undefined ? <Loading /> : <RoleGate need="admin" role={role} />}</PageBody>
      </>
    );

  const all = rows ?? [];
  const drafts = all.filter((r) => r.summary.status === Status.Draft);
  const disputes = all.filter((r) => r.summary.status === Status.Active && r.milestones[r.summary.currentMilestone]?.status === MStatus.Disputed);
  const active = all.filter((r) => r.summary.status === Status.Active);
  const expired = all.filter((r) => r.summary.status === Status.Funding && now > r.summary.fundingDeadline);
  const eligible = all.filter(
    (r) => (r.summary.status === Status.Failed && r.summary.failType === FailType.Crop) || r.summary.status === Status.Defaulted,
  );

  const nav = [
    ["#persetujuan", `Pengajuan (${drafts.length})`],
    ["#sengketa", `Sengketa (${disputes.length})`],
    ["#berjalan", `Berjalan (${active.length})`],
    ["#cadangan", "Dana cadangan"],
    ["#koperasi", "Koperasi"],
    ["#agen", "Agen AI"],
  ];

  return (
    <>
      <PageHero
        eyebrow="Admin"
        title="Pusat kendali BagiPanen"
        description="Admin hanya menjalankan aturan yang sudah tertulis di kontrak. Dana escrow tidak bisa ditarik siapa pun, termasuk admin."
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat variant="glass" icon={ClipboardList} label="Pengajuan baru" value={drafts.length} />
          <Stat variant="glass" icon={Gavel} label="Sengketa" value={disputes.length} />
          <Stat variant="glass" icon={Sprout} label="Berjalan" value={active.length} />
          <Stat variant="glass" icon={Scale} label="Perlu kompensasi" value={eligible.length} />
        </div>
      </PageHero>
      <PageBody>
        <nav className="sticky top-[7.5rem] z-10 -mx-1 flex gap-1 overflow-x-auto rounded-full border border-krem-200 bg-white/90 p-1 shadow-soft backdrop-blur lg:top-20">
          {nav.map(([href, label]) => (
            <a key={href} href={href} className="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-hutan-50 hover:text-hutan-900">
              {label}
            </a>
          ))}
        </nav>
        {isLoading && <Loading />}

        <section id="persetujuan" className="scroll-mt-40">
          <SectionTitle eyebrow="Pengajuan" description="Periksa angka dan ceritanya sebelum pendanaan dibuka.">
            Proyek yang menunggu review
          </SectionTitle>
          {drafts.length === 0 ? (
            <EmptyState icon={ClipboardList} title="Tidak ada pengajuan baru" />
          ) : (
            <div className="flex flex-col gap-5">
              {drafts.map(({ summary: c }) => (
                <div key={c.address} className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <CampaignLink c={c} />
                    <span className="text-sm text-stone-500">
                      butuh {formatUsdt(c.targetAmount)} USDT · perkiraan jual {formatUsdt(c.estimatedRevenue)} USDT
                    </span>
                  </div>
                  <AdminReviewPanel c={c} />
                </div>
              ))}
            </div>
          )}
        </section>

        <section id="sengketa" className="scroll-mt-40">
          <SectionTitle eyebrow="Sengketa" description="Muncul kalau bukti satu tahap ditolak tiga kali.">
            Tahap yang perlu diputuskan
          </SectionTitle>
          {disputes.length === 0 ? (
            <EmptyState icon={Gavel} title="Tidak ada sengketa" />
          ) : (
            <div className="flex flex-col gap-4">
              {disputes.map((r) => (
                <DisputeCard key={r.summary.address} {...r} />
              ))}
            </div>
          )}
        </section>

        <section id="berjalan" className="scroll-mt-40">
          <SectionTitle eyebrow="Berjalan" description="Tandai gagal panen atau gagal bayar hanya kalau memang terjadi. Keduanya tidak bisa dibatalkan.">
            Proyek yang sedang berjalan
          </SectionTitle>
          {active.length === 0 && expired.length === 0 ? (
            <EmptyState icon={Sprout} title="Tidak ada proyek berjalan" />
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

        <section id="cadangan" className="scroll-mt-40">
          <ReserveSection eligible={eligible} />
        </section>
        <div className="grid gap-6 lg:grid-cols-2">
          <section id="koperasi" className="scroll-mt-40">
            <CooperativeSection />
          </section>
          <section id="agen" className="scroll-mt-40">
            <AgentSection />
          </section>
        </div>
      </PageBody>
    </>
  );
}
