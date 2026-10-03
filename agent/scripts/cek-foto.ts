/**
 * Uji foto bukti ke adapter vision (Gemini di testnet) TANPA transaksi onchain, supaya kesempatan
 * unggah per milestone (maks. 3) tidak terbuang saat menyiapkan demo.
 *
 *   npm run cek-foto -- --komoditas "Padi" --tahap Tanam --lokasi "Sidrap, Sulawesi Selatan" \
 *     --panen-hari 100 [--lat -3.92 --lon 119.81] foto1.jpg [foto2.jpg ...]
 *
 * Putusan memakai aturan yang sama dengan agen (decide), tanpa cek duplikat & EXIF.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { createVision } from "../src/adapters.js";
import { evaluateExif } from "../src/exif.js";
import { decide } from "../src/verdict.js";
import { getWeather, STATIC_WEATHER, weatherText } from "../src/weather.js";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    komoditas: { type: "string" },
    tahap: { type: "string" },
    lokasi: { type: "string", default: "-" },
    "panen-hari": { type: "string", default: "90" },
    lat: { type: "string" },
    lon: { type: "string" },
  },
});

if (!values.komoditas || !values.tahap || positionals.length === 0) {
  console.error('Pakai: npm run cek-foto -- --komoditas "Padi" --tahap Tanam [--lokasi ..] [--panen-hari 90] foto.jpg ...');
  process.exit(1);
}

const days = Number(values["panen-hari"]);
const weather =
  values.lat && values.lon ? await getWeather(Number(values.lat), Number(values.lon), true) : STATIC_WEATHER;
const vision = createVision();
const mime = (f: string) => (/\.png$/i.test(f) ? "image/png" : /\.webp$/i.test(f) ? "image/webp" : "image/jpeg");
const noExif = evaluateExif({}, { latitude: 0, longitude: 0 }, Math.floor(Date.now() / 1000));

for (const file of positionals) {
  const bytes = new Uint8Array(await readFile(file));
  const { result, model } = await vision.assess(
    { bytes, mimeType: mime(file), fileName: path.basename(file) },
    {
      commodity: values.komoditas,
      locationName: values.lokasi!,
      milestoneName: values.tahap,
      expectedHarvestDate: new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(Date.now() + days * 86_400_000)),
      daysToHarvest: days,
      weatherSummary: weatherText(weather),
    },
  );
  const d = decide(result, noExif, false, values.tahap, values.komoditas);
  console.log(
    `${d.approved ? "SETUJU" : "TOLAK "} ${path.basename(file)} · ${result.detected_commodity}, fase ${result.detected_stage}, ` +
      `kondisi ${result.plant_condition}, yakin ${result.confidence.toFixed(2)} (${model})`,
  );
  if (!d.approved) console.log(`       alasan: ${d.reasons.join("; ")}`);
  if (result.red_flags.length) console.log(`       catatan: ${result.red_flags.join("; ")}`);
}
