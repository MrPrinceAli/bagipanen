import { formatNumber } from "./format";
import { tr, trTerm } from "./i18n";
import type { VerdictDocument } from "./types";

/** Ambang aturan putusan agen (PRD): keyakinan AI, jarak GPS, umur foto. */
const MIN_CONFIDENCE = 0.7;
const MAX_DISTANCE_KM = 2;
const MAX_AGE_DAYS = 7;

const lower = (v: string) => v.trim().toLowerCase();
const known = (v: string | undefined): v is string => Boolean(v && !/^(tidak (dikenali|diketahui|jelas)|unknown|-)$/i.test(v.trim()));
/** Istilah dari Gemini/kontrak (komoditas, fase, kondisi) dalam bahasa aktif, huruf kecil. */
const term = (v: string) => lower(trTerm(v.trim()));

export type VerdictContext = { commodity?: string; milestone?: string };

/**
 * Ringkasan putusan dalam bahasa sehari-hari (ID/EN), disusun dari data terstruktur di JSON putusan.
 * Gayanya sama dengan `summary_id` yang ditulis agen versi terbaru, sehingga putusan lama
 * (format "Ditolak: …; …") juga tampil natural. Jika datanya tidak lengkap, pakai `summary_id`
 * (ID) atau kalimat umum (EN, karena agen hanya menulis ringkasan berbahasa Indonesia).
 */
export function verdictText(v: VerdictDocument, ctx: VerdictContext = {}): string {
  const vision = v.vision ?? {};
  const extras: string[] = [];
  if (v.exif?.status === "missing")
    extras.push(
      tr(
        "Foto ini tidak menyimpan data GPS dan tanggal, jadi lokasinya belum bisa dicek otomatis.",
        "This photo has no GPS or date data, so its location can't be checked automatically.",
      ),
    );
  if (v.weather?.extreme) extras.push(tr("Ada peringatan hujan ekstrem di sekitar lahan.", "There's an extreme rainfall warning around the field."));
  const tail = extras.length ? ` ${extras.join(" ")}` : "";
  const fallback = () => tr(v.summary_id, `${v.approved ? "Photo approved." : "Photo rejected."}${tail}`);

  if (v.approved) {
    if (!known(vision.detected_stage) || !vision.plant_condition) return fallback();
    const days = vision.estimated_days_to_harvest;
    const harvest =
      typeof days === "number" ? tr(`, perkiraan panen sekitar ${days} hari lagi`, `, with harvest expected in about ${days} days`) : "";
    return tr(
      `Foto diterima. Tanaman terlihat di fase ${term(vision.detected_stage)} dengan kondisi ${vision.plant_condition}${harvest}.${tail}`,
      `Photo approved. The crop is at the ${term(vision.detected_stage)} stage in ${term(vision.plant_condition)} condition${harvest}.${tail}`,
    );
  }

  const reasons: string[] = [];
  if (vision.is_farm_photo === false) reasons.push(tr("Foto ini tidak terlihat seperti foto lahan pertanian.", "This doesn't look like a photo of farmland."));
  if (vision.commodity_match === false) {
    const expected = ctx.commodity ? term(ctx.commodity) : null;
    reasons.push(
      known(vision.detected_commodity)
        ? tr(
            `Tanaman di foto terlihat seperti ${term(vision.detected_commodity)}${expected ? `, bukan ${expected}` : ""}.`,
            `The crop in the photo looks like ${term(vision.detected_commodity)}${expected ? `, not ${expected}` : ""}.`,
          )
        : tr(
            `Jenis tanamannya tidak bisa dikenali${expected ? ` sebagai ${expected}` : ""}.`,
            `The crop couldn't be recognized${expected ? ` as ${expected}` : ""}.`,
          ),
    );
  }
  if (vision.stage_match === false) {
    const stage = ctx.milestone ? term(ctx.milestone) : null;
    reasons.push(
      known(vision.detected_stage)
        ? tr(
            `Fase tanamannya ${term(vision.detected_stage)}${stage ? `, padahal tahap ini ${stage}` : ""}.`,
            `The crop is at the ${term(vision.detected_stage)} stage${stage ? `, but this is the ${stage} stage` : ""}.`,
          )
        : tr(
            `Fase tanamannya tidak bisa dipastikan${stage ? `, padahal tahap ini ${stage}` : ""}.`,
            `The crop's growth stage couldn't be confirmed${stage ? ` for the ${stage} stage` : ""}.`,
          ),
    );
  }
  if (typeof vision.confidence === "number" && vision.confidence < MIN_CONFIDENCE) {
    const pct = Math.round(vision.confidence * 100);
    reasons.push(
      tr(
        `Agen kurang yakin dengan foto ini (${pct}%, minimal ${MIN_CONFIDENCE * 100}%).`,
        `The agent isn't confident enough about this photo (${pct}%, minimum ${MIN_CONFIDENCE * 100}%).`,
      ),
    );
  }
  if (v.exif?.status === "mismatch") {
    if (typeof v.exif.distanceKm === "number" && v.exif.distanceKm > MAX_DISTANCE_KM) {
      const km = formatNumber(v.exif.distanceKm, 1);
      reasons.push(
        tr(
          `Lokasi foto ${km} km dari lahan, padahal batasnya ${MAX_DISTANCE_KM} km.`,
          `The photo was taken ${km} km from the field, but the limit is ${MAX_DISTANCE_KM} km.`,
        ),
      );
    } else
      reasons.push(
        tr(
          `Tanggal foto terlalu jauh dari waktu kirim (batasnya ${MAX_AGE_DAYS} hari).`,
          `The photo was taken too long before it was sent (the limit is ${MAX_AGE_DAYS} days).`,
        ),
      );
  }
  if (v.duplicate) reasons.push(tr("Foto yang sama sudah pernah dipakai di proyek atau tahap lain.", "The same photo was already used in another project or stage."));
  if (reasons.length === 0) return fallback();
  return `${tr("Foto ditolak.", "Photo rejected.")} ${reasons.join(" ")}${tail}`;
}
