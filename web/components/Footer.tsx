"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { explorerAddressUrl, IS_LOCAL, REPO_URL } from "@/lib/config";
import { addresses } from "@/lib/addresses";
import { tr } from "@/lib/i18n";
import { Logo } from "./Header";
import { Container } from "./ui";


export function Footer() {
  const factoryUrl = addresses.factory ? explorerAddressUrl(addresses.factory) : null;
  return (
    <footer className="glow-hutan relative overflow-hidden bg-hutan-950 text-white/70">
      <div className="pola-bedengan absolute inset-0" aria-hidden />
      <Container className="relative grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
        <div className="flex flex-col gap-4">
          <Logo />
          <p className="max-w-sm text-sm leading-relaxed">
            {tr(
              "Modal tanam untuk petani tanpa jerat ijon. Dananya dikunci di smart contract, cair per tahap setelah lahan dicek, dan hasil panennya dibagi terbuka.",
              "Crop funding for farmers, free from the ijon trap. The money is locked in a smart contract, released stage by stage once the field is checked, and the harvest is shared in the open.",
            )}
          </p>
          <p className="text-xs text-white/45">{tr("Dibuat untuk Indonesia Web3 Hackathon 2026.", "Built for the Indonesia Web3 Hackathon 2026.")}</p>
        </div>
        <div>
          <p className="mb-3 text-xs font-semibold tracking-[0.18em] text-emas-300 uppercase">{tr("Jelajahi", "Explore")}</p>
          <ul className="flex flex-col gap-2 text-sm">
            <li>
              <Link href="/proyek" className="hover:text-white">
                {tr("Proyek tanam & peta", "Projects & map")}
              </Link>
            </li>
            <li>
              <Link href="/petani" className="hover:text-white">
                {tr("Petani & Rapor", "Farmers & report cards")}
              </Link>
            </li>
            <li>
              <Link href="/transparansi" className="hover:text-white">
                {tr("Transparansi dana", "Fund transparency")}
              </Link>
            </li>
            <li>
              <Link href="/faq" className="hover:text-white">
                {tr("Tanya jawab", "FAQ")}
              </Link>
            </li>
            <li>
              <Link href="/coba" className="hover:text-white">
                {tr("Coba demo", "Try the demo")}
              </Link>
            </li>
            <li>
              <Link href="/#cara-kerja" className="hover:text-white">
                {tr("Cara kerja", "How it works")}
              </Link>
            </li>
            <li>
              <Link href="/agent" className="hover:text-white">
                {tr("Agen AI verifikator", "AI verifier agent")}
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="mb-3 text-xs font-semibold tracking-[0.18em] text-emas-300 uppercase">{tr("Transparansi", "Transparency")}</p>
          <ul className="flex flex-col gap-2 text-sm">
            <li>
              <a href={REPO_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-white">
                {tr("Kode sumber di GitHub", "Source code on GitHub")} <ExternalLink className="size-3" aria-hidden />
              </a>
            </li>
            {factoryUrl && (
              <li>
                <a href={factoryUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-white">
                  {tr("Kontrak di BscScan", "Contract on BscScan")} <ExternalLink className="size-3" aria-hidden />
                </a>
              </li>
            )}
            <li className="text-white/45">{IS_LOCAL ? tr("Mode lokal · chain Anvil", "Local mode · Anvil chain") : tr("BNB Smart Chain Testnet · token demo mUSDT", "BNB Smart Chain Testnet · mUSDT demo token")}</li>
          </ul>
        </div>
      </Container>
      <div className="relative border-t border-white/10">
        <Container className="flex flex-col gap-1 py-5 text-xs text-white/40 sm:flex-row sm:justify-between">
          <span>{tr("Bukan produk investasi sungguhan. Semua dana di sini adalah token uji coba.", "Not a real investment product. All funds here are test tokens.")}</span>
          <span>
            {tr("Foto sampul:", "Cover photo:")}{" "}
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
