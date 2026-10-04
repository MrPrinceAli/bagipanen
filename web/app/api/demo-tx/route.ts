import { type Address, createPublicClient, createWalletClient, type Hex, http, isAddress, isAddressEqual } from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { campaignFactoryAbi } from "@/lib/abi/CampaignFactory";
import { addresses, REPUTATION_REGISTRY } from "@/lib/addresses";
import { IS_LOCAL, testnetChain } from "@/lib/config";
import { DEMO_ROLE_INDEX, type DemoRole } from "@/lib/demoJudge";

export const runtime = "nodejs";

/**
 * POST /api/demo-tx — mode demo juri (testnet). Body: { role, to, data, value? }.
 * Server menandatangani transaksi dengan akun demo peran itu (DEMO_MNEMONIC, rahasia server di
 * Vercel — kunci tidak pernah sampai ke browser). Admin tidak tersedia (mode lihat saja).
 * Hanya transaksi ke kontrak BagiPanen yang dilayani: factory, mUSDT, kontrak proyek resmi,
 * dan ERC-8004 ReputationRegistry; tanpa kiriman tBNB.
 */
export async function POST(request: Request) {
  const mnemonic = process.env.DEMO_MNEMONIC;
  if (IS_LOCAL || !mnemonic) return Response.json({ error: "Mode demo juri tidak aktif." }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { role?: string; to?: string; data?: string; value?: string };
  const role = body.role as DemoRole;
  if (!(role in DEMO_ROLE_INDEX)) return Response.json({ error: "Peran demo tidak dikenal." }, { status: 400 });
  if (!body.to || !isAddress(body.to) || !body.data?.startsWith("0x")) return Response.json({ error: "Transaksi tidak valid." }, { status: 400 });
  if (body.value && BigInt(body.value) !== 0n) return Response.json({ error: "Akun demo tidak mengirim tBNB." }, { status: 400 });

  const to = body.to as Address;
  const client = createPublicClient({ chain: testnetChain, transport: http() });
  const known = [addresses.factory, addresses.usdt, REPUTATION_REGISTRY].filter(Boolean) as Address[];
  const allowed =
    known.some((a) => isAddressEqual(a, to)) ||
    (await client.readContract({ address: addresses.factory!, abi: campaignFactoryAbi, functionName: "isCampaign", args: [to] }).catch(() => false));
  if (!allowed) return Response.json({ error: "Akun demo hanya bisa bertransaksi dengan kontrak BagiPanen." }, { status: 403 });

  const account = mnemonicToAccount(mnemonic, { addressIndex: DEMO_ROLE_INDEX[role] });
  const wallet = createWalletClient({ account, chain: testnetChain, transport: http() });
  try {
    const hash = await wallet.sendTransaction({ to, data: body.data as Hex });
    return Response.json({ hash });
  } catch (e) {
    const msg = (e as { shortMessage?: string; message?: string }).shortMessage ?? (e as Error).message;
    return Response.json({ error: msg.slice(0, 300) }, { status: 400 });
  }
}
