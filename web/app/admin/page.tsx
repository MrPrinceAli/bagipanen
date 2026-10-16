"use client";

import { tr, trTerm } from "@/lib/i18n";
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
          {tr("Sengketa", "Dispute")} · {trTerm(m.name)}
        </Badge>
      </div>
      <p className="mt-1 text-sm text-stone-600">
        {tr(
          `Bukti tahap ini sudah ditolak ${m.attempts} kali. Keputusanmu final dan tercatat di blockchain.`,
          `This stage's proof has been rejected ${m.attempts} times. Your decision is final and recorded on the blockchain.`,
        )}
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[200px_1fr]">
        <IpfsImage cid={m.proofCID} alt={tr(`Bukti terakhir tahap ${m.name}`, `Latest ${trTerm(m.name)} stage proof`)} className="h-40" />
        <div className="flex flex-col gap-3 rounded-2xl bg-krem-50 p-4 ring-1 ring-krem-200">
          <div>
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-stone-500 uppercase">{tr("Putusan AI terakhir", "Latest AI verdict")}</p>
            {m.aiReasonCID ? <VerdictSummary cid={m.aiReasonCID} ctx={{ commodity: c.commodity, milestone: m.name }} /> : <p className="text-sm text-stone-500">{tr("Belum ada.", "None yet.")}</p>}
          </div>
          <p className="text-sm">
            <span className="text-stone-500">{tr("Koperasi:", "Cooperative:")} </span>
            <span className="font-semibold">{m.verifierApproved ? tr("setuju", "approved") : tr("menolak", "rejected")}</span>
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button loading={tx.busy && choice === true} disabled={tx.busy} onClick={() => resolve(true)}>
          {tr("Setujui & cairkan dana tahap", "Approve & release stage funds")}
        </Button>
        <ConfirmButton loading={tx.busy && choice === false} disabled={tx.busy} onConfirm={() => resolve(false)}>
          {tr("Tolak final", "Reject finally")}
        </ConfirmButton>
      </div>
      <div className="mt-3">
        <TxStatus state={tx.state} successText={choice ? tr("Dana tahap dicairkan.", "Stage funds released.") : tr("Tahap ini ditolak final.", "This stage was finally rejected.")} />
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
        {tr(
          `${formatUsdt(c.totalReleased)} dari ${formatUsdt(c.raisedAmount)} USDT sudah cair · ${m ? `tahap ${m.name}` : "semua tahap cair, menunggu setoran panen"} · perkiraan panen ${formatDate(c.expectedHarvestDate)}`,
          `${formatUsdt(c.totalReleased)} of ${formatUsdt(c.raisedAmount)} USDT released · ${m ? `${trTerm(m.name)} stage` : "all stages released, awaiting the harvest deposit"} · expected harvest ${formatDate(c.expectedHarvestDate)}`,
        )}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <ConfirmButton size="sm" loading={failTx.busy} onConfirm={() => failTx.write({ address: c.address, abi: harvestCampaignAbi, functionName: "markFailed" })}>
          {tr("Tandai gagal panen", "Mark crop failure")}
        </ConfirmButton>
        <ConfirmButton
          size="sm"
          variant="secondary"
          disabled={!canDefault}
          loading={defaultTx.busy}
          onConfirm={() => defaultTx.write({ address: c.address, abi: harvestCampaignAbi, functionName: "markDefault" })}
        >
          {tr("Tandai gagal bayar", "Mark default")}
        </ConfirmButton>
      </div>
      {!canDefault && (
        <p className="mt-2 text-xs text-stone-500">
          {tr(
            `Gagal bayar baru bisa ditandai mulai ${formatDate(defaultAt)}, yaitu 30 hari setelah perkiraan panen.`,
            `A default can only be marked from ${formatDate(defaultAt)}, 30 days after the expected harvest.`,
          )}
        </p>
      )}
      <div className="mt-3 flex flex-col gap-1">
        <TxStatus state={failTx.state} successText={tr("Ditandai gagal panen. Sisa dana sekarang bisa diklaim investor.", "Marked as crop failure. Investors can now claim the remaining funds.")} />
        <TxStatus state={defaultTx.state} successText={tr("Ditandai gagal bayar. Petani tidak bisa mengajukan proyek baru.", "Marked as default. The farmer can no longer propose new projects.")} />
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
        {tr(
          `Waktu pendanaan habis. Terkumpul ${formatUsdt(c.raisedAmount)} dari ${formatUsdt(c.targetAmount)} USDT.`,
          `Funding period ended. Raised ${formatUsdt(c.raisedAmount)} of ${formatUsdt(c.targetAmount)} USDT.`,
        )}
      </p>
      <Button className="mt-4" size="sm" loading={tx.busy} onClick={() => tx.write({ address: c.address, abi: harvestCampaignAbi, functionName: "finalizeFunding" })}>
        {tr("Tutup pendanaan & buka refund", "Close funding & open refunds")}
      </Button>
      <div className="mt-3">
        <TxStatus state={tx.state} successText={tr("Pendanaan ditutup. Investor bisa refund 100%.", "Funding closed. Investors can get a 100% refund.")} />
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
        description={tr(
          "Kompensasi hanya bisa dikirim ke proyek yang gagal panen atau gagal bayar, dan langsung menambah dana yang bisa diklaim investor.",
          "Compensation can only go to projects that had a crop failure or default, and it directly adds to what investors can claim.",
        )}
      >
        {tr("Dana cadangan", "Reserve fund")}
      </CardTitle>
      <div className="mb-5 rounded-2xl bg-hutan-950 p-5 text-white">
        <p className="text-xs font-semibold tracking-wide text-white/60 uppercase">{tr("Saldo saat ini", "Current balance")}</p>
        <Usdt value={balance ?? 0n} className="mt-1 font-display text-3xl [&>span:last-child]:font-sans [&>span:last-child]:text-white/60" />
      </div>
      {eligible.length === 0 ? (
        <EmptyState title={tr("Belum ada proyek yang perlu kompensasi", "No projects need compensation yet")} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={tr("Proyek", "Project")} htmlFor="comp-campaign">
              <Select id="comp-campaign" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">{tr("Pilih proyek…", "Choose a project…")}</option>
                {eligible.map(({ summary: c }) => (
                  <option key={c.address} value={c.address}>
                    #{c.campaignId.toString()} {trTerm(c.commodity)} ·{" "}
                    {c.status === Status.Defaulted ? tr("gagal bayar", "default") : tr("gagal panen", "crop failure")} · {formatUsdt(c.investorPool)}{" "}
                    {tr("USDT untuk investor", "USDT for investors")}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={tr("Jumlah (USDT)", "Amount (USDT)")} htmlFor="comp-amount">
              <Input id="comp-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="20" />
            </Field>
          </div>
          {tooMuch && (
            <Notice tone="warn" className="mt-3">
              {tr("Jumlahnya melebihi saldo dana cadangan.", "The amount exceeds the reserve fund balance.")}
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
              {tr("Kirim kompensasi", "Send compensation")}
            </Button>
            <TxStatus state={tx.state} successText={tr("Kompensasi terkirim. Investor bisa klaim lagi.", "Compensation sent. Investors can claim again.")} />
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
      <CardTitle
        icon={Building2}
        description={tr("Koperasi mendaftarkan petani anggotanya dan menjadi kunci kedua pencairan dana.", "Cooperatives register their member farmers and hold the second key for releasing funds.")}
      >
        {tr("Koperasi", "Cooperatives")}
      </CardTitle>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={tr("Alamat dompet koperasi", "Cooperative wallet address")} htmlFor="coop-wallet">
          <AddressInput id="coop-wallet" value={wallet} onChange={setWallet} />
        </Field>
        <Field label={tr("Nama koperasi", "Cooperative name")} htmlFor="coop-name">
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
          {tr("Daftarkan koperasi", "Register cooperative")}
        </Button>
        <TxStatus state={tx.state} successText={tr("Koperasi berhasil didaftarkan.", "Cooperative registered successfully.")} />
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
                <Badge tone="green">{tr(`${members} petani`, `${members} ${members === 1 ? "farmer" : "farmers"}`)}</Badge>
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
        description={tr("Hubungkan agen AI verifikator dengan identitasnya di registri.", "Link the AI verifier agent to its identity in the registry.")}
        action={
          <Link href="/agent" className="text-sm font-semibold text-hutan-700 hover:underline">
            {tr("Profil agen →", "Agent profile →")}
          </Link>
        }
      >
        {tr("Agen AI", "AI agent")}
      </CardTitle>
      {agent && (
        <dl className="mb-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl bg-krem-50 p-4 text-sm ring-1 ring-krem-200">
          <dt className="text-stone-500">Status</dt>
          <dd>
            {agent.isAgent ? (
              <Badge tone="green" dot>
                {tr("Aktif", "Active")}
              </Badge>
            ) : (
              <Badge tone="red" dot>
                {tr("Belum diatur", "Not set up")}
              </Badge>
            )}
          </dd>
          <dt className="text-stone-500">{tr("Registri", "Registry")}</dt>
          <dd className="flex flex-wrap items-center gap-2">
            <AddressLink address={agent.identityRegistry} />
            <span className="text-xs text-stone-500">{identityIsMock(agent.identityRegistry) ? "MockAgentIdentity" : "ERC-8004"}</span>
          </dd>
          <dt className="text-stone-500">{tr("ID agen", "Agent ID")}</dt>
          <dd className="font-semibold">#{agent.agentId.toString()}</dd>
          <dt className="text-stone-500">{tr("Dompet agen", "Agent wallet")}</dt>
          <dd>
            <AddressLink address={agent.agentWallet} />
          </dd>
        </dl>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label={tr("Registri identitas", "Identity registry")} htmlFor="agent-registry" hint={tr("Kosongkan untuk memakai registri sekarang", "Leave empty to use the current registry")}>
          <AddressInput id="agent-registry" value={registry} onChange={setRegistry} placeholder={agent?.identityRegistry ?? "0x…"} />
        </Field>
        <Field label={tr("ID agen", "Agent ID")} htmlFor="agent-id">
          <Input id="agent-id" inputMode="numeric" value={agentId} onChange={(e) => setAgentId(e.target.value)} placeholder="1" />
        </Field>
        <Field
          label={tr("Dompet agen", "Agent wallet")}
          htmlFor="agent-wallet"
          hint={tr("Harus pemilik ID agen itu, dan bukan dompet admin, koperasi, atau petani", "Must own that agent ID, and must not be the admin, cooperative, or farmer wallet")}
        >
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
          {tr("Simpan konfigurasi agen", "Save agent configuration")}
        </Button>
        <TxStatus state={tx.state} successText={tr("Konfigurasi agen tersimpan.", "Agent configuration saved.")} />
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
        <PageHero
          eyebrow="Admin"
          title={tr("Pusat kendali BagiPanen", "BagiPanen control center")}
          description={tr("Tempat admin meninjau pengajuan, memutuskan sengketa, dan mengelola dana cadangan.", "Where the admin reviews proposals, resolves disputes, and manages the reserve fund.")}
        />
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
    ["#persetujuan", `${tr("Pengajuan", "Proposals")} (${drafts.length})`],
    ["#sengketa", `${tr("Sengketa", "Disputes")} (${disputes.length})`],
    ["#berjalan", `${tr("Berjalan", "Running")} (${active.length})`],
    ["#cadangan", tr("Dana cadangan", "Reserve fund")],
    ["#koperasi", tr("Koperasi", "Cooperatives")],
    ["#agen", tr("Agen AI", "AI agent")],
  ];

  return (
    <>
      <PageHero
        eyebrow="Admin"
        title={tr("Pusat kendali BagiPanen", "BagiPanen control center")}
        description={tr(
          "Admin hanya menjalankan aturan yang sudah tertulis di kontrak. Dana escrow tidak bisa ditarik siapa pun, termasuk admin.",
          "The admin only carries out rules already written in the contracts. Nobody can withdraw escrowed funds, including the admin.",
        )}
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat variant="glass" icon={ClipboardList} label={tr("Pengajuan baru", "New proposals")} value={drafts.length} />
          <Stat variant="glass" icon={Gavel} label={tr("Sengketa", "Disputes")} value={disputes.length} />
          <Stat variant="glass" icon={Sprout} label={tr("Berjalan", "Running")} value={active.length} />
          <Stat variant="glass" icon={Scale} label={tr("Perlu kompensasi", "Need compensation")} value={eligible.length} />
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
          <SectionTitle eyebrow={tr("Pengajuan", "Proposals")} description={tr("Periksa angka dan ceritanya sebelum pendanaan dibuka.", "Check the numbers and the story before funding opens.")}>
            {tr("Proyek yang menunggu review", "Projects awaiting review")}
          </SectionTitle>
          {drafts.length === 0 ? (
            <EmptyState icon={ClipboardList} title={tr("Tidak ada pengajuan baru", "No new proposals")} />
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
          <SectionTitle eyebrow={tr("Sengketa", "Disputes")} description={tr("Muncul kalau bukti satu tahap ditolak tiga kali.", "Shows up when a stage's proof is rejected three times.")}>
            {tr("Tahap yang perlu diputuskan", "Stages to decide")}
          </SectionTitle>
          {disputes.length === 0 ? (
            <EmptyState icon={Gavel} title={tr("Tidak ada sengketa", "No disputes")} />
          ) : (
            <div className="flex flex-col gap-4">
              {disputes.map((r) => (
                <DisputeCard key={r.summary.address} {...r} />
              ))}
            </div>
          )}
        </section>

        <section id="berjalan" className="scroll-mt-40">
          <SectionTitle
            eyebrow={tr("Berjalan", "Running")}
            description={tr(
              "Tandai gagal panen atau gagal bayar hanya kalau memang terjadi. Keduanya tidak bisa dibatalkan.",
              "Only mark a crop failure or default if it really happened. Neither can be undone.",
            )}
          >
            {tr("Proyek yang sedang berjalan", "Running projects")}
          </SectionTitle>
          {active.length === 0 && expired.length === 0 ? (
            <EmptyState icon={Sprout} title={tr("Tidak ada proyek berjalan", "No running projects")} />
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
