import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Adapter penyimpanan file (hanya dipakai di API route, jangan diimpor dari komponen klien).
 * - local  : web/.local-ipfs/<cid>, CID = SHA-256 isi file (mode lokal)
 * - pinata : IPFS via Pinata (mode testnet)
 */
export type StorageAdapter = {
  name: "local" | "pinata";
  put(data: Uint8Array, contentType: string, fileName: string): Promise<string>;
  url(cid: string, origin: string): string;
};

export const LOCAL_IPFS_DIR = path.join(process.cwd(), ".local-ipfs");
const LOCAL_CID = /^[0-9a-f]{64}$/;

const local: StorageAdapter = {
  name: "local",
  async put(data, contentType, fileName) {
    const cid = createHash("sha256").update(data).digest("hex");
    await mkdir(LOCAL_IPFS_DIR, { recursive: true });
    await writeFile(path.join(LOCAL_IPFS_DIR, cid), data);
    await writeFile(
      path.join(LOCAL_IPFS_DIR, `${cid}.meta.json`),
      JSON.stringify({ contentType, fileName, size: data.byteLength }),
    );
    return cid;
  },
  url(cid, origin) {
    return `${origin}/api/ipfs/${cid}`;
  },
};

const PINATA_UPLOAD_URL = "https://uploads.pinata.cloud/v3/files";

/**
 * IPFS via Pinata (docs.pinata.cloud): POST uploads.pinata.cloud/v3/files, multipart `file` +
 * `network=public`, header `Authorization: Bearer <PINATA_JWT>` → CID di `data.cid`.
 * File dikirim apa adanya sehingga EXIF foto tetap utuh.
 */
const pinata: StorageAdapter = {
  name: "pinata",
  async put(data, contentType, fileName) {
    const jwt = process.env.PINATA_JWT;
    if (!jwt) throw new Error("PINATA_JWT belum diisi di web/.env.local.");
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(data)], { type: contentType }), fileName);
    form.append("network", "public");
    form.append("name", fileName);
    const res = await fetch(PINATA_UPLOAD_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    const body = (await res.json().catch(() => ({}))) as { data?: { cid?: string } };
    if (!res.ok || !body.data?.cid) throw new Error(`Unggah ke Pinata gagal (HTTP ${res.status}).`);
    return body.data.cid;
  },
  url(cid) {
    const gateway = (process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://ipfs.io").replace(/\/+$/, "");
    return `${/^https?:\/\//.test(gateway) ? gateway : `https://${gateway}`}/ipfs/${cid}`;
  },
};

export function getStorage(): StorageAdapter {
  return process.env.NEXT_PUBLIC_APP_MODE === "testnet" ? pinata : local;
}

/** Baca file dari penyimpanan lokal. Mengembalikan null jika CID tidak valid / tidak ada. */
export async function readLocal(cid: string): Promise<{ data: Buffer; contentType: string } | null> {
  if (!LOCAL_CID.test(cid)) return null;
  try {
    const [data, meta] = await Promise.all([
      readFile(path.join(LOCAL_IPFS_DIR, cid)),
      readFile(path.join(LOCAL_IPFS_DIR, `${cid}.meta.json`), "utf8"),
    ]);
    return { data, contentType: (JSON.parse(meta) as { contentType: string }).contentType };
  } catch {
    return null;
  }
}

/** Deteksi tipe gambar dari isi file (magic bytes), bukan hanya dari header browser. */
export function sniffImageType(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}
