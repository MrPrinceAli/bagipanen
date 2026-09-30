import { getStorage, sniffImageType } from "@/lib/server/storage";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * POST /api/upload — multipart/form-data, field `file`.
 * Hanya JPEG/PNG/WebP (dicek dari isi file), maks 5 MB. File disimpan apa adanya (EXIF tidak dihapus).
 * Balasan: { cid, url }
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Format unggahan tidak valid (harus multipart/form-data)." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Field `file` wajib diisi." }, { status: 400 });
  if (file.size === 0) return Response.json({ error: "File kosong." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "Ukuran file maksimal 5 MB." }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffImageType(bytes);
  if (sniffed === null) {
    return Response.json({ error: "Hanya foto JPEG, PNG, atau WebP yang diterima." }, { status: 415 });
  }

  try {
    const storage = getStorage();
    const cid = await storage.put(bytes, sniffed, file.name);
    return Response.json({ cid, url: storage.url(cid, new URL(request.url).origin) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Gagal menyimpan file." }, { status: 500 });
  }
}
