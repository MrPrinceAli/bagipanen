import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Header } from "@/components/Header";
import { IS_LOCAL } from "@/lib/config";
import "./globals.css";
import { Providers } from "./providers";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BagiPanen — Pendanaan Panen Petani",
  description:
    "Modal tanam yang adil untuk petani, transparan untuk investor, diverifikasi AI, tercatat onchain di BNB Chain.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <Providers>
          <Header />
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
          <footer className="border-t border-tanah-200 px-4 py-4 text-center text-xs text-stone-500">
            BagiPanen · Indonesia Web3 Hackathon 2026 ·{" "}
            {IS_LOCAL ? "Mode lokal (Anvil, data demo)" : "BNB Smart Chain Testnet"}
          </footer>
        </Providers>
      </body>
    </html>
  );
}
