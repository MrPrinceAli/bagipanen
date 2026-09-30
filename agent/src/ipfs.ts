import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/** File yang diambil dari penyimpanan (foto bukti). `fileName` hanya tersedia di penyimpanan lokal. */
export type StoredFile = { bytes: Uint8Array; mimeType: string; fileName?: string };

export type Storage = {
  name: "local" | "pinata";
  getFile(cid: string): Promise<StoredFile>;
  /** Unggah dokumen JSON, kembalikan CID-nya. */
  putJson(doc: unknown, name: string): Promise<string>;
};

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Penyimpanan lokal (mode local): folder yang sama dengan API upload web
 * (web/.local-ipfs/<cid> + <cid>.meta.json), CID = SHA-256 isi file.
 */
export function localFileStorage(dir: string): Storage {
  const LOCAL_CID = /^[0-9a-f]{64}$/;
  return {
    name: "local",
    async getFile(cid) {
      if (!LOCAL_CID.test(cid)) throw new Error(`CID lokal tidak valid: ${cid}`);
      const [bytes, metaRaw] = await Promise.all([
        readFile(path.join(dir, cid)),
        readFile(path.join(dir, `${cid}.meta.json`), "utf8").catch(() => "{}"),
      ]);
      const meta = JSON.parse(metaRaw) as { contentType?: string; fileName?: string };
      return { bytes: new Uint8Array(bytes), mimeType: meta.contentType ?? "application/octet-stream", fileName: meta.fileName };
    },
    async putJson(doc, name) {
      const data = new TextEncoder().encode(JSON.stringify(doc));
      const cid = sha256Hex(data);
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, cid), data);
      await writeFile(
        path.join(dir, `${cid}.meta.json`),
        JSON.stringify({ contentType: "application/json", fileName: name, size: data.byteLength }),
      );
      return cid;
    },
  };
}

const PINATA_UPLOAD_URL = "https://uploads.pinata.cloud/v3/files";

/**
 * IPFS via Pinata (mode testnet). Unggah: POST uploads.pinata.cloud/v3/files (multipart `file`,
 * `network=public`, Bearer JWT) → `data.cid` (docs.pinata.cloud). Unduh lewat gateway IPFS.
 */
export function pinataStorage(jwt: string, gateway: string): Storage {
  const base = (/^https?:\/\//.test(gateway) ? gateway : `https://${gateway}`).replace(/\/+$/, "");
  return {
    name: "pinata",
    async getFile(cid) {
      const res = await fetch(`${base}/ipfs/${cid}`, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`Gateway IPFS membalas HTTP ${res.status} untuk ${cid}.`);
      return {
        bytes: new Uint8Array(await res.arrayBuffer()),
        mimeType: res.headers.get("content-type")?.split(";")[0] ?? "application/octet-stream",
      };
    },
    async putJson(doc, name) {
      const form = new FormData();
      form.append("file", new Blob([JSON.stringify(doc)], { type: "application/json" }), name);
      form.append("network", "public");
      form.append("name", name);
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
  };
}
