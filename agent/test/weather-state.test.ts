import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { localFileStorage, sha256Hex } from "../src/ipfs.js";
import { AgentState, DeferredProofs, SeenHashes } from "../src/state.js";
import { openMeteoUrl, summarizeDaily, todayWib, weatherText } from "../src/weather.js";

describe("cuaca (Open-Meteo)", () => {
  it("URL memakai parameter PRD", () => {
    const u = new URL(openMeteoUrl(-7.35, 107.8));
    assert.equal(u.origin + u.pathname, "https://api.open-meteo.com/v1/forecast");
    assert.equal(u.searchParams.get("daily"), "precipitation_sum,temperature_2m_max,temperature_2m_min");
    assert.equal(u.searchParams.get("past_days"), "14");
    assert.equal(u.searchParams.get("forecast_days"), "7");
    assert.equal(u.searchParams.get("timezone"), "Asia/Jakarta");
  });

  it("ringkasan 14 hari terakhir & tanda ekstrem > 100 mm", () => {
    const time = ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01"];
    const w = summarizeDaily(
      { time, precipitation_sum: [10, 20.55, 5, 150], temperature_2m_max: [28, 29, 30, 27], temperature_2m_min: [18, 19, 20, 17] },
      "2026-09-30",
    );
    assert.equal(w.precip14dMm, 30.6); // hanya hari sebelum "hari ini"
    assert.equal(w.maxDailyPrecipMm, 20.6);
    assert.equal(w.extreme, true); // prakiraan 150 mm
    assert.equal(w.tempMaxC, 28.5);
    assert.match(weatherText(w), /hujan ekstrem/);
  });

  it("tanggal WIB", () => assert.equal(todayWib(new Date("2026-09-30T18:00:00Z")), "2026-10-01"));
});

describe("state & deteksi duplikat", () => {
  const dir = () => mkdtempSync(path.join(tmpdir(), "bagipanen-agent-"));
  const A = "0x98A01f8FF48B849CcaF4d8D987eE200683a1a11e";
  const B = "0x1111111111111111111111111111111111111111";

  it("duplikat hanya jika dipakai kampanye atau milestone lain (PRD)", () => {
    const seen = new SeenHashes(dir());
    seen.add("h1", { campaign: A, milestoneIndex: 0, attempt: 1 });
    assert.equal(seen.findDuplicate("h1", A, 0), null, "unggah ulang di milestone yang sama bukan duplikat");
    assert.equal(seen.findDuplicate("h1", A.toLowerCase(), 0), null, "alamat tidak peka huruf besar");
    assert.ok(seen.findDuplicate("h1", A, 1), "milestone lain");
    assert.ok(seen.findDuplicate("h1", B, 0), "kampanye lain");
    assert.equal(seen.findDuplicate("h2", B, 0), null);
  });

  it("state dianggap usang jika chain berganti (dev:chain diulang)", () => {
    const d = dir();
    const id = { chainId: 31337, factory: A, genesisHash: "0xaaa" };
    const s = new AgentState(d);
    assert.equal(s.isStale(id), true);
    s.reset(id, 5n);
    assert.equal(s.lastBlock, 4n);
    s.setLastBlock(20n);
    const again = new AgentState(d);
    assert.equal(again.isStale(id), false);
    assert.equal(again.lastBlock, 20n);
    assert.equal(again.isStale({ ...id, genesisHash: "0xbbb" }), true);
  });
});

describe("antrean bukti tertunda", () => {
  const proof = { campaign: "0x98A01f8FF48B849CcaF4d8D987eE200683a1a11e", index: 0, cid: "bafy", attempt: 1, blockNumber: "10", txHash: "0xabc", logIndex: 0 };

  it("jeda bertambah 1, 2, 4 menit … maksimal 10 menit, dan tersimpan di disk", () => {
    const d = mkdtempSync(path.join(tmpdir(), "bagipanen-deferred-"));
    const q = new DeferredProofs(d);
    const t0 = 1_000_000;
    assert.equal(q.schedule(proof, t0).nextAt - t0, 60_000);
    assert.equal(q.schedule(proof, t0).nextAt - t0, 120_000);
    assert.equal(q.schedule(proof, t0).nextAt - t0, 240_000);
    for (let i = 0; i < 5; i++) q.schedule(proof, t0);
    assert.equal(q.schedule(proof, t0).nextAt - t0, 600_000);
    assert.equal(q.size, 1, "satu entri per (kampanye, milestone, percobaan)");
    assert.equal(new DeferredProofs(d).size, 1, "bertahan setelah restart");
  });

  it("due() hanya yang sudah waktunya; remove() menghapus", () => {
    const q = new DeferredProofs(mkdtempSync(path.join(tmpdir(), "bagipanen-deferred-")));
    const item = q.schedule(proof, 0);
    assert.equal(q.due(item.nextAt - 1).length, 0);
    assert.equal(q.due(item.nextAt).length, 1);
    q.remove(item.key);
    assert.equal(q.size, 0);
  });
});

describe("penyimpanan lokal (kompatibel dengan API upload web)", () => {
  it("putJson → CID SHA-256, bisa dibaca kembali dengan metadata", async () => {
    const d = mkdtempSync(path.join(tmpdir(), "bagipanen-ipfs-"));
    const store = localFileStorage(d);
    const doc = { schema: "bagipanen.verdict.v1", approved: true };
    const cid = await store.putJson(doc, "verdict.json");
    assert.equal(cid, sha256Hex(new TextEncoder().encode(JSON.stringify(doc))));
    const file = await store.getFile(cid);
    assert.equal(file.mimeType, "application/json");
    assert.equal(file.fileName, "verdict.json");
    assert.deepEqual(JSON.parse(new TextDecoder().decode(file.bytes)), doc);
    assert.equal(JSON.parse(readFileSync(path.join(d, `${cid}.meta.json`), "utf8")).contentType, "application/json");
  });

  it("menolak CID yang bukan hex SHA-256 (cegah path traversal)", async () => {
    await assert.rejects(localFileStorage(tmpdir()).getFile("../etc/passwd"), /CID lokal tidak valid/);
  });
});
