import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ExifCheck } from "../src/exif.js";
import { buildVerdictDocument, decide, MIN_CONFIDENCE } from "../src/verdict.js";
import type { VisionResult } from "../src/vision.js";
import { STATIC_WEATHER } from "../src/weather.js";

const good: VisionResult = {
  is_farm_photo: true,
  commodity_match: true,
  detected_commodity: "cabai merah",
  detected_stage: "Tumbuh",
  stage_match: true,
  plant_condition: "baik",
  confidence: 0.86,
  estimated_days_to_harvest: 45,
  reason_id: "Tanaman cabai fase vegetatif.",
  red_flags: [],
};
const exifOk: ExifCheck = { status: "ok", distanceKm: 0.4, takenAt: "2026-10-03T08:12:00+07:00", notes: [] };
const exifMissing: ExifCheck = { status: "missing", distanceKm: null, takenAt: null, notes: ["EXIF (GPS & tanggal) tidak ada"] };
const exifBad: ExifCheck = { status: "mismatch", distanceKm: 45, takenAt: null, notes: ["lokasi foto 45 km dari lahan (maks 2 km)"] };

describe("decide (aturan PRD)", () => {
  it("disetujui jika semua syarat terpenuhi", () => assert.equal(decide(good, exifOk, false, "Tumbuh").approved, true));
  it("EXIF missing tidak langsung ditolak", () => assert.equal(decide(good, exifMissing, false, "Tumbuh").approved, true));

  const cases: [string, VisionResult, ExifCheck, boolean, RegExp][] = [
    ["bukan foto lahan", { ...good, is_farm_photo: false }, exifOk, false, /bukan foto lahan/],
    ["komoditas beda", { ...good, commodity_match: false, detected_commodity: "jagung" }, exifOk, false, /komoditas tidak sesuai \(terdeteksi: jagung\)/],
    ["fase beda", { ...good, stage_match: false, detected_stage: "Tanam" }, exifOk, false, /fase tidak sesuai \(terdeteksi Tanam, seharusnya Tumbuh\)/],
    ["yakin < 0,70", { ...good, confidence: 0.69 }, exifOk, false, /keyakinan AI 0,69 di bawah 0,70/],
    ["EXIF mismatch", good, exifBad, false, /45 km dari lahan/],
    ["duplikat", good, exifOk, true, /foto sama/],
  ];
  for (const [name, v, e, dup, re] of cases) {
    it(`ditolak: ${name}`, () => {
      const d = decide(v, e, dup, "Tumbuh");
      assert.equal(d.approved, false);
      assert.match(d.reasons.join("; "), re);
    });
  }

  it("batas keyakinan tepat 0,70 disetujui", () => assert.equal(decide({ ...good, confidence: MIN_CONFIDENCE }, exifOk, false, "Tumbuh").approved, true));
});

describe("buildVerdictDocument", () => {
  const base = {
    campaign: "0x98A01f8FF48B849CcaF4d8D987eE200683a1a11e" as const,
    milestoneIndex: 1,
    attempt: 1,
    proofCID: "bafy-proof",
    vision: good,
    exif: exifOk,
    weather: STATIC_WEATHER,
    duplicate: false,
    agent: { registry: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512" as const, agentId: 12n, model: "mock-vision" },
    now: new Date("2026-10-03T01:13:05Z"),
  };

  it("mengikuti format bagipanen.verdict.v1", () => {
    const doc = buildVerdictDocument({ ...base, decision: decide(good, exifOk, false, "Tumbuh") });
    assert.equal(doc.schema, "bagipanen.verdict.v1");
    assert.equal(doc.approved, true);
    assert.equal(doc.summary_id, "Disetujui: fase tumbuh, kondisi baik, perkiraan panen ±45 hari lagi.");
    assert.deepEqual(doc.exif, { status: "ok", distanceKm: 0.4, takenAt: "2026-10-03T08:12:00+07:00" });
    assert.deepEqual(doc.agent, { registry: base.agent.registry, agentId: "12", model: "mock-vision" });
    assert.equal(doc.decidedAt, "2026-10-03T08:13:05+07:00");
    assert.deepEqual(Object.keys(doc).sort(), [
      "agent", "approved", "attempt", "campaign", "decidedAt", "duplicate", "exif", "milestoneIndex", "proofCID", "schema",
      "summary_id", "vision", "weather",
    ]);
  });

  it("ringkasan penolakan berisi alasan yang jelas", () => {
    const decision = decide({ ...good, is_farm_photo: false }, exifBad, true, "Tumbuh");
    const doc = buildVerdictDocument({ ...base, decision, exif: exifBad, duplicate: true });
    assert.equal(doc.approved, false);
    assert.match(doc.summary_id, /^Ditolak: bukan foto lahan pertanian; lokasi foto 45 km dari lahan \(maks 2 km\); foto sama/);
  });

  it("catatan EXIF tidak ada tercantum di ringkasan", () => {
    const doc = buildVerdictDocument({ ...base, exif: exifMissing, decision: decide(good, exifMissing, false, "Tumbuh") });
    assert.match(doc.summary_id, /Catatan: EXIF tidak ada \(dicatat\)\.$/);
  });
});
