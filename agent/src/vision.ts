import { createPartFromBase64, createUserContent, GoogleGenAI, type Schema, Type } from "@google/genai";
import type { StoredFile } from "./ipfs.js";

/** Output penilaian foto (skema PRD, sama untuk MockVision dan Gemini). */
export type VisionResult = {
  is_farm_photo: boolean;
  commodity_match: boolean;
  detected_commodity: string;
  detected_stage: string;
  stage_match: boolean;
  plant_condition: "baik" | "sedang" | "buruk";
  confidence: number;
  estimated_days_to_harvest: number;
  reason_id: string;
  red_flags: string[];
};

export type VisionContext = {
  commodity: string;
  locationName: string;
  milestoneName: string;
  /** Perkiraan panen, sudah diformat (mis. "28 Januari 2027"). */
  expectedHarvestDate: string;
  daysToHarvest: number;
  weatherSummary: string;
};

export type VisionAdapter = {
  name: "mock-vision" | "gemini";
  model: string;
  assess(photo: StoredFile, ctx: VisionContext): Promise<VisionResult>;
};

/** Prompt sistem (PRD, Spesifikasi agen AI). */
export const SYSTEM_PROMPT =
  "Kamu adalah verifikator lapangan pertanian yang teliti dan skeptis untuk platform BagiPanen.";

/** Prompt pengguna dengan konteks kampanye (PRD, Spesifikasi agen AI). */
export function buildUserPrompt(ctx: VisionContext): string {
  return [
    `Konteks kampanye: komoditas ${ctx.commodity}, lokasi ${ctx.locationName}, milestone "${ctx.milestoneName}"`,
    "(Tanam = bibit baru ditanam/lahan baru diolah; Tumbuh = tanaman vegetatif, daun berkembang;",
    `Pra-panen = tanaman berbunga/berbuah, mendekati panen). Perkiraan panen: ${ctx.expectedHarvestDate}.`,
    `Ringkasan cuaca 14 hari terakhir: ${ctx.weatherSummary}.`,
    "Nilai foto terlampir. Jangan menyetujui foto yang bukan lahan pertanian, foto layar, gambar dari",
    "internet, atau tanaman yang tidak sesuai komoditas. Balas HANYA JSON valid sesuai skema, tanpa teks lain.",
  ].join("\n");
}

/** Skema structured output Gemini (`responseSchema`), sesuai skema output PRD. */
export const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    is_farm_photo: { type: Type.BOOLEAN },
    commodity_match: { type: Type.BOOLEAN },
    detected_commodity: { type: Type.STRING },
    detected_stage: { type: Type.STRING, enum: ["Tanam", "Tumbuh", "Pra-panen", "Tidak diketahui"] },
    stage_match: { type: Type.BOOLEAN },
    plant_condition: { type: Type.STRING, enum: ["baik", "sedang", "buruk"] },
    confidence: { type: Type.NUMBER, minimum: 0, maximum: 1 },
    estimated_days_to_harvest: { type: Type.INTEGER },
    reason_id: { type: Type.STRING },
    red_flags: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: [
    "is_farm_photo",
    "commodity_match",
    "detected_commodity",
    "detected_stage",
    "stage_match",
    "plant_condition",
    "confidence",
    "estimated_days_to_harvest",
    "reason_id",
    "red_flags",
  ],
  propertyOrdering: [
    "is_farm_photo",
    "commodity_match",
    "detected_commodity",
    "detected_stage",
    "stage_match",
    "plant_condition",
    "confidence",
    "estimated_days_to_harvest",
    "reason_id",
    "red_flags",
  ],
};

/** Kata di nama file yang membuat MockVision menolak (PRD: "salah" atau "tolak"). */
export const MOCK_REJECT_PATTERN = /salah|tolak/i;

/**
 * MockVision (mode lokal): menyetujui, kecuali nama file mengandung "salah" atau "tolak".
 * Format output sama persis dengan Gemini, sehingga pipeline lain tidak berubah.
 */
export const mockVision: VisionAdapter = {
  name: "mock-vision",
  model: "mock-vision",
  async assess(photo, ctx) {
    const days = Math.max(0, ctx.daysToHarvest);
    if (photo.fileName && MOCK_REJECT_PATTERN.test(photo.fileName)) {
      return {
        is_farm_photo: false,
        commodity_match: false,
        detected_commodity: "tidak dikenali",
        detected_stage: "Tidak diketahui",
        stage_match: false,
        plant_condition: "buruk",
        confidence: 0.2,
        estimated_days_to_harvest: days,
        reason_id: `Simulasi MockVision: nama file "${photo.fileName}" menandai foto yang tidak sesuai (mis. foto layar atau tanaman lain), bukan ${ctx.commodity.toLowerCase()} fase ${ctx.milestoneName}.`,
        red_flags: ["bukan foto lahan komoditas yang diajukan (simulasi MockVision)"],
      };
    }
    return {
      is_farm_photo: true,
      commodity_match: true,
      detected_commodity: ctx.commodity.toLowerCase(),
      detected_stage: ctx.milestoneName,
      stage_match: true,
      plant_condition: "baik",
      confidence: 0.9,
      estimated_days_to_harvest: days,
      reason_id: `Simulasi MockVision: foto dianggap lahan ${ctx.commodity.toLowerCase()} fase ${ctx.milestoneName}, kondisi baik.`,
      red_flags: [],
    };
  },
};

/** Normalisasi & validasi output model agar selalu sesuai skema. */
export function normalizeVision(raw: unknown): VisionResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  const bool = (k: string) => r[k] === true;
  const str = (k: string, d = "") => (typeof r[k] === "string" ? (r[k] as string) : d);
  const num = (k: string, d = 0) => (typeof r[k] === "number" && Number.isFinite(r[k]) ? (r[k] as number) : d);
  const cond = str("plant_condition");
  return {
    is_farm_photo: bool("is_farm_photo"),
    commodity_match: bool("commodity_match"),
    detected_commodity: str("detected_commodity"),
    detected_stage: str("detected_stage", "Tidak diketahui"),
    stage_match: bool("stage_match"),
    plant_condition: cond === "baik" || cond === "sedang" || cond === "buruk" ? cond : "buruk",
    confidence: Math.min(1, Math.max(0, num("confidence"))),
    estimated_days_to_harvest: Math.max(0, Math.round(num("estimated_days_to_harvest"))),
    reason_id: str("reason_id"),
    red_flags: Array.isArray(r.red_flags) ? r.red_flags.filter((x): x is string => typeof x === "string") : [],
  };
}

/** Adapter Gemini (mode testnet): gambar dilampirkan, output JSON lewat `responseSchema`. */
export function geminiVision(apiKey: string, model: string): VisionAdapter {
  const ai = new GoogleGenAI({ apiKey });
  return {
    name: "gemini",
    model,
    async assess(photo, ctx) {
      const response = await ai.models.generateContent({
        model,
        contents: createUserContent([
          createPartFromBase64(Buffer.from(photo.bytes).toString("base64"), photo.mimeType),
          buildUserPrompt(ctx),
        ]),
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.2,
        },
      });
      if (!response.text) throw new Error("Gemini tidak mengembalikan jawaban.");
      return normalizeVision(JSON.parse(response.text));
    },
  };
}
