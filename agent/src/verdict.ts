import type { Address } from "viem";
import { type ExifCheck, toWibIso } from "./exif.js";
import type { VisionResult } from "./vision.js";
import type { WeatherCheck } from "./weather.js";

export const MIN_CONFIDENCE = 0.7;

export type Decision = { approved: boolean; reasons: string[] };

const lower = (v: string) => v.trim().toLowerCase();
/** Model kadang menjawab "tidak dikenali" / "unknown" alih-alih mengosongkan isian. */
const known = (v: string | undefined) => Boolean(v && !/^(tidak (dikenali|diketahui|jelas)|unknown|-)$/i.test(v.trim()));
const sentence = (v: string) => `${v.charAt(0).toUpperCase()}${v.slice(1)}.`;

/**
 * Aturan keputusan (PRD):
 *   approved = is_farm_photo && commodity_match && stage_match && confidence >= 0.70
 *              && exif.status != "mismatch" && !duplicate
 * Alasan ditulis sebagai kalimat utuh karena langsung tampil di UI.
 */
export function decide(vision: VisionResult, exif: ExifCheck, duplicate: boolean, milestoneName: string, commodity = "komoditas proyek ini"): Decision {
  const reasons: string[] = [];
  if (!vision.is_farm_photo) reasons.push("foto ini tidak terlihat seperti foto lahan pertanian");
  if (!vision.commodity_match)
    reasons.push(
      known(vision.detected_commodity)
        ? `tanaman di foto terlihat seperti ${lower(vision.detected_commodity)}, bukan ${lower(commodity)}`
        : `jenis tanamannya tidak bisa dikenali sebagai ${lower(commodity)}`,
    );
  if (!vision.stage_match)
    reasons.push(
      known(vision.detected_stage)
        ? `fase tanamannya ${lower(vision.detected_stage)}, padahal tahap ini ${lower(milestoneName)}`
        : `fase tanamannya tidak bisa dipastikan, padahal tahap ini ${lower(milestoneName)}`,
    );
  if (vision.confidence < MIN_CONFIDENCE)
    reasons.push(`agen kurang yakin dengan foto ini (${Math.round(vision.confidence * 100)}%, minimal ${Math.round(MIN_CONFIDENCE * 100)}%)`);
  if (exif.status === "mismatch") reasons.push(...exif.notes);
  if (duplicate) reasons.push("foto yang sama sudah pernah dipakai di proyek atau tahap lain");
  return { approved: reasons.length === 0, reasons };
}

/** Ringkasan untuk UI (`summary_id`), ditulis sebagai kalimat biasa. */
export function summarize(decision: Decision, vision: VisionResult, exif: ExifCheck, weather: WeatherCheck): string {
  const extras: string[] = [];
  if (exif.status === "missing") extras.push("Foto ini tidak menyimpan data GPS dan tanggal, jadi lokasinya belum bisa dicek otomatis.");
  if (weather.extreme) extras.push("Ada peringatan hujan ekstrem di sekitar lahan.");
  const tail = extras.length ? ` ${extras.join(" ")}` : "";
  if (decision.approved) {
    return `Foto diterima. Tanaman terlihat di fase ${lower(vision.detected_stage)} dengan kondisi ${vision.plant_condition}, perkiraan panen sekitar ${vision.estimated_days_to_harvest} hari lagi.${tail}`;
  }
  return `Foto ditolak. ${decision.reasons.map(sentence).join(" ")}${tail}`;
}

export type VerdictDocument = {
  schema: "bagipanen.verdict.v1";
  campaign: Address;
  milestoneIndex: number;
  attempt: number;
  proofCID: string;
  approved: boolean;
  summary_id: string;
  vision: VisionResult;
  exif: { status: ExifCheck["status"]; distanceKm: number | null; takenAt: string | null };
  weather: WeatherCheck;
  duplicate: boolean;
  agent: { registry: Address; agentId: string; model: string };
  decidedAt: string;
};

/** JSON putusan yang diunggah ke IPFS (format PRD `bagipanen.verdict.v1`). */
export function buildVerdictDocument(input: {
  campaign: Address;
  milestoneIndex: number;
  attempt: number;
  proofCID: string;
  decision: Decision;
  vision: VisionResult;
  exif: ExifCheck;
  weather: WeatherCheck;
  duplicate: boolean;
  agent: { registry: Address; agentId: bigint; model: string };
  now?: Date;
}): VerdictDocument {
  return {
    schema: "bagipanen.verdict.v1",
    campaign: input.campaign,
    milestoneIndex: input.milestoneIndex,
    attempt: input.attempt,
    proofCID: input.proofCID,
    approved: input.decision.approved,
    summary_id: summarize(input.decision, input.vision, input.exif, input.weather),
    vision: input.vision,
    exif: {
      status: input.exif.status,
      distanceKm: input.exif.distanceKm === null ? null : Math.round(input.exif.distanceKm * 100) / 100,
      takenAt: input.exif.takenAt,
    },
    weather: input.weather,
    duplicate: input.duplicate,
    agent: { registry: input.agent.registry, agentId: input.agent.agentId.toString(), model: input.agent.model },
    decidedAt: toWibIso(input.now ?? new Date()),
  };
}
