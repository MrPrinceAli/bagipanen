"use client";

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
      <CardTitle icon={UserPlus} description="Petani yang sudah terdaftar bisa langsung mengajukan kampanye. Satu dompet hanya boleh punya satu peran.">
        Daftarkan petani anggota
      </CardTitle>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Alamat dompet petani" htmlFor="farmer-wallet">
          <AddressInput id="farmer-wallet" value={wallet} onChange={setWallet} />
        </Field>
        <Field label="Nama petani" htmlFor="farmer-name">
          <Input id="farmer-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Pak Ujang" />
        </Field>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <Button disabled={!ready} loading={tx.busy} onClick={submit} className="self-start">
          Daftarkan petani
        </Button>
        <TxStatus state={tx.state} successText="Petani berhasil didaftarkan." />
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
        <PageHero eyebrow="Koperasi" title="Ruang kerja koperasi" description="Tempat koperasi memeriksa bukti lapangan dan mendampingi petani anggotanya." />
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
        eyebrow="Koperasi"
        title={coopName ?? "Ruang kerja koperasi"}
        description="Kamu kunci kedua pencairan dana. Cek foto lahan dari petani, bandingkan dengan hasil agen AI, lalu putuskan."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat variant="glass" icon={Inbox} label="Perlu diputuskan" value={queue.length} sub="bukti menunggu keputusanmu" />
          <Stat variant="glass" icon={Users} label="Petani anggota" value={members.length} />
          <Stat variant="glass" icon={Wheat} label="Kampanye dampingan" value={mine.length} />
        </div>
      </PageHero>
      <PageBody>
        <section>
          <SectionTitle eyebrow="Antrean" description="Bukti baru dari petani muncul di sini otomatis.">
            Bukti yang perlu kamu cek
          </SectionTitle>
          {isLoading ? (
            <Loading />
          ) : queue.length === 0 ? (
            <EmptyState icon={ClipboardCheck} title="Antrean kosong">
              Belum ada bukti yang menunggu keputusanmu.
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
              {waitingAi.length} bukti sudah kamu putuskan dan tinggal menunggu hasil agen AI.
            </p>
          )}
        </section>

        <RegisterFarmer />

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardTitle icon={Users}>Petani anggota ({members.length})</CardTitle>
            {members.length === 0 ? (
              <p className="text-sm text-stone-500">Belum ada petani yang terdaftar.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-krem-200">
                {members.map((f) => (
                  <li key={f.address} className="flex items-center justify-between gap-2 py-3">
                    <div>
                      <p className="font-semibold text-hutan-950">{f.name}</p>
                      <p className="font-mono text-xs text-stone-500">{shortAddress(f.address)}</p>
                    </div>
                    <Link href={`/petani/${f.address}`} className="text-sm font-semibold text-hutan-700 hover:underline">
                      Rapor →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardTitle icon={Sprout}>Kampanye dampingan ({mine.length})</CardTitle>
            {mine.length === 0 ? (
              <p className="text-sm text-stone-500">Belum ada kampanye dari petani anggota.</p>
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
                          Tahap {m.name}: <MilestoneBadge status={m.status} />
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
