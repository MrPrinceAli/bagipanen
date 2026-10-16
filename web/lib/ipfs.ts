import { tr } from "./i18n";
import { IS_LOCAL } from "./config";

const GATEWAY = (() => {
  const g = (process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://ipfs.io").replace(/\/+$/, "");
  return /^https?:\/\//.test(g) ? g : `https://${g}`;
})();

/** URL untuk menampilkan file berdasarkan CID (mode lokal: API route; testnet: gateway IPFS). */
export function ipfsUrl(cid: string): string {
  if (!cid) return "";
  return IS_LOCAL ? `/api/ipfs/${cid}` : `${GATEWAY}/ipfs/${cid}`;
}

export type UploadResult = { cid: string; url: string };

async function parseUpload(res: Response): Promise<UploadResult> {
  const body = await res.json().catch(() => ({}));
  // 413 tanpa pesan dari API kita = ditolak hosting sebelum sampai ke API (Vercel membatasi body ±4,5 MB).
  if (res.status === 413 && !body.error) throw new Error(
      tr(
        "Fotonya terlalu besar untuk versi online (maksimal sekitar 4,5 MB). Pilih foto yang lebih kecil, atau turunkan resolusi kamera lalu foto ulang.",
        "The photo is too large for the online version (about 4.5 MB max). Choose a smaller photo, or lower your camera resolution and take it again.",
      ),
    );
  if (!res.ok) throw new Error(body.error ?? tr(`Unggahan gagal (HTTP ${res.status}). Coba lagi.`, `Upload failed (HTTP ${res.status}). Try again.`));
  return body as UploadResult;
}

/** Unggah foto apa adanya (tanpa kompres, agar EXIF tetap utuh). */
export async function uploadFile(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  return parseUpload(await fetch("/api/upload", { method: "POST", body: form }));
}

/** Unggah dokumen JSON (wajib punya field `schema`). */
export async function uploadJson(doc: { schema: string } & Record<string, unknown>): Promise<UploadResult> {
  return parseUpload(
    await fetch("/api/upload-json", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(doc),
    }),
  );
}

export async function fetchIpfsJson<T>(cid: string): Promise<T> {
  const res = await fetch(ipfsUrl(cid));
  if (!res.ok) throw new Error(`Gagal mengambil ${cid} (HTTP ${res.status}).`);
  return (await res.json()) as T;
}
