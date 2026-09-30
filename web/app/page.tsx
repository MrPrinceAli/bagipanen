"use client";

import Link from "next/link";
import { CampaignCard } from "@/components/CampaignCard";
import { Card, EmptyState, Notice, SectionTitle, Spinner, Stat } from "@/components/ui";
import { useCampaignList, useReserveBalance } from "@/lib/campaigns";
import { formatRupiah, formatUsdt } from "@/lib/format";
import { useRole } from "@/lib/role";
import { FailType, Status } from "@/lib/types";

export default function HomePage() {
  const { data: campaigns, isLoading, isError } = useCampaignList();
  const { data: reserve } = useReserveBalance();
  const { role } = useRole();

  const funded = (campaigns ?? []).filter(
    (c) =>
      c.status === Status.Active ||
      c.status === Status.Harvested ||
      c.status === Status.Defaulted ||
      (c.status === Status.Failed && c.failType === FailType.Crop),
  );
  const totalFunded = funded.reduce((sum, c) => sum + c.raisedAmount, 0n);
  const activeCount = (campaigns ?? []).filter((c) => c.status === Status.Funding || c.status === Status.Active).length;
  const visible = (campaigns ?? []).filter((c) => c.status !== Status.Draft && c.status !== Status.Cancelled);
  const drafts = (campaigns ?? []).filter((c) => c.status === Status.Draft);

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-3xl bg-daun-800 px-5 py-8 text-white sm:px-8 sm:py-10">
        <p className="text-sm font-semibold tracking-wide text-daun-200 uppercase">Pendanaan panen di BNB Chain</p>
        <h1 className="mt-2 text-2xl leading-tight font-extrabold sm:text-4xl">
          Modal tanam yang adil untuk petani, transparan untuk investor, diverifikasi AI, tercatat onchain.
        </h1>
        <p className="mt-3 max-w-2xl text-daun-100">
          Investor mendanai satu musim tanam dengan stablecoin. Dana cair bertahap setelah bukti lapangan disetujui agen AI{" "}
          <em>dan</em> koperasi, lalu hasil panen dibagi otomatis: modal kembali dulu, keuntungan 55% petani, 40% investor, 5%
          dana cadangan.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <a href="#kampanye" className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-daun-800 hover:bg-daun-50">
            Lihat kampanye
          </a>
          {role === "petani" && (
            <Link href="/create" className="rounded-xl border border-white/60 px-4 py-2.5 text-sm font-semibold hover:bg-white/10">
              Ajukan kampanye
            </Link>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Total didanai" value={`${formatUsdt(totalFunded)} USDT`} sub={`≈ ${formatRupiah(totalFunded)} (perkiraan)`} />
        <Stat label="Kampanye aktif" value={activeCount} sub="Pendanaan + berjalan" />
        <Stat
          label="Dana cadangan"
          value={reserve === undefined ? "–" : `${formatUsdt(reserve)} USDT`}
          sub="5% keuntungan tiap panen, untuk kompensasi gagal panen"
        />
      </section>

      <section id="kampanye" className="scroll-mt-28">
        <SectionTitle>Kampanye</SectionTitle>
        {isLoading ? (
          <p className="flex items-center gap-2 text-sm text-stone-500">
            <Spinner /> Memuat kampanye dari blockchain…
          </p>
        ) : isError ? (
          <Notice tone="error">Gagal membaca kampanye dari blockchain. Periksa koneksi jaringan.</Notice>
        ) : visible.length === 0 ? (
          <EmptyState title="Belum ada kampanye yang dibuka">
            {role === "petani" ? (
              <Link href="/create" className="text-daun-700 underline">
                Ajukan kampanye pertama Anda
              </Link>
            ) : (
              "Kampanye muncul di sini setelah petani mengajukan dan admin menyetujui."
            )}
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((c) => (
              <CampaignCard key={c.address} c={c} />
            ))}
          </div>
        )}
        {drafts.length > 0 && (role === "admin" || role === "petani") && (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-semibold text-stone-600">Menunggu persetujuan admin ({drafts.length})</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {drafts.map((c) => (
                <CampaignCard key={c.address} c={c} />
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          ["🔐 Dua kunci pencairan", "Dana tahap hanya cair jika agen AI dan koperasi sama-sama menyetujui bukti lapangan."],
          ["🤖 Agen AI ber-identitas", "Agen verifikator punya identitas onchain (ERC-8004) dan rekam jejak putusan yang publik."],
          ["📒 Rapor Petani", "Setiap musim tercatat onchain sebagai riwayat kredit alternatif bagi petani di luar SLIK OJK."],
        ].map(([title, body]) => (
          <Card key={title}>
            <p className="font-semibold text-daun-900">{title}</p>
            <p className="mt-1 text-sm text-stone-600">{body}</p>
          </Card>
        ))}
      </section>
    </div>
  );
}
