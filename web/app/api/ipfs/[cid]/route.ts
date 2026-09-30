import { readLocal } from "@/lib/server/storage";

export const runtime = "nodejs";

/** GET /api/ipfs/<cid> — menyajikan file dari penyimpanan lokal (hanya mode lokal). */
export async function GET(_request: Request, ctx: RouteContext<"/api/ipfs/[cid]">) {
  if (process.env.NEXT_PUBLIC_APP_MODE === "testnet") {
    return Response.json({ error: "Penyimpanan lokal tidak aktif di mode testnet." }, { status: 404 });
  }
  const { cid } = await ctx.params;
  const file = await readLocal(cid);
  if (!file) return Response.json({ error: "File tidak ditemukan." }, { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "content-type": file.contentType,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
