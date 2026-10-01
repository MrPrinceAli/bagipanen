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
  /** Model utama (untuk log). Model yang benar-benar menjawab dikembalikan oleh `assess`. */
  model: string;
  assess(photo: StoredFile, ctx: VisionContext): Promise<{ result: VisionResult; model: string }>;
};

/**
 * Coba model satu per satu sampai ada yang berhasil (mis. model utama sedang 503 "high demand",
 * menggantung, atau sudah tidak tersedia). Melempar galat terakhir jika semuanya gagal.
 */
export async function tryModels<T>(
  models: string[],
  run: (model: string) => Promise<T>,
  onFail?: (model: string, error: unknown) => void,
): Promise<{ value: T; model: string }> {
  let last: unknown = new Error("Tidak ada model Gemini yang dikonfigurasi.");
  for (const model of models) {
    try {
      return { value: await run(model), model };
    } catch (e) {
      last = e;
      onFail?.(model, e);
    }
  }
  throw last;
}

/**
 * Model yang kuotanya habis (429 RESOURCE_EXHAUSTED) dilewati sementara, supaya tiap bukti tidak
 * membuang satu panggilan (±3 detik) ke model yang pasti menolak. Jika semua model sedang
 * dilewati, semuanya tetap dicoba.
 */
export function quotaCooldown(ms: number, now: () => number = Date.now) {
  const until = new Map<string, number>();
  return {
    available: (models: string[]) => {
      const ready = models.filter((m) => (until.get(m) ?? 0) <= now());
      return ready.length > 0 ? ready : models;
    },
    /** Mengembalikan true jika model mulai dilewati. */
    note: (model: string, error: unknown) => {
      if (!describeGeminiError(error).startsWith("429")) return false;
      until.set(model, now() + ms);
      return true;
    },
  };
}

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
    return { result: mockAssess(photo, ctx), model: "mock-vision" };
  },
};

function mockAssess(photo: StoredFile, ctx: VisionContext): VisionResult {
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
        red_flags: ["ini bukan foto lahan tanaman yang diajukan (simulasi MockVision)"],
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
}

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

/** Ringkasan galat Gemini yang mudah dibaca, mis. "503 UNAVAILABLE" atau "timeout 45 dtk". */
export function describeGeminiError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/abort|timeout/i.test(msg) || (e as { name?: string })?.name === "TimeoutError") return "timeout";
  const code = msg.match(/"code":\s*(\d+)/)?.[1];
  const status = msg.match(/"status":\s*"([A-Z_]+)"/)?.[1];
  return code || status ? `${code ?? ""} ${status ?? ""}`.trim() : msg.slice(0, 120);
}

/**
 * Adapter Gemini (mode testnet): gambar dilampirkan, output JSON lewat `responseSchema`.
 * `models` = model utama lalu cadangan; tiap panggilan dibatasi `timeoutMs`.
 */
export function geminiVision(
  apiKey: string,
  models: string[],
  opts: { timeoutMs?: number; quotaCooldownMs?: number; onFallback?: (model: string, reason: string) => void } = {},
): VisionAdapter {
  const ai = new GoogleGenAI({ apiKey });
  const timeoutMs = opts.timeoutMs ?? 45_000;
  const cooldownMs = opts.quotaCooldownMs ?? 10 * 60_000;
  const cooldown = quotaCooldown(cooldownMs);
  return {
    name: "gemini",
    model: models[0],
    async assess(photo, ctx) {
      const { value, model } = await tryModels(
        cooldown.available(models),
        async (m) => {
          const response = await ai.models.generateContent({
            model: m,
            contents: createUserContent([
              createPartFromBase64(Buffer.from(photo.bytes).toString("base64"), photo.mimeType),
              buildUserPrompt(ctx),
            ]),
            config: {
              systemInstruction: SYSTEM_PROMPT,
              responseMimeType: "application/json",
              responseSchema: RESPONSE_SCHEMA,
              temperature: 0.2,
              abortSignal: AbortSignal.timeout(timeoutMs),
            },
          });
          if (!response.text) throw new Error("Gemini tidak mengembalikan jawaban.");
          return normalizeVision(JSON.parse(response.text));
        },
        (m, e) => {
          const skipped = cooldown.note(m, e);
          opts.onFallback?.(m, `${describeGeminiError(e)}${skipped ? `, dilewati ${Math.round(cooldownMs / 60_000)} menit` : ""}`);
        },
      );
      return { result: value, model };
    },
  };
}
