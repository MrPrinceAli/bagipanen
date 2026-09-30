import type { Address } from "viem";
import { type ExifCheck, toWibIso } from "./exif.js";
import type { VisionResult } from "./vision.js";
import type { WeatherCheck } from "./weather.js";

export const MIN_CONFIDENCE = 0.7;

export type Decision = { approved: boolean; reasons: string[] };

const dec = (v: number) => new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

/**
 * Aturan keputusan (PRD):
 *   approved = is_farm_photo && commodity_match && stage_match && confidence >= 0.70
 *              && exif.status != "mismatch" && !duplicate
 */
export function decide(vision: VisionResult, exif: ExifCheck, duplicate: boolean, milestoneName: string): Decision {
  const reasons: string[] = [];
  if (!vision.is_farm_photo) reasons.push("bukan foto lahan pertanian");
  if (!vision.commodity_match) reasons.push(`komoditas tidak sesuai (terdeteksi: ${vision.detected_commodity || "tidak dikenali"})`);
  if (!vision.stage_match) reasons.push(`fase tidak sesuai (terdeteksi ${vision.detected_stage}, seharusnya ${milestoneName})`);
  if (vision.confidence < MIN_CONFIDENCE) reasons.push(`keyakinan AI ${dec(vision.confidence)} di bawah ${dec(MIN_CONFIDENCE)}`);
  if (exif.status === "mismatch") reasons.push(...exif.notes);
  if (duplicate) reasons.push("foto sama dengan bukti kampanye/milestone lain");
  return { approved: reasons.length === 0, reasons };
}

/** Ringkasan satu kalimat untuk UI (`summary_id`). */
export function summarize(decision: Decision, vision: VisionResult, exif: ExifCheck, weather: WeatherCheck): string {
  const extras: string[] = [];
  if (exif.status === "missing") extras.push("EXIF tidak ada (dicatat)");
  if (weather.extreme) extras.push("peringatan cuaca ekstrem");
  const tail = extras.length ? ` Catatan: ${extras.join("; ")}.` : "";
  if (decision.approved) {
    return `Disetujui: fase ${vision.detected_stage.toLowerCase()}, kondisi ${vision.plant_condition}, perkiraan panen ±${vision.estimated_days_to_harvest} hari lagi.${tail}`;
  }
  return `Ditolak: ${decision.reasons.join("; ")}.${tail}`;
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
