import exifr from "exifr";

export const MAX_DISTANCE_KM = 2;
export const MAX_AGE_DAYS = 7;

export type ExifData = { latitude?: number; longitude?: number; takenAt?: Date };

export type ExifCheck = {
  status: "ok" | "missing" | "mismatch";
  distanceKm: number | null;
  takenAt: string | null;
  /** Catatan berbahasa Indonesia untuk alasan putusan. */
  notes: string[];
};

/** Baca GPS & DateTimeOriginal dari foto. Foto tanpa EXIF → objek kosong (bukan error). */
export async function readExif(bytes: Uint8Array): Promise<ExifData> {
  const buf = Buffer.from(bytes);
  const [gps, tags] = await Promise.all([
    exifr.gps(buf).catch(() => undefined),
    exifr.parse(buf, ["DateTimeOriginal", "CreateDate"]).catch(() => undefined),
  ]);
  const out: ExifData = {};
  if (gps && Number.isFinite(gps.latitude) && Number.isFinite(gps.longitude)) {
    out.latitude = gps.latitude;
    out.longitude = gps.longitude;
  }
  const date = (tags?.DateTimeOriginal ?? tags?.CreateDate) as Date | undefined;
  if (date instanceof Date && !Number.isNaN(date.getTime())) out.takenAt = date;
  return out;
}

/** Jarak dua titik di permukaan bumi (km), rumus haversine. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371.0088;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Tanggal dalam format ISO berzona WIB, mis. "2026-10-03T08:12:00+07:00". */
export function toWibIso(date: Date): string {
  return `${new Date(date.getTime() + 7 * 3600_000).toISOString().slice(0, 19)}+07:00`;
}

const km = (v: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(v);

/**
 * Aturan PRD: jarak GPS ke koordinat lahan ≤ 2 km dan tanggal foto ≤ 7 hari dari waktu submit.
 * - Tidak ada GPS maupun tanggal → `missing` (tidak langsung ditolak, hanya dicatat).
 * - Ada tapi tidak cocok → `mismatch` (ditolak).
 * - Hanya satu yang ada dan cocok → `ok`, dengan catatan bagian yang tidak ada.
 */
export function evaluateExif(
  data: ExifData,
  farm: { latitude: number; longitude: number },
  submittedAtUnix: number,
): ExifCheck {
  const hasGps = data.latitude !== undefined && data.longitude !== undefined;
  const hasDate = data.takenAt !== undefined;
  const notes: string[] = [];
  const distanceKm = hasGps ? haversineKm(data.latitude!, data.longitude!, farm.latitude, farm.longitude) : null;
  const takenAt = hasDate ? toWibIso(data.takenAt!) : null;

  if (!hasGps && !hasDate) {
    return { status: "missing", distanceKm: null, takenAt: null, notes: ["foto tidak menyimpan data GPS dan tanggal"] };
  }

  let mismatch = false;
  if (distanceKm !== null && distanceKm > MAX_DISTANCE_KM) {
    mismatch = true;
    notes.push(`lokasi foto ${km(distanceKm)} km dari lahan, padahal batasnya ${MAX_DISTANCE_KM} km`);
  }
  if (hasDate) {
    const ageDays = Math.abs(submittedAtUnix - data.takenAt!.getTime() / 1000) / 86_400;
    if (ageDays > MAX_AGE_DAYS) {
      mismatch = true;
      notes.push(`tanggal foto berselisih ${km(ageDays)} hari dari waktu kirim, padahal batasnya ${MAX_AGE_DAYS} hari`);
    }
  }
  if (!hasGps) notes.push("foto tidak menyimpan data GPS");
  if (!hasDate) notes.push("foto tidak menyimpan tanggal");
  return { status: mismatch ? "mismatch" : "ok", distanceKm, takenAt, notes };
}
