import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import "./globals.css";
import { Providers } from "./providers";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BagiPanen · Modal tanam tanpa ijon",
  description:
    "Danai satu musim tanam petani Indonesia. Dana dikunci di smart contract, cair per tahap setelah lahan dicek agen AI dan koperasi, lalu hasil panen dibagi terbuka di BNB Chain.",
};

export const viewport: Viewport = {
  themeColor: "#0b1d15",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${jakarta.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <Providers>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
