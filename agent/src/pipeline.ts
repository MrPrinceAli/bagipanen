import type { Hash } from "viem";
import { type CampaignData, isCampaign, type ProofLog, readAgentConfig, readCampaign, recordVerdict } from "./chain.js";
import { config } from "./config.js";
import { evaluateExif, readExif } from "./exif.js";
import { sha256Hex, type Storage } from "./ipfs.js";
import { fmt, log, shortAddr, shortHash } from "./log.js";
import type { SeenHashes } from "./state.js";
import { buildVerdictDocument, decide } from "./verdict.js";
import type { VisionAdapter } from "./vision.js";
import { getWeather, weatherText } from "./weather.js";

const STATUS_ACTIVE = 2;
const MSTATUS_PROOF_SUBMITTED = 1;

export type Outcome =
  | { kind: "skipped"; reason: string }
  | { kind: "decided"; approved: boolean; txHash: Hash; reasonCID: string };

type Deps = { storage: Storage; vision: VisionAdapter; seen: SeenHashes };

const harvestFmt = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" });
const n1 = (v: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(v);
const n2 = (v: number) => v.toFixed(2);

/**
 * Idempoten: bukti hanya dinilai jika milestone di kontrak masih menunggu putusan AI
 * untuk percobaan yang sama. Mengembalikan alasan dilewati, atau null jika masih relevan.
 */
export function pendingReason({ summary, milestones }: CampaignData, p: ProofLog): string | null {
  const m = milestones[p.index];
  if (!m) return "milestone tidak ditemukan";
  if (summary.status !== STATUS_ACTIVE) return "kampanye tidak lagi berstatus Berjalan";
  if (summary.currentMilestone !== p.index) return `milestone ${m.name} sudah selesai`;
  if (m.attempts !== p.attempt) return `percobaan ${p.attempt} sudah digantikan percobaan ${m.attempts}`;
  if (m.aiDecided) return "sudah diputus agen";
  if (m.status !== MSTATUS_PROOF_SUBMITTED) return "status milestone bukan 'Bukti dikirim'";
  if (m.proofCID !== p.cid) return "CID bukti di kontrak berbeda";
  return null;
}

/** Pipeline 7 langkah untuk satu bukti (PRD, Spesifikasi agen AI). */
export async function processProof(p: ProofLog, { storage, vision, seen }: Deps): Promise<Outcome> {
  if (!(await isCampaign(p.campaign))) return { kind: "skipped", reason: `${shortAddr(p.campaign)} bukan kampanye BagiPanen` };

  // 1. Konteks dari kontrak
  const data = await readCampaign(p.campaign);
  const stale = pendingReason(data, p);
  const m = data.milestones[p.index];
  const label = `Kampanye ${shortAddr(p.campaign)} milestone ${m?.name ?? `#${p.index + 1}`} (percobaan ${p.attempt})`;
  if (stale) return { kind: "skipped", reason: `${label}: ${stale}` };
  const { summary } = data;
  log("BUKTI", label);

  // 2. Unduh foto + SHA-256
  const photo = await storage.getFile(p.cid);
  const hash = sha256Hex(photo.bytes);
  log("FOTO", `${n1(photo.bytes.byteLength / 1024)} KB, sha256 ${hash.slice(0, 12)}…${photo.fileName ? `, file "${photo.fileName}"` : ""}`);

  // 3. Cek duplikat
  const dup = seen.findDuplicate(hash, p.campaign, p.index);
  if (dup) log("FOTO", fmt.red(`duplikat: sudah dipakai di kampanye ${shortAddr(dup.campaign)} milestone #${dup.milestoneIndex + 1}`));

  // 4. EXIF: GPS ≤ 2 km, tanggal ≤ 7 hari
  const farm = { latitude: summary.latE6 / 1e6, longitude: summary.lonE6 / 1e6 };
  const exif = evaluateExif(await readExif(photo.bytes), farm, Number(m.submittedAt));
  const exifDetail = [
    exif.distanceKm !== null ? `GPS ${n1(exif.distanceKm)} km dari lahan` : null,
    exif.takenAt ? `diambil ${exif.takenAt}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  log("EXIF", `${exif.status}${exifDetail ? ` (${exifDetail})` : ""}${exif.status === "mismatch" ? ` — ${exif.notes.join("; ")}` : ""}`);

  // 5. Cuaca Open-Meteo
  const weather = await getWeather(farm.latitude, farm.longitude, config.mode === "local");
  log("CUACA", `14 hari: ${weatherText(weather)}`);

  // 6. Nilai foto (MockVision / Gemini)
  const daysToHarvest = Math.ceil((Number(summary.expectedHarvestDate) - Date.now() / 1000) / 86_400);
  const result = await vision.assess(photo, {
    commodity: summary.commodity,
    locationName: summary.locationName,
    milestoneName: m.name,
    expectedHarvestDate: harvestFmt.format(new Date(Number(summary.expectedHarvestDate) * 1000)),
    daysToHarvest,
    weatherSummary: weatherText(weather),
  });
  log("AI", `${result.detected_commodity}, fase ${result.detected_stage}, kondisi ${result.plant_condition}, yakin ${n2(result.confidence)} (${vision.model})`);

  // 7. JSON putusan → IPFS → recordVerdict
  const decision = decide(result, exif, dup !== null, m.name);
  const agent = await readAgentConfig();
  const doc = buildVerdictDocument({
    campaign: p.campaign,
    milestoneIndex: p.index,
    attempt: p.attempt,
    proofCID: p.cid,
    decision,
    vision: result,
    exif,
    weather,
    duplicate: dup !== null,
    agent: { registry: agent.identityRegistry, agentId: agent.agentId, model: vision.model },
  });
  const reasonCID = await storage.putJson(doc, `verdict-${p.campaign.slice(2, 10)}-m${p.index + 1}-a${p.attempt}.json`);

  const recheck = pendingReason(await readCampaign(p.campaign), p);
  if (recheck) return { kind: "skipped", reason: `${label}: ${recheck}` };
  const txHash = await recordVerdict(p.campaign, decision.approved, reasonCID);
  seen.add(hash, { campaign: p.campaign, milestoneIndex: p.index, attempt: p.attempt });

  const verdictText = decision.approved ? fmt.green("DISETUJUI") : fmt.red("DITOLAK");
  log("PUTUSAN", `${verdictText} → tx ${shortHash(txHash)} · ${doc.summary_id}`);
  return { kind: "decided", approved: decision.approved, txHash, reasonCID };
}
