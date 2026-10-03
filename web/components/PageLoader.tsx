"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "./ui";

/* ------------------------------------------------------------------ Tunas */

const MESSAGES = [
  [20, "Menyiapkan lahan…"],
  [45, "Menyiram bibit…"],
  [70, "Membaca blockchain…"],
  [92, "Memanggil agen AI…"],
  [101, "Siap panen!"],
] as const;
const messageFor = (v: number) => MESSAGES.find(([max]) => v < max)?.[1] ?? "Siap panen!";

/** Tunas yang tumbuh mengikuti persentase: batang memanjang, daun di 25/50/75%, malai padi di ~100%. */
export function PlantProgress({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const leaf = (at: number) => ({ transform: v >= at ? "scale(1)" : "scale(0)", transformBox: "fill-box" as const });
  return (
    <svg viewBox="0 0 160 160" className={cn("overflow-visible", className)} aria-hidden>
      <defs>
        <radialGradient id="pl-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#edc56a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#edc56a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="pl-soil" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8d5a1c" />
          <stop offset="1" stopColor="#4a2f18" />
        </linearGradient>
      </defs>
      <circle cx="80" cy="62" r="62" fill="url(#pl-glow)" style={{ opacity: 0.25 + v / 160, transition: "opacity .4s" }} />
      {/* Tetes air (menyiram) selama belum selesai */}
      {v < 100 &&
        [58, 80, 102].map((x, i) => (
          <path key={x} className="loader-drop" style={{ animationDelay: `${i * 0.35}s` }} d={`M${x} 6 C${x - 3} 12 ${x - 3} 16 ${x} 17 C${x + 3} 16 ${x + 3} 12 ${x} 6 Z`} fill="#8fc2a3" />
        ))}
      <ellipse cx="80" cy="140" rx="52" ry="11" fill="url(#pl-soil)" />
      <ellipse cx="80" cy="136" rx="40" ry="5" fill="#a87a45" opacity="0.6" />
      <path
        d="M80 138 C78 116 85 98 80 78 C76 62 83 48 80 30"
        pathLength={100}
        stroke="#5fa27b"
        strokeWidth="4.5"
        strokeLinecap="round"
        fill="none"
        style={{ strokeDasharray: 100, strokeDashoffset: 100 - Math.min(100, v * 1.05), transition: "stroke-dashoffset .35s ease-out" }}
      />
      <g fill="#3d855d" style={{ transition: "transform .5s cubic-bezier(.3,1.6,.5,1)" }}>
        <path style={{ ...leaf(25), transformOrigin: "80px 116px", transition: "transform .5s cubic-bezier(.3,1.6,.5,1)" }} d="M80 116 C66 104 52 108 46 120 C60 126 72 124 80 116 Z" />
        <path style={{ ...leaf(50), transformOrigin: "81px 98px", transition: "transform .5s cubic-bezier(.3,1.6,.5,1)" }} d="M81 98 C94 86 108 88 114 100 C100 106 88 106 81 98 Z" />
        <path style={{ ...leaf(75), transformOrigin: "79px 72px", transition: "transform .5s cubic-bezier(.3,1.6,.5,1)" }} d="M79 72 C67 62 55 64 50 74 C62 80 72 79 79 72 Z" />
      </g>
      {/* Malai padi keemasan */}
      <g style={{ opacity: v >= 96 ? 1 : 0, transform: v >= 96 ? "none" : "translateY(6px)", transition: "all .5s ease-out" }}>
        {[
          [80, 24, 0],
          [74, 32, -28],
          [86, 32, 28],
          [72, 41, -32],
          [88, 41, 32],
          [80, 34, 0],
        ].map(([x, y, r]) => (
          <ellipse key={`${x}${y}`} cx={x} cy={y} rx="3" ry="6" fill="#edc56a" transform={`rotate(${r} ${x} ${y})`} />
        ))}
      </g>
    </svg>
  );
}

/* ------------------------------------------------------- Loader awal (layar penuh) */

const INTRO_MS = 7000; // durasi animasi pembuka, sama untuk kunjungan pertama maupun refresh
const MAX_MS = 12_000; // pengaman bila event load tidak kunjung datang

/**
 * Layar pembuka setiap kali web dibuka atau di-refresh: persentase naik mulus mengikuti waktu
 * selama ±7 detik, tetapi tertahan di 92% sampai font & semua sumber halaman benar-benar selesai
 * dimuat. Tidak muncul pada navigasi antarhalaman.
 */
export function InitialLoader() {
  const [value, setValue] = useState(0);
  const [phase, setPhase] = useState<"load" | "fade" | "gone">("load");

  useEffect(() => {
    const minMs = INTRO_MS;
    let loaded = false;
    Promise.all([
      document.readyState === "complete" ? Promise.resolve() : new Promise((r) => window.addEventListener("load", r, { once: true })),
      document.fonts?.ready ?? Promise.resolve(),
    ]).then(() => (loaded = true));

    // Dihitung sejak halaman mulai dibuka (performance.now() = waktu sejak navigasi), bukan sejak
    // JavaScript siap, supaya total durasi pembuka tetap ±7 detik.
    const started = 0;
    let v = 0;
    let raf = 0;
    const tick = () => {
      const elapsed = performance.now() - started;
      if (elapsed > MAX_MS) loaded = true;
      const eased = 1 - Math.pow(1 - Math.min(1, elapsed / minMs), 2.2);
      const target = Math.min(loaded ? 100 : 92, eased * 100);
      v += (target - v) * 0.2;
      const shown = target === 100 && v > 99.5 ? 100 : Math.floor(v);
      setValue((prev) => (prev === shown ? prev : shown));
      if (shown < 100) raf = requestAnimationFrame(tick);
      else {
        setTimeout(() => setPhase("fade"), 400);
        setTimeout(() => setPhase("gone"), 1000);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (phase === "gone") return null;
  return (
    <div
      id="page-loader"
      role="status"
      aria-live="polite"
      aria-label={`Memuat BagiPanen ${value}%`}
      className={cn(
        "glow-hutan fixed inset-0 z-[100] grid place-items-center bg-hutan-950 text-white transition-opacity duration-500",
        phase === "fade" && "pointer-events-none opacity-0",
      )}
    >
      <div className="pola-bedengan absolute inset-0" aria-hidden />
      <div className="relative flex flex-col items-center">
        <PlantProgress value={value} className="size-40 sm:size-48" />
        <p className="mt-4 font-display text-6xl font-semibold tracking-tight tabular-nums">
          {value}
          <span className="text-emas-300">%</span>
        </p>
        <p className="mt-2 text-sm text-white/60">{messageFor(value)}</p>
        <div className="mt-6 h-1 w-48 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-linear-to-r from-hutan-400 to-emas-300 transition-[width] duration-200" style={{ width: `${value}%` }} />
        </div>
        <p className="mt-6 font-display text-lg font-semibold text-white/90">
          Bagi<span className="text-emas-300">Panen</span>
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- Loader navigasi */

/**
 * Pindah halaman: garis progres di atas; jika lebih dari ±0,2 detik, muncul kartu kecil berisi
 * tunas + persentase. Dimulai saat tautan internal diklik, selesai saat pathname berganti.
 */
export function NavigationLoader() {
  const pathname = usePathname();
  const [value, setValue] = useState<number | null>(null);
  const [showCard, setShowCard] = useState(false);
  const timers = useRef<number[]>([]);
  const prevPath = useRef(pathname);

  const clear = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  };

  const done = useCallback(() => {
    clear();
    setValue((v) => (v === null ? v : 100));
    timers.current.push(
      window.setTimeout(() => {
        setValue(null);
        setShowCard(false);
      }, 420),
    );
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download") || a.closest('[data-moved="1"]')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      clear();
      setValue(8);
      setShowCard(false);
      let v = 8;
      const step = () => {
        v = Math.min(90, v + (90 - v) * 0.12);
        setValue(Math.floor(v));
        timers.current.push(window.setTimeout(step, 120));
      };
      timers.current.push(window.setTimeout(step, 120));
      timers.current.push(window.setTimeout(() => setShowCard(true), 220));
      timers.current.push(window.setTimeout(done, 8000)); // pengaman bila navigasi batal
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [done]);

  useEffect(() => {
    if (prevPath.current !== pathname) {
      prevPath.current = pathname;
      done();
    }
  }, [pathname, done]);

  if (value === null) return null;
  return (
    <>
      <div className="fixed inset-x-0 top-0 z-[90] h-1 bg-transparent" role="progressbar" aria-valuenow={value} aria-label="Memuat halaman">
        <div
          className="h-full bg-linear-to-r from-hutan-400 via-emas-300 to-emas-400 shadow-[0_0_12px_rgb(237_197_106/0.8)] transition-[width] duration-200 ease-out"
          style={{ width: `${value}%` }}
        />
      </div>
      {showCard && (
        <div className="pointer-events-none fixed inset-0 z-[85] grid place-items-center bg-hutan-950/25 backdrop-blur-[2px]">
          <div className="flex items-center gap-4 rounded-3xl bg-hutan-950/95 px-6 py-4 text-white shadow-lift ring-1 ring-white/10">
            <PlantProgress value={value} className="size-16" />
            <div>
              <p className="font-display text-3xl font-semibold tabular-nums">
                {value}
                <span className="text-emas-300">%</span>
              </p>
              <p className="text-xs text-white/60">{messageFor(value)}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
