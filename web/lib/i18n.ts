/**
 * Bahasa antarmuka (ID/EN). Teks ditulis berpasangan di tempatnya: `tr("Teks Indonesia", "English text")`.
 *
 * Bahasa aktif disimpan di variabel modul agar bisa dibaca juga oleh kode di luar komponen (format
 * angka/tanggal, pesan error, kalimat putusan agen). `LangProvider` (lib/lang.tsx) memperbaruinya lalu
 * merender ulang seluruh isi halaman, sehingga semua `tr()` membaca bahasa yang baru.
 * Render server/prerender selalu "id"; bahasa pilihan diterapkan setelah halaman dimuat di browser.
 */
export type Lang = "id" | "en";

let current: Lang = "id";

export function getLang(): Lang {
  return current;
}

/** Hanya untuk LangProvider. */
export function setCurrentLang(lang: Lang) {
  current = lang;
}

/** Pilih teks sesuai bahasa aktif. */
export function tr(id: string, en: string): string {
  return current === "en" ? en : id;
}

/** Locale Intl untuk angka & tanggal. */
export function locale(): string {
  return current === "en" ? "en-US" : "id-ID";
}

export const LANG_STORAGE_KEY = "bagipanen.lang";

/**
 * Saklar fitur dua bahasa untuk pengunjung (toggle di header + deteksi bahasa browser). false =
 * situs hanya Bahasa Indonesia, dan EN aktif bila `localStorage["bagipanen.lang"] = "en"` diisi manual.
 */
export const I18N_PUBLIC = true;

/** Bahasa bawaan dari browser: Indonesia jika bahasa utama browser `id`, selain itu Inggris. */
export function detectLang(): Lang {
  try {
    const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === "id" || saved === "en") return saved;
  } catch {
    // penyimpanan diblokir: pakai bahasa browser
  }
  if (!I18N_PUBLIC) return "id";
  const first = (navigator.languages?.[0] ?? navigator.language ?? "id").toLowerCase();
  return first.startsWith("id") ? "id" : "en";
}

/** Tabel label dua bahasa: `trMap({ a: ["Teks", "Text"] }).a` mengikuti bahasa aktif. */
export function trMap<K extends string | number>(pairs: Record<K, readonly [string, string]>): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const key of Object.keys(pairs) as K[]) {
    Object.defineProperty(out, key, { enumerable: true, get: () => tr(pairs[key][0], pairs[key][1]) });
  }
  return out;
}

/**
 * Padanan istilah yang tersimpan onchain dalam Bahasa Indonesia (nama tahap, komoditas). Teks bebas
 * dari pengguna (judul, cerita proyek, nama) tidak diterjemahkan.
 */
const TERMS: Record<string, string> = {
  tanam: "Planting",
  tumbuh: "Growing",
  "pra-panen": "Pre-harvest",
  padi: "Rice",
  jagung: "Corn",
  "cabai merah": "Red chili",
  "cabai rawit": "Bird's eye chili",
  cabai: "Chili",
  "bawang merah": "Shallot",
  "bawang putih": "Garlic",
  kentang: "Potato",
  tomat: "Tomato",
  kedelai: "Soybean",
  "kacang tanah": "Peanut",
  singkong: "Cassava",
  "ubi jalar": "Sweet potato",
  kopi: "Coffee",
  kakao: "Cocoa",
  tebu: "Sugarcane",
  sayuran: "Vegetables",
  // kondisi tanaman dari penilaian Gemini
  baik: "good",
  sedang: "fair",
  buruk: "poor",
  rusak: "damaged",
};

/** "Padi" → "Rice" (EN); istilah tak dikenal dikembalikan apa adanya. */
export function trTerm(term: string): string {
  if (current !== "en") return term;
  return TERMS[term.trim().toLowerCase()] ?? term;
}
