import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Adapter penyimpanan file (hanya dipakai di API route, jangan diimpor dari komponen klien).
 * - local  : web/.local-ipfs/<cid>, CID = SHA-256 isi file (mode lokal)
 * - pinata : IPFS via Pinata (mode testnet; disiapkan saat konfigurasi)
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

const pinata: StorageAdapter = {
  name: "pinata",
  async put() {
    throw new Error("Penyimpanan Pinata belum disiapkan. Gunakan NEXT_PUBLIC_APP_MODE=local untuk saat ini.");
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
