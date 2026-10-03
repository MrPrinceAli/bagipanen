"use client";

import { ArrowRight, Bot, Check, Coins, ExternalLink, Fuel, HandCoins, Network, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useAccount, useBalance, useSwitchChain } from "wagmi";
import { TxStatus } from "@/components/common";
import { ConnectPrompt } from "@/components/wallet";
import { Button, ButtonLink, Card, cn, Notice, PageBody, PageHero } from "@/components/ui";
import { mockUSDTAbi } from "@/lib/abi/MockUSDT";
import { addresses } from "@/lib/addresses";
import { useCampaignList, useMyPositions, useUsdtBalance } from "@/lib/campaigns";
import { AGENT_WORKFLOW_URL, FAUCET_AMOUNT, HIDDEN_FROM_HOME, IS_LOCAL, targetChain } from "@/lib/config";
import { formatUsdt } from "@/lib/format";
import { useTx } from "@/lib/tx";
import { Status } from "@/lib/types";

const FAUCETS = [
  { label: "Faucet QuickNode", href: "https://faucet.quicknode.com/binance-smart-chain/bnb-testnet" },
  { label: "Faucet resmi BNB Chain", href: "https://www.bnbchain.org/en/testnet-faucet" },
];

function Step({
  n,
  icon: Icon,
  title,
  done,
  children,
}: {
  n: number;
  icon: LucideIcon;
  title: string;
  done: boolean;
  children: ReactNode;
}) {
  return (
    <li className={cn("relative flex gap-4 rounded-3xl border bg-white p-5 shadow-soft sm:p-6", done ? "border-hutan-200" : "border-krem-200")}>
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-2xl font-display text-lg font-semibold",
          done ? "bg-hutan-600 text-white" : "bg-krem-100 text-hutan-900 ring-1 ring-krem-300",
        )}
      >
        {done ? <Check className="size-5" aria-hidden /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Icon className="size-4 text-hutan-500" aria-hidden />
          <h2 className="font-display text-xl font-semibold text-hutan-950">{title}</h2>
          {done && <span className="rounded-full bg-hutan-50 px-2 py-0.5 text-xs font-semibold text-hutan-700 ring-1 ring-hutan-200">selesai</span>}
        </div>
        <div className="mt-2 text-sm leading-relaxed text-pretty text-stone-600">{children}</div>
      </div>
    </li>
  );
}

export default function TryDemoPage() {
  const { address, isConnected, chainId } = useAccount();
  const { switchChain, isPending: switching } = useSwitchChain();
  const onChain = isConnected && chainId === targetChain.id;
  const { data: gas } = useBalance({ address, chainId: targetChain.id, query: { enabled: onChain } });
  const { data: usdt } = useUsdtBalance();
  const { data: campaigns } = useCampaignList();
  const { data: positions } = useMyPositions(campaigns);
  const mintTx = useTx();

  const funding = (campaigns ?? []).filter((c) => c.status === Status.Funding && !HIDDEN_FROM_HOME.has(c.address.toLowerCase()));
  const hasGas = Boolean(gas && gas.value > 0n);
  const hasUsdt = Boolean(usdt && usdt > 0n);
  const hasFunded = Boolean(positions && positions.length > 0);

  return (
    <>
      <PageHero
        eyebrow="Coba demo"
        title="Coba jadi investor dalam 5 menit"
        description="Semua berjalan di BSC Testnet dengan token demo, jadi tidak ada uang sungguhan. Langkah yang sudah kamu selesaikan akan tercentang otomatis."
      />
      <PageBody>
        {IS_LOCAL && <Notice tone="info">Mode lokal: pilih akun demo di header, tidak perlu MetaMask maupun faucet.</Notice>}
        <ol className="flex flex-col gap-4">
          <Step n={1} icon={Wallet} title="Hubungkan MetaMask" done={isConnected}>
            <p>
              Pasang{" "}
              <a href="https://metamask.io/download/" target="_blank" rel="noreferrer" className="font-semibold text-hutan-700 underline">
                MetaMask
              </a>{" "}
              di browser, lalu hubungkan. Di HP, buka halaman ini dari browser di dalam aplikasi MetaMask.
            </p>
            {!isConnected && (
              <div className="mt-3 max-w-sm">
                <ConnectPrompt />
              </div>
            )}
          </Step>

          <Step n={2} icon={Network} title="Pindah ke BSC Testnet" done={onChain}>
            <p>BagiPanen berjalan di BNB Smart Chain Testnet (chain ID {targetChain.id}). MetaMask akan meminta izin menambah atau pindah jaringan.</p>
            {isConnected && !onChain && (
              <Button className="mt-3" size="sm" loading={switching} onClick={() => switchChain({ chainId: targetChain.id })}>
                Pindah ke BSC Testnet
              </Button>
            )}
          </Step>

          <Step n={3} icon={Fuel} title="Ambil sedikit tBNB untuk gas" done={hasGas}>
            <p>
              Setiap transaksi butuh gas dalam tBNB (gratis dari faucet). 0,005 tBNB sudah cukup untuk puluhan transaksi.
              {gas && <span className="font-semibold text-hutan-900"> Saldomu: {Number(gas.formatted).toLocaleString("id-ID", { maximumFractionDigits: 4 })} tBNB.</span>}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {FAUCETS.map((f) => (
                <a
                  key={f.href}
                  href={f.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-krem-100 px-3 py-1.5 text-sm font-semibold text-hutan-800 ring-1 ring-krem-300 hover:bg-krem-200"
                >
                  {f.label} <ExternalLink className="size-3.5" aria-hidden />
                </a>
              ))}
            </div>
            <p className="mt-2 text-xs text-stone-500">Faucet resmi BNB Chain mensyaratkan saldo BNB di mainnet.</p>
          </Step>

          <Step n={4} icon={Coins} title="Minta 1.000 mUSDT demo" done={hasUsdt}>
            <p>
              mUSDT adalah stablecoin demo khusus testnet.
              {usdt !== undefined && <span className="font-semibold text-hutan-900"> Saldomu: {formatUsdt(usdt)} mUSDT.</span>}
            </p>
            {onChain && address && addresses.usdt && (
              <div className="mt-3 flex flex-col gap-2">
                <Button
                  size="sm"
                  variant="gold"
                  className="self-start"
                  loading={mintTx.busy}
                  disabled={!hasGas}
                  onClick={() => mintTx.write({ address: addresses.usdt!, abi: mockUSDTAbi, functionName: "mint", args: [address, FAUCET_AMOUNT] })}
                >
                  <Coins className="size-4" aria-hidden /> Minta 1.000 mUSDT
                </Button>
                {!hasGas && <p className="text-xs text-stone-500">Isi tBNB dulu di langkah 3.</p>}
                <TxStatus state={mintTx.state} successText="1.000 mUSDT masuk ke dompetmu." />
              </div>
            )}
          </Step>

          <Step n={5} icon={HandCoins} title="Danai proyek yang sedang cari dana" done={hasFunded}>
            <p>Buka salah satu proyek di bawah, isi jumlahnya, lalu klik Izinkan mUSDT → Danai. Token porsi (BPS) langsung muncul di Dashboard.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {funding.map((c) => (
                <ButtonLink key={c.address} href={`/campaign/${c.address}`} size="sm" variant="secondary">
                  {c.commodity} · {c.locationName.split(",")[0]} <ArrowRight className="size-3.5" aria-hidden />
                </ButtonLink>
              ))}
              {campaigns && funding.length === 0 && <span className="text-stone-500">Saat ini tidak ada proyek yang sedang cari dana.</span>}
            </div>
            {hasFunded && (
              <ButtonLink href="/dashboard" size="sm" className="mt-3">
                Lihat porsimu di Dashboard <ArrowRight className="size-3.5" aria-hidden />
              </ButtonLink>
            )}
          </Step>
        </ol>

        <Card className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Bot className="size-5 text-hutan-600" aria-hidden />
            <h2 className="font-display text-xl font-semibold text-hutan-950">Yang bisa dilihat tanpa dompet</h2>
          </div>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {[
              { href: "/proyek", label: "Peta & semua proyek, termasuk yang sudah panen dan yang gagal" },
              { href: "/petani", label: "Rapor Petani: riwayat setiap musim, tidak bisa diubah" },
              { href: "/agent", label: "Profil agen AI: identitas & reputasi ERC-8004, putusan terbaru" },
              { href: "/transparansi", label: "Transparansi: aliran dana, dana cadangan, semua kontrak" },
            ].map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="flex items-start gap-2 rounded-2xl bg-krem-50 p-3 ring-1 ring-krem-200 hover:bg-krem-100">
                  <ArrowRight className="mt-0.5 size-4 shrink-0 text-hutan-600" aria-hidden />
                  <span className="text-stone-700">{l.label}</span>
                </Link>
              </li>
            ))}
            <li className="sm:col-span-2">
              <a href={AGENT_WORKFLOW_URL} target="_blank" rel="noreferrer" className="flex items-start gap-2 rounded-2xl bg-krem-50 p-3 ring-1 ring-krem-200 hover:bg-krem-100">
                <ExternalLink className="mt-0.5 size-4 shrink-0 text-hutan-600" aria-hidden />
                <span className="text-stone-700">Log kerja agen AI di GitHub Actions: setiap putaran pemeriksaan foto terbuka untuk publik</span>
              </a>
            </li>
          </ul>
        </Card>
      </PageBody>
    </>
  );
}
