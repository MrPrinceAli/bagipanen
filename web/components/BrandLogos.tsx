import { cn } from "./ui";

/**
 * Logo merek kecil untuk label "powered by". Bentuk logo diambil apa adanya, tidak digambar ulang:
 * Google Gemini, BNB Chain, Solidity, OpenZeppelin dari Simple Icons 16.33.0 (CC0, simpleicons.org;
 * warna = hex resmi Simple Icons); Open-Meteo = ikon awan-matahari di header open-meteo.com
 * (Bootstrap Icons "cloud-sun", MIT; warna gelap seperti di situsnya). Merek tetap milik pemiliknya masing-masing.
 */
const LOGOS = {
  gemini: { name: "Google Gemini", color: "#8E75B2", viewBox: "0 0 24 24", paths: ["M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81"] },
  bnb: { name: "BNB Chain", color: "#F0B90B", viewBox: "0 0 24 24", paths: ["M5.631 3.676 12.001 0l6.367 3.676-2.34 1.358L12 2.716 7.972 5.034l-2.34-1.358Zm12.737 4.636-2.34-1.358L12 9.272 7.972 6.954l-2.34 1.358v2.716l4.026 2.318v4.636L12 19.341l2.341-1.359v-4.636l4.027-2.318V8.312Zm0 7.352v-2.716l-2.34 1.358v2.716l2.34-1.358Zm1.663.96-4.027 2.318v2.717l6.368-3.677V10.63l-2.34 1.358v4.636Zm-2.34-10.63 2.34 1.358v2.716l2.341-1.358V5.994l-2.34-1.358-2.342 1.358ZM9.657 19.926v2.716L12 24l2.341-1.358v-2.716l-2.34 1.358-2.343-1.358Zm-4.027-4.262 2.341 1.358v-2.716l-2.34-1.358v2.716Zm4.027-9.67L12 7.352l2.341-1.358-2.34-1.358-2.343 1.358Zm-5.69 1.358L6.31 5.994 3.968 4.636l-2.34 1.358V8.71l2.34 1.358V7.352Zm0 4.636-2.34-1.358v7.352l6.368 3.677v-2.717l-4.028-2.318v-4.636Z"] },
  solidity: { name: "Solidity", color: "#363636", viewBox: "0 0 24 24", paths: ["M4.409 6.608L7.981.255l3.572 6.353H4.409zM8.411 0l3.569 6.348L15.552 0H8.411zm4.036 17.392l3.572 6.354 3.575-6.354h-7.147zm-.608-10.284h-7.43l3.715 6.605 3.715-6.605zm.428-.25h7.428L15.982.255l-3.715 6.603zM15.589 24l-3.569-6.349L8.448 24h7.141zm-3.856-6.858H4.306l3.712 6.603 3.715-6.603zm.428-.25h7.433l-3.718-6.605-3.715 6.605z"] },
  openzeppelin: { name: "OpenZeppelin", color: "#4E5EE4", viewBox: "0 0 24 24", paths: ["M22.783 24H9.317l2.196-3.69a5.23 5.23 0 0 1 4.494-2.558h6.775ZM1.217 0h21.566l-3.718 6.247H1.217ZM9.76 9.763a5.73 5.73 0 0 1 4.92-2.795h4.01L8.498 24h-7.26Z"] },
  openmeteo: { name: "Open-Meteo", color: "#1f2937", viewBox: "0 0 16 16", paths: ["M7 8a3.5 3.5 0 0 1 3.5 3.555.5.5 0 0 0 .624.492A1.503 1.503 0 0 1 13 13.5a1.5 1.5 0 0 1-1.5 1.5H3a2 2 0 1 1 .1-3.998.5.5 0 0 0 .51-.375A3.502 3.502 0 0 1 7 8zm4.473 3a4.5 4.5 0 0 0-8.72-.99A3 3 0 0 0 3 16h8.5a2.5 2.5 0 0 0 0-5h-.027z", "M10.5 1.5a.5.5 0 0 0-1 0v1a.5.5 0 0 0 1 0v-1zm3.743 1.964a.5.5 0 1 0-.707-.707l-.708.707a.5.5 0 0 0 .708.708l.707-.708zm-7.779-.707a.5.5 0 0 0-.707.707l.707.708a.5.5 0 1 0 .708-.708l-.708-.707zm1.734 3.374a2 2 0 1 1 3.296 2.198c.199.281.372.582.516.898a3 3 0 1 0-4.84-3.225c.352.011.696.055 1.028.129zm4.484 4.074c.6.215 1.125.59 1.522 1.072a.5.5 0 0 0 .039-.742l-.707-.707a.5.5 0 0 0-.854.377zM14.5 6.5a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"] },
} as const;

export type LogoKey = keyof typeof LOGOS;

export function BrandLogo({ name, className }: { name: LogoKey; className?: string }) {
  const l = LOGOS[name];
  return (
    <svg viewBox={l.viewBox} className={cn("size-4 shrink-0", className)} fill={l.color} role="img" aria-label={l.name}>
      {l.paths.map((d) => (
        <path key={d.slice(0, 24)} d={d} />
      ))}
    </svg>
  );
}

/** Deretan label kecil "ditenagai oleh": logo + nama, atau lencana teks (mis. ERC-8004 yang tak punya logo resmi). */
export function PoweredBy({ items }: { items: ({ logo: LogoKey; label?: string } | { badge: string; label: string })[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-1.5" aria-label="Teknologi yang dipakai">
      {items.map((it) => (
        <li
          key={"logo" in it ? it.logo : it.badge}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-stone-700 shadow-soft ring-1 ring-krem-200"
        >
          {"logo" in it ? (
            <BrandLogo name={it.logo} />
          ) : (
            <span className="rounded bg-hutan-900 px-1 py-px font-mono text-[9px] leading-none font-bold text-emas-300">{it.badge}</span>
          )}
          {it.label ?? ("logo" in it ? LOGOS[it.logo].name : "")}
        </li>
      ))}
    </ul>
  );
}
