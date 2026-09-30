/** Cuaca dari Open-Meteo (gratis, tanpa API key). */

export const EXTREME_DAILY_PRECIP_MM = 100;

export type WeatherCheck = {
  precip14dMm: number;
  maxDailyPrecipMm: number;
  extreme: boolean;
  tempMaxC: number | null;
  tempMinC: number | null;
  source: "open-meteo" | "static";
};

type Daily = {
  time: string[];
  precipitation_sum: (number | null)[];
  temperature_2m_max: (number | null)[];
  temperature_2m_min: (number | null)[];
};

export function openMeteoUrl(latitude: number, longitude: number): string {
  const q = new URLSearchParams({
    latitude: latitude.toFixed(6),
    longitude: longitude.toFixed(6),
    daily: "precipitation_sum,temperature_2m_max,temperature_2m_min",
    past_days: "14",
    forecast_days: "7",
    timezone: "Asia/Jakarta",
  });
  return `https://api.open-meteo.com/v1/forecast?${q}`;
}

/** Tanggal hari ini (YYYY-MM-DD) di zona WIB. */
export function todayWib(now = new Date()): string {
  return new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Ringkas data harian: curah hujan 14 hari terakhir (sebelum hari ini), maksimum harian,
 * dan tanda `extreme` jika ada hari (lalu maupun prakiraan) dengan hujan > 100 mm.
 */
export function summarizeDaily(daily: Daily, today: string): WeatherCheck {
  const past: number[] = [];
  const all: number[] = [];
  const maxT: number[] = [];
  const minT: number[] = [];
  daily.time.forEach((day, i) => {
    const p = daily.precipitation_sum[i] ?? 0;
    all.push(p);
    if (day < today) {
      past.push(p);
      if (daily.temperature_2m_max[i] != null) maxT.push(daily.temperature_2m_max[i]!);
      if (daily.temperature_2m_min[i] != null) minT.push(daily.temperature_2m_min[i]!);
    }
  });
  const avg = (xs: number[]) => (xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  return {
    precip14dMm: round1(past.reduce((a, b) => a + b, 0)),
    maxDailyPrecipMm: round1(past.length ? Math.max(...past) : 0),
    extreme: all.some((p) => p > EXTREME_DAILY_PRECIP_MM),
    tempMaxC: avg(maxT),
    tempMinC: avg(minT),
    source: "open-meteo",
  };
}

/** Data statis dipakai di mode lokal jika Open-Meteo tidak bisa dihubungi (offline). */
export const STATIC_WEATHER: WeatherCheck = {
  precip14dMm: 86.2,
  maxDailyPrecipMm: 24.1,
  extreme: false,
  tempMaxC: 27,
  tempMinC: 17,
  source: "static",
};

export async function getWeather(latitude: number, longitude: number, allowStaticFallback: boolean): Promise<WeatherCheck> {
  try {
    const res = await fetch(openMeteoUrl(latitude, longitude), { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`Open-Meteo membalas HTTP ${res.status}`);
    const body = (await res.json()) as { daily?: Daily };
    if (!body.daily?.time) throw new Error("Respons Open-Meteo tidak berisi data harian");
    return summarizeDaily(body.daily, todayWib());
  } catch (e) {
    if (allowStaticFallback) return STATIC_WEATHER;
    throw e;
  }
}

const n = (v: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(v);

/** Ringkasan satu kalimat untuk prompt Gemini & log. */
export function weatherText(w: WeatherCheck): string {
  const temp = w.tempMinC !== null && w.tempMaxC !== null ? `, suhu rata-rata ${n(w.tempMinC)}–${n(w.tempMaxC)}°C` : "";
  const extreme = w.extreme ? ", ADA hari dengan hujan ekstrem (>100 mm)" : "";
  const src = w.source === "static" ? " (data statis, offline)" : "";
  return `total hujan ${n(w.precip14dMm)} mm, maksimum ${n(w.maxDailyPrecipMm)} mm/hari${temp}${extreme}${src}`;
}
