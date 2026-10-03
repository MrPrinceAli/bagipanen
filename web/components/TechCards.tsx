"use client";

import { useQuery } from "@tanstack/react-query";
import { CloudRain, ScanEye, Thermometer } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import proofImage from "@/public/demo/sidrap-pra-panen.jpg";
import { PoweredBy } from "./BrandLogos";
import { Card, cn } from "./ui";

/* ================================================================ Gemini Vision */

/**
 * Cara agen menilai foto: Gemini sebagai "mata", aturan BagiPanen yang memutuskan (agent/src/verdict.ts).
 * Contohnya putusan sungguhan: bukti Pra-panen proyek padi Sidrap di BSC testnet (3 Okt 2026).
 */
export function GeminiVisionCard() {
  const json: [string, string, string][] = [
    ["foto_lahan", "true", "text-sky-300"],
    ["komoditas", '"Padi"', "text-emas-200"],
    ["fase", '"Pra-panen"', "text-emas-200"],
    ["kondisi", '"baik"', "text-emas-200"],
    ["yakin", "0.95", "text-sky-300"],
    ["catatan", "[]", "text-white/60"],
  ];
  return (
    <Card className="flex h-full flex-col gap-6 p-6 sm:p-8">
      <PoweredBy items={[{ logo: "gemini", label: "Google Gemini" }]} />
      <div>
        <p className="text-xs font-semibold tracking-[0.18em] text-emas-600 uppercase">Mata agen AI · Gemini Vision</p>
        <h2 className="mt-2 font-display text-3xl font-semibold text-balance text-hutan-950">Foto lahan dinilai, bukan sekadar diunggah</h2>
        <p className="mt-2 text-pretty text-stone-600">
          Agen mengirim foto bukti beserta konteks proyek ke Gemini dan meminta jawaban JSON yang ketat. Keputusan tetap di tangan aturan
          BagiPanen: keyakinan minimal 70%, komoditas dan fase harus cocok, ditambah cek GPS, tanggal, dan foto daur ulang.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_1.1fr]">
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-hutan-900">
          <Image
            src={proofImage}
            alt="Foto bukti tahap Pra-panen: tanaman padi yang mulai menguning"
            sizes="(min-width: 640px) 240px, 100vw"
            placeholder="blur"
            className="h-full w-full object-cover opacity-90"
          />
          {/* Bingkai bidik & garis pemindai */}
          {["top-3 left-3 border-t-2 border-l-2", "top-3 right-3 border-t-2 border-r-2", "bottom-3 left-3 border-b-2 border-l-2", "right-3 bottom-3 border-r-2 border-b-2"].map(
            (c) => (
              <span key={c} className={cn("absolute size-5 rounded-sm border-emas-300", c)} aria-hidden />
            ),
          )}
          <span className="scan-line pointer-events-none absolute inset-x-0 h-12" aria-hidden />
          <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-hutan-950/70 px-2.5 py-1 font-mono text-[10px] text-emas-200 backdrop-blur">
            memindai foto…
          </span>
        </div>
        <pre className="overflow-x-auto rounded-2xl bg-hutan-950 p-4 font-mono text-[12px] leading-relaxed text-white/80">
          <span className="text-white/40">{"{"}</span>
          {json.map(([k, v, c], i) => (
            <span key={k} className="block pl-3">
              <span className="text-hutan-300">&quot;{k}&quot;</span>: <span className={c}>{v}</span>
              {i < json.length - 1 ? "," : ""}
            </span>
          ))}
          <span className="text-white/40">{"}"}</span>
          <span className="mt-2 block font-semibold text-hutan-300">→ DISETUJUI</span>
        </pre>
      </div>
      <p className="-mt-3 text-xs text-stone-400">
        Putusan sungguhan: bukti tahap Pra-panen proyek padi Sidrap di BSC testnet. Foto: Undeka 11, Wikimedia Commons, CC BY-SA 4.0.
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-1.5 text-xs">
        <ScanEye className="size-4 text-hutan-500" aria-hidden />
        {["gemini-3.8-flash", "3.6-flash", "3.7-flash", "3.5-flash"].map((m, i) => (
          <span key={m} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-stone-400">→</span>}
            <span className={cn("rounded-full px-2 py-0.5 font-mono", i === 0 ? "bg-hutan-900 text-white" : "bg-krem-100 text-stone-600 ring-1 ring-krem-300")}>{m}</span>
          </span>
        ))}
        <span className="basis-full text-stone-500 sm:basis-auto">model cadangan otomatis saat sibuk atau kuota habis</span>
      </div>
    </Card>
  );
}

/* ================================================================ Open-Meteo */

const EXTREME_MM = 100; // sama dengan agent/src/weather.ts
const PLACES = [
  { name: "Sidrap", lat: -3.8833, lon: 119.7667 },
  { name: "Karo", lat: 3.1907, lon: 98.5083 },
  { name: "Kulon Progo", lat: -7.9539, lon: 110.2081 },
  { name: "Demak", lat: -6.8317, lon: 110.7236 },
];

type Daily = { time: string[]; precipitation_sum: (number | null)[]; temperature_2m_max: (number | null)[]; temperature_2m_min: (number | null)[] };

/** 14 hari terakhir dari Open-Meteo, parameter sama dengan agen (tanpa API key, CORS terbuka). */
function useWeather(lat: number, lon: number) {
  return useQuery({
    queryKey: ["open-meteo", lat, lon],
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const q = new URLSearchParams({
        latitude: lat.toFixed(4),
        longitude: lon.toFixed(4),
        daily: "precipitation_sum,temperature_2m_max,temperature_2m_min",
        past_days: "14",
        forecast_days: "1",
        timezone: "Asia/Jakarta",
      });
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`);
      if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
      const d = ((await res.json()) as { daily: Daily }).daily;
      const n = d.time.length - 1; // hari ini = indeks terakhir, tidak dihitung
      const days = d.time.slice(0, n).map((t, i) => ({ t, mm: d.precipitation_sum[i] ?? 0 }));
      const avg = (xs: (number | null)[]) => {
        const v = xs.slice(0, n).filter((x): x is number => x != null);
        return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
      };
      return {
        days,
        total: days.reduce((a, b) => a + b.mm, 0),
        max: Math.max(0, ...days.map((x) => x.mm)),
        tMax: avg(d.temperature_2m_max),
        tMin: avg(d.temperature_2m_min),
      };
    },
  });
}

export function OpenMeteoCard() {
  const [place, setPlace] = useState(0);
  const p = PLACES[place];
  const { data, isLoading, isError } = useWeather(p.lat, p.lon);
  const scale = Math.max(20, (data?.max ?? 0) * 1.15);
  const fmt = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: 1 });

  return (
    <Card className="flex h-full flex-col gap-6 p-6 sm:p-8">
      <PoweredBy items={[{ logo: "openmeteo", label: "Open-Meteo" }]} />
      <div>
        <p className="text-xs font-semibold tracking-[0.18em] text-emas-600 uppercase">Cuaca sebagai saksi · Open-Meteo</p>
        <h2 className="mt-2 font-display text-3xl font-semibold text-balance text-hutan-950">Klaim gagal panen dicek dengan data</h2>
        <p className="mt-2 text-pretty text-stone-600">
          Agen membaca curah hujan dan suhu 14 hari di koordinat lahan dari Open-Meteo (gratis, tanpa API key). Hujan di atas {EXTREME_MM}&nbsp;mm
          sehari ditandai ekstrem, jadi alasan gagal panen bisa diuji dengan data, bukan cuma cerita.
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Lokasi lahan">
        {PLACES.map((x, i) => (
          <button
            key={x.name}
            type="button"
            role="tab"
            aria-selected={i === place}
            onClick={() => setPlace(i)}
            className={cn(
              "rounded-full px-3 py-1 text-sm font-medium ring-1 transition",
              i === place ? "bg-hutan-900 text-white ring-hutan-900" : "bg-white text-stone-600 ring-krem-200 hover:bg-krem-100",
            )}
          >
            {x.name}
          </button>
        ))}
      </div>
      <div className="rounded-2xl bg-linear-to-b from-sky-50 to-white p-4 ring-1 ring-sky-100">
        {isError ? (
          <p className="py-10 text-center text-sm text-stone-500">Open-Meteo belum bisa dihubungi. Coba muat ulang.</p>
        ) : (
          <>
            <div className="flex h-32 items-end gap-1" aria-label={`Curah hujan harian 14 hari terakhir di ${p.name}`}>
              {(data?.days ?? Array.from({ length: 14 }, (_, i) => ({ t: String(i), mm: 0 }))).map((d) => (
                <div key={d.t} className="group relative flex h-full flex-1 flex-col justify-end">
                  <div
                    className={cn(
                      "rounded-t-md transition-[height] duration-700 ease-out",
                      isLoading ? "animate-pulse bg-sky-100" : d.mm > EXTREME_MM ? "bg-red-500" : "bg-linear-to-t from-sky-500 to-sky-300",
                    )}
                    style={{ height: isLoading ? "30%" : `${Math.max(2, (d.mm / scale) * 100)}%` }}
                  />
                  {!isLoading && (
                    <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 rounded bg-hutan-950 px-1.5 py-0.5 text-[10px] whitespace-nowrap text-white group-hover:block">
                      {fmt(d.mm)} mm
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-stone-400">
              <span>14 hari lalu</span>
              <span>kemarin</span>
            </div>
          </>
        )}
      </div>
      <dl className="mt-auto grid grid-cols-3 gap-3 text-center">
        {[
          { icon: CloudRain, k: "Total hujan", v: data ? `${fmt(data.total)} mm` : "…" },
          { icon: CloudRain, k: "Tertinggi/hari", v: data ? `${fmt(data.max)} mm` : "…", warn: data && data.max > EXTREME_MM },
          { icon: Thermometer, k: "Suhu rata-rata", v: data && data.tMin != null && data.tMax != null ? `${fmt(data.tMin)}–${fmt(data.tMax)}°C` : "…" },
        ].map(({ icon: Icon, k, v, warn }) => (
          <div key={k} className={cn("rounded-2xl p-3 ring-1", warn ? "bg-red-50 ring-red-200" : "bg-krem-50 ring-krem-200")}>
            <Icon className={cn("mx-auto size-4", warn ? "text-red-600" : "text-sky-600")} aria-hidden />
            <dd className="mt-1 font-semibold text-hutan-950">{v}</dd>
            <dt className="text-xs text-stone-500">{k}</dt>
          </div>
        ))}
      </dl>
      <p className="-mt-3 text-xs text-stone-400">Data langsung dari Open-Meteo saat halaman dibuka · koordinat lahan contoh di {p.name}</p>
    </Card>
  );
}
