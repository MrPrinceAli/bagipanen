import { getStorage } from "@/lib/server/storage";

export const runtime = "nodejs";

const MAX_BYTES = 100 * 1024;

/**
 * POST /api/upload-json — body JSON, maks 100 KB, wajib punya field `schema`.
 * Balasan: { cid, url }
 */
export async function POST(request: Request) {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BYTES) {
    return Response.json({ error: "Ukuran JSON maksimal 100 KB." }, { status: 413 });
  }
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    return Response.json({ error: "Body bukan JSON yang valid." }, { status: 400 });
  }
  if (typeof doc !== "object" || doc === null || Array.isArray(doc) || typeof (doc as { schema?: unknown }).schema !== "string") {
    return Response.json({ error: "JSON wajib berupa objek dengan field `schema`." }, { status: 400 });
  }

  try {
    const storage = getStorage();
    const data = new TextEncoder().encode(JSON.stringify(doc));
    const cid = await storage.put(data, "application/json", `${(doc as { schema: string }).schema}.json`);
    return Response.json({ cid, url: storage.url(cid, new URL(request.url).origin) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Gagal menyimpan JSON." }, { status: 500 });
  }
}
