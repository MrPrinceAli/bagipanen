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
    return Response.json({ error: "Unggahan tidak terbaca. Coba pilih ulang fotonya." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Fotonya belum dipilih." }, { status: 400 });
  if (file.size === 0) return Response.json({ error: "Filenya kosong." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "Ukuran foto maksimal 5 MB." }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffImageType(bytes);
  if (sniffed === null) {
    return Response.json({ error: "Yang bisa diunggah hanya foto JPEG, PNG, atau WebP." }, { status: 415 });
  }

  try {
    const storage = getStorage();
    const cid = await storage.put(bytes, sniffed, file.name);
    return Response.json({ cid, url: storage.url(cid, new URL(request.url).origin) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Fotonya gagal disimpan. Coba lagi." }, { status: 500 });
  }
}
