"use client";

import { tr, trTerm } from "@/lib/i18n";
import { ClipboardCheck, Inbox, Sprout, UserPlus, Users, Wheat } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { type Address, isAddressEqual } from "viem";
import { CampaignLink } from "@/components/CampaignLink";
import { CooperativePanel } from "@/components/campaign/panels";
import { AddressInput, MilestoneBadge, parseAddressInput, StatusBadge, TxStatus } from "@/components/common";
import { Button, Card, CardTitle, EmptyState, Field, Input, Loading, PageBody, PageHero, SectionTitle, Stat } from "@/components/ui";
import { RoleGate } from "@/components/wallet";
import { campaignFactoryAbi } from "@/lib/abi/CampaignFactory";
import { addresses } from "@/lib/addresses";
import { shortAddress } from "@/lib/format";
import { useAllCampaigns, useRegistrations } from "@/lib/registry";
import { useRole } from "@/lib/role";
import { useTx } from "@/lib/tx";
import { MStatus, Status } from "@/lib/types";

function RegisterFarmer() {
  const tx = useTx();
  const [wallet, setWallet] = useState("");
  const [name, setName] = useState("");
  const addr = parseAddressInput(wallet);
  const ready = Boolean(addr && name.trim());

  async function submit() {
    const ok = await tx.write({ address: addresses.factory!, abi: campaignFactoryAbi, functionName: "registerFarmer", args: [addr!, name.trim()] });
    if (ok) {
      setWallet("");
      setName("");
    }
  }

  return (
    <Card>
      <CardTitle
        icon={UserPlus}
        description={tr(
          "Petani yang sudah terdaftar bisa langsung mengajukan proyek tanam. Satu dompet hanya boleh punya satu peran.",
          "Registered farmers can propose crop projects right away. One wallet can only have one role.",
        )}
      >
        {tr("Daftarkan petani anggota", "Register a member farmer")}
      </CardTitle>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={tr("Alamat dompet petani", "Farmer wallet address")} htmlFor="farmer-wallet">
          <AddressInput id="farmer-wallet" value={wallet} onChange={setWallet} />
        </Field>
        <Field label={tr("Nama petani", "Farmer name")} htmlFor="farmer-name">
          <Input id="farmer-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Pak Ujang" />
        </Field>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <Button disabled={!ready} loading={tx.busy} onClick={submit} className="self-start">
          {tr("Daftarkan petani", "Register farmer")}
        </Button>
        <TxStatus state={tx.state} successText={tr("Petani berhasil didaftarkan.", "Farmer registered successfully.")} />
      </div>
    </Card>
  );
}

export default function KoperasiPage() {
  const { role, address } = useRole();
  const { data: campaigns, isLoading } = useAllCampaigns();
  const { data: regs } = useRegistrations();

  if (role === undefined || role !== "koperasi" || !address)
    return (
      <>
        <PageHero
          eyebrow={tr("Koperasi", "Cooperative")}
          title={tr("Ruang kerja koperasi", "Cooperative workspace")}
          description={tr("Tempat koperasi memeriksa bukti lapangan dan mendampingi petani anggotanya.", "Where cooperatives check field proof and support their member farmers.")}
        />
        <PageBody>{role === undefined ? <Loading /> : <RoleGate need="koperasi" role={role} />}</PageBody>
      </>
    );

  const me = address as Address;
  const coopName = regs?.cooperatives.find((c) => isAddressEqual(c.address, me))?.name;
  const mine = (campaigns ?? []).filter((c) => isAddressEqual(c.summary.cooperative, me));
  const queue = mine.filter(({ summary: s, milestones }) => {
    const m = milestones[s.currentMilestone];
    return s.status === Status.Active && m && !m.verifierDecided && (m.status === MStatus.ProofSubmitted || m.status === MStatus.AIReviewed);
  });
  const waitingAi = mine.filter(({ summary: s, milestones }) => {
    const m = milestones[s.currentMilestone];
    return s.status === Status.Active && m && m.verifierDecided && !m.aiDecided && m.status === MStatus.ProofSubmitted;
  });
  const members = (regs?.farmers ?? []).filter((f) => f.cooperative && isAddressEqual(f.cooperative, me));

  return (
    <>
      <PageHero
        eyebrow={tr("Koperasi", "Cooperative")}
        title={coopName ?? tr("Ruang kerja koperasi", "Cooperative workspace")}
        description={tr(
          "Kamu kunci kedua pencairan dana. Cek foto lahan dari petani, bandingkan dengan hasil agen AI, lalu putuskan.",
          "You're the second key for releasing funds. Check the farmer's field photo, compare it with the AI agent's result, then decide.",
        )}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat variant="glass" icon={Inbox} label={tr("Perlu diputuskan", "To decide")} value={queue.length} sub={tr("bukti menunggu keputusanmu", "proofs awaiting your decision")} />
          <Stat variant="glass" icon={Users} label={tr("Petani anggota", "Member farmers")} value={members.length} />
          <Stat variant="glass" icon={Wheat} label={tr("Proyek dampingan", "Supported projects")} value={mine.length} />
        </div>
      </PageHero>
      <PageBody>
        <section>
          <SectionTitle eyebrow={tr("Antrean", "Queue")} description={tr("Bukti baru dari petani muncul di sini otomatis.", "New proof from farmers appears here automatically.")}>
            {tr("Bukti yang perlu kamu cek", "Proof for you to check")}
          </SectionTitle>
          {isLoading ? (
            <Loading />
          ) : queue.length === 0 ? (
            <EmptyState icon={ClipboardCheck} title={tr("Antrean kosong", "Queue is empty")}>
              {tr("Belum ada bukti yang menunggu keputusanmu.", "No proof is waiting for your decision.")}
            </EmptyState>
          ) : (
            <div className="flex flex-col gap-5">
              {queue.map(({ summary: s, milestones }) => (
                <div key={s.address} className="flex flex-col gap-2">
                  <CampaignLink c={s} />
                  <CooperativePanel c={s} milestone={milestones[s.currentMilestone]} />
                </div>
              ))}
            </div>
          )}
          {waitingAi.length > 0 && (
            <p className="mt-3 text-sm text-stone-600">
              {tr(
                `${waitingAi.length} bukti sudah kamu putuskan dan tinggal menunggu hasil agen AI.`,
                `You've decided on ${waitingAi.length} proofs that are just waiting for the AI agent's result.`,
              )}
            </p>
          )}
        </section>

        <RegisterFarmer />

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardTitle icon={Users}>{tr("Petani anggota", "Member farmers")} ({members.length})</CardTitle>
            {members.length === 0 ? (
              <p className="text-sm text-stone-500">{tr("Belum ada petani yang terdaftar.", "No farmers registered yet.")}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-krem-200">
                {members.map((f) => (
                  <li key={f.address} className="flex items-center justify-between gap-2 py-3">
                    <div>
                      <p className="font-semibold text-hutan-950">{f.name}</p>
                      <p className="font-mono text-xs text-stone-500">{shortAddress(f.address)}</p>
                    </div>
                    <Link href={`/petani/${f.address}`} className="text-sm font-semibold text-hutan-700 hover:underline">
                      {tr("Rapor →", "Report card →")}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardTitle icon={Sprout}>{tr("Proyek dampingan", "Supported projects")} ({mine.length})</CardTitle>
            {mine.length === 0 ? (
              <p className="text-sm text-stone-500">{tr("Belum ada proyek dari petani anggota.", "No projects from member farmers yet.")}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-krem-200">
                {mine.map(({ summary: s, milestones }) => {
                  const m = milestones[s.currentMilestone];
                  return (
                    <li key={s.address} className="flex flex-col gap-1.5 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <CampaignLink c={s} />
                        <StatusBadge status={s.status} failType={s.failType} />
                      </div>
                      {s.status === Status.Active && m && (
                        <p className="flex items-center gap-2 text-sm text-stone-600">
                          {tr(`Tahap ${m.name}:`, `${trTerm(m.name)} stage:`)} <MilestoneBadge status={m.status} />
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </PageBody>
    </>
  );
}
