import { type Address, createPublicClient, http, isAddress } from "viem";
import { campaignFactoryAbi } from "@/lib/abi/CampaignFactory";
import { harvestCampaignAbi } from "@/lib/abi/HarvestCampaign";
import { addresses } from "@/lib/addresses";
import { IS_LOCAL, REPO_URL, testnetChain } from "@/lib/config";

export const runtime = "nodejs";

/** Status milestone `ProofSubmitted` (lihat HarvestCampaign.MStatus). */
const PROOF_SUBMITTED = 1;
const WORKFLOW = "agent.yml";
const MIN_INTERVAL_MS = 45_000;
let lastDispatch = 0;

/**
 * POST /api/agent-wake — body { campaign }. Dipanggil web setelah petani mengirim foto bukti:
 * memicu workflow agen di GitHub Actions saat itu juga, tanpa menunggu jadwal ±5 menit.
 * Aman dipanggil siapa saja: hanya memicu jika kontrak resmi itu benar-benar punya bukti yang
 * menunggu putusan agen, dan dilewati bila agen sudah berjalan/mengantre.
 * Butuh GITHUB_DISPATCH_TOKEN (fine-grained PAT, repo ini saja, izin Actions: read & write).
 */
export async function POST(request: Request) {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (IS_LOCAL || !token) return Response.json({ dispatched: false, reason: "pemicu agen tidak aktif" });

  const body = (await request.json().catch(() => ({}))) as { campaign?: string };
  if (!body.campaign || !isAddress(body.campaign) || !addresses.factory) {
    return Response.json({ error: "Alamat proyek tidak valid." }, { status: 400 });
  }
  const campaign = body.campaign as Address;

  const client = createPublicClient({ chain: testnetChain, transport: http() });
  const official = await client.readContract({ address: addresses.factory, abi: campaignFactoryAbi, functionName: "isCampaign", args: [campaign] });
  if (!official) return Response.json({ error: "Bukan proyek BagiPanen." }, { status: 400 });
  const [summary, milestones] = await Promise.all([
    client.readContract({ address: campaign, abi: harvestCampaignAbi, functionName: "getSummary" }),
    client.readContract({ address: campaign, abi: harvestCampaignAbi, functionName: "getMilestones" }),
  ]);
  const m = milestones[summary.currentMilestone];
  if (!m || m.status !== PROOF_SUBMITTED || m.aiDecided) {
    return Response.json({ dispatched: false, reason: "tidak ada bukti yang menunggu putusan agen" });
  }
  if (Date.now() - lastDispatch < MIN_INTERVAL_MS) return Response.json({ dispatched: false, reason: "agen baru saja dipanggil" });

  const repo = REPO_URL.replace("https://github.com/", "");
  const gh = (path: string, init?: RequestInit) =>
    fetch(`https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      signal: AbortSignal.timeout(15_000),
    });

  // Jangan menumpuk run: jika agen sudah mengantre/berjalan, run itu akan memproses bukti ini.
  for (const status of ["queued", "in_progress"]) {
    const res = await gh(`/runs?status=${status}&per_page=1`);
    if (res.ok && ((await res.json()) as { total_count?: number }).total_count) {
      return Response.json({ dispatched: false, reason: "agen sedang berjalan" });
    }
  }
  const res = await gh("/dispatches", { method: "POST", body: JSON.stringify({ ref: "main" }) });
  if (!res.ok) return Response.json({ error: `GitHub menolak pemicu (HTTP ${res.status}).` }, { status: 502 });
  lastDispatch = Date.now();
  return Response.json({ dispatched: true });
}
