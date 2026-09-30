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
  if (!res.ok) throw new Error(body.error ?? `Unggah gagal (HTTP ${res.status}).`);
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
