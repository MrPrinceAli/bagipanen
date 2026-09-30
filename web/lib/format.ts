import { formatUnits, parseUnits } from "viem";
import { IDR_PER_USDT } from "./config";

export const USDT_DECIMALS = 18;

const numberFmt = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
const rupiahFmt = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

export function usdtToNumber(value: bigint): number {
  return Number(formatUnits(value, USDT_DECIMALS));
}

/** 1650000000000000000000n → "1.650" */
export function formatUsdt(value: bigint): string {
  return numberFmt.format(usdtToNumber(value));
}

/** Perkiraan rupiah dengan kurs tetap: 1000 USDT → "Rp16.000.000" */
export function formatRupiah(value: bigint): string {
  return `Rp${rupiahFmt.format(usdtToNumber(value) * IDR_PER_USDT)}`;
}

/**
 * Parse input pengguna format Indonesia ("1.000", "357,5", "1000") ke wei.
 * Titik = pemisah ribuan, koma = desimal. Mengembalikan null jika tidak valid.
 */
export function parseUsdtInput(input: string): bigint | null {
  const normalized = input.trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,18})?$/.test(normalized)) return null;
  try {
    return parseUnits(normalized, USDT_DECIMALS);
  } catch {
    return null;
  }
}

/** Kebalikan parseUsdtInput untuk mengisi kolom input: 357.5 USDT → "357,5" */
export function usdtToInput(value: bigint): string {
  return formatUnits(value, USDT_DECIMALS).replace(".", ",");
}

export function formatPercent(ratio: number): string {
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(ratio * 100)}%`;
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

const dateFmt = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" });
const dateTimeFmt = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

export function formatDate(unixSeconds: bigint | number): string {
  return dateFmt.format(new Date(Number(unixSeconds) * 1000));
}

export function formatDateTime(unixSeconds: bigint | number): string {
  return `${dateTimeFmt.format(new Date(Number(unixSeconds) * 1000))} WIB`;
}

/** Sisa waktu yang mudah dibaca: "8 menit lagi", "2 hari lagi", "sudah lewat". */
export function formatTimeLeft(deadlineUnix: bigint | number, nowMs = Date.now()): string {
  const secs = Number(deadlineUnix) - Math.floor(nowMs / 1000);
  if (secs <= 0) return "sudah lewat";
  if (secs < 60) return `${secs} detik lagi`;
  if (secs < 3600) return `${Math.ceil(secs / 60)} menit lagi`;
  if (secs < 86_400) return `${Math.ceil(secs / 3600)} jam lagi`;
  return `${Math.ceil(secs / 86_400)} hari lagi`;
}

export function formatArea(m2: number): string {
  if (m2 >= 10_000 || m2 % 1000 === 0) return `${numberFmt.format(m2 / 10_000)} ha (${numberFmt.format(m2)} m²)`;
  return `${numberFmt.format(m2)} m²`;
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
