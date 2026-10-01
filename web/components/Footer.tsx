import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { explorerAddressUrl, IS_LOCAL } from "@/lib/config";
import { addresses } from "@/lib/addresses";
import { Logo } from "./Header";
import { Container } from "./ui";

const REPO_URL = "https://github.com/MrPrinceAli/bagipanen";

export function Footer() {
  const factoryUrl = addresses.factory ? explorerAddressUrl(addresses.factory) : null;
  return (
    <footer className="glow-hutan relative overflow-hidden bg-hutan-950 text-white/70">
      <div className="pola-bedengan absolute inset-0" aria-hidden />
      <Container className="relative grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
        <div className="flex flex-col gap-4">
          <Logo />
          <p className="max-w-sm text-sm leading-relaxed">
            Modal tanam untuk petani tanpa jerat ijon. Dananya dikunci di smart contract, cair per tahap setelah lahan dicek, dan
            hasil panennya dibagi terbuka.
          </p>
          <p className="text-xs text-white/45">Dibuat untuk Indonesia Web3 Hackathon 2026.</p>
        </div>
        <div>
          <p className="mb-3 text-xs font-semibold tracking-[0.18em] text-emas-300 uppercase">Jelajahi</p>
          <ul className="flex flex-col gap-2 text-sm">
            <li>
              <Link href="/#kampanye" className="hover:text-white">
                Kampanye
              </Link>
            </li>
            <li>
              <Link href="/#cara-kerja" className="hover:text-white">
                Cara kerja
              </Link>
            </li>
            <li>
              <Link href="/agent" className="hover:text-white">
                Agen AI verifikator
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="mb-3 text-xs font-semibold tracking-[0.18em] text-emas-300 uppercase">Transparansi</p>
          <ul className="flex flex-col gap-2 text-sm">
            <li>
              <a href={REPO_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-white">
                Kode sumber di GitHub <ExternalLink className="size-3" aria-hidden />
              </a>
            </li>
            {factoryUrl && (
              <li>
                <a href={factoryUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-white">
                  Kontrak di BscScan <ExternalLink className="size-3" aria-hidden />
                </a>
              </li>
            )}
            <li className="text-white/45">{IS_LOCAL ? "Mode lokal · chain Anvil" : "BNB Smart Chain Testnet · token demo mUSDT"}</li>
          </ul>
        </div>
      </Container>
      <div className="relative border-t border-white/10">
        <Container className="flex flex-col gap-1 py-5 text-xs text-white/40 sm:flex-row sm:justify-between">
          <span>Bukan produk investasi sungguhan. Semua dana di sini adalah token uji coba.</span>
          <span>
            Foto sampul:{" "}
            <a href="https://commons.wikimedia.org/wiki/File:Kebun_cabai.jpg" target="_blank" rel="noreferrer" className="underline hover:text-white/70">
              Amelia Citra
            </a>
            , CC BY-SA 4.0
          </span>
        </Container>
      </div>
    </footer>
  );
}
