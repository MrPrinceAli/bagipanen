import { Bot, Lock, LockOpen, Sprout, Users } from "lucide-react";
import Image from "next/image";
import type { CSSProperties } from "react";
import heroImage from "@/public/hero-lahan.jpg";
import { cn } from "./ui";

/**
 * Empat panel "Cara kerja", masing-masing bergaya berbeda (formulir kertas, neon fintech, tanah &
 * tunas, neo-brutalist). Animasi dikendalikan CSS di globals.css (.how-*): berjalan saat `on`
 * (visual menempel di desktop) atau saat panel muncul di layar (Reveal, di HP). Angka = contoh PRD.
 */
type PanelProps = { on: boolean };
const onAttr = (on: boolean) => (on ? "" : undefined);

/* ---------------------------------------------------------- 1 · Formulir kertas */
function ProposalPanel({ on }: PanelProps) {
  const rows = [
    ["Komoditas", "Cabai merah"],
    ["Lokasi", "Cikajang, Garut"],
    ["Luas lahan", "0,5 ha"],
    ["Butuh modal", "1.000 USDT"],
    ["Perkiraan jual", "1.650 USDT"],
  ];
  return (
    <div data-on={onAttr(on)} className="how-panel how-paper relative h-full min-h-[27rem] -rotate-1 rounded-[1.75rem] p-6 pl-16 text-[#3b2a14] sm:p-8 sm:pl-20">
      <span className="how-clip absolute -top-4 left-9 rotate-[8deg]" aria-hidden />
      <p className="font-mono text-[11px] font-bold tracking-[0.25em] text-[#8d5a1c] uppercase">Formulir pengajuan · No. 007</p>
      <p className="mt-2 font-display text-2xl font-semibold">Modal tanam cabai merah</p>
      <div className="mt-5 grid grid-cols-[1fr_auto] items-start gap-4">
        <dl className="flex flex-col gap-2.5">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-baseline gap-2">
              <dt className="w-24 shrink-0 font-mono text-[10px] tracking-wider text-[#8d5a1c]/80 uppercase sm:w-28">{k}</dt>
              <dd className="flex-1 border-b border-dotted border-[#8d5a1c]/50 pb-0.5 font-display text-lg leading-none italic">{v}</dd>
            </div>
          ))}
        </dl>
        <figure className="w-24 rotate-[5deg] bg-white p-1.5 pb-5 shadow-[0_12px_24px_-10px_rgb(0_0_0/0.45)] sm:w-32">
          <Image src={heroImage} alt="" sizes="128px" placeholder="blur" className="aspect-square w-full object-cover" />
          <figcaption className="mt-1 text-center font-display text-[11px] italic">lahan awal</figcaption>
        </figure>
      </div>
      <p className="mt-6 font-display text-sm text-[#5c3b20] italic">
        Tanda tangan petani: <span className="ml-1 font-semibold not-italic [font-family:cursive]">Darto</span>
      </p>
      <div className="how-stamp absolute right-6 bottom-6 rounded-xl border-[3px] border-double border-red-700 px-3 py-1.5 text-center font-mono text-sm leading-tight font-black tracking-widest text-red-700 uppercase mix-blend-multiply">
        Direview
        <br />
        admin
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- 2 · Neon fintech */
function FundingPanel({ on }: PanelProps) {
  const investors = [
    { name: "Rina", amt: "500", hue: "from-emas-300 to-emas-600" },
    { name: "Budi", amt: "300", hue: "from-hutan-300 to-hutan-600" },
    { name: "Sari", amt: "200", hue: "from-sky-300 to-sky-600" },
  ];
  return (
    <div data-on={onAttr(on)} className="how-panel how-neon relative flex h-full min-h-[27rem] flex-col overflow-hidden rounded-[1.75rem] p-6 text-white sm:p-8">
      <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.25em] text-white/60 uppercase">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-hutan-300 opacity-70" />
          <span className="relative inline-flex size-2 rounded-full bg-hutan-300" />
        </span>
        Pool pendanaan · live onchain
      </p>
      <div className="my-auto grid items-center gap-7 py-6 sm:grid-cols-[auto_1fr]">
        <div className="relative mx-auto">
          <div className="how-ring grid size-48 place-items-center rounded-full">
            <div className="grid size-[10.4rem] place-items-center rounded-full bg-[#04110b] text-center shadow-[inset_0_0_30px_rgb(237_197_106/0.15)]">
              <div>
                <p className="font-display text-4xl font-semibold tracking-tight">1.000</p>
                <p className="font-mono text-[10px] tracking-widest text-white/50 uppercase">USDT terkumpul</p>
                <p className="mt-1 text-sm font-semibold text-emas-300">100%</p>
              </div>
            </div>
          </div>
          {[
            { t: "+500 BPS", cls: "-top-3 left-0", d: "0s" },
            { t: "+300 BPS", cls: "top-[45%] -left-10", d: "0.8s" },
            { t: "+200 BPS", cls: "-bottom-3 left-6", d: "1.6s" },
          ].map((k) => (
            <span
              key={k.t}
              className={cn("how-token absolute rounded-full border border-emas-300/40 bg-emas-300/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-emas-200 backdrop-blur", k.cls)}
              style={{ animationDelay: k.d }}
            >
              {k.t}
            </span>
          ))}
        </div>
        <ul className="flex flex-col gap-2.5">
          {investors.map((v) => (
            <li key={v.name} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 backdrop-blur">
              <span className="flex items-center gap-2.5">
                <span className={cn("grid size-7 place-items-center rounded-full bg-linear-to-br text-xs font-bold text-hutan-950", v.hue)}>{v.name[0]}</span>
                <span className="font-semibold">{v.name}</span>
              </span>
              <span className="font-mono text-xs text-white/70">
                {v.amt} USDT <span className="text-white/35">→</span> <span className="text-emas-300">{v.amt} BPS</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="font-mono text-[11px] text-white/45">1 USDT = 1 token porsi (BPS) · tidak bisa dipindahtangankan</p>
    </div>
  );
}

/* ---------------------------------------------------------- 3 · Tanah & tunas */
function ReleasePanel({ on }: PanelProps) {
  const rows = [
    { name: "Pra-panen", pct: "25%", ai: true, coop: false, delay: "1.5s" },
    { name: "Tumbuh", pct: "35%", ai: true, coop: true, delay: "1s" },
    { name: "Tanam", pct: "40%", ai: true, coop: true, delay: "0.5s" },
  ];
  const leaf = (y: number, d: string): CSSProperties => ({ transitionDelay: d, transformOrigin: `50px ${y}px` });
  return (
    <div data-on={onAttr(on)} className="how-panel how-soil relative h-full min-h-[27rem] overflow-hidden rounded-[1.75rem] p-5 sm:p-6">
      <p className="relative font-mono text-[11px] font-bold tracking-[0.25em] text-hutan-800 uppercase">Lahan · pencairan bertahap</p>
      <svg viewBox="0 0 100 400" className="absolute top-12 bottom-4 left-3 h-[calc(100%-4rem)] w-20 sm:left-6 sm:w-24" aria-hidden>
        <g stroke="#c9a87a" strokeOpacity="0.55" strokeWidth="1.5" fill="none" strokeLinecap="round">
          <path d="M50 395 C40 400 30 410 22 420 M50 395 C60 402 70 410 80 418 M50 395 V425" />
        </g>
        <path className="how-stem" d="M50 398 C47 340 56 300 50 250 C44 200 57 160 50 115 C46 85 52 60 50 34" stroke="#2c6a48" strokeWidth="5" fill="none" strokeLinecap="round" />
        <g fill="#3d855d">
          <path className="how-leaf" style={leaf(300, "0.6s")} d="M50 300 C34 288 20 294 12 310 C28 318 42 314 50 300 Z" />
          <path className="how-leaf" style={leaf(285, "0.75s")} d="M51 285 C66 272 80 276 88 292 C72 300 58 298 51 285 Z" />
          <path className="how-leaf" style={leaf(190, "1.1s")} d="M50 190 C34 178 20 184 12 200 C28 208 42 204 50 190 Z" />
          <path className="how-leaf" style={leaf(172, "1.25s")} d="M51 172 C66 160 80 164 88 180 C72 188 58 186 51 172 Z" />
          <path className="how-leaf" style={leaf(80, "1.6s")} d="M50 80 C36 70 24 74 18 88 C32 94 44 92 50 80 Z" />
        </g>
        <g>
          <path className="how-leaf" style={leaf(60, "1.9s")} d="M54 60 C62 62 66 72 63 84 C61 90 57 90 57 86 C58 78 57 70 52 66 Z" fill="#c0392b" />
          <path className="how-leaf" style={leaf(48, "2.05s")} d="M46 48 C38 50 34 60 37 72 C39 78 43 78 43 74 C42 66 43 58 48 54 Z" fill="#e05540" />
        </g>
      </svg>
      <ul className="relative ml-20 flex h-[calc(100%-2rem)] flex-col justify-around gap-2 pt-2 sm:ml-28">
        {rows.map((r) => (
          <li key={r.name} className="how-row rounded-2xl bg-white/90 px-3.5 py-2.5 shadow-[0_8px_20px_-12px_rgb(0_0_0/0.5)] backdrop-blur" style={{ transitionDelay: r.delay }}>
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-hutan-950">
                {r.name} <span className="font-normal text-stone-500">· {r.pct}</span>
              </p>
              <span className={cn("text-[11px] font-bold tracking-wide uppercase", r.coop ? "text-hutan-600" : "text-emas-700")}>{r.coop ? "Cair" : "Menunggu"}</span>
            </div>
            <div className="mt-1.5 flex gap-1.5 text-[11px] font-semibold">
              {[
                { icon: Bot, label: "AI", ok: r.ai },
                { icon: Users, label: "Koperasi", ok: r.coop },
              ].map(({ icon: Icon, label, ok }) => (
                <span key={label} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5", ok ? "bg-hutan-100 text-hutan-800" : "bg-emas-100 text-emas-800")}>
                  <Icon className="size-3" aria-hidden /> {label}
                  {ok ? <LockOpen className="size-3" aria-hidden /> : <Lock className="size-3" aria-hidden />}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------- 4 · Neo-brutalist */
function SplitPanel({ on }: PanelProps) {
  const tiles = [
    { label: "Modal investor", value: "1.000", cls: "bg-hutan-800 text-white", tilt: "-2deg", d: "0.35s" },
    { label: "Untung investor", value: "260", cls: "bg-hutan-500 text-white", tilt: "1.5deg", d: "0.5s" },
    { label: "Untung petani", value: "357,5", cls: "bg-emas-400 text-hutan-950", tilt: "1deg", d: "0.65s" },
    { label: "Dana cadangan", value: "32,5", cls: "bg-[#c0392b] text-white", tilt: "-1.5deg", d: "0.8s" },
  ];
  return (
    <div data-on={onAttr(on)} className="how-panel how-brutal relative flex h-full min-h-[27rem] flex-col rounded-[1.25rem] p-6 text-hutan-950 sm:p-7">
      <div className="flex items-start justify-between gap-3">
        <p className="font-display text-3xl leading-none font-black tracking-tight uppercase">
          Bagi
          <br />
          hasil
        </p>
        <span className="rotate-6 border-[3px] border-hutan-950 bg-hutan-950 px-2.5 py-1 font-mono text-xs font-black tracking-widest text-emas-300 uppercase shadow-[4px_4px_0_#e6b043]">
          Otomatis!
        </span>
      </div>
      <div className="my-auto grid items-center gap-7 py-6 sm:grid-cols-[auto_1fr]">
        <div
          className="how-donut relative mx-auto size-44 sm:size-48 rounded-full border-[3px] border-hutan-950 shadow-[6px_6px_0_#0b1d15]"
          style={{ background: "conic-gradient(#1b4130 0 60.6%, #3d855d 0 76.4%, #e6b043 0 98.1%, #c0392b 0)" }}
        >
          <div className="absolute inset-[24%] grid place-items-center rounded-full border-[3px] border-hutan-950 bg-[#fdf9ee] text-center">
            <div>
              <p className="font-display text-2xl leading-none font-black">1.650</p>
              <p className="font-mono text-[9px] font-bold tracking-widest uppercase">USDT</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {tiles.map((t) => (
            <div key={t.label} className={cn("how-tile rounded-lg p-3", t.cls)} style={{ "--tilt": t.tilt, animationDelay: t.d } as CSSProperties}>
              <p className="font-mono text-[9px] font-black tracking-wider uppercase opacity-80">{t.label}</p>
              <p className="font-display text-[1.7rem] leading-tight font-black">{t.value}</p>
            </div>
          ))}
        </div>
      </div>
      <p className="font-mono text-[11px] font-bold">Modal kembali dulu → untung: 55% petani · 40% investor · 5% cadangan</p>
    </div>
  );
}

const PANELS = [ProposalPanel, FundingPanel, ReleasePanel, SplitPanel];

export function StepVisual({ index, active }: { index: number; active: boolean }) {
  const Panel = PANELS[index];
  return <Panel on={active} />;
}

/** Lencana nomor langkah, bergaya sesuai panelnya. */
export function StepBadge({ index }: { index: number }) {
  const n = String(index + 1).padStart(2, "0");
  if (index === 0)
    return (
      <span className="inline-block -rotate-3 rounded-md border-2 border-dashed border-red-700/80 px-2.5 py-1 font-mono text-xs font-black tracking-[0.2em] text-red-700 uppercase">
        Langkah {n}
      </span>
    );
  if (index === 1)
    return (
      <span className="inline-block rounded-full bg-[#04110b] px-3 py-1 font-mono text-xs font-bold tracking-[0.2em] text-emas-300 uppercase shadow-[0_0_18px_rgb(237_197_106/0.45)] ring-1 ring-emas-300/40">
        Langkah {n}
      </span>
    );
  if (index === 2)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-hutan-100 px-3 py-1 text-xs font-bold tracking-[0.15em] text-hutan-800 uppercase ring-1 ring-hutan-200">
        <Sprout className="size-3.5" aria-hidden /> Langkah {n}
      </span>
    );
  return (
    <span className="inline-block border-2 border-hutan-950 bg-emas-300 px-2.5 py-1 font-mono text-xs font-black tracking-[0.2em] text-hutan-950 uppercase shadow-[3px_3px_0_#0b1d15]">
      Langkah {n}
    </span>
  );
}
