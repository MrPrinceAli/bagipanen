import type { VerdictDocument } from "./types";

/** Ambang aturan putusan agen (PRD): keyakinan AI, jarak GPS, umur foto. */
const MIN_CONFIDENCE = 0.7;
const MAX_DISTANCE_KM = 2;
const MAX_AGE_DAYS = 7;

const lower = (v: string) => v.trim().toLowerCase();
const known = (v: string | undefined): v is string => Boolean(v && !/^(tidak (dikenali|diketahui|jelas)|unknown|-)$/i.test(v.trim()));
const km = (v: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(v);

export type VerdictContext = { commodity?: string; milestone?: string };

/**
 * Ringkasan putusan dalam bahasa sehari-hari, disusun dari data terstruktur di JSON putusan.
 * Gayanya sama dengan `summary_id` yang ditulis agen versi terbaru, sehingga putusan lama
 * (format "Ditolak: …; …") juga tampil natural. Jika datanya tidak lengkap, pakai `summary_id`.
 */
export function verdictText(v: VerdictDocument, ctx: VerdictContext = {}): string {
  const vision = v.vision ?? {};
  const extras: string[] = [];
  if (v.exif?.status === "missing") extras.push("Foto ini tidak menyimpan data GPS dan tanggal, jadi lokasinya belum bisa dicek otomatis.");
  if (v.weather?.extreme) extras.push("Ada peringatan hujan ekstrem di sekitar lahan.");
  const tail = extras.length ? ` ${extras.join(" ")}` : "";

  if (v.approved) {
    if (!known(vision.detected_stage) || !vision.plant_condition) return v.summary_id;
    const harvest = typeof vision.estimated_days_to_harvest === "number" ? `, perkiraan panen sekitar ${vision.estimated_days_to_harvest} hari lagi` : "";
    return `Foto diterima. Tanaman terlihat di fase ${lower(vision.detected_stage)} dengan kondisi ${vision.plant_condition}${harvest}.${tail}`;
  }

  const reasons: string[] = [];
  if (vision.is_farm_photo === false) reasons.push("Foto ini tidak terlihat seperti foto lahan pertanian.");
  if (vision.commodity_match === false) {
    const expected = ctx.commodity ? lower(ctx.commodity) : null;
    reasons.push(
      known(vision.detected_commodity)
        ? `Tanaman di foto terlihat seperti ${lower(vision.detected_commodity)}${expected ? `, bukan ${expected}` : ""}.`
        : `Jenis tanamannya tidak bisa dikenali${expected ? ` sebagai ${expected}` : ""}.`,
    );
  }
  if (vision.stage_match === false) {
    const expected = ctx.milestone ? `, padahal tahap ini ${lower(ctx.milestone)}` : "";
    reasons.push(known(vision.detected_stage) ? `Fase tanamannya ${lower(vision.detected_stage)}${expected}.` : `Fase tanamannya tidak bisa dipastikan${expected}.`);
  }
  if (typeof vision.confidence === "number" && vision.confidence < MIN_CONFIDENCE)
    reasons.push(`Agen kurang yakin dengan foto ini (${Math.round(vision.confidence * 100)}%, minimal ${MIN_CONFIDENCE * 100}%).`);
  if (v.exif?.status === "mismatch") {
    if (typeof v.exif.distanceKm === "number" && v.exif.distanceKm > MAX_DISTANCE_KM)
      reasons.push(`Lokasi foto ${km(v.exif.distanceKm)} km dari lahan, padahal batasnya ${MAX_DISTANCE_KM} km.`);
    else reasons.push(`Tanggal foto terlalu jauh dari waktu kirim (batasnya ${MAX_AGE_DAYS} hari).`);
  }
  if (v.duplicate) reasons.push("Foto yang sama sudah pernah dipakai di kampanye atau tahap lain.");
  if (reasons.length === 0) return v.summary_id;
  return `Foto ditolak. ${reasons.join(" ")}${tail}`;
}
