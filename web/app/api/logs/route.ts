import { IS_LOCAL } from "@/lib/config";
import { getLogIndex } from "@/lib/server/logIndex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/logs — indeks event log CampaignFactory + semua HarvestCampaign resmi (log mentah
 * eth_getLogs). Browser memakai ini sebagai pengganti memindai RPC sendiri (Sentio membatasi
 * 5.000 blok per panggilan). Hanya membaca chain; di-cache CDN Vercel sebentar untuk semua pengunjung.
 */
export async function GET() {
  if (IS_LOCAL) return Response.json({ error: "Tidak dipakai di mode lokal." }, { status: 404 });
  try {
    const { toBlock, logs } = await getLogIndex();
    return Response.json(
      { toBlock, logs },
      { headers: { "Cache-Control": "public, max-age=0, s-maxage=15, stale-while-revalidate=300" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gagal membaca log.";
    return Response.json({ error: message }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
