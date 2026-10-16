import { formatUnits, parseUnits } from "viem";
import { IDR_PER_USDT } from "./config";
import { getLang, locale, tr } from "./i18n";

export const USDT_DECIMALS = 18;

/** Formatter Intl per bahasa (dibuat sekali per locale). */
const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();
function nf(maximumFractionDigits: number): Intl.NumberFormat {
  const key = `n:${locale()}:${maximumFractionDigits}`;
  if (!cache.has(key)) cache.set(key, new Intl.NumberFormat(locale(), { maximumFractionDigits }));
  return cache.get(key) as Intl.NumberFormat;
}
function df(kind: "date" | "dateTime"): Intl.DateTimeFormat {
  const key = `d:${locale()}:${kind}`;
  if (!cache.has(key))
    cache.set(
      key,
      new Intl.DateTimeFormat(
        locale(),
        kind === "date"
          ? { dateStyle: "long", timeZone: "Asia/Jakarta" }
          : { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" },
      ),
    );
  return cache.get(key) as Intl.DateTimeFormat;
}

export function usdtToNumber(value: bigint): number {
  return Number(formatUnits(value, USDT_DECIMALS));
}

/** 1650000000000000000000n → "1.650" (ID) / "1,650" (EN) */
export function formatUsdt(value: bigint): string {
  return nf(2).format(usdtToNumber(value));
}

/** Angka biasa sesuai bahasa: 1560.5 → "1.560,5" (ID) / "1,560.5" (EN). */
export function formatNumber(value: number, maximumFractionDigits = 2): string {
  return nf(maximumFractionDigits).format(value);
}

/** Perkiraan rupiah dengan kurs tetap: 1000 USDT → "Rp16.000.000" */
export function formatRupiah(value: bigint): string {
  return `Rp${nf(0).format(usdtToNumber(value) * IDR_PER_USDT)}`;
}

/**
 * Parse input pengguna ke wei, sesuai bahasa: ID "1.000" / "357,5" (titik = ribuan, koma = desimal),
 * EN "1,000" / "357.5" (koma = ribuan, titik = desimal). Mengembalikan null jika tidak valid.
 */
export function parseUsdtInput(input: string): bigint | null {
  const compact = input.trim().replace(/\s/g, "");
  const normalized = getLang() === "en" ? compact.replace(/,/g, "") : compact.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,18})?$/.test(normalized)) return null;
  try {
    return parseUnits(normalized, USDT_DECIMALS);
  } catch {
    return null;
  }
}

/** Kebalikan parseUsdtInput untuk mengisi kolom input: 357.5 USDT → "357,5" (ID) / "357.5" (EN) */
export function usdtToInput(value: bigint): string {
  const plain = formatUnits(value, USDT_DECIMALS);
  return getLang() === "en" ? plain : plain.replace(".", ",");
}

export function formatPercent(ratio: number): string {
  return `${nf(1).format(ratio * 100)}%`;
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

export function formatDate(unixSeconds: bigint | number): string {
  return df("date").format(new Date(Number(unixSeconds) * 1000));
}

export function formatDateTime(unixSeconds: bigint | number): string {
  return `${df("dateTime").format(new Date(Number(unixSeconds) * 1000))} WIB`;
}

/** Sisa waktu yang mudah dibaca: "8 menit lagi" / "8 minutes left", "sudah lewat" / "passed". */
export function formatTimeLeft(deadlineUnix: bigint | number, nowMs = Date.now()): string {
  const secs = Number(deadlineUnix) - Math.floor(nowMs / 1000);
  const left = (n: number, idUnit: string, enUnit: string) => tr(`${n} ${idUnit} lagi`, `${n} ${enUnit}${n === 1 ? "" : "s"} left`);
  if (secs <= 0) return tr("sudah lewat", "passed");
  if (secs < 60) return left(secs, "detik", "second");
  if (secs < 3600) return left(Math.ceil(secs / 60), "menit", "minute");
  if (secs < 86_400) return left(Math.ceil(secs / 3600), "jam", "hour");
  return left(Math.ceil(secs / 86_400), "hari", "day");
}

export function formatArea(m2: number): string {
  if (m2 >= 10_000 || m2 % 1000 === 0) return `${nf(2).format(m2 / 10_000)} ha (${nf(2).format(m2)} m²)`;
  return `${nf(2).format(m2)} m²`;
}

/** Koordinat x1e6 → derajat desimal. */
export function e6ToDeg(v: number): number {
  return v / 1_000_000;
}

export function googleMapsUrl(latE6: number, lonE6: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${e6ToDeg(latE6)},${e6ToDeg(lonE6)}`;
}

/**
 * Proyeksi imbal hasil investor dari estimasi penjualan (aturan bagi hasil PRD:
 * modal kembali dulu, keuntungan 55% petani / 40% investor / 5% cadangan).
 */
export function projectedInvestorReturn(target: bigint, estimatedRevenue: bigint): number {
  if (target === 0n) return 0;
  let pool = estimatedRevenue;
  if (estimatedRevenue >= target) {
    const profit = estimatedRevenue - target;
    pool = estimatedRevenue - (profit * 5_500n) / 10_000n - (profit * 500n) / 10_000n;
  }
  return usdtToNumber(pool - target) / usdtToNumber(target);
}
