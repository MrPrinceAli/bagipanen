# PRD BagiPanen — Pendanaan Panen Petani (RWA + Agen AI di BNB Chain)

Sep 30, 2026 · @Ali

## Cara memakai dokumen ini

Dokumen ini adalah satu-satunya acuan untuk membangun BagiPanen dengan Claude Code; simpan di repo sebagai `docs/PRD.md` (ekspor sebagai Markdown).

**Prinsip utama (berlaku untuk semua keputusan):**

1. Ini proyek hackathon, bukan produk komersial. Semua layanan harus gratis.
2. Alur end-to-end yang jalan tanpa error lebih penting daripada fitur tambahan.
3. Jangan mengarang alamat kontrak, ABI, nama fungsi, atau versi library. Jika tidak yakin, baca dokumentasi resmi dulu atau tanyakan.
4. Semua teks antarmuka dalam Bahasa Indonesia.
5. Tidak ada private key atau API key di kode; semua lewat `.env`.

**Isi `CLAUDE.md` di root repo:**

```markdown
# BagiPanen — instruksi untuk Claude Code
- Acuan utama: docs/PRD.md. Baca bagian yang relevan sebelum mengerjakan tugas.
- Monorepo: contracts/ (Foundry), web/ (Next.js App Router + TypeScript), agent/ (Node.js + TypeScript).
- Jaringan: bangun & uji di Anvil lokal (APP_MODE=local), target akhir BSC testnet (chain ID 97). Token: MockUSDT 18 desimal.
- Penyimpanan, penilaian foto, dan jaringan memakai adapter yang dipilih dari .env; jangan hardcode Pinata/Gemini/BSC.
- Setiap fungsi kontrak wajib punya test Foundry. Jalankan `forge test` sebelum menyatakan selesai.
- Jangan mengarang alamat kontrak/ABI ERC-8004; cek dokumentasi resmi BNB Chain.
- UI berbahasa Indonesia, mobile-first, Tailwind.
- Rahasia hanya di .env (lihat .env.example). Jangan commit .env.
- Kerjakan per langkah, buat rencana dulu untuk tugas besar, commit setelah tiap fitur jalan.
```

## Ringkasan produk

BagiPanen adalah platform pendanaan modal tanam untuk petani Indonesia di BNB Chain: investor mendanai satu musim tanam dengan stablecoin, dana cair bertahap setelah diverifikasi agen AI dan koperasi, lalu hasil panen dibagi otomatis oleh smart contract.

**Pitch satu kalimat:** Modal tanam yang adil untuk petani, transparan untuk investor, diverifikasi AI, tercatat onchain.

**Konteks:** Indonesia Web3 Hackathon 2026 (co-host Binance Academy, BNB Chain, Coinvestasi). Batas submission 7 Oktober 2026.

**Track:** Finance & Commerce (utama: RWA + stablecoin), AI Agents (agen verifikator dengan identitas ERC-8004), Consumer Apps.

**Tiga pembeda utama:**

- Dua kunci pencairan: dana hanya cair jika agen AI **dan** koperasi setuju.
- Agen verifikator punya identitas ERC-8004 resmi di BNB Chain.
- Rapor Petani: rekam jejak panen onchain sebagai riwayat kredit alternatif bagi petani yang tidak tercatat di SLIK OJK.

## Masalah, solusi, dan kenapa BNB Chain

Petani kecil sulit mendapat kredit bank karena tidak punya riwayat kredit, sehingga modal tanam datang dari tengkulak lewat sistem ijon: panen dibeli murah sebelum waktunya.

**Solusi:** investor ritel mendanai modal tanam lewat smart contract. Dana dikunci, dicairkan per tahap setelah bukti lapangan diverifikasi, dan keuntungan dibagi dengan porsi terbesar untuk petani (55%). Setiap musim yang selesai menambah Rapor Petani onchain.

**Kenapa butuh blockchain:** dana tidak bisa diambil sepihak (termasuk oleh admin), setiap pencairan dan bukti tercatat publik, dan bagi hasil berjalan otomatis tanpa perantara.

**Kenapa BNB Chain:**

- Biaya transaksi rendah dan cepat, sehingga investasi kecil tetap masuk akal.
- Ekosistem stablecoin besar, cocok untuk pendanaan dan bagi hasil.
- Dukungan native untuk identitas agen AI (ERC-8004).
- Pionir: kebanyakan agen onchain masih seputar trading dan data; BagiPanen menghubungkan AI + RWA + sektor riil pertanian.

## Aktor & peran

Enam aktor; peran di aplikasi ditentukan otomatis dari alamat wallet yang login (semua memakai MetaMask).

| Aktor | Tanggung jawab | Cara dikenali di kontrak | Contoh demo |
| --- | --- | --- | --- |
| Admin | Mendaftarkan koperasi, menyetujui kampanye, menangani sengketa & gagal panen | `owner` di `CampaignFactory` | Tim BagiPanen |
| Koperasi | Mendaftarkan petani, verifikasi lapangan tiap milestone, membantu penjualan | `isCooperative[addr] == true` | Koperasi Tani Makmur, Garut |
| Petani | Mengajukan kampanye, unggah bukti, setor hasil panen | `farmerCooperative[addr] != address(0)` | Pak Darto, cabai 0,5 ha |
| Investor | Mendanai, klaim bagi hasil / refund | Wallet lain mana pun | Rina, Budi, Sari |
| Agen AI | Menilai bukti foto + cuaca, mencatat putusan | Wallet agen yang terikat ke ID ERC-8004 | BagiPanen Verifier Agent |
| Smart contract | Menyimpan dana, menjalankan aturan, membagi hasil | — | BSC testnet |

Satu wallet hanya memegang satu peran. Untuk demo siapkan 7 akun MetaMask: admin, koperasi, petani, 3 investor, dan agen.

## Proses bisnis

Satu kampanye berjalan dalam lima fase, dari onboarding sampai bagi hasil; fase 4 berulang untuk tiap milestone.

**Fase 1 — Onboarding**

1. **Admin** mendaftarkan wallet koperasi (`registerCooperative`).
2. **Koperasi** mendaftarkan wallet petani anggotanya (`registerFarmer`).

**Fase 2 — Pengajuan**

3. **Petani** mengisi pengajuan: komoditas, lokasi (nama + koordinat), luas lahan, kebutuhan modal, estimasi hasil penjualan, perkiraan tanggal panen, foto lahan awal. Status: `Draft`.
4. **Admin** meninjau lalu menyetujui (`Funding`, tenggat dimulai) atau menolak (`Cancelled`).

**Fase 3 — Pendanaan**

5. **Investor** menyetor MockUSDT dan menerima token porsi 1:1. Setoran dibatasi sisa target.
6. Target tercapai → otomatis `Active`. Tenggat lewat dan target belum tercapai → siapa pun memanggil `finalizeFunding` → `Failed`, investor refund 100%.

**Fase 4 — Budidaya & pencairan (3 milestone: Tanam 40%, Tumbuh 35%, Pra-panen 25%)**

7. **Petani** mengunggah foto lahan (`submitProof`).
8. **Agen AI** menilai foto, metadata, dan cuaca, lalu mencatat putusan (`recordVerdict`).
9. **Koperasi** mengonfirmasi (`verifierDecision`).
10. **Smart contract** mencairkan dana tahap itu ke petani jika AI dan koperasi sama-sama setuju.

**Fase 5 — Panen & bagi hasil**

11. **Petani + koperasi** menjual panen; koperasi menerbitkan nota.
12. **Petani** menyetor hasil penjualan + foto nota (`depositHarvest`). Status: `Harvested`.
13. **Smart contract** langsung mengirim bagian petani dan dana cadangan; bagian investor siap diklaim.
14. **Investor** mengklaim (`claim`).
15. **Smart contract** memperbarui Rapor Petani dan statistik agen.

**Aturan bisnis:**

- Modal dikembalikan dulu ke investor, baru keuntungan dibagi **55% petani, 40% investor, 5% dana cadangan**.
- Dana tahap cair hanya jika `aiApproved && verifierApproved`.
- Milestone berurutan; milestone berikutnya baru bisa diajukan setelah yang sebelumnya cair.
- Token porsi tidak bisa dipindahtangankan di MVP (pasar sekunder = roadmap).
- Biaya platform nol untuk hackathon.
- UI menampilkan nilai dalam USDT dengan perkiraan rupiah memakai kurs tetap Rp16.000 per USDT (konstanta di frontend).

**Contoh perhitungan (dipakai juga sebagai data demo):**

| Pos | Penerima | USDT | ≈ Rupiah |
| --- | --- | --- | --- |
| Modal terkumpul (Rina 500, Budi 300, Sari 200) | Escrow | 1.000 | 16.000.000 |
| Cair Tanam (40%) | Petani | 400 | 6.400.000 |
| Cair Tumbuh (35%) | Petani | 350 | 5.600.000 |
| Cair Pra-panen (25%) | Petani | 250 | 4.000.000 |
| Hasil penjualan disetor | Kontrak | 1.650 | 26.400.000 |
| Keuntungan (1.650 − 1.000) | Dibagi | 650 | 10.400.000 |
| Bagian petani (55%) | Petani | 357,5 | 5.720.000 |
| Dana cadangan (5%) | ReservePool | 32,5 | 520.000 |
| Pool investor (modal + 40%) | Investor | 1.260 | 20.160.000 |
| Klaim Rina (50%) | Rina | 630 | 10.080.000 |
| Klaim Budi (30%) | Budi | 378 | 6.048.000 |
| Klaim Sari (20%) | Sari | 252 | 4.032.000 |

Imbal hasil investor: 26% dalam satu musim.

## Penanganan kondisi khusus

Setiap kondisi di bawah wajib diimplementasikan di kontrak dan punya test; kolom terakhir adalah fungsi yang menanganinya.

| Kondisi | Penanganan | Fungsi |
| --- | --- | --- |
| Target dana tidak tercapai saat tenggat | Status `Failed` (tipe Funding), investor refund 100% | `finalizeFunding`, `refund` |
| Foto ditolak AI atau koperasi | Milestone `Rejected`; petani boleh unggah ulang, maksimal 3 percobaan per milestone | `submitProof` |
| Ditolak pada percobaan ke-3 | Milestone `Disputed`; admin memutuskan setujui atau tolak final | `resolveDispute` |
| Gagal panen (bencana, dibuktikan data cuaca) saat `Active` | Admin menandai gagal; sisa dana yang belum cair menjadi pool investor, bisa ditambah kompensasi dari dana cadangan | `markFailed`, `ReservePool.compensate`, `claim` |
| Hasil panen lebih kecil dari modal | Seluruh setoran menjadi pool investor pro-rata; petani dan cadangan tidak mendapat bagian | `depositHarvest` |
| Petani tidak menyetor sampai perkiraan panen + 30 hari | Admin menandai default; Rapor Petani mencatat default, petani diblokir membuat kampanye baru | `markDefault` |
| Kampanye ditolak admin | Status `Cancelled`, tidak ada dana terlibat | `rejectCampaign` |

Klaim investor bersifat kumulatif: kompensasi yang masuk setelah investor klaim tetap bisa diklaim lagi secara adil.

## Arsitektur sistem

Tidak ada server atau database: smart contract menyimpan data dan dana, IPFS menyimpan file, dan agen AI menjadi satu-satunya proses off-chain yang aktif.

&#91;embedded content: arsitektur BagiPanen · web, kontrak, IPFS, agen AI\]

Agen membaca event `ProofSubmitted` dari kontrak, mengambil foto dari IPFS, lalu mengirim `recordVerdict` kembali ke kontrak; frontend hanya membaca kontrak dan mengunggah file lewat API route.

## Keputusan teknis & stack

Semua pilihan di bawah sudah final untuk hackathon dan semuanya gratis; Claude Code tidak perlu menebak.

| Area | Keputusan |
| --- | --- |
| Jaringan | BSC testnet, chain ID 97, tBNB dari faucet resmi BNB Chain |
| Stablecoin | `MockUSDT` (ERC-20, 18 desimal, `mint` terbuka untuk demo) |
| Smart contract | Solidity ^0.8.24, Foundry, OpenZeppelin Contracts v5 |
| Identitas agen | Registri identitas ERC-8004 resmi di BSC testnet; fallback `MockAgentIdentity` (ERC-721) jika tidak tersedia |
| Reputasi | Kontrak sendiri `ReputationBook` (petani + agen) |
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS, wagmi v2, viem v2, RainbowKit, TanStack Query |
| Login | MetaMask untuk semua peran (tanpa login sosial / gasless di MVP) |
| Backend | Tidak ada server & database; hanya API route Next.js untuk upload ke Pinata |
| Penyimpanan | IPFS via Pinata (free tier) |
| Agen AI | Node.js 20+, TypeScript, `tsx`, viem, `@google/genai`, `exifr`, `dotenv`; berjalan di laptop saat demo |
| Model AI | Model Gemini Flash terbaru yang mendukung gambar di free tier (cek dokumentasi Google AI Studio) |
| Cuaca | Open-Meteo (gratis, tanpa API key) |
| Hosting | Vercel (hobby tier), root directory `web/` |
| Verifikasi kontrak | `forge verify-contract` dengan API key BscScan/Etherscan (cek dokumentasi terbaru) |

**Batasan:** jangan menambah dependensi berbayar, database, atau layanan yang butuh kartu kredit.

## Struktur repo

Satu monorepo dengan tiga paket; alamat kontrak hasil deploy ditulis ke satu file JSON yang dibaca frontend dan agen.

```text
bagipanen/
├── CLAUDE.md
├── README.md
├── .env.example
├── docs/PRD.md
├── deployments/bscTestnet.json      # alamat kontrak (ditulis script deploy)
├── contracts/                       # Foundry
│   ├── foundry.toml
│   ├── src/
│   │   ├── MockUSDT.sol
│   │   ├── CampaignFactory.sol
│   │   ├── HarvestCampaign.sol
│   │   ├── ReservePool.sol
│   │   ├── ReputationBook.sol
│   │   ├── MockAgentIdentity.sol    # fallback ERC-8004
│   │   └── interfaces/IAgentIdentity.sol
│   ├── script/Deploy.s.sol
│   ├── script/Seed.s.sol            # opsional: data demo
│   └── test/
├── web/                             # Next.js
│   ├── app/
│   │   ├── page.tsx                 # daftar kampanye
│   │   ├── campaign/[address]/page.tsx
│   │   ├── create/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── koperasi/page.tsx
│   │   ├── admin/page.tsx
│   │   ├── petani/[address]/page.tsx  # Rapor Petani
│   │   ├── agent/page.tsx           # profil agen ERC-8004
│   │   └── api/upload/route.ts, api/upload-json/route.ts
│   ├── components/
│   └── lib/ (abi/, addresses.ts, wagmi.ts, format.ts, ipfs.ts, role.ts)
└── agent/                           # Node.js
    ├── src/
    │   ├── index.ts       # loop utama
    │   ├── chain.ts       # viem client, baca/tulis kontrak
    │   ├── ipfs.ts        # ambil gambar, unggah JSON
    │   ├── exif.ts        # cek GPS & tanggal
    │   ├── weather.ts     # Open-Meteo
    │   ├── vision.ts      # Gemini
    │   └── verdict.ts     # aturan keputusan akhir
    ├── scripts/register-agent.ts   # daftar ke ERC-8004
    ├── agent-card.json
    └── data/seen-hashes.json       # deteksi foto duplikat
```

Setelah deploy, script menyalin ABI dari `contracts/out/` ke `web/lib/abi/` dan `agent/src/abi/`.

## Spesifikasi smart contract

Enam kontrak; `HarvestCampaign` adalah inti (escrow, token porsi, milestone, bagi hasil) dan di-deploy satu per kampanye oleh `CampaignFactory`.

### Konstanta

```solidity
uint16 constant BPS = 10_000;
uint16 constant FARMER_PROFIT_BPS   = 5_500; // 55%
uint16 constant INVESTOR_PROFIT_BPS = 4_000; // 40%
uint16 constant RESERVE_PROFIT_BPS  =   500; // 5%
uint8  constant MAX_ATTEMPTS = 3;
uint64 constant DEFAULT_GRACE = 30 days;
// Milestone default: Tanam 4000, Tumbuh 3500, Pra-panen 2500 (jumlah wajib 10000)
```

### MockUSDT

ERC-20 OpenZeppelin, nama "Mock USDT", simbol "mUSDT", 18 desimal. `mint(address to, uint256 amount)` terbuka untuk siapa saja, maksimal 10.000 mUSDT per panggilan.

### CampaignFactory (Ownable)

| Fungsi | Siapa | Keterangan |
| --- | --- | --- |
| `registerCooperative(address coop, string name)` | owner | Masuk whitelist koperasi |
| `registerFarmer(address farmer, string name)` | koperasi | Menyimpan `farmerCooperative[farmer] = msg.sender` |
| `createCampaign(CampaignParams p) returns (address)` | petani terdaftar, tidak diblokir | `new HarvestCampaign(...)`, status `Draft` |
| `approveCampaign(address c)` / `rejectCampaign(address c)` | owner | Memanggil `c.startFunding()` / `c.cancel()` |
| `setAgent(address identityRegistry, uint256 agentId, address agentWallet)` | owner | Konfigurasi agen ERC-8004 |
| `isAgent(address a) view returns (bool)` | publik | `a == agentWallet` dan (jika registri resmi) `IAgentIdentity(identityRegistry).ownerOf(agentId) == a` |
| `getCampaigns() view returns (address[])` | publik | Semua kampanye |
| `getCampaignsByFarmer(address)` | publik | Untuk dashboard & Rapor Petani |

State: `isCooperative`, `cooperativeName`, `farmerCooperative`, `farmerName`, `isCampaign`, `campaigns[]`, `reputationBook`, `reservePool`, `usdt`.

```solidity
struct CampaignParams {
    string commodity;          // "Cabai merah"
    string locationName;       // "Cikajang, Garut"
    int32  latE6;              // lintang x 1e6
    int32  lonE6;              // bujur x 1e6
    uint32 landAreaM2;         // 5000
    uint256 targetAmount;      // 1000e18
    uint256 estimatedRevenue;  // 1650e18
    uint64 fundingDuration;    // detik; demo 600
    uint64 expectedHarvestDate;// unix time
    string metadataCID;        // JSON kampanye di IPFS
    string[] milestoneNames;   // ["Tanam","Tumbuh","Pra-panen"]
    uint16[] milestoneBps;     // [4000,3500,2500]
}
```

### HarvestCampaign (ERC20 token porsi + ReentrancyGuard)

Nama token "BagiPanen Share", simbol "BPS-\<id>". `transfer` dan `transferFrom` di-revert (non-transferable); hanya mint dan burn internal.

```solidity
enum Status { Draft, Funding, Active, Harvested, Failed, Cancelled, Defaulted }
enum FailType { None, Funding, Crop }
enum MStatus { Pending, ProofSubmitted, AIReviewed, Rejected, Disputed, Released }

struct Milestone {
    string  name;
    uint16  bps;
    MStatus status;
    uint8   attempts;
    string  proofCID;
    bool    aiDecided;
    bool    aiApproved;
    string  aiReasonCID;
    bool    verifierDecided;
    bool    verifierApproved;
    uint256 releasedAmount;
    uint64  submittedAt;
}
```

State penting: `factory`, `farmer`, `cooperative`, `usdt`, `params`, `status`, `failType`, `fundingDeadline`, `raisedAmount`, `currentMilestone`, `milestones[]`, `harvestAmount`, `receiptCID`, `investorPool`, `totalSharesAtSettle`, `paidOut[address]`.

| Fungsi | Siapa | Syarat | Efek |
| --- | --- | --- | --- |
| `startFunding()` | factory | `Draft` | `Funding`, `fundingDeadline = now + fundingDuration` |
| `cancel()` | factory | `Draft` | `Cancelled` |
| `fund(uint256 amount)` | siapa saja kecuali petani/koperasi | `Funding`, sebelum tenggat, `amount <= target - raised` | transferFrom USDT, mint share 1:1; jika penuh → `Active` |
| `finalizeFunding()` | siapa saja | `Funding`, tenggat lewat, belum penuh | `Failed`, `failType = Funding` |
| `refund()` | investor | `Failed` + `failType == Funding` | burn share, kembalikan USDT 1:1 |
| `submitProof(string cid)` | petani | `Active`; milestone `Pending` atau `Rejected`; `attempts < 3` | `ProofSubmitted`, reset keputusan, `attempts++` |
| `recordVerdict(bool ok, string reasonCID)` | `factory.isAgent(msg.sender)` | milestone `ProofSubmitted` | simpan putusan AI; `AIReviewed`; lalu `_tryResolve()` |
| `verifierDecision(bool ok)` | `cooperative` kampanye ini | milestone `ProofSubmitted` atau `AIReviewed` | simpan putusan; `_tryResolve()` |
| `resolveDispute(bool ok)` | factory owner | milestone `Disputed` | ok → release; tidak → `Rejected` final, admin bisa `markFailed` |
| `markFailed()` | factory owner | `Active` | `Failed`, `failType = Crop`, settle pool investor |
| `depositHarvest(uint256 amount, string receiptCID)` | petani | `Active`, semua milestone `Released` | hitung & kirim bagian, `Harvested` |
| `markDefault()` | factory owner | `Active`, `now > expectedHarvestDate + DEFAULT_GRACE` | `Defaulted`, settle sisa escrow, catat default |
| `addCompensation(uint256 amount)` | reservePool | `Failed` (Crop) atau `Defaulted` | `investorPool += amount` |
| `claim()` | investor | `Harvested`, `Failed` (Crop), `Defaulted` | kirim `owed - paidOut` |
| `getSummary()` / `getMilestones()` | view | — | satu panggilan untuk UI |

**Logika `_tryResolve()`** (dipanggil setelah AI atau koperasi memutuskan):

```text
jika aiDecided && verifierDecided:
    jika aiApproved && verifierApproved:
        amount = raisedAmount * bps / BPS   (milestone terakhir: sisa escrow agar tidak ada debu)
        transfer ke farmer, status = Released, currentMilestone++
    lainnya:
        jika attempts >= MAX_ATTEMPTS: status = Disputed
        lainnya: status = Rejected   (petani boleh submitProof lagi)
```

**Rumus `depositHarvest(amount)`** (transferFrom petani ke kontrak dulu):

```text
jika amount >= raisedAmount:
    profit        = amount - raisedAmount
    farmerShare   = profit * 5500 / 10000
    reserveShare  = profit * 500 / 10000
    investorPool  = amount - farmerShare - reserveShare
    transfer farmerShare ke farmer; transfer reserveShare ke ReservePool (panggil reservePool.contribute)
lainnya:
    investorPool  = amount           (petani & cadangan 0)
totalSharesAtSettle = totalSupply()
reputationBook.recordHarvest(farmer, amount, estimatedRevenue, onTime = now <= expectedHarvestDate + 7 days)
```

**Rumus `claim()`** (kumulatif, share tidak di-burn):

```text
owed = investorPool * balanceOf(msg.sender) / totalSharesAtSettle
pay  = owed - paidOut[msg.sender]; require pay > 0
paidOut[msg.sender] = owed; transfer pay
```

Saat `markFailed` / `markDefault`: `investorPool = usdt.balanceOf(this)` (sisa dana yang belum cair), `totalSharesAtSettle = totalSupply()`.

### ReservePool (Ownable, owner = admin)

`contribute(uint256 amount)` dipanggil kampanye (hanya `factory.isCampaign`), mencatat total. `compensate(address campaign, uint256 amount)` owner: transfer USDT ke kampanye lalu panggil `addCompensation`. `balance()` view.

### ReputationBook

Hanya bisa ditulis oleh alamat dengan `factory.isCampaign`.

```solidity
struct FarmerStats { uint32 campaignsFunded; uint32 harvestsCompleted; uint32 onTimeHarvests;
                     uint32 cropFailures; uint32 defaults; uint256 totalReported; uint256 totalEstimated; }
struct AgentStats  { uint32 verdicts; uint32 approvals; uint32 rejections; uint32 overturned; }
```

Fungsi tulis: `recordFunded`, `recordHarvest`, `recordCropFailure`, `recordDefault`, `recordVerdict(bool approved)`, `recordOverturn()` (dipanggil saat `resolveDispute` membatalkan putusan AI). Petani dengan `defaults > 0` diblokir di `createCampaign`.

### Event (wajib, dipakai frontend dan agen)

`CooperativeRegistered`, `FarmerRegistered`, `CampaignCreated(address campaign, address farmer)`, `CampaignApproved`, `CampaignRejected`, `Funded(address investor, uint256 amount)`, `FundingSucceeded`, `FundingFailed`, `Refunded`, `ProofSubmitted(uint8 index, string cid, uint8 attempt)`, `VerdictRecorded(uint8 index, bool approved, string reasonCID)`, `VerifierDecided(uint8 index, bool approved)`, `MilestoneRejected`, `MilestoneDisputed`, `TrancheReleased(uint8 index, uint256 amount)`, `HarvestDeposited(uint256 amount, string receiptCID)`, `Claimed(address investor, uint256 amount)`, `CampaignFailed`, `CampaignDefaulted`, `CompensationAdded`.

**Keamanan:** `ReentrancyGuard` di semua fungsi yang memindahkan dana, `SafeERC20`, pola checks-effects-interactions, custom error berbahasa Inggris singkat (misal `NotFarmer()`), tidak ada fungsi admin untuk menarik dana escrow.

## Integrasi ERC-8004

Identitas agen memakai registri identitas ERC-8004 resmi di BSC testnet; reputasi tetap dicatat di `ReputationBook` sendiri agar tidak bergantung pada aturan penilaian registri resmi.

**Langkah wajib sebelum menulis kode (tugas Claude Code):**

1. Cari di dokumentasi resmi BNB Chain alamat Identity Registry ERC-8004 untuk BSC testnet, beserta ABI dan fungsi pendaftarannya.
2. Konfirmasi fungsi untuk mengecek pemilik atau wallet agen (misal `ownerOf(agentId)` karena identitasnya berbasis ERC-721, atau getter wallet agen jika tersedia).
3. Tulis temuan ke `docs/erc8004-notes.md` (alamat, fungsi, sumber) dan minta konfirmasi sebelum lanjut.

**Alur pendaftaran (`agent/scripts/register-agent.ts`):**

1. Unggah `agent-card.json` ke IPFS.
2. Panggil fungsi pendaftaran di registri resmi dengan URI kartu tersebut dari wallet agen; simpan `agentId`.
3. Admin memanggil `factory.setAgent(registry, agentId, agentWallet)`.

**Isi `agent-card.json`** (ikuti format registration file resmi ERC-8004; field tambahan di bawah boleh ditambahkan sebagai metadata):

```json
{
  "name": "BagiPanen Verifier Agent",
  "description": "Agen AI independen yang memverifikasi bukti lapangan milestone pendanaan panen di BagiPanen.",
  "image": "ipfs://<cid-logo>",
  "agentWallet": "0x...",
  "bagipanen": {
    "role": "field-proof-verifier",
    "regions": ["Jawa Barat"],
    "commodities": ["Cabai merah", "Padi"],
    "partnerCooperatives": ["Koperasi Tani Makmur, Garut"],
    "methods": ["vision-llm", "exif-gps-check", "weather-open-meteo", "duplicate-hash"],
    "network": "bsc-testnet"
  }
}
```

**Fallback:** jika registri resmi tidak tersedia di testnet dalam 2 jam pencarian, deploy `MockAgentIdentity` (ERC-721 minimal dengan `register(string uri) returns (uint256)` dan `tokenURI`) dan pakai jalur yang sama. Di UI dan README tulis jujur registri mana yang dipakai.

**Agen harus independen:** wallet agen tidak boleh sama dengan wallet petani, koperasi, atau admin (dicek di `setAgent`).

## Spesifikasi agen AI

Agen adalah proses Node.js yang berjalan terus, menilai setiap bukti dalam 7 langkah, dan hanya menyetujui jika semua syarat keputusan terpenuhi.

**Loop utama (`index.ts`):**

- Polling setiap 10 detik dengan viem `getLogs` untuk event `ProofSubmitted` **tanpa filter alamat** (filter berdasarkan signature event), mulai dari blok terakhir yang diproses (disimpan di `data/state.json`).
- Abaikan log dari alamat yang `factory.isCampaign(addr) == false`.
- Idempoten: lewati jika milestone di kontrak sudah tidak berstatus `ProofSubmitted` atau `aiDecided == true` untuk percobaan itu.
- Jika satu bukti gagal diproses (error jaringan/API), coba ulang maksimal 3 kali dengan jeda 15 detik, lalu catat di log tanpa menghentikan loop.

**Pipeline per bukti:**

1. **Ambil konteks** dari kontrak: `getSummary()` (komoditas, lokasi, koordinat, perkiraan panen) dan milestone aktif (nama, percobaan ke-).
2. **Unduh foto** dari gateway IPFS berdasarkan CID; hitung SHA-256.
3. **Cek duplikat:** jika hash sudah ada di `data/seen-hashes.json` untuk kampanye atau milestone lain → tolak.
4. **Cek EXIF** dengan `exifr`: GPS dan `DateTimeOriginal`. Jarak ke koordinat lahan ≤ 2 km (haversine) dan tanggal ≤ 7 hari dari waktu submit. EXIF tidak ada → status `missing` (tidak langsung ditolak, dicatat di alasan). EXIF ada tapi lokasi/tanggal tidak cocok → tolak.
5. **Cuaca** dari Open-Meteo untuk koordinat lahan: `daily=precipitation_sum,temperature_2m_max,temperature_2m_min`, `past_days=14`, `forecast_days=7`, `timezone=Asia/Jakarta`. Tandai `extreme` jika curah hujan harian > 100 mm.
6. **Nilai foto dengan Gemini** (prompt di bawah), minta output JSON.
7. **Buat & unggah JSON putusan** ke IPFS, lalu panggil `recordVerdict(approved, reasonCID)` dari wallet agen.

**Aturan keputusan (`verdict.ts`):**

```text
approved = gemini.is_farm_photo
        && gemini.commodity_match
        && gemini.stage_match
        && gemini.confidence >= 0.70
        && exif.status != "mismatch"
        && !duplicate
```

**Prompt Gemini (system + user, gambar dilampirkan):**

```text
Kamu adalah verifikator lapangan pertanian yang teliti dan skeptis untuk platform BagiPanen.
Konteks kampanye: komoditas {commodity}, lokasi {locationName}, milestone "{milestoneName}"
(Tanam = bibit baru ditanam/lahan baru diolah; Tumbuh = tanaman vegetatif, daun berkembang;
Pra-panen = tanaman berbunga/berbuah, mendekati panen). Perkiraan panen: {expectedHarvestDate}.
Ringkasan cuaca 14 hari terakhir: {weatherSummary}.
Nilai foto terlampir. Jangan menyetujui foto yang bukan lahan pertanian, foto layar, gambar dari
internet, atau tanaman yang tidak sesuai komoditas. Balas HANYA JSON valid sesuai skema, tanpa teks lain.
```

**Skema output Gemini** (pakai structured output / `responseSchema`):

```json
{
  "is_farm_photo": true,
  "commodity_match": true,
  "detected_commodity": "cabai merah",
  "detected_stage": "Tumbuh",
  "stage_match": true,
  "plant_condition": "baik | sedang | buruk",
  "confidence": 0.86,
  "estimated_days_to_harvest": 45,
  "reason_id": "Tanaman cabai fase vegetatif, daun hijau merata, tidak tampak hama.",
  "red_flags": []
}
```

**JSON putusan yang diunggah ke IPFS (`reasonCID`):**

```json
{
  "schema": "bagipanen.verdict.v1",
  "campaign": "0x...",
  "milestoneIndex": 1,
  "attempt": 1,
  "proofCID": "bafy...",
  "approved": true,
  "summary_id": "Disetujui: fase tumbuh, kondisi baik, perkiraan panen ±45 hari lagi.",
  "vision": { "...output Gemini...": "" },
  "exif": { "status": "ok | missing | mismatch", "distanceKm": 0.4, "takenAt": "2026-10-03T08:12:00+07:00" },
  "weather": { "precip14dMm": 86.2, "maxDailyPrecipMm": 24.1, "extreme": false },
  "duplicate": false,
  "agent": { "registry": "0x...", "agentId": "12", "model": "gemini-..." },
  "decidedAt": "2026-10-03T08:13:05+07:00"
}
```

**Log konsol** harus mudah dibaca saat demo, misalnya: `[BUKTI] Kampanye 0x12..ab milestone Tumbuh (percobaan 1)` → `[AI] cabai, fase Tumbuh, yakin 0.86` → `[PUTUSAN] DISETUJUI → tx 0x...`.

**Tips demo:** foto yang dikirim lewat WhatsApp kehilangan EXIF; unggah langsung dari galeri kamera HP.

## Spesifikasi frontend

Delapan halaman, semua membaca data langsung dari kontrak dengan wagmi; tombol aksi yang tampil ditentukan oleh peran wallet (`lib/role.ts`).

| Halaman | Peran | Isi & aksi |
| --- | --- | --- |
| `/` | Semua | Hero singkat (pitch), statistik (total didanai, kampanye aktif, dana cadangan), kartu kampanye: komoditas, lokasi, progres dana, status, imbal hasil proyeksi |
| `/campaign/[address]` | Semua | Detail kampanye, peta sederhana (tautan Google Maps dari koordinat), progres dana, timeline 3 milestone dengan foto bukti, putusan AI (ringkasan, fase, kondisi, perkiraan panen) dan status koperasi, tautan BscScan per transaksi, tautan ke Rapor Petani. Aksi sesuai peran: Danai / Refund / Klaim (investor), Unggah bukti / Setor hasil panen (petani), Setujui / Tolak (koperasi) |
| `/create` | Petani | Form pengajuan (komoditas, lokasi, klik koordinat atau isi manual, luas, target, estimasi penjualan, perkiraan panen, durasi pendanaan, foto lahan). Unggah foto & metadata ke IPFS, lalu `createCampaign` |
| `/dashboard` | Petani, investor | Petani: kampanye saya + tindakan berikutnya. Investor: porsi saya, nilai klaim tersedia, tombol Klaim/Refund |
| `/koperasi` | Koperasi | Daftarkan petani, antrean milestone menunggu keputusan (foto + putusan AI + tombol Setujui/Tolak) |
| `/admin` | Admin | Daftarkan koperasi, setujui/tolak kampanye, sengketa, tandai gagal panen/default, kompensasi dari dana cadangan, konfigurasi agen |
| `/petani/[address]` | Semua | **Rapor Petani** (lihat di bawah) |
| `/agent` | Semua | Profil agen: ID & registri ERC-8004 (tautan BscScan), isi agent card, statistik putusan dari `ReputationBook`, 10 putusan terakhir |

**Rapor Petani** menampilkan: nama petani & koperasi pendamping, jumlah kampanye didanai, panen selesai, persentase tepat waktu, akurasi estimasi (total hasil aktual ÷ total estimasi), gagal panen, default, riwayat kampanye dengan tautan. Kalimat penjelas di halaman: "Rekam jejak ini tercatat di BNB Chain dan tidak bisa diubah siapa pun, sebagai riwayat kredit alternatif bagi petani."

**Komponen global:** header dengan tombol RainbowKit, badge peran (Admin/Koperasi/Petani/Investor), tombol "Minta mUSDT demo" (mint 1.000), banner jika jaringan bukan BSC testnet dengan tombol ganti jaringan.

**Pola UX wajib:**

- Transaksi dua langkah (`approve` lalu `fund` / `depositHarvest`) ditampilkan sebagai stepper yang jelas.
- Setiap transaksi: status menunggu, sukses dengan tautan BscScan, atau pesan error yang mudah dipahami (terjemahkan custom error ke Bahasa Indonesia).
- Status dan label memakai Bahasa Indonesia: Draf, Pendanaan, Berjalan, Panen, Gagal, Dibatalkan, Gagal bayar; milestone: Menunggu, Bukti dikirim, Diperiksa AI, Ditolak, Sengketa, Cair.
- Tampilkan USDT + perkiraan rupiah (kurs Rp16.000, dengan label "perkiraan").
- Data di-refresh otomatis setiap 10 detik supaya putusan agen muncul tanpa reload.
- Mobile-first, lebar minimal 360 px, palet hijau-tanah yang bersih.

## API upload & metadata IPFS

Dua API route Next.js menjadi satu-satunya kode server, supaya `PINATA_JWT` tidak pernah sampai ke browser.

| Route | Input | Output | Validasi |
| --- | --- | --- | --- |
| `POST /api/upload` | `multipart/form-data`, field `file` | `{ "cid": "bafy...", "url": "https://<gateway>/ipfs/bafy..." }` | Hanya `image/jpeg`, `image/png`, `image/webp`; maks 5 MB. File dikirim apa adanya (jangan dikompres di browser agar EXIF tidak hilang) |
| `POST /api/upload-json` | JSON body | `{ "cid": ..., "url": ... }` | Maks 100 KB, wajib punya field `schema` |

Agen mengunggah JSON putusan langsung ke Pinata dengan `PINATA_JWT` miliknya sendiri (dari `.env` agen).

**Metadata kampanye (`metadataCID`):**

```json
{
  "schema": "bagipanen.campaign.v1",
  "title": "Modal tanam cabai merah musim hujan 2026",
  "story": "Pak Darto menanam cabai di 0,5 ha lahan di Cikajang ...",
  "farmerName": "Darto",
  "cooperativeName": "Koperasi Tani Makmur",
  "commodity": "Cabai merah",
  "costPlan": [
    { "item": "Bibit", "usdt": 250 },
    { "item": "Pupuk & pestisida", "usdt": 400 },
    { "item": "Tenaga kerja", "usdt": 350 }
  ],
  "coverImageCID": "bafy..."
}
```

**Bukti milestone (`proofCID`):** file foto mentah. **Nota panen (`receiptCID`):** file foto nota. **Putusan agen (`reasonCID`):** format di bagian Spesifikasi agen AI.

## Konfigurasi & deployment

Semua rahasia ada di `.env` (tidak di-commit); `.env.example` berisi daftar variabel tanpa nilai.

```bash
# ---- contracts/ ----
BSC_TESTNET_RPC=            # cek RPC resmi BSC testnet di dokumentasi BNB Chain
DEPLOYER_PRIVATE_KEY=       # wallet admin, KHUSUS testnet
BSCSCAN_API_KEY=            # untuk forge verify-contract
ERC8004_IDENTITY_REGISTRY=  # dari docs/erc8004-notes.md (kosong = pakai MockAgentIdentity)

# ---- agent/ ----
AGENT_PRIVATE_KEY=          # wallet agen, KHUSUS testnet
GEMINI_API_KEY=
GEMINI_MODEL=               # model Flash terbaru yang mendukung gambar
PINATA_JWT=
IPFS_GATEWAY=               # gateway Pinata Anda
FACTORY_ADDRESS=
START_BLOCK=                # blok deploy factory

# ---- web/ (NEXT_PUBLIC_ boleh terlihat di browser) ----
PINATA_JWT=
NEXT_PUBLIC_IPFS_GATEWAY=
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
NEXT_PUBLIC_FACTORY_ADDRESS=
NEXT_PUBLIC_USDT_ADDRESS=
NEXT_PUBLIC_RESERVE_ADDRESS=
NEXT_PUBLIC_REPUTATION_ADDRESS=
NEXT_PUBLIC_IDR_PER_USDT=16000
```

**Mode aplikasi:** tambahkan `APP_MODE` (agen & kontrak) dan `NEXT_PUBLIC_APP_MODE` (web) dengan nilai `local` atau `testnet`. Di mode `local`, variabel API key dan private key boleh kosong; alamat kontrak diambil dari `deployments/anvil.json`.

**Urutan deploy (`script/Deploy.s.sol`):**

1. `MockUSDT`
2. `MockAgentIdentity` (hanya jika `ERC8004_IDENTITY_REGISTRY` kosong)
3. `CampaignFactory(usdt)`
4. `ReputationBook(factory)` dan `ReservePool(factory, usdt)`
5. `factory.setModules(reputationBook, reservePool)`
6. Tulis semua alamat + nomor blok ke `deployments/bscTestnet.json`

Perintah: `forge script script/Deploy.s.sol --rpc-url $BSC_TESTNET_RPC --broadcast --verify`. Setelah itu jalankan script kecil `pnpm sync` (atau `npm run sync`) yang menyalin ABI dan alamat ke `web/` dan `agent/`.

**Agen:** `cd agent && npm run register` (sekali), lalu admin memanggil `setAgent` dari halaman `/admin`, kemudian `npm run start`.

**Frontend:** deploy ke Vercel dengan root directory `web/` dan isi environment variable yang sama dengan `.env` bagian web.

## Testing & acceptance criteria

Proyek dianggap selesai jika semua test Foundry lulus dan seluruh checklist acceptance di bawah tercentang di BSC testnet.

**Test Foundry wajib (`contracts/test/`):**

- Happy path lengkap: daftar koperasi & petani → buat → setujui → 3 investor danai → 3 milestone cair → setor panen 1.650 → klaim 630 / 378 / 252, petani menerima 357,5 + 1.000 total cair, cadangan 32,5.
- Pendanaan gagal → `finalizeFunding` → refund 1:1.
- Milestone ditolak AI → unggah ulang → disetujui.
- Ditolak 3 kali → `Disputed` → `resolveDispute(true)` cair; `recordOverturn` tercatat.
- Panen di bawah modal (misal 800) → seluruhnya ke investor pro-rata.
- Gagal panen → `markFailed` → klaim sisa escrow → `compensate` → klaim lagi (kumulatif).
- Default → `markDefault` setelah grace → petani diblokir membuat kampanye.
- Kontrol akses: non-agen tidak bisa `recordVerdict`, koperasi lain tidak bisa memutuskan, token porsi tidak bisa ditransfer, admin tidak bisa menarik escrow.
- Pembulatan: total yang keluar tidak pernah melebihi saldo kontrak.

**Acceptance di testnet:**

- [ ] Semua kontrak ter-deploy dan terverifikasi di BscScan testnet
- [ ] Agen terdaftar di registri ERC-8004 (resmi atau fallback) dan tampil di `/agent`
- [ ] Satu kampanye demo lengkap dari pengajuan sampai semua investor klaim
- [ ] Minimal satu milestone ditolak AI dengan alasan jelas, lalu disetujui setelah unggah ulang
- [ ] Putusan agen muncul di UI ≤ 30 detik setelah bukti dikirim
- [ ] Rapor Petani menampilkan statistik yang benar setelah kampanye selesai
- [ ] Semua halaman bisa dipakai di layar 360 px dan berbahasa Indonesia
- [ ] README: deskripsi, arsitektur, alamat kontrak, cara menjalankan

## Data demo

Data berikut dipakai untuk uji end-to-end: satu kampanye cabai dari pengajuan sampai klaim, dengan satu penolakan AI.

**Data demo:**

| Item | Nilai |
| --- | --- |
| Koperasi | Koperasi Tani Makmur, Garut |
| Petani | Pak Darto |
| Komoditas & lahan | Cabai merah, 5.000 m², Cikajang, Garut (koordinat sesuai lokasi foto yang Anda punya) |
| Target modal | 1.000 mUSDT (≈ Rp16 juta) |
| Durasi pendanaan | 600 detik (10 menit) untuk demo |
| Estimasi penjualan | 1.650 mUSDT |
| Investor | Rina 500, Budi 300, Sari 200 |
| Foto | 3 foto lahan asli sesuai fase + 1 foto yang sengaja salah (misal foto layar atau tanaman lain) + 1 foto nota |

## Rencana kerja & urutan prompt (bangun dulu, konfigurasi terakhir)

Aplikasi dibangun dan diuji penuh secara lokal tanpa akun atau API key apa pun; semua konfigurasi eksternal (MetaMask, tBNB, API key, ERC-8004 resmi, deploy testnet) dikerjakan di blok terakhir.

Satu-satunya yang wajib ada sebelum mulai adalah alat di laptop: Node.js LTS, Git, Foundry, dan VS Code + Claude Code.

**Mode lokal vs konfigurasi akhir:**

| Komponen | Selama pembangunan (`APP_MODE=local`) | Setelah konfigurasi (`APP_MODE=testnet`) |
| --- | --- | --- |
| Blockchain | Anvil (chain lokal Foundry, chain ID 31337) dengan 10 akun bawaan bersaldo | BSC testnet (chain ID 97) |
| Wallet di browser | Pemilih akun demo di header (Admin, Koperasi, Petani, Rina, Budi, Sari) yang menandatangani dengan private key bawaan Anvil; hanya aktif di mode lokal | MetaMask via RainbowKit |
| Penyimpanan file | API route yang sama menyimpan file ke `web/.local-ipfs/`, CID = hash SHA-256 file | IPFS via Pinata |
| Penilaian foto | `MockVision`: menyetujui, kecuali nama file mengandung `salah` atau `tolak`; format output sama dengan Gemini | Gemini |
| Cuaca | Open-Meteo (tanpa key); data statis jika offline | Open-Meteo |
| Identitas agen | `MockAgentIdentity` | Registri ERC-8004 resmi (fallback tetap mock) |
| Verifikasi kontrak | Tidak perlu | BscScan |

**Aturan implementasi:** penyimpanan, penilaian foto, dan jaringan dibuat sebagai adapter (`local`/`pinata`, `mock`/`gemini`, `anvil`/`bscTestnet`) yang dipilih dari `.env`. Pindah ke testnet cukup dengan mengganti `.env` dan deploy ulang, tanpa mengubah kode.

| Blok | Kerjakan | Prompt | Selesai jika |
| --- | --- | --- | --- |
| 1 | Setup repo, `CLAUDE.md`, `docs/PRD.md` | 1 | Struktur repo & `.env.example` ada |
| 2 | Semua kontrak + test | 2 | `forge test` lulus |
| 3 | Deploy ke Anvil + script seed data demo + sync ABI | 3 | Satu perintah menyalakan chain lokal berisi data demo |
| 4 | Frontend inti + pemilih akun demo + penyimpanan lokal (sesi A) | 4 | Buat kampanye, danai, lihat detail di browser |
| 5 | Agen AI dengan `MockVision` (sesi B, paralel dengan blok 4) | 5 | Agen menolak file "salah" dan menyetujui file benar |
| 6 | Halaman koperasi, admin, dashboard, Rapor Petani, agen | 6 | Semua peran menyelesaikan aksinya |
| 7 | Uji skenario penuh di lokal, perbaiki bug | 7 | Checklist acceptance (kecuali bagian testnet) tercentang |
| 8 | **Konfigurasi:** MetaMask, tBNB, API key, riset ERC-8004, deploy BSC testnet, ganti ke Gemini & Pinata, uji ulang | 8 | Skenario penuh jalan di BSC testnet |
| 9 | README + deploy Vercel | 9 | Link Vercel jalan, README lengkap |

**Urutan prompt untuk Claude Code** (commit setelah tiap prompt):

1. "Baca `CLAUDE.md` dan `docs/PRD.md`. Buat struktur monorepo sesuai bagian Struktur repo, termasuk `.env.example` dengan `APP_MODE=local`. Jangan tulis logika dulu."
2. "Implementasikan semua kontrak di bagian Spesifikasi smart contract dan Penanganan kondisi khusus, termasuk `MockAgentIdentity`. Buat rencana singkat dulu, lalu kode dan test; jalankan `forge test` sampai lulus."
3. "Buat `Deploy.s.sol` yang bisa deploy ke Anvil maupun BSC testnet, `Seed.s.sol` untuk data demo (koperasi, petani, investor memakai akun bawaan Anvil), script sync ABI, dan satu perintah `npm run dev:chain` untuk menyalakan Anvil + deploy + seed."
4. (Sesi A) "Bangun frontend inti sesuai Spesifikasi frontend dengan adapter mode lokal: pemilih akun demo Anvil, penyimpanan file lokal di API route, halaman `/`, `/campaign/[address]`, `/create`, `/dashboard`."
5. (Sesi B) "Bangun agen AI sesuai Spesifikasi agen AI dengan adapter `MockVision` dan penyimpanan lokal, termasuk registrasi ke `MockAgentIdentity` dan log konsol yang mudah dibaca. Siapkan adapter Gemini dan Pinata tapi belum dipakai."
6. "Bangun halaman `/koperasi`, `/admin`, `/petani/[address]`, dan `/agent`."
7. "Jalankan seluruh skenario Data demo di mode lokal dan periksa terhadap checklist Testing & acceptance criteria. Daftar yang belum terpenuhi, lalu perbaiki satu per satu."
8. "Kita masuk tahap konfigurasi. Pandu saya menyiapkan MetaMask, tBNB, dan API key; cari alamat registri ERC-8004 resmi di BSC testnet (tulis ke `docs/erc8004-notes.md`, jangan mengarang); lalu deploy ke BSC testnet dengan `APP_MODE=testnet` dan uji ulang dengan Gemini & Pinata."
9. "Tulis README lengkap untuk juri hackathon dan siapkan deploy Vercel dengan root directory `web/`."

## Di luar lingkup & roadmap

Fitur di bawah sengaja tidak dibangun untuk hackathon; cukup disebut di slide roadmap.

- **Jangan dibangun di MVP:** login sosial & gasless (paymaster), BNB Greenfield, pasar sekunder token porsi, pembayaran x402, notifikasi WhatsApp/Telegram, database/backend, mainnet, multisig admin, reputasi di Reputation Registry ERC-8004 resmi, Validation Registry.
- **Roadmap produk:** login sosial + gas sponsorship untuk petani; penyimpanan bukti di BNB Greenfield; data IoT, drone, dan citra satelit untuk verifikasi; asuransi parametrik berbasis cuaca; pasar sekunder token porsi; agen membayar data per request via x402; reputasi ke Reputation Registry ERC-8004 agar portabel.
- **Roadmap bisnis & regulasi:** kemitraan dengan koperasi nyata; kerja sama dengan penyelenggara securities crowdfunding berizin OJK; on-ramp rupiah; biaya platform kecil dari keuntungan.
