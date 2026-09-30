"use client";

import Link from "next/link";
import { useState } from "react";
import { type Address, isAddressEqual } from "viem";
import { CampaignLink } from "@/components/CampaignLink";
import { CooperativePanel } from "@/components/campaign/panels";
import { AddressInput, MilestoneBadge, parseAddressInput, StatusBadge, TxStatus } from "@/components/common";
import { Button, Card, EmptyState, Field, Input, Notice, SectionTitle, Spinner } from "@/components/ui";
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
      <SectionTitle>Daftarkan petani anggota</SectionTitle>
      <p className="mb-3 text-sm text-stone-600">Petani yang terdaftar bisa mengajukan kampanye. Satu wallet hanya boleh memegang satu peran.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Wallet petani" htmlFor="farmer-wallet">
          <AddressInput id="farmer-wallet" value={wallet} onChange={setWallet} />
        </Field>
        <Field label="Nama petani" htmlFor="farmer-name">
          <Input id="farmer-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Pak Ujang" />
        </Field>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <Button disabled={!ready} loading={tx.busy} onClick={submit}>
          Daftarkan petani
        </Button>
        <TxStatus state={tx.state} successText="Petani terdaftar." />
      </div>
    </Card>
  );
}

export default function KoperasiPage() {
  const { role, address } = useRole();
  const { data: campaigns, isLoading } = useAllCampaigns();
  const { data: regs } = useRegistrations();

  if (role === undefined) return <Spinner />;
  if (role !== "koperasi" || !address)
    return <Notice tone="info">Halaman ini untuk koperasi terdaftar. {role === "tamu" ? "Pilih akun Koperasi di header." : "Wallet Anda bukan koperasi."}</Notice>;

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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-daun-900">{coopName ?? "Koperasi"}</h1>
        <p className="text-sm text-stone-600">Verifikasi lapangan tiap milestone dan pendampingan petani anggota.</p>
      </div>

      <section>
        <SectionTitle>Antrean verifikasi ({queue.length})</SectionTitle>
        {isLoading ? (
          <Spinner />
        ) : queue.length === 0 ? (
          <EmptyState title="Tidak ada milestone yang menunggu keputusan">Bukti baru dari petani akan muncul di sini otomatis.</EmptyState>
        ) : (
          <div className="flex flex-col gap-4">
            {queue.map(({ summary: s, milestones }) => (
              <div key={s.address} className="flex flex-col gap-1">
                <CampaignLink c={s} />
                <CooperativePanel c={s} milestone={milestones[s.currentMilestone]} />
              </div>
            ))}
          </div>
        )}
        {waitingAi.length > 0 && (
          <p className="mt-3 text-sm text-stone-600">
            {waitingAi.length} milestone sudah Anda putuskan dan sedang menunggu putusan agen AI.
          </p>
        )}
      </section>

      <RegisterFarmer />

      <section>
        <SectionTitle>Petani anggota ({members.length})</SectionTitle>
        {members.length === 0 ? (
          <EmptyState title="Belum ada petani anggota" />
        ) : (
          <Card className="p-0 sm:p-0">
            <ul className="divide-y divide-tanah-100">
              {members.map((f) => (
                <li key={f.address} className="flex items-center justify-between gap-2 px-4 py-3">
                  <div>
                    <p className="font-medium">{f.name}</p>
                    <p className="font-mono text-xs text-stone-500">{shortAddress(f.address)}</p>
                  </div>
                  <Link href={`/petani/${f.address}`} className="text-sm text-daun-700 underline">
                    Rapor Petani →
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section>
        <SectionTitle>Kampanye dampingan ({mine.length})</SectionTitle>
        {mine.length === 0 ? (
          <EmptyState title="Belum ada kampanye" />
        ) : (
          <div className="flex flex-col gap-3">
            {mine.map(({ summary: s, milestones }) => {
              const m = milestones[s.currentMilestone];
              return (
                <Card key={s.address}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <CampaignLink c={s} />
                    <StatusBadge status={s.status} failType={s.failType} />
                  </div>
                  {s.status === Status.Active && m && (
                    <p className="mt-2 flex items-center gap-2 text-sm text-stone-600">
                      Milestone {m.name}: <MilestoneBadge status={m.status} />
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
