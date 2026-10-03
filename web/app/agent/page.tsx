"use client";

import { Award, BadgeCheck, Bot, Check, ExternalLink, FileJson, Fingerprint, Scale, X } from "lucide-react";
import Link from "next/link";
import { VerdictSummary } from "@/components/campaign/Timeline";
import { AddressLink, TxLink } from "@/components/common";
import { Badge, Card, CardTitle, cn, EmptyState, Loading, Notice, PageBody, PageHero, SectionTitle, Stat } from "@/components/ui";
import { formatDateTime, formatPercent, shortAddress } from "@/lib/format";
import { REPUTATION_REGISTRY } from "@/lib/addresses";
import { useAgentReputation } from "@/lib/agentReputation";
import { identityIsMock, tokenUriHref, useAgentProfile, useRecentVerdicts, useRegistrations } from "@/lib/registry";

const METHOD_LABEL: Record<string, string> = {
  "vision-llm": "Penilaian foto dengan AI",
  "exif-gps-check": "Cek GPS & tanggal foto",
  "weather-open-meteo": "Cuaca 14 hari (Open-Meteo)",
  "duplicate-hash": "Deteksi foto duplikat",
};

function Tags({ items, map }: { items?: string[]; map?: Record<string, string> }) {
  if (!items?.length) return <span className="text-stone-400">–</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {items.map((x) => (
        <Badge key={x}>{map?.[x] ?? x}</Badge>
      ))}
    </span>
  );
}

const STEPS = [
  "Membaca data proyek: komoditas, lokasi, tahap, dan perkiraan panen.",
  "Mengunduh foto bukti dan menghitung sidik jarinya (SHA-256).",
  "Memastikan foto yang sama belum pernah dipakai di proyek atau tahap lain.",
  "Mencocokkan GPS dan tanggal foto: maksimal 2 km dari lahan dan 7 hari sebelum dikirim.",
  "Mengambil data hujan dan suhu 14 hari terakhir di lokasi lahan.",
  "Meminta model AI menilai isi foto: jenis tanaman, fase, kondisi, dan tingkat keyakinan.",
  "Menyimpan catatan putusan ke IPFS, lalu mencatat hasilnya di kontrak.",
];

export default function AgentPage() {
  const { data: agent, isLoading } = useAgentProfile();
  const { data: verdicts } = useRecentVerdicts(10);

  if (isLoading || !agent || !agent.configured)
    return (
      <>
        <PageHero eyebrow="Agen AI" title="Agen verifikator lapangan" />
        <PageBody>
          {isLoading || !agent ? (
            <Loading>Membaca identitas agen dari blockchain…</Loading>
          ) : (
            <Notice tone="warn">Agen verifikator belum diatur. Admin perlu mendaftarkan agennya dulu (di mode lokal cukup jalankan npm run dev:chain).</Notice>
          )}
        </PageBody>
      </>
    );

  const mock = identityIsMock(agent.identityRegistry);
  const s = agent.stats;
  const card = agent.card;

  return (
    <>
      <PageHero
        eyebrow="Profil agen AI"
        title={card?.name ?? "Agen verifikator"}
        description="Agen ini memeriksa setiap foto bukti dari lahan sebelum dana tahap boleh cair. Identitasnya tercatat di blockchain, dan semua putusannya bisa dibaca siapa saja."
      >
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-emas-400 px-3 py-1.5 text-sm font-semibold text-hutan-950">
            <Fingerprint className="size-4" aria-hidden /> Agen #{agent.agentId.toString()}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white/85">
            <BadgeCheck className="size-4 text-emas-300" aria-hidden />
            {mock ? "Registri cadangan MockAgentIdentity" : "Registri identitas ERC-8004"}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white/85">
            <span className={cn("size-2 rounded-full", agent.isAgent ? "bg-hutan-300" : "bg-red-400")} aria-hidden />
            {agent.isAgent ? "Aktif sebagai verifikator" : "Tidak aktif"}
          </span>
        </div>
      </PageHero>
      <PageBody>
        {mock && (
          <Notice tone="warn">
            Identitas agen ini tercatat di <strong>MockAgentIdentity</strong>, registri cadangan milik BagiPanen untuk mode lokal, bukan registri
            ERC-8004 resmi.
          </Notice>
        )}

        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat icon={Bot} label="Total putusan" value={s.verdicts} sub="foto yang sudah dinilai" />
          <Stat icon={Check} label="Diterima" value={s.approvals} sub={s.verdicts ? `${formatPercent(s.approvals / s.verdicts)} dari semua foto` : undefined} />
          <Stat icon={X} label="Ditolak" value={s.rejections} sub={s.verdicts ? `${formatPercent(s.rejections / s.verdicts)} dari semua foto` : undefined} />
          <Stat icon={Scale} label="Dikoreksi admin" value={s.overturned} sub="putusan AI yang dibatalkan saat sengketa" />
        </section>

        {REPUTATION_REGISTRY && <Erc8004Reputation agentId={agent.agentId} />}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardTitle icon={Fingerprint} description="Dompet agen terpisah dari admin, koperasi, dan petani. Kontrak mengecek ini saat agen diatur.">
              Identitas di blockchain
            </CardTitle>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
              <dt className="text-stone-500">ID agen</dt>
              <dd className="font-semibold text-hutan-950">#{agent.agentId.toString()}</dd>
              <dt className="text-stone-500">Registri</dt>
              <dd>
                <AddressLink address={agent.identityRegistry} full />
              </dd>
              <dt className="text-stone-500">Dompet agen</dt>
              <dd>
                <AddressLink address={agent.agentWallet} full />
              </dd>
              <dt className="text-stone-500">Agent card</dt>
              <dd className="text-xs break-all">
                {agent.tokenURI ? (
                  <a href={tokenUriHref(agent.tokenURI)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-hutan-700 hover:underline">
                    {agent.tokenURI} <ExternalLink className="size-3 shrink-0" aria-hidden />
                  </a>
                ) : (
                  "–"
                )}
              </dd>
            </dl>
          </Card>

          <Card>
            <CardTitle icon={FileJson} description="Data yang diumumkan agen tentang dirinya sendiri.">
              Isi agent card
            </CardTitle>
            {agent.cardError ? (
              <p className="text-sm text-red-700">{agent.cardError}</p>
            ) : card ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
                <dt className="text-stone-500">Peran</dt>
                <dd>{card.bagipanen?.role === "field-proof-verifier" ? "Verifikator bukti lapangan" : (card.bagipanen?.role ?? "–")}</dd>
                <dt className="text-stone-500">Wilayah</dt>
                <dd>
                  <Tags items={card.bagipanen?.regions} />
                </dd>
                <dt className="text-stone-500">Komoditas</dt>
                <dd>
                  <Tags items={card.bagipanen?.commodities} />
                </dd>
                <dt className="text-stone-500">Koperasi mitra</dt>
                <dd>
                  <Tags items={card.bagipanen?.partnerCooperatives} />
                </dd>
                <dt className="text-stone-500">Cara kerja</dt>
                <dd>
                  <Tags items={card.bagipanen?.methods} map={METHOD_LABEL} />
                </dd>
                <dt className="text-stone-500">Jaringan</dt>
                <dd>{card.bagipanen?.network ?? "–"}</dd>
              </dl>
            ) : (
              <Loading />
            )}
            {card && (
              <details className="mt-4 text-xs">
                <summary className="cursor-pointer font-medium text-stone-500 hover:text-hutan-800">Lihat JSON lengkap</summary>
                <pre className="mt-2 max-h-80 overflow-auto rounded-2xl bg-hutan-950 p-4 text-emas-100">{JSON.stringify(card, null, 2)}</pre>
              </details>
            )}
          </Card>
        </div>

        <Card>
          <CardTitle icon={Bot} description="Urutan yang dijalankan agen untuk setiap foto bukti yang masuk.">
            Cara agen memeriksa foto
          </CardTitle>
          <ol className="grid gap-3 sm:grid-cols-2">
            {STEPS.map((step, i) => (
              <li key={step} className="flex gap-3 rounded-2xl bg-krem-50 p-3.5 text-sm ring-1 ring-krem-200">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-hutan-900 font-display text-xs font-semibold text-emas-300">{i + 1}</span>
                <span className="leading-relaxed text-stone-700">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-stone-600">
            Foto diterima hanya kalau benar foto lahan, tanaman dan fasenya cocok, AI cukup yakin (minimal 70%), lokasi dan tanggalnya tidak
            bertentangan, dan foto itu belum pernah dipakai.
          </p>
        </Card>

        <section>
          <SectionTitle eyebrow="Putusan terbaru" description="Sepuluh foto terakhir yang dinilai agen, lengkap dengan alasannya.">
            Jejak putusan agen
          </SectionTitle>
          {!verdicts ? (
            <Loading>Membaca putusan dari blockchain…</Loading>
          ) : verdicts.length === 0 ? (
            <EmptyState icon={Bot} title="Belum ada putusan" />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {verdicts.map((v) => (
                <Card key={`${v.txHash}-${v.index}`} className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Link href={`/campaign/${v.campaign}`} className="font-display text-lg font-semibold text-hutan-950 hover:text-hutan-700">
                        {v.commodity} · tahap {v.milestoneName}
                      </Link>
                      <p className="text-xs text-stone-500">
                        Proyek {shortAddress(v.campaign)} · {formatDateTime(v.timestamp)}
                      </p>
                    </div>
                    {v.approved ? (
                      <Badge tone="green" dot>
                        Diterima
                      </Badge>
                    ) : (
                      <Badge tone="red" dot>
                        Ditolak
                      </Badge>
                    )}
                  </div>
                  {v.reasonCID && <VerdictSummary cid={v.reasonCID} ctx={{ commodity: v.commodity, milestone: v.milestoneName }} />}
                  <TxLink hash={v.txHash} className="mt-auto" />
                </Card>
              ))}
            </div>
          )}
        </section>
      </PageBody>
    </>
  );
}

/** Reputasi agen di ERC-8004 ReputationRegistry resmi, hanya dari koperasi terdaftar (klien tepercaya). */
function Erc8004Reputation({ agentId }: { agentId: bigint }) {
  const { data: regs } = useRegistrations();
  const coops = regs?.cooperatives.map((c) => c.address);
  const { data: rep, isLoading } = useAgentReputation(agentId, coops);
  return (
    <Card className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-xl">
        <CardTitle
          icon={Award}
          description="Setiap kali koperasi memutuskan satu tahap, koperasi mencatat apakah ia sepakat dengan putusan agen. Catatannya tersimpan di registri reputasi ERC-8004 resmi, terpisah dari BagiPanen, dan bisa dibaca aplikasi lain."
        >
          Reputasi di ERC-8004
        </CardTitle>
        <p className="text-xs text-stone-500">
          Registri <AddressLink address={REPUTATION_REGISTRY!} /> · hanya menghitung penilaian dari {coops?.length ?? "…"} koperasi terdaftar.
        </p>
      </div>
      <div className="shrink-0 rounded-3xl bg-hutan-50 px-6 py-4 text-center ring-1 ring-hutan-100">
        <p className="font-display text-4xl font-semibold text-hutan-900">
          {isLoading || !rep ? "…" : rep.agreement === null ? "–" : formatPercent(rep.agreement)}
        </p>
        <p className="mt-1 text-xs text-stone-600">{rep ? (rep.count > 0 ? `kesepakatan dari ${rep.count} penilaian koperasi` : "belum ada penilaian") : "memuat…"}</p>
      </div>
    </Card>
  );
}
