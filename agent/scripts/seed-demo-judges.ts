/**
 * Akun demo untuk juri di BSC testnet (DEMO_MNEMONIC di contracts/.env, terpisah dari TESTNET_MNEMONIC):
 *   indeks 0 = Koperasi Demo, 1 = Petani Demo, 2 = Investor Demo.
 * Admin (TESTNET_MNEMONIC #0) mendaftarkan koperasi demo; koperasi demo mendaftarkan petani demo;
 * gas tBNB diambil dari wallet investor contoh (Rina/Budi/Sari); lalu dibuat satu proyek demo
 * yang langsung disetujui & didanai penuh oleh Investor Demo, sehingga juri bisa langsung mencoba
 * alur kirim foto → putusan agen AI → konfirmasi koperasi.
 *
 *   npm run seed:demo              siapkan akun + proyek demo (aman diulang)
 *   npm run seed:demo -- --baru    buat proyek demo baru (mis. setelah tahap proyek lama habis)
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { type Address, createPublicClient, createWalletClient, formatEther, http, parseEther, parseEventLogs, parseUnits } from "viem";
import { type HDAccount, mnemonicToAccount } from "viem/accounts";
import { campaignFactoryAbi } from "../src/abi/CampaignFactory.js";
import { harvestCampaignAbi } from "../src/abi/HarvestCampaign.js";
import { mockUSDTAbi } from "../src/abi/MockUSDT.js";
import { AGENT_ROOT, chain, config, IS_LOCAL, requireEnv } from "../src/config.js";
import { deployments } from "../src/deployments.js";

if (IS_LOCAL) throw new Error("seed:demo hanya untuk testnet (APP_MODE=testnet di agent/.env).");

const env = dotenv.parse(await readFile(path.join(AGENT_ROOT, "../contracts/.env"), "utf8").catch(() => ""));
const RPC = env.BSC_TESTNET_RPC || config.rpcUrl;
if (!env.TESTNET_MNEMONIC || !env.DEMO_MNEMONIC) throw new Error("TESTNET_MNEMONIC dan DEMO_MNEMONIC wajib ada di contracts/.env.");
const main = (i: number) => mnemonicToAccount(env.TESTNET_MNEMONIC, { addressIndex: i });
const demo = (i: number) => mnemonicToAccount(env.DEMO_MNEMONIC, { addressIndex: i });

const admin = main(0);
const donors = [main(3), main(4), main(5)];
const coop = demo(0);
const farmer = demo(1);
const investor = demo(2);

const t = deployments.bscTestnet as unknown as { factory: Address; usdt: Address };
const pub = createPublicClient({ chain, transport: http(RPC) });
const wallet = (a: HDAccount) => createWalletClient({ account: a, chain, transport: http(RPC) });
const log = (m: string) => console.log(`${new Date().toLocaleTimeString("id-ID", { hour12: false })} ${m}`);
const usdt = (n: number) => parseUnits(String(n), 18);
const STATE = path.join(AGENT_ROOT, "data/demo-judges.json");
const state: { campaigns?: Address[] } = JSON.parse(await readFile(STATE, "utf8").catch(() => "{}"));

async function send(a: HDAccount, req: Parameters<ReturnType<typeof wallet>["writeContract"]>[0], label: string) {
  const hash = await wallet(a).writeContract(req as never);
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`${label} gagal (${hash})`);
  log(`  ✓ ${label} · ${hash.slice(0, 12)}…`);
  return r;
}

/** Isi tBNB sampai `min`, diambil dari wallet investor contoh yang saldonya paling besar. */
async function ensureGas(to: Address, min: bigint) {
  const bal = await pub.getBalance({ address: to });
  if (bal >= min) return;
  const need = min - bal;
  const balances = await Promise.all(donors.map((d) => pub.getBalance({ address: d.address })));
  const i = balances.indexOf(balances.reduce((a, b) => (b > a ? b : a)));
  if (balances[i] < need + parseEther("0.001")) throw new Error(`tBNB donor kurang untuk mengisi ${to}`);
  const hash = await wallet(donors[i]).sendTransaction({ to, value: need });
  await pub.waitForTransactionReceipt({ hash });
  log(`  ✓ ${formatEther(need)} tBNB → ${to.slice(0, 8)}… (dari donor #${i + 3})`);
}

async function ensureUsdt(to: Address, min: bigint) {
  const bal = await pub.readContract({ address: t.usdt, abi: mockUSDTAbi, functionName: "balanceOf", args: [to] });
  if (bal < min) await send(admin, { address: t.usdt, abi: mockUSDTAbi, functionName: "mint", args: [to, min - bal] }, `mint ${formatEther(min - bal)} mUSDT`);
}

const PINATA_JWT = requireEnv("PINATA_JWT", "JWT Pinata");
async function pin(data: Blob, name: string) {
  const form = new FormData();
  form.append("file", data, name);
  form.append("network", "public");
  form.append("name", name);
  const res = await fetch("https://uploads.pinata.cloud/v3/files", { method: "POST", headers: { Authorization: `Bearer ${PINATA_JWT}` }, body: form });
  const body = (await res.json().catch(() => ({}))) as { data?: { cid?: string } };
  if (!res.ok || !body.data?.cid) throw new Error(`Unggah ${name} gagal (HTTP ${res.status}).`);
  return body.data.cid;
}

const factory = { address: t.factory, abi: campaignFactoryAbi } as const;

log("== Akun demo juri");
log(`  Koperasi Demo ${coop.address}\n           Petani Demo   ${farmer.address}\n           Investor Demo ${investor.address}`);
await ensureGas(coop.address, parseEther("0.003"));
await ensureGas(farmer.address, parseEther("0.004"));
await ensureGas(investor.address, parseEther("0.003"));
if (!(await pub.readContract({ ...factory, functionName: "isCooperative", args: [coop.address] })))
  await send(admin, { ...factory, functionName: "registerCooperative", args: [coop.address, "Koperasi Demo Juri"] }, "daftar Koperasi Demo Juri");
if ((await pub.readContract({ ...factory, functionName: "farmerCooperative", args: [farmer.address] })) === "0x0000000000000000000000000000000000000000")
  await send(coop, { ...factory, functionName: "registerFarmer", args: [farmer.address, "Pak Juri (petani demo)"] }, "daftar Pak Juri (petani demo)");
await ensureUsdt(investor.address, usdt(3000));
await ensureUsdt(farmer.address, usdt(2000));

const last = state.campaigns?.at(-1);
if (!last || process.argv.includes("--baru")) {
  log("== Proyek demo baru");
  const coverImageCID = await pin(new Blob([await readFile(path.join(AGENT_ROOT, "../docs/demo-photos/juri/sampul-jagung.jpg"))], { type: "image/jpeg" }), "demo-sampul-jagung.jpg");
  const n = (state.campaigns?.length ?? 0) + 1;
  const meta = {
    schema: "bagipanen.campaign.v1",
    title: `Proyek demo juri #${n}: jagung di Gunungkidul`,
    story:
      "Proyek ini khusus untuk dicoba juri. Masuk sebagai Petani Demo untuk mengirim foto lahan, tunggu agen AI menilainya, lalu masuk sebagai Koperasi Demo untuk mengonfirmasi sampai dana tahap cair.",
    farmerName: "Pak Juri (petani demo)",
    cooperativeName: "Koperasi Demo Juri",
    commodity: "Jagung",
    costPlan: [
      { item: "Benih jagung", usdt: 150 },
      { item: "Pupuk", usdt: 200 },
      { item: "Upah tenaga kerja", usdt: 150 },
    ],
    coverImageCID,
  };
  const metadataCID = await pin(new Blob([JSON.stringify(meta)], { type: "application/json" }), `campaign-demo-juri-${n}.json`);
  const now = Math.floor(Date.now() / 1000);
  const r = await send(
    farmer,
    {
      ...factory,
      functionName: "createCampaign",
      args: [
        {
          commodity: "Jagung",
          locationName: "Wonosari, Gunungkidul, DI Yogyakarta",
          latE6: -7966700,
          lonE6: 110600000,
          landAreaM2: 2500,
          targetAmount: usdt(500),
          estimatedRevenue: usdt(760),
          fundingDuration: BigInt(30 * 86400),
          expectedHarvestDate: BigInt(now + 100 * 86400),
          metadataCID,
          milestoneNames: ["Tanam", "Tumbuh", "Pra-panen"],
          milestoneBps: [4000, 3500, 2500],
        },
      ],
    },
    "Pak Juri ajukan proyek",
  );
  const [ev] = parseEventLogs({ abi: campaignFactoryAbi, logs: r.logs, eventName: "CampaignCreated" });
  const addr = ev.args.campaign;
  state.campaigns = [...(state.campaigns ?? []), addr];
  await writeFile(STATE, JSON.stringify(state, null, 2));
  await send(admin, { ...factory, functionName: "approveCampaign", args: [addr] }, "admin setujui");
  await send(investor, { address: t.usdt, abi: mockUSDTAbi, functionName: "approve", args: [addr, usdt(500)] }, "izinkan mUSDT");
  await send(investor, { address: addr, abi: harvestCampaignAbi, functionName: "fund", args: [usdt(500)] }, "Investor Demo danai 500");
  log(`  proyek demo: ${addr}`);
} else log(`== Proyek demo yang ada: ${last}`);
log("== Selesai");
