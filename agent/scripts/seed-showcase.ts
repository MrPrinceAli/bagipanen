/**
 * Enam proyek tanam contoh di BSC testnet, dua per status (Cari dana, Berjalan, Selesai), di daerah
 * yang berbeda. Setiap daerah punya koperasi & petani sendiri (wallet dari TESTNET_MNEMONIC, indeks 7+).
 *
 *   npm run seed:showcase            (APP_MODE=testnet di agent/.env; agen harus sedang berjalan)
 *
 * Semua langkah lewat transaksi sungguhan, sama seperti lewat UI. Foto bukti dinilai agen AI yang
 * sedang berjalan (Gemini); script ini hanya menunggu putusannya, lalu koperasi mengonfirmasi.
 * Aman dijalankan ulang: setiap langkah mengecek status di chain dulu, alamat proyek disimpan di
 * data/showcase.json. Foto & nota: docs/demo-photos/showcase (sumber di docs/demo-photos/SUMBER.md).
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

if (IS_LOCAL) throw new Error("seed:showcase hanya untuk testnet (APP_MODE=testnet di agent/.env).");
// Mnemonic & RPC dari contracts/.env (sama dengan script Foundry). RPC resmi BNB menjawab harga gas
// 0,1 gwei; RPC agen (Sentio, dipilih untuk getLogs) menjawab 1 gwei sehingga plafon gas dari saldo
// petani tidak cukup untuk deploy proyek (~3,5 juta gas) dan estimasi revert "0x".
const contractsEnv = dotenv.parse(await readFile(path.join(AGENT_ROOT, "../contracts/.env"), "utf8").catch(() => ""));
const RPC = contractsEnv.BSC_TESTNET_RPC || config.rpcUrl;

const PHOTOS = path.join(AGENT_ROOT, "../docs/demo-photos/showcase");
const STATE_FILE = path.join(AGENT_ROOT, "data/showcase.json");
const MILESTONES = { names: ["Tanam", "Tumbuh", "Pra-panen"], bps: [4000, 3500, 2500] };
const DAY = 86_400;
const usdt = (n: number) => parseUnits(String(n), 18);

type Investor = "rina" | "budi" | "sari";
type Project = {
  key: string;
  idx: number; // indeks wallet koperasi; petani = idx + 1
  cooperative: string;
  farmer: string;
  commodity: string;
  title: string;
  story: string;
  locationName: string;
  lat: number;
  lon: number;
  areaM2: number;
  target: number;
  estimate: number;
  harvestInDays: number;
  fundingDays: number;
  costPlan: { item: string; usdt: number }[];
  funding: Partial<Record<Investor, number>>;
  /** Foto bukti per milestone yang dikirim (urut). */
  proofs: string[];
  harvest?: { amount: number; receipt: string };
  claim?: boolean;
};

// Koordinat: perkiraan pusat kecamatan (Wikipedia). Nama orang & koperasi fiktif.
const PROJECTS: Project[] = [
  {
    key: "nganjuk",
    idx: 7,
    cooperative: "Koperasi Tani Brambang Makmur, Nganjuk",
    farmer: "Pak Sarmin",
    commodity: "Bawang merah",
    title: "Bawang merah musim kemarau di Rejoso, Nganjuk",
    story:
      "Pak Sarmin menanam bawang merah di lahan 0,3 ha di Rejoso, Nganjuk, salah satu sentra bawang merah Jawa Timur. Modalnya untuk bibit umbi, pupuk, obat tanaman, dan upah tenaga kerja selama sekitar 70 hari.",
    locationName: "Rejoso, Nganjuk, Jawa Timur",
    lat: -7.5761,
    lon: 111.9327,
    areaM2: 3000,
    target: 900,
    estimate: 1400,
    harvestInDays: 80,
    fundingDays: 45,
    costPlan: [
      { item: "Bibit umbi bawang merah", usdt: 450 },
      { item: "Pupuk & obat tanaman", usdt: 250 },
      { item: "Upah tenaga kerja", usdt: 200 },
    ],
    funding: { rina: 300, budi: 240 },
    proofs: [],
  },
  {
    key: "karo",
    idx: 9,
    cooperative: "Koperasi Tani Sinabung Jaya, Karo",
    farmer: "Pak Edi Sembiring",
    commodity: "Kentang",
    title: "Kentang dataran tinggi di Berastagi, Karo",
    story:
      "Pak Edi Sembiring menanam kentang di lahan 0,4 ha di kaki Gunung Sibayak, Berastagi. Modal musim ini dipakai untuk bibit kentang G2, pupuk, fungisida, dan upah tenaga kerja.",
    locationName: "Berastagi, Karo, Sumatera Utara",
    lat: 3.1907,
    lon: 98.5083,
    areaM2: 4000,
    target: 1200,
    estimate: 1850,
    harvestInDays: 115,
    fundingDays: 45,
    costPlan: [
      { item: "Bibit kentang G2", usdt: 600 },
      { item: "Pupuk & fungisida", usdt: 350 },
      { item: "Upah tenaga kerja", usdt: 250 },
    ],
    funding: { sari: 300 },
    proofs: [],
  },
  {
    key: "kulonprogo",
    idx: 11,
    cooperative: "Koperasi Tani Pesisir Mandiri, Kulon Progo",
    farmer: "Bu Sumarni",
    commodity: "Cabai rawit",
    title: "Cabai rawit di lahan pasir pantai Galur, Kulon Progo",
    story:
      "Bu Sumarni menanam cabai rawit di lahan pasir pantai Galur seluas 0,25 ha, memakai mulsa plastik dan sumur renteng. Modalnya untuk bibit, mulsa, pupuk, dan pompa air.",
    locationName: "Galur, Kulon Progo, DI Yogyakarta",
    lat: -7.9539,
    lon: 110.2081,
    areaM2: 2500,
    target: 700,
    estimate: 1150,
    harvestInDays: 105,
    fundingDays: 30,
    costPlan: [
      { item: "Bibit & mulsa plastik", usdt: 250 },
      { item: "Pupuk & obat tanaman", usdt: 250 },
      { item: "Pompa air & upah tenaga kerja", usdt: 200 },
    ],
    funding: { rina: 400, sari: 300 },
    proofs: [],
  },
  {
    key: "lombok",
    idx: 13,
    cooperative: "Koperasi Tani Sasak Bersatu, Lombok Tengah",
    farmer: "Pak Lalu Hamdi",
    commodity: "Padi",
    title: "Padi sawah tadah hujan di Praya, Lombok Tengah",
    story:
      "Pak Lalu Hamdi menggarap sawah tadah hujan 0,6 ha di Praya. Modal musim hujan ini untuk benih, olah lahan, pupuk, serta upah tanam dan panen.",
    locationName: "Praya, Lombok Tengah, NTB",
    lat: -8.7056,
    lon: 116.2706,
    areaM2: 6000,
    target: 800,
    estimate: 1180,
    harvestInDays: 105,
    fundingDays: 30,
    costPlan: [
      { item: "Benih & olah lahan", usdt: 250 },
      { item: "Pupuk", usdt: 300 },
      { item: "Upah tanam & panen", usdt: 250 },
    ],
    funding: { budi: 500, sari: 300 },
    proofs: ["lombok-tanam.jpg"],
  },
  {
    key: "sidrap",
    idx: 15,
    cooperative: "Koperasi Tani Lumbung Sidenreng, Sidrap",
    farmer: "Pak Andi Baso",
    commodity: "Padi",
    title: "Padi sawah irigasi di Watang Pulu, Sidrap",
    story:
      "Pak Andi Baso menggarap sawah irigasi 0,8 ha di Sidrap, salah satu lumbung padi Sulawesi Selatan. Modalnya untuk benih, sewa traktor, pupuk, pestisida, dan upah tenaga kerja.",
    locationName: "Watang Pulu, Sidrap, Sulawesi Selatan",
    lat: -3.8833,
    lon: 119.7667,
    areaM2: 8000,
    target: 1000,
    estimate: 1520,
    harvestInDays: 100,
    fundingDays: 30,
    costPlan: [
      { item: "Benih & sewa traktor", usdt: 300 },
      { item: "Pupuk & pestisida", usdt: 400 },
      { item: "Upah tenaga kerja", usdt: 300 },
    ],
    funding: { rina: 500, budi: 300, sari: 200 },
    proofs: ["sidrap-tanam.jpg", "sidrap-tumbuh.jpg", "sidrap-pra-panen.jpg"],
    harvest: { amount: 1560, receipt: "sidrap-nota.jpg" },
    claim: true,
  },
  {
    key: "tanahlaut",
    idx: 17,
    cooperative: "Koperasi Tani Borneo Lestari, Tanah Laut",
    farmer: "Pak Rahmadi",
    commodity: "Jagung",
    title: "Jagung hibrida di Pelaihari, Tanah Laut",
    story:
      "Pak Rahmadi menanam jagung hibrida di lahan 1 ha di Pelaihari, sentra jagung Kalimantan Selatan. Modalnya untuk benih, pupuk, upah tenaga kerja, dan sewa alat pemipil.",
    locationName: "Pelaihari, Tanah Laut, Kalimantan Selatan",
    lat: -3.8,
    lon: 114.7667,
    areaM2: 10000,
    target: 1100,
    estimate: 1600,
    harvestInDays: 100,
    fundingDays: 30,
    costPlan: [
      { item: "Benih jagung hibrida", usdt: 300 },
      { item: "Pupuk", usdt: 450 },
      { item: "Upah tenaga kerja & sewa alat", usdt: 350 },
    ],
    funding: { budi: 600, sari: 500 },
    proofs: ["tanahlaut-tanam.jpg", "tanahlaut-tumbuh.jpg", "tanahlaut-pra-panen.jpg"],
    harvest: { amount: 1700, receipt: "tanahlaut-nota.jpg" },
  },
];

// ---------------------------------------------------------------- klien & akun

const testnet = deployments.bscTestnet as unknown as { factory: Address; usdt: Address };
const mnemonic = contractsEnv.TESTNET_MNEMONIC;
if (!mnemonic) throw new Error("TESTNET_MNEMONIC belum diisi di contracts/.env.");
const acct = (i: number) => mnemonicToAccount(mnemonic, { addressIndex: i });
const admin = acct(0);
const investors: Record<Investor, HDAccount> = { rina: acct(3), budi: acct(4), sari: acct(5) };

const pub = createPublicClient({ chain, transport: http(RPC) });
const wallet = (account: HDAccount) => createWalletClient({ account, chain, transport: http(RPC) });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (msg: string) => console.log(`${new Date().toLocaleTimeString("id-ID", { hour12: false })} ${msg}`);

async function send(account: HDAccount, req: Parameters<ReturnType<typeof wallet>["writeContract"]>[0], label: string) {
  // RPC publik kadang gagal sesaat (mis. node tertinggal satu-dua blok) → coba lagi sebentar kemudian.
  let hash: `0x${string}` | undefined;
  for (let attempt = 1; !hash; attempt++) {
    try {
      hash = await wallet(account).writeContract(req as never);
    } catch (e) {
      if (attempt >= 4) throw e;
      log(`  … ${label} belum bisa dikirim (${(e as { shortMessage?: string }).shortMessage ?? "galat"}), coba lagi`);
      await sleep(6_000 * attempt);
    }
  }
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${label} gagal (tx ${hash})`);
  log(`  ✓ ${label} · ${hash.slice(0, 12)}…`);
  return receipt;
}

/** Isi tBNB untuk gas dari admin bila saldo di bawah `min`. */
async function ensureGas(to: Address, min: bigint) {
  const bal = await pub.getBalance({ address: to });
  if (bal >= min) return;
  const hash = await wallet(admin).sendTransaction({ to, value: min - bal });
  await pub.waitForTransactionReceipt({ hash });
  log(`  ✓ kirim ${formatEther(min - bal)} tBNB ke ${to.slice(0, 8)}…`);
}

async function ensureUsdt(to: Address, need: bigint) {
  const bal = await pub.readContract({ address: testnet.usdt, abi: mockUSDTAbi, functionName: "balanceOf", args: [to] });
  if (bal < need) await send(admin, { address: testnet.usdt, abi: mockUSDTAbi, functionName: "mint", args: [to, need - bal] }, `mint ${formatEther(need - bal)} mUSDT`);
}

async function approveUsdt(owner: HDAccount, spender: Address, amount: bigint) {
  const allowance = await pub.readContract({ address: testnet.usdt, abi: mockUSDTAbi, functionName: "allowance", args: [owner.address, spender] });
  if (allowance < amount) await send(owner, { address: testnet.usdt, abi: mockUSDTAbi, functionName: "approve", args: [spender, amount] }, "izinkan mUSDT");
}

// ---------------------------------------------------------------- IPFS (Pinata)

const PINATA_JWT = requireEnv("PINATA_JWT", "JWT Pinata");
async function pin(data: Blob, name: string): Promise<string> {
  const form = new FormData();
  form.append("file", data, name);
  form.append("network", "public");
  form.append("name", name);
  const res = await fetch("https://uploads.pinata.cloud/v3/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  const body = (await res.json().catch(() => ({}))) as { data?: { cid?: string } };
  if (!res.ok || !body.data?.cid) throw new Error(`Unggah ${name} ke Pinata gagal (HTTP ${res.status}).`);
  return body.data.cid;
}
const pinPhoto = async (file: string) => pin(new Blob([await readFile(path.join(PHOTOS, file))], { type: "image/jpeg" }), file);

// ---------------------------------------------------------------- state

type State = Record<string, { campaign?: Address }>;
const state: State = JSON.parse(await readFile(STATE_FILE, "utf8").catch(() => "{}"));
const saveState = () => writeFile(STATE_FILE, JSON.stringify(state, null, 2));

const factory = { address: testnet.factory, abi: campaignFactoryAbi } as const;
const STATUS = ["Draft", "Cari dana", "Berjalan", "Selesai", "Gagal", "Dibatalkan"];
const M_RELEASED = 5;
const M_REJECTED = 3;

async function readCampaign(addr: Address) {
  const [summary, milestones] = await Promise.all([
    pub.readContract({ address: addr, abi: harvestCampaignAbi, functionName: "getSummary" }),
    pub.readContract({ address: addr, abi: harvestCampaignAbi, functionName: "getMilestones" }),
  ]);
  return { summary, milestones };
}

// ---------------------------------------------------------------- langkah per proyek

async function onboard(p: Project, coop: HDAccount, farmer: HDAccount) {
  await ensureGas(coop.address, parseEther("0.0015"));
  await ensureGas(farmer.address, parseEther("0.003"));
  if (!(await pub.readContract({ ...factory, functionName: "isCooperative", args: [coop.address] })))
    await send(admin, { ...factory, functionName: "registerCooperative", args: [coop.address, p.cooperative] }, `daftar koperasi ${p.cooperative}`);
  const registeredCoop = await pub.readContract({ ...factory, functionName: "farmerCooperative", args: [farmer.address] });
  if (registeredCoop === "0x0000000000000000000000000000000000000000")
    await send(coop, { ...factory, functionName: "registerFarmer", args: [farmer.address, p.farmer] }, `daftar petani ${p.farmer}`);
}

async function create(p: Project, farmer: HDAccount): Promise<Address> {
  const existing = state[p.key]?.campaign;
  if (existing) return existing;
  const coverImageCID = await pinPhoto(`${p.key}-sampul.jpg`);
  const meta = {
    schema: "bagipanen.campaign.v1",
    title: p.title,
    story: p.story,
    farmerName: p.farmer,
    cooperativeName: p.cooperative,
    commodity: p.commodity,
    costPlan: p.costPlan,
    coverImageCID,
  };
  const metadataCID = await pin(new Blob([JSON.stringify(meta)], { type: "application/json" }), `campaign-${p.key}.json`);
  const now = Math.floor(Date.now() / 1000);
  const receipt = await send(
    farmer,
    {
      ...factory,
      functionName: "createCampaign",
      args: [
        {
          commodity: p.commodity,
          locationName: p.locationName,
          latE6: Math.round(p.lat * 1e6),
          lonE6: Math.round(p.lon * 1e6),
          landAreaM2: p.areaM2,
          targetAmount: usdt(p.target),
          estimatedRevenue: usdt(p.estimate),
          fundingDuration: BigInt(p.fundingDays * DAY),
          expectedHarvestDate: BigInt(now + p.harvestInDays * DAY),
          metadataCID,
          milestoneNames: MILESTONES.names,
          milestoneBps: MILESTONES.bps,
        },
      ],
    },
    "ajukan proyek",
  );
  const [ev] = parseEventLogs({ abi: campaignFactoryAbi, logs: receipt.logs, eventName: "CampaignCreated" });
  state[p.key] = { campaign: ev.args.campaign };
  await saveState();
  return ev.args.campaign;
}

async function fund(p: Project, addr: Address) {
  for (const [name, amount] of Object.entries(p.funding) as [Investor, number][]) {
    const inv = investors[name];
    const have = await pub.readContract({ address: addr, abi: harvestCampaignAbi, functionName: "balanceOf", args: [inv.address] });
    const want = usdt(amount);
    if (have >= want) continue;
    await ensureGas(inv.address, parseEther("0.003"));
    await ensureUsdt(inv.address, want - have);
    await approveUsdt(inv, addr, want - have);
    await send(inv, { address: addr, abi: harvestCampaignAbi, functionName: "fund", args: [want - have] }, `${name} danai ${amount} mUSDT`);
  }
}

/** Kirim bukti, tunggu putusan agen AI yang sedang berjalan, lalu koperasi mengonfirmasi. */
async function milestone(p: Project, addr: Address, i: number, farmer: HDAccount, coop: HDAccount) {
  let m = (await readCampaign(addr)).milestones[i];
  if (m.status === M_RELEASED) return;
  if (m.status === 0 || m.status === M_REJECTED) {
    if (m.status === M_REJECTED) throw new Error(`Bukti ${m.name} ${p.key} pernah ditolak agen; cek alasannya dulu sebelum mengirim ulang.`);
    const cid = await pinPhoto(p.proofs[i]);
    await send(farmer, { address: addr, abi: harvestCampaignAbi, functionName: "submitProof", args: [cid] }, `kirim bukti ${m.name}`);
  }
  log(`  … menunggu putusan agen AI untuk ${m.name}`);
  const deadline = Date.now() + 15 * 60_000;
  while (!m.aiDecided) {
    if (Date.now() > deadline) throw new Error(`Agen belum memutus bukti ${m.name} ${p.key} setelah 15 menit. Pastikan agen berjalan.`);
    await sleep(10_000);
    m = (await readCampaign(addr)).milestones[i];
  }
  if (!m.aiApproved) throw new Error(`Agen MENOLAK bukti ${m.name} ${p.key} (alasan: ipfs ${m.aiReasonCID}).`);
  log(`  ✓ agen AI menyetujui ${m.name}`);
  if (!m.verifierDecided)
    await send(coop, { address: addr, abi: harvestCampaignAbi, functionName: "verifierDecision", args: [true] }, `koperasi setujui ${m.name} → dana cair`);
}

async function harvest(p: Project, addr: Address, farmer: HDAccount) {
  if (!p.harvest) return;
  const amount = usdt(p.harvest.amount);
  await ensureUsdt(farmer.address, amount);
  await approveUsdt(farmer, addr, amount);
  const cid = await pinPhoto(p.harvest.receipt);
  await send(farmer, { address: addr, abi: harvestCampaignAbi, functionName: "depositHarvest", args: [amount, cid] }, `setor hasil panen ${p.harvest.amount} mUSDT`);
}

async function claimAll(addr: Address) {
  for (const [name, inv] of Object.entries(investors)) {
    const c = await pub.readContract({ address: addr, abi: harvestCampaignAbi, functionName: "claimable", args: [inv.address] });
    if (c > 0n) await send(inv, { address: addr, abi: harvestCampaignAbi, functionName: "claim" }, `${name} klaim ${formatEther(c)} mUSDT`);
  }
}

async function run(p: Project) {
  const coop = acct(p.idx);
  const farmer = acct(p.idx + 1);
  log(`== ${p.title}`);
  await onboard(p, coop, farmer);
  const addr = await create(p, farmer);
  log(`  proyek ${addr}`);

  if ((await readCampaign(addr)).summary.status === 0)
    await send(admin, { ...factory, functionName: "approveCampaign", args: [addr] }, "admin setujui proyek");
  await fund(p, addr);
  for (let i = 0; i < p.proofs.length; i++) await milestone(p, addr, i, farmer, coop);

  let { summary } = await readCampaign(addr);
  if (summary.status === 2 && p.harvest && summary.currentMilestone === MILESTONES.names.length) await harvest(p, addr, farmer);
  ({ summary } = await readCampaign(addr));
  if (summary.status === 3 && p.claim) await claimAll(addr);
  ({ summary } = await readCampaign(addr));
  log(`  status: ${STATUS[summary.status]}`);
}

const only = process.argv.slice(2);
for (const p of PROJECTS) if (only.length === 0 || only.includes(p.key)) await run(p);
log("== Selesai");
