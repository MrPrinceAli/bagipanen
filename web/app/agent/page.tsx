"use client";

import Link from "next/link";
import { VerdictSummary } from "@/components/campaign/Timeline";
import { TxLink } from "@/components/common";
import { Badge, Card, EmptyState, Notice, SectionTitle, Spinner, Stat } from "@/components/ui";
import { explorerAddressUrl } from "@/lib/config";
import { formatDateTime, formatPercent, shortAddress } from "@/lib/format";
import { identityIsMock, tokenUriHref, useAgentProfile, useRecentVerdicts } from "@/lib/registry";

function AddressLink({ address }: { address: string }) {
  const url = explorerAddressUrl(address);
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className="font-mono text-xs break-all text-daun-700 underline">
      {address} ↗
    </a>
  ) : (
    <span className="font-mono text-xs break-all">{address}</span>
  );
}

function Tags({ items }: { items?: string[] }) {
  if (!items?.length) return <span className="text-stone-400">–</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {items.map((x) => (
        <Badge key={x}>{x}</Badge>
      ))}
    </span>
  );
}

export default function AgentPage() {
  const { data: agent, isLoading } = useAgentProfile();
  const { data: verdicts } = useRecentVerdicts(10);

  if (isLoading || !agent) return <Spinner />;
  if (!agent.configured)
    return <Notice tone="warn">Agen verifikator belum dikonfigurasi. Admin perlu mendaftarkan agen (mode lokal: `npm run dev:chain`).</Notice>;

  const mock = identityIsMock(agent.identityRegistry);
  const s = agent.stats;
  const card = agent.card;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold tracking-wide text-tanah-600 uppercase">Profil agen AI</p>
        <h1 className="text-2xl font-extrabold text-daun-900">{card?.name ?? "Agen verifikator"}</h1>
        {card?.description && <p className="max-w-2xl text-sm text-stone-600">{card.description}</p>}
        <div className="flex flex-wrap gap-2">
          {agent.isAgent ? <Badge tone="green">Aktif sebagai verifikator</Badge> : <Badge tone="red">Tidak aktif</Badge>}
          {mock ? <Badge tone="yellow">Registri: MockAgentIdentity (fallback)</Badge> : <Badge tone="blue">Registri identitas ERC-8004</Badge>}
        </div>
      </div>

      {mock && (
        <Notice tone="warn">
          Identitas agen ini tercatat di <strong>MockAgentIdentity</strong>, yaitu registri ERC-721 pengganti (fallback) milik BagiPanen,
          bukan registri identitas ERC-8004 resmi.
        </Notice>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total putusan" value={s.verdicts} />
        <Stat label="Disetujui" value={s.approvals} sub={s.verdicts ? formatPercent(s.approvals / s.verdicts) : undefined} />
        <Stat label="Ditolak" value={s.rejections} sub={s.verdicts ? formatPercent(s.rejections / s.verdicts) : undefined} />
        <Stat label="Dibatalkan admin" value={s.overturned} sub="putusan AI yang dianulir di sengketa" />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle>Identitas onchain</SectionTitle>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-stone-500">ID agen</dt>
            <dd className="font-semibold">#{agent.agentId.toString()}</dd>
            <dt className="text-stone-500">Registri</dt>
            <dd>
              <AddressLink address={agent.identityRegistry} />
            </dd>
            <dt className="text-stone-500">Wallet agen</dt>
            <dd>
              <AddressLink address={agent.agentWallet} />
            </dd>
            <dt className="text-stone-500">Agent card</dt>
            <dd className="text-xs break-all">
              {agent.tokenURI ? (
                <a href={tokenUriHref(agent.tokenURI)} target="_blank" rel="noreferrer" className="text-daun-700 underline">
                  {agent.tokenURI}
                </a>
              ) : (
                "–"
              )}
            </dd>
          </dl>
          <p className="mt-3 text-xs text-stone-500">
            Wallet agen terpisah dari admin, koperasi, dan petani (dicek kontrak saat konfigurasi), sehingga penilaian bersifat independen.
          </p>
        </Card>

        <Card>
          <SectionTitle>Isi agent card</SectionTitle>
          {agent.cardError ? (
            <p className="text-sm text-red-700">{agent.cardError}</p>
          ) : card ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="text-stone-500">Peran</dt>
              <dd>{card.bagipanen?.role ?? "–"}</dd>
              <dt className="text-stone-500">Wilayah</dt>
              <dd><Tags items={card.bagipanen?.regions} /></dd>
              <dt className="text-stone-500">Komoditas</dt>
              <dd><Tags items={card.bagipanen?.commodities} /></dd>
              <dt className="text-stone-500">Koperasi mitra</dt>
              <dd><Tags items={card.bagipanen?.partnerCooperatives} /></dd>
              <dt className="text-stone-500">Metode</dt>
              <dd><Tags items={card.bagipanen?.methods} /></dd>
              <dt className="text-stone-500">Jaringan</dt>
              <dd>{card.bagipanen?.network ?? "–"}</dd>
              <dt className="text-stone-500">Wallet (card)</dt>
              <dd className="font-mono text-xs break-all">{card.agentWallet ?? "–"}</dd>
            </dl>
          ) : (
            <Spinner />
          )}
          {card && (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-stone-500">Lihat JSON mentah</summary>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-stone-900 p-3 text-stone-100">{JSON.stringify(card, null, 2)}</pre>
            </details>
          )}
        </Card>
      </div>

      <section>
        <SectionTitle>10 putusan terakhir</SectionTitle>
        {!verdicts ? (
          <Spinner />
        ) : verdicts.length === 0 ? (
          <EmptyState title="Belum ada putusan" />
        ) : (
          <div className="flex flex-col gap-3">
            {verdicts.map((v) => (
              <Card key={`${v.txHash}-${v.index}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link href={`/campaign/${v.campaign}`} className="font-semibold text-stone-900 hover:underline">
                      {v.commodity} · milestone {v.milestoneName}
                    </Link>
                    <p className="text-xs text-stone-500">
                      Kampanye {shortAddress(v.campaign)} · {formatDateTime(v.timestamp)}
                    </p>
                  </div>
                  {v.approved ? <Badge tone="green">Disetujui</Badge> : <Badge tone="red">Ditolak</Badge>}
                </div>
                {v.reasonCID && <VerdictSummary cid={v.reasonCID} />}
                <div className="mt-1">
                  <TxLink hash={v.txHash} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
