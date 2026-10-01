import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { evaluateExif, haversineKm, readExif, toWibIso } from "../src/exif.js";

const fixture = (name: string) => new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));
const FARM = { latitude: -7.35, longitude: 107.8 };
const at = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

describe("readExif", () => {
  it("membaca GPS & tanggal dari foto", async () => {
    const d = await readExif(fixture("gps-garut.jpg"));
    assert.ok(Math.abs(d.latitude! - -7.35) < 1e-4);
    assert.ok(Math.abs(d.longitude! - 107.8) < 1e-4);
    assert.ok(d.takenAt instanceof Date);
  });

  it("foto tanpa EXIF menghasilkan objek kosong, bukan error", async () => {
    assert.deepEqual(await readExif(fixture("no-exif.jpg")), {});
  });
});

describe("haversineKm", () => {
  it("jarak 0 untuk titik yang sama", () => assert.equal(haversineKm(-7.35, 107.8, -7.35, 107.8), 0));
  it("Jakarta → Garut sekitar 168 km", () => {
    const d = haversineKm(-6.2, 106.8, -7.35, 107.8);
    assert.ok(d > 160 && d < 175, `jarak ${d}`);
  });
  it("0,01° lintang ≈ 1,11 km", () => assert.ok(Math.abs(haversineKm(0, 0, 0.01, 0) - 1.112) < 0.01));
});

describe("evaluateExif", () => {
  const taken = new Date("2026-09-30T10:00:00+07:00");

  it("ok: GPS dekat lahan & tanggal ≤ 7 hari", () => {
    const r = evaluateExif({ latitude: -7.351, longitude: 107.801, takenAt: taken }, FARM, at("2026-10-02T10:00:00+07:00"));
    assert.equal(r.status, "ok");
    assert.ok(r.distanceKm! < 0.2);
    assert.equal(r.takenAt, "2026-09-30T10:00:00+07:00");
  });

  it("missing: tanpa GPS dan tanggal", () => {
    const r = evaluateExif({}, FARM, at("2026-10-02T10:00:00+07:00"));
    assert.equal(r.status, "missing");
    assert.equal(r.distanceKm, null);
  });

  it("mismatch: lokasi > 2 km", () => {
    const r = evaluateExif({ latitude: -6.2, longitude: 106.8, takenAt: taken }, FARM, at("2026-09-30T12:00:00+07:00"));
    assert.equal(r.status, "mismatch");
    assert.match(r.notes.join(" "), /km dari lahan/);
  });

  it("mismatch: foto lebih tua dari 7 hari", () => {
    const r = evaluateExif({ latitude: -7.35, longitude: 107.8, takenAt: taken }, FARM, at("2026-10-08T12:00:00+07:00"));
    assert.equal(r.status, "mismatch");
    assert.match(r.notes.join(" "), /hari dari waktu kirim/);
  });

  it("batas: tepat 2 km dan tepat 7 hari masih ok", () => {
    const lat2km = -7.35 + 2 / 111.195;
    const r = evaluateExif(
      { latitude: lat2km - 1e-6, longitude: 107.8, takenAt: taken },
      FARM,
      Math.floor(taken.getTime() / 1000) + 7 * 86_400,
    );
    assert.equal(r.status, "ok");
  });

  it("ok dengan catatan jika hanya GPS yang ada", () => {
    const r = evaluateExif({ latitude: -7.35, longitude: 107.8 }, FARM, at("2026-10-02T10:00:00+07:00"));
    assert.equal(r.status, "ok");
    assert.deepEqual(r.notes, ["foto tidak menyimpan tanggal"]);
  });
});

describe("toWibIso", () => {
  it("format ISO +07:00", () => assert.equal(toWibIso(new Date("2026-10-03T01:12:00Z")), "2026-10-03T08:12:00+07:00"));
});
