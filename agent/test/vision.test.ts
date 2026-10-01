import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildUserPrompt, describeGeminiError, mockVision, normalizeVision, quotaCooldown, RESPONSE_SCHEMA, tryModels, type VisionContext } from "../src/vision.js";

const ctx: VisionContext = {
  commodity: "Cabai merah",
  locationName: "Cikajang, Garut",
  milestoneName: "Tanam",
  expectedHarvestDate: "28 Januari 2027",
  daysToHarvest: 120,
  weatherSummary: "total hujan 86,2 mm",
};
const photo = (fileName?: string) => ({ bytes: new Uint8Array([1, 2, 3]), mimeType: "image/jpeg", fileName });

describe("MockVision", () => {
  it("menyetujui foto dengan nama biasa", async () => {
    const { result: r, model } = await mockVision.assess(photo("cabai-tanam.jpg"), ctx);
    assert.equal(model, "mock-vision");
    assert.equal(r.is_farm_photo && r.commodity_match && r.stage_match, true);
    assert.ok(r.confidence >= 0.7);
    assert.equal(r.detected_stage, "Tanam");
    assert.equal(r.estimated_days_to_harvest, 120);
  });

  for (const name of ["foto-salah.jpg", "TOLAK.png", "lahan_Salah_2.webp", "ditolak.jpg"]) {
    it(`menolak foto bernama "${name}"`, async () => {
      const { result: r } = await mockVision.assess(photo(name), ctx);
      assert.equal(r.is_farm_photo, false);
      assert.ok(r.confidence < 0.7);
      assert.ok(r.red_flags.length > 0);
      assert.match(r.reason_id, new RegExp(name.replace(".", "\\.")));
    });
  }

  it("tanpa nama file (mis. dari gateway IPFS) dianggap sesuai", async () => {
    assert.equal((await mockVision.assess(photo(undefined), ctx)).result.is_farm_photo, true);
  });

  it("format output sama dengan skema Gemini", async () => {
    const { result: r } = await mockVision.assess(photo("x.jpg"), ctx);
    assert.deepEqual(Object.keys(r).sort(), [...(RESPONSE_SCHEMA.required ?? [])].sort());
  });
});

describe("prompt & normalisasi", () => {
  it("prompt memuat konteks kampanye (PRD)", () => {
    const p = buildUserPrompt(ctx);
    for (const s of ["komoditas Cabai merah", "lokasi Cikajang, Garut", 'milestone "Tanam"', "Perkiraan panen: 28 Januari 2027", "total hujan 86,2 mm", "Balas HANYA JSON valid"]) {
      assert.ok(p.includes(s), `prompt tidak memuat: ${s}`);
    }
  });

  it("normalizeVision memperbaiki nilai di luar skema", () => {
    const r = normalizeVision({ is_farm_photo: "ya", confidence: 3, plant_condition: "bagus", red_flags: ["a", 1] });
    assert.equal(r.is_farm_photo, false);
    assert.equal(r.confidence, 1);
    assert.equal(r.plant_condition, "buruk");
    assert.deepEqual(r.red_flags, ["a"]);
  });
});

describe("model cadangan Gemini", () => {
  it("memakai model berikutnya jika model utama gagal (mis. 503)", async () => {
    const failed: string[] = [];
    const { value, model } = await tryModels(
      ["utama", "cadangan-1", "cadangan-2"],
      async (m) => {
        if (m === "utama") throw new Error('{"error":{"code":503,"status":"UNAVAILABLE"}}');
        return `jawaban dari ${m}`;
      },
      (m, e) => failed.push(`${m}: ${describeGeminiError(e)}`),
    );
    assert.equal(model, "cadangan-1");
    assert.equal(value, "jawaban dari cadangan-1");
    assert.deepEqual(failed, ["utama: 503 UNAVAILABLE"]);
  });

  it("melempar galat terakhir jika semua model gagal", async () => {
    await assert.rejects(
      tryModels(["a", "b"], async (m) => {
        throw new Error(`gagal ${m}`);
      }),
      /gagal b/,
    );
  });

  it("model dengan kuota habis (429) dilewati sementara; 503 tidak", () => {
    let t = 0;
    const c = quotaCooldown(600_000, () => t);
    const models = ["utama", "cadangan"];
    assert.equal(c.note("utama", new Error('{"error":{"code":503,"status":"UNAVAILABLE"}}')), false);
    assert.deepEqual(c.available(models), models);
    assert.equal(c.note("utama", new Error('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}')), true);
    assert.deepEqual(c.available(models), ["cadangan"]);
    c.note("cadangan", new Error('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}'));
    assert.deepEqual(c.available(models), models, "jika semua dilewati, semua tetap dicoba");
    t = 600_000;
    assert.deepEqual(c.available(["utama"]), ["utama"], "dicoba lagi setelah jeda");
  });

  it("ringkasan galat: timeout & kode HTTP", () => {
    const t = new Error("The operation was aborted due to timeout");
    t.name = "TimeoutError";
    assert.equal(describeGeminiError(t), "timeout");
    assert.equal(describeGeminiError(new Error('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}')), "429 RESOURCE_EXHAUSTED");
  });
});
