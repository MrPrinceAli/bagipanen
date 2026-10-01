# Catatan keputusan

Keputusan untuk hal yang ambigu di PRD. Aturannya: pilih opsi paling sederhana, lalu catat di sini.

## Gelombang 1 — Setup repo

1. **Nama file `CLAUDE.md`.** File awal bernama `claude.md` (huruf kecil). Namanya diganti menjadi `CLAUDE.md` sesuai PRD, karena Linux/Vercel membedakan huruf besar-kecil.
2. **Nama folder root.** Di PRD tertulis `bagipanen/`; repo tetap memakai folder yang ada (`BagiPanen/`). Tidak berpengaruh ke kode.
3. **Package manager: npm.** pnpm tidak terpasang, dan PRD mengizinkan `npm run sync`. Tidak ada npm workspaces: `web/` dan `agent/` masing-masing punya `package.json` sendiri. Ini paling sederhana dan cocok dengan Vercel yang memakai root directory `web/`.
4. **Letak file `.env`.** Ada satu `.env.example` di root sebagai template, dibagi tiga bagian sesuai PRD. Tiap paket memakai file `.env` miliknya sendiri, yaitu lokasi bawaan tiap alat:
   - `contracts/.env` (dibaca Foundry)
   - `agent/.env` (dibaca `dotenv`)
   - `web/.env.local` (dibaca Next.js)

   Cara ini juga menyelesaikan `PINATA_JWT` yang muncul dua kali di PRD (agen dan web).
5. **Pemilihan adapter.** Adapter penyimpanan (`local`/`pinata`), penilaian foto (`mock`/`gemini`), dan jaringan (`anvil`/`bscTestnet`) dipilih dari satu variabel saja: `APP_MODE` (`NEXT_PUBLIC_APP_MODE` di web). Variabel override per adapter tidak dibuat dulu; baru ditambah jika nanti diperlukan.
6. **Isi Gelombang 1 hanya kerangka.** Semua file dari "Struktur repo" dibuat sebagai placeholder tanpa logika:
   - Halaman Next.js berupa komponen kosong yang valid (`return null`).
   - Modul lain berisi `export {}`.
   - File Solidity berisi SPDX + pragma saja.
7. **Waktu pemasangan dependensi.**
   - Foundry (`forge-std` v1.16.2, OpenZeppelin Contracts v5.7.0, keduanya tag rilis resmi terbaru) dipasang sekarang sebagai git submodule, supaya `forge build` bisa dicek.
   - Dependensi `web/` dan `agent/` dipasang di gelombang yang memakainya (4 dan 5), dengan versi terbaru dari npm, bukan versi tebakan.
8. **`deployments/*.json` belum dibuat.** File ini ditulis oleh script deploy (Gelombang 3 dan 8). Folder dijaga dengan `.gitkeep`, agar tidak ada alamat kontrak palsu.
9. **State runtime agen.** `agent/data/seen-hashes.json` dan `agent/data/state.json` dibuat otomatis oleh agen saat berjalan, dan tidak di-commit (hasil mode lokal dan testnet berbeda).
10. **Broadcast Foundry.** Broadcast lokal (`contracts/broadcast/*/31337/`) diabaikan git. Broadcast testnet boleh di-commit sebagai jejak deploy.
11. **Versi compiler.** `solc_version = "0.8.24"` dipasang tetap di `foundry.toml`, sesuai "Solidity ^0.8.24" di PRD. Semua modul OZ yang akan dipakai (ERC20, SafeERC20, Ownable, ReentrancyGuard, ERC721) cocok dengan versi ini, karena pragma-nya `^0.8.20` / `^0.8.24`. `evm_version` dibiarkan default Foundry; akan dicek ulang terhadap dokumentasi BNB Chain saat deploy testnet (Gelombang 8).

## Gelombang 2 — Kontrak + test

1. **`CampaignDeployer` (kontrak tambahan).** Jika `new HarvestCampaign` ada di dalam `CampaignFactory`, runtime factory menjadi 25.158 byte dan melewati batas EIP-170 (24.576 byte); tidak bisa di-deploy ke BSC testnet. Mengubah optimizer (runs 1/50, via-ir) tidak cukup. Solusinya:
   - Constructor factory membuat `CampaignDeployer` sekali. Hanya kontrak inilah yang memuat bytecode kampanye.
   - Runtime factory sekarang 6,9 KB dan deployer 19,4 KB.
   - Signature `CampaignFactory(usdt)` dan urutan deploy di PRD tidak berubah.
   - `HarvestCampaign` menerima alamat factory lewat constructor, lalu membaca `usdt`, `reputationBook`, dan `reservePool` dari factory.
2. **`params` disimpan tanpa array milestone.** State `params` bertipe `Terms`, yaitu `CampaignParams` tanpa `milestoneNames`/`milestoneBps`, karena nama dan bobot milestone sudah disimpan di `milestones[]`. Ini menghemat gas dan ukuran bytecode.
3. **`IAgentIdentity` minimal.** Isinya hanya `ownerOf` dan `tokenURI`, yaitu fungsi standar ERC-721 (PRD: identitas ERC-8004 berbasis ERC-721). ABI pendaftaran registri resmi tidak ditulis di kontrak; akan diriset di Gelombang 8 (`docs/erc8004-notes.md`).
4. **`isAgent` selalu mengecek `ownerOf(agentId) == wallet`,** baik untuk registri resmi maupun mock. Di kedua jalur, agen mendaftar dari wallet-nya sendiri, jadi aturan ini selalu terpenuhi. `setAgent` juga memvalidasi kepemilikan ini. Jika registri me-revert, `isAgent` mengembalikan `false`, bukan revert.
5. **Satu wallet satu peran.** Aturan ini ditegakkan di `registerCooperative`, `registerFarmer`, dan `setAgent`: admin, koperasi, petani, dan agen saling eksklusif. Investor tidak dibatasi.
6. **`fund` "kecuali petani/koperasi"** diartikan sebagai petani dan koperasi *kampanye itu sendiri*, yaitu pihak yang punya konflik kepentingan.
7. **Batas waktu.**

   | Aturan | Syarat |
   | --- | --- |
   | `fund` masih boleh | `now <= fundingDeadline` |
   | `finalizeFunding` boleh | `now > fundingDeadline` |
   | `markDefault` boleh | `now > expectedHarvestDate + 30 hari` |
   | Panen dihitung tepat waktu | `now <= expectedHarvestDate + 7 hari` (konstanta `ON_TIME_WINDOW`) |
8. **Pencairan milestone terakhir** = `raisedAmount − totalReleased`, tidak memakai `balanceOf`. Tujuannya agar USDT yang dikirim nyasar ke kontrak tidak ikut cair ke petani. Untuk `markFailed`/`markDefault`, pool tetap dihitung dari `usdt.balanceOf(this)` sesuai PRD.
9. **Bagian investor saat panen** = `amount − farmerShare − reserveShare` (rumus PRD). Debu pembulatan jatuh ke investor. `INVESTOR_PROFIT_BPS` tetap ada sebagai konstanta informasi untuk UI.
10. **Overturn putusan AI.** `recordOverturn` dicatat setiap kali keputusan admin di `resolveDispute` berbeda dari putusan AI terakhir, ke arah mana pun.
11. **Statistik agen.** `AgentStats` di `ReputationBook` berupa satu struct global. Ini mengikuti signature PRD `recordVerdict(bool)`/`recordOverturn()`, karena MVP hanya punya satu agen.
12. **Validasi `createCampaign`:**
    - `commodity` tidak kosong, `targetAmount > 0`, `fundingDuration > 0`.
    - `expectedHarvestDate` harus di masa depan.
    - 1–10 milestone, setiap bobot > 0, total bobot = 10.000.
    - CID bukti, alasan AI, dan nota panen tidak boleh kosong.
13. **Tambahan kecil di luar PRD:**
    - View `claimable(address)` untuk dashboard investor, `campaignCount()`, dan `totalReleased`.
    - Event `DisputeResolved`, `ModulesSet`, `AgentConfigured`, `ReservePool.Contributed/Compensated`, dan `MockAgentIdentity.AgentRegistered`.
    - File `interfaces/IBagiPanen.sol` berisi antarmuka internal, supaya tidak ada import melingkar.
    - Parameter alamat pada event (`investor`, `campaign`) di-*index*. Signature event (topic0) tetap sama dengan PRD.
14. **ID `MockAgentIdentity` mulai dari 1,** supaya 0 berarti "belum dikonfigurasi". Pemilik `ReservePool` adalah deployer (admin).
15. **Token porsi.** `transfer` dan `transferFrom` selalu revert, sesuai PRD. `approve` dibiarkan karena tidak berbahaya: allowance tidak bisa dipakai untuk memindahkan token.

## Gelombang 3 — Deploy Anvil, seed, sync

1. **Akun demo Anvil.** Indeks akun bawaan Anvil untuk setiap peran:

   | Indeks | Peran |
   | --- | --- |
   | 0 | Admin |
   | 1 | Koperasi |
   | 2 | Petani |
   | 3 | Rina |
   | 4 | Budi |
   | 5 | Sari |
   | 6 | Agen |

   Pemetaan ini hanya ditulis di satu tempat (`contracts/script/AnvilAccounts.sol`). `Deploy.s.sol` menyalinnya ke `deployments/anvil.json` bersama mnemonic bawaan Anvil. Mnemonic itu publik dan bukan rahasia; PRD memang meminta pemilih akun demo menandatangani dengan private key bawaan Anvil. Web dan agen menurunkan key dari situ, dan hanya di mode lokal. File `bscTestnet.json` tidak pernah berisi mnemonic atau daftar akun.
2. **Deploy memilih jaringan dari chain ID RPC**, bukan dari `APP_MODE`. Chain 31337 ditulis ke `deployments/anvil.json`, chain 97 ke `deployments/bscTestnet.json`, dan chain lain ditolak. Di Anvil, `ERC8004_IDENTITY_REGISTRY` diabaikan dan selalu dipakai `MockAgentIdentity`. Di testnet, alamat registri yang diisi wajib berupa kontrak.
3. **Format deployment JSON.** Kuncinya datar: `usdt`, `identityRegistry`, `identityIsMock`, `factory`, `campaignDeployer`, `reputationBook`, `reservePool`, `deployer`, `startBlock`, `chainId`, `network`. `startBlock` adalah `block.number` saat simulasi, jadi selalu ≤ blok deploy sebenarnya; aman sebagai titik awal `getLogs` agen.
4. **Isi seed:**
   - Koperasi Tani Makmur, Garut.
   - Petani "Pak Darto".
   - 5.000 mUSDT untuk Rina, Budi, dan Sari masing-masing.
   - 1.000 mUSDT untuk petani, supaya bisa menyetor hasil panen 1.650 di demo tanpa faucet.
   - **Tanpa kampanye**, karena kampanye dibuat lewat UI beserta metadata IPFS-nya (Gelombang 4/7).
   - Registrasi agen dan `setAgent` belum dikerjakan; akan dilakukan `agent/scripts/register-agent.ts` di Gelombang 5 dan ditambahkan ke `dev:chain` saat itu.

   Seed aman dijalankan ulang: pendaftaran yang sudah ada dilewati.
5. **Hasil `npm run sync`.** Satu modul `.ts` per kontrak (`export const xxxAbi = [...] as const`) agar wagmi/viem bisa menebak tipe. Tidak ada `index.ts`. `deployments.ts` memuat `anvil` dan `bscTestnet` (bernilai `null` jika belum di-deploy). Hasil sync dan `deployments/anvil.json` ikut di-commit: Vercel tidak punya Foundry, dan alamat Anvil deterministik (bergantung pada nonce, bukan bytecode).
6. **`dev:chain` selalu mulai dari chain kosong** (tanpa `--state`). Konsekuensinya:
   - File di `web/.local-ipfs/` tetap ada, dan itu tidak masalah.
   - Agen harus mendeteksi chain yang di-reset (blok tersimpan > blok terbaru) di Gelombang 5.
   - Port 8545 dipakai tetap; jika port sudah terpakai, `dev:chain` berhenti dengan pesan jelas.
   - Log Anvil ditulis ke `.anvil.log`.
7. **`npm run deploy:testnet`** sudah ada, tapi belum memakai `--verify`. Konfigurasi verifikasi BscScan/Etherscan akan dicek dari dokumentasi terbaru di Gelombang 8. Jalur testnet (fallback mock, registri diisi, registri bukan kontrak) sudah diuji dengan Anvil `--chain-id 97`.

## Gelombang 4 — Frontend inti

1. **Versi paket.**
   - Next.js 16.3.7 + React 19.2 + Tailwind v4, konfigurasi dari `create-next-app@latest`.
   - **wagmi 2.19.5** sesuai PRD (wagmi v2). Versi terbaru sebenarnya 3.x, tapi RainbowKit 2.2.11 (terbaru) mensyaratkan `wagmi ^2.9`.
   - viem 2.57.1, TanStack Query 5, dan `exifr` untuk membaca GPS foto di browser.
   - `tsconfig` target dinaikkan ke ES2020, karena kode memakai literal BigInt.
2. **`overrides: @coinbase/cdp-sdk 1.52.0`.** Paket ini turunan wagmi → `@wagmi/connectors` → `@base-org/account`. Mulai 1.53.0, paket ini mengimpor paket `@x402/*` yang hanya peer dependency *opsional*, sehingga build Turbopack gagal. Versi 1.52.0 adalah yang terakhir tanpa impor itu, dan masih memenuhi syarat `^1.0.0` dari `@base-org/account`. BagiPanen tidak memakai connector Base Account maupun x402.
3. **Hasil `npm audit`: 2 high (`axios`, `ws`) dan 25 moderate**, semuanya dependensi turunan. Semua perbaikan yang tersedia mewajibkan wagmi v3 (breaking, dan bertentangan dengan PRD + RainbowKit), jadi dibiarkan. Dampaknya kecil karena jalur kode itu tidak dipakai: `ws` untuk transport websocket (aplikasi memakai http), `axios` di connector Base Account.
4. **Akun demo lokal.** Dibuat sebagai connector wagmi sendiri (`lib/anvilConnector.ts`). `eth_sendTransaction` diteruskan ke Anvil, yang menandatangani dengan key bawaannya karena akun-akun itu memang "unlocked". Jadi **tidak ada private key di browser**; polanya sama dengan connector `mock` bawaan wagmi. Akun bisa diganti tanpa memutus koneksi, dan pilihannya diingat di `localStorage`.
5. **Semua transaksi disimulasikan dulu (`simulateContract` / `eth_call`) sebelum dikirim.** Ternyata Anvil tetap menambang transaksi yang revert, sehingga UI hanya bisa menampilkan pesan umum. Dengan simulasi:
   - revert tertangkap sebelum transaksi dikirim, lengkap dengan nama custom error untuk diterjemahkan;
   - tidak ada transaksi gagal yang ikut ditambang, dan tidak ada gas terbuang di testnet;
   - revert lintas kontrak (factory → kampanye) di-decode lewat gabungan ABI error semua kontrak.
6. **Penyimpanan lokal.**
   - File disimpan di `web/.local-ipfs/<sha256-hex>`, dengan metadata (tipe konten) di `<cid>.meta.json`, dan disajikan lewat `GET /api/ipfs/[cid]` (hanya mode lokal).
   - Tipe foto diperiksa dari isi file (magic bytes JPEG/PNG/WebP), bukan hanya dari header browser.
   - JSON diserialisasi ulang sebelum di-hash.
7. **Adapter Pinata di web** masih berupa placeholder yang memberi error jelas. Adapter ini dibuat bersama adapter Pinata agen (Gelombang 5) setelah dokumentasi resmi Pinata dicek.
8. **Admin bisa menyetujui/menolak kampanye Draf langsung di halaman detail.** Ini supaya alur Gelombang 4 (buat → danai → detail) bisa selesai di browser. Halaman `/admin` yang lengkap menyusul di Gelombang 6.
9. **"Klik koordinat" di form `/create`** diwujudkan sebagai:
   - tombol **Ambil dari GPS foto** (EXIF; otomatis terisi saat foto lahan dipilih jika koordinat masih kosong);
   - tombol **Pakai lokasi perangkat** (geolokasi browser);
   - isian manual.

   Tidak ada widget peta, supaya tanpa dependensi atau API key tambahan. Di halaman detail, peta berupa tautan Google Maps (sesuai PRD).
10. **Definisi statistik beranda.**
    - *Total didanai* = jumlah `raisedAmount` kampanye yang mencapai target (status Berjalan, Panen, Gagal panen, Gagal bayar).
    - *Kampanye aktif* = Pendanaan + Berjalan.
    - *Dana cadangan* = `ReservePool.balance()`.
    - *Proyeksi imbal hasil* = pool investor yang dihitung dari estimasi penjualan dengan rumus bagi hasil PRD (demo: 26%).
11. **Kampanye Draf** hanya tampil untuk admin dan petani, di bagian "Menunggu persetujuan admin". Kampanye yang dibatalkan disembunyikan dari beranda.
12. **Format input angka Indonesia:** titik = pemisah ribuan, koma = desimal. Tanggal panen disimpan sebagai pukul 12.00 WIB pada tanggal yang dipilih. Pilihan durasi pendanaan: 10 menit (demo), 1 jam, 1 hari, 7 hari, 30 hari. `approve` mUSDT selalu sejumlah yang akan dipakai, tidak pernah tak terbatas.
13. **Riwayat transaksi** dibaca dari event kampanye + event persetujuan di factory, mulai dari `START_BLOCK`. Di testnet ada tautan BscScan; di lokal hanya hash. Pembagian rentang `getLogs` untuk batas RPC BSC akan dicek di Gelombang 8.
14. **Variabel env opsional baru:** `NEXT_PUBLIC_LOCAL_RPC_URL` dan `NEXT_PUBLIC_BSC_TESTNET_RPC`. Jika kosong, dipakai RPC bawaan definisi chain di viem. Jika `NEXT_PUBLIC_IPFS_GATEWAY` kosong di testnet, dipakai `https://ipfs.io`. `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` diisi placeholder sampai Gelombang 8.
15. **Halaman `/koperasi`, `/admin`, `/petani/[address]`, `/agent`** untuk sementara menampilkan kartu "segera hadir" (Gelombang 6).

## Gelombang 5 — Agen AI (MockVision)

1. **Versi paket agen.** viem 2.57.1 (sama dengan web), `@google/genai` 2.24.0, `exifr` 7.1.3, `dotenv` 18, `tsx` 4.23. TypeScript 5.9.3 dipakai supaya sama dengan web, walau TypeScript terbaru sudah 7.x. `@types/node` 20.
2. **Adapter dipilih dari `APP_MODE`.**

   | Mode | Penyimpanan | Penilai foto |
   | --- | --- | --- |
   | `local` | folder lokal bersama web (`web/.local-ipfs`, dapat diubah lewat `LOCAL_IPFS_DIR`), dengan format file + `.meta.json` yang sama | MockVision |
   | `testnet` | Pinata | Gemini |

   Adapter Pinata dan Gemini sudah dibuat, tetapi belum dipakai sampai Gelombang 8.
3. **Wallet agen di mode lokal** diturunkan dari mnemonic Anvil (akun `agen`, indeks 6), lalu menandatangani secara lokal dengan viem. Di testnet dipakai `AGENT_PRIVATE_KEY`.
4. **Nama file untuk MockVision** dibaca dari `<cid>.meta.json` yang ditulis API upload web. Karena penyimpanan berbasis isi (CID = hash), file dengan isi identik yang diunggah ulang dengan nama lain akan tercatat dengan nama terakhir.
5. **Rincian aturan EXIF:**
   - `missing` hanya jika GPS **dan** tanggal sama-sama tidak ada.
   - Jika hanya salah satu yang ada, bagian yang ada tetap diperiksa, dan bagian yang hilang dicatat.
   - Selisih tanggal dihitung mutlak, ≤ 7 hari. Jarak ≤ 2 km (tepat 2 km masih lolos).
6. **Cuaca:**
   - `precip14dMm` dan `maxDailyPrecipMm` dihitung dari 14 hari sebelum hari ini (WIB).
   - `extreme` = ada hari (lampau maupun prakiraan) dengan hujan > 100 mm.
   - Data statis hanya dipakai di mode lokal saat Open-Meteo tidak bisa dihubungi.
   - Objek `weather` di JSON putusan ditambah `tempMaxC`, `tempMinC`, dan `source`.
7. **Deteksi duplikat.** SHA-256 foto dicatat per (kampanye, milestone), setelah putusan tercatat onchain. Unggah ulang foto yang sama untuk milestone yang sama bukan duplikat (sesuai PRD: "untuk kampanye atau milestone lain").
8. **Idempotensi.** Bukti dilewati jika:
   - kampanye sudah tidak Berjalan;
   - milestone sudah lewat;
   - percobaan sudah digantikan yang lebih baru;
   - `aiDecided` sudah true;
   - status milestone bukan `ProofSubmitted`;
   - CID di kontrak berbeda.

   Pengecekan diulang tepat sebelum mengirim transaksi, dan `recordVerdict` disimulasikan dulu. Revert kontrak dianggap "keadaan sudah berubah", sehingga dilewati tanpa diulang. Galat jaringan/API diulang 3 kali dengan jeda 15 detik.
9. **Deteksi chain berganti.** `data/state.json` menyimpan identitas chain (chainId, factory, hash blok genesis). Jika identitas itu berubah (mis. `dev:chain` diulang), state dan `seen-hashes.json` otomatis direset tanpa perlu me-restart agen.
10. **Agen belum terdaftar.** Selama wallet agen belum terdaftar (`isAgent` = false), agen menunggu tanpa memajukan blok, jadi bukti tidak hilang.
11. **`getLogs` dibagi per rentang blok:** `MAX_LOG_RANGE` bawaan 5.000 di testnet dan 100.000 di lokal.
12. **Gemini:**
    - `systemInstruction` = kalimat pertama prompt PRD; sisa prompt PRD + konteks kampanye menjadi pesan pengguna.
    - Gambar dilampirkan lewat `createPartFromBase64`.
    - Output JSON memakai `responseMimeType: application/json` + `responseSchema` (tipe `Type`), `temperature` 0,2.
    - `detected_stage` dibatasi ke Tanam / Tumbuh / Pra-panen / Tidak diketahui.
    - Output model dinormalisasi agar selalu sesuai skema.
13. **Pinata.** API v3 files (`POST https://uploads.pinata.cloud/v3/files`, `network=public`, `data.cid`, dari docs.pinata.cloud), dipakai untuk JSON putusan agen **dan** unggahan web. Unduhan lewat `${IPFS_GATEWAY}/ipfs/<cid>`.
14. **`register-agent`:**
    - `agentWallet` diisi di salinan agent card. `image` placeholder dihapus sampai ada logo. Di lokal, `network` diisi `anvil-local`.
    - URI = `ipfs://<cid>`.
    - Idempoten: dilewati jika wallet sudah menjadi agen.
    - Mode lokal: `setAgent` otomatis oleh admin Anvil. Mode testnet dengan registri mock: script mencetak parameter untuk halaman `/admin`.
    - Registri ERC-8004 resmi belum didukung sampai riset di Gelombang 8.
15. **`npm run dev:chain`** sekarang juga menjalankan `register` agen (dengan `APP_MODE=local` dipaksa), jika `agent/node_modules` sudah ada.
16. **Variabel env agen yang ditambahkan:** `BSC_TESTNET_RPC` (agen butuh RPC di testnet, padahal tidak tercantum di bagian agen PRD), serta opsional `LOCAL_RPC_URL`, `LOCAL_IPFS_DIR`, `POLL_INTERVAL_MS`, `RETRY_DELAY_MS`, `MAX_LOG_RANGE`.
17. **Unit test** memakai `node:test` lewat `tsx --test` (40 test), dengan fixture foto kecil di `agent/test/fixtures/`.

## Gelombang 6 — Halaman koperasi, admin, Rapor Petani, agen

1. **Daftar koperasi dan petani** dibaca dari event `CooperativeRegistered` / `FarmerRegistered` di factory, karena kontrak hanya menyimpan mapping, bukan daftar.
2. **Aturan berbasis waktu di halaman admin memakai waktu blok terbaru (waktu chain), bukan jam browser.** Contohnya tombol "Tandai gagal bayar" (aktif setelah perkiraan panen + 30 hari) dan "Tutup pendanaan" untuk tenggat yang lewat. Waktu chain adalah acuan yang dipakai kontrak, dan ini juga memungkinkan uji dengan `evm_increaseTime` di Anvil.
3. **Aksi admin yang tidak bisa dibatalkan memakai konfirmasi dua langkah:** tandai gagal panen, tandai gagal bayar, dan tolak final sengketa. Konfirmasi batal otomatis setelah 5 detik.
4. **Persetujuan kampanye tersedia di `/admin` dan tetap juga di halaman detail kampanye** (dari Gelombang 4). Admin juga bisa "Tutup pendanaan" untuk kampanye yang tenggatnya lewat, walau aksi ini sebenarnya boleh dilakukan siapa saja.
5. **Antrean koperasi** berisi milestone aktif di kampanye dampingannya yang berstatus Bukti dikirim / Diperiksa AI dan belum diputuskan koperasi. Koperasi boleh memutuskan sebelum atau sesudah agen AI; kontrak mencairkan dana hanya jika keduanya setuju.
6. **Halaman `/agent`.**
   - Registri ditulis jujur: "MockAgentIdentity (fallback)" jika memakai registri mock hasil deploy, atau "ERC-8004" jika admin mengarahkan `setAgent` ke registri lain.
   - Agent card dibaca dari `tokenURI(agentId)`, fungsi standar ERC-721. Bentuk URI yang didukung: `ipfs://`, `https://`, dan `data:`.
7. **10 putusan terakhir** diambil dari event `VerdictRecorded` tanpa filter alamat, lalu disaring ke kampanye resmi (`isCampaign`). *(Diubah di Gelombang 8 butir 3: sekarang langsung difilter dengan alamat kampanye resmi.)* Ringkasan tiap putusan dibaca dari JSON `reasonCID`.
8. **Rumus Rapor Petani.**
   - Tepat waktu = `onTimeHarvests ÷ harvestsCompleted`.
   - Akurasi estimasi = `totalReported ÷ totalEstimated`; hanya kampanye yang sudah panen yang ikut dihitung (sesuai `ReputationBook`).
   - Nilai "–" jika belum ada panen.
   - Badge "Diblokir" tampil jika `defaults > 0`.
9. **Header:** petani mendapat tautan "Rapor saya".

## Gelombang 7 — Uji skenario penuh & perbaikan

1. **Hasil uji acceptance** (bagian lokal) dicatat di [acceptance.md](acceptance.md).
2. **README ditulis sekarang (versi lokal),** supaya butir checklist "README" terpenuhi. Alamat BSC testnet dan link Vercel ditambahkan di Gelombang 8–9, bersama pemolesan untuk juri.
3. **Notifikasi (toast) global untuk transaksi sukses.** `TxStatus` tetap menampilkan status di tempat, dan sekarang juga mengirim toast. Tujuannya agar pesan sukses tetap terlihat walaupun komponennya hilang setelah data di-refresh.
4. **Waktu acuan untuk aturan tenggat dan masa tenggang di UI** = `max(jam perangkat, timestamp blok terbaru)` (`useEffectiveNow`). Hitung mundur di kartu beranda tetap memakai jam perangkat, karena hanya bersifat tampilan.
5. **Error boundary Next 16** memakai prop `retry` (bukan `reset` seperti versi lama), sesuai dokumentasi yang terpasang.

## Gelombang 8 — Konfigurasi & BSC testnet

1. **Wallet testnet dibuat lokal dengan Foundry** (`cast wallet new-mnemonic`): satu seed phrase 12 kata, 7 akun dengan urutan sama seperti mode lokal (0 Admin … 6 Agen, path MetaMask `m/44'/60'/0'/0/i`).
   - Seed phrase disimpan di `.secrets/testnet-wallet.txt` (folder diabaikan git, izin 600) dan sebagai `TESTNET_MNEMONIC` di `contracts/.env`.
   - Key Admin ada di `contracts/.env` (`DEPLOYER_PRIVATE_KEY`), key Agen di `agent/.env` (`AGENT_PRIVATE_KEY`).
   - Tidak ada rahasia yang ditampilkan di chat. MetaMask cukup mengimpor seed phrase ini untuk demo di browser.
2. **RPC.**
   - Deploy memakai RPC resmi BNB (`https://bsc-testnet-dataseed.bnbchain.org`).
   - Agen & web memakai `https://bsc-testnet-rpc.publicnode.com`, karena RPC publik resmi BNB menolak `eth_getLogs` ("limit exceeded" bahkan untuk 10 blok), sedangkan publicnode melayani sampai 50.000 blok per panggilan (diuji; lihat [erc8004-notes.md](erc8004-notes.md)).
   - BSC testnet ≈ 0,45 detik/blok ≈ 192.000 blok/hari.
3. **`getLogs` bertahap.** Agen: `MAX_LOG_RANGE` bawaan 50.000 di testnet. Web: `lib/logs.ts` membagi rentang per 50.000 blok (4 paralel) dan, di testnet, menyimpan log yang sudah dibaca sehingga refresh 10 detik hanya membaca blok baru. Di mode lokal tanpa cache, karena chain bisa di-reset.
   - **Filter alamat di `getLogs`.** publicnode menolak `eth_getLogs` tanpa `address` ("Please specify an address in your request"). Masalah ini baru terlihat di testnet sungguhan, tidak di gladi resik fork Anvil.
     - **Agen** tetap mengikuti PRD (polling `ProofSubmitted` tanpa filter alamat) dan memakai RPC `https://rpc.sentio.xyz/bsc-testnet`, yang mengizinkannya (diuji sampai 100.000 blok). Jika RPC yang dipakai menolak, agen otomatis beralih ke filter daftar kampanye resmi `factory.getCampaigns()` dan mencatatnya di log. Hasilnya sama, karena bukti dari alamat lain toh dilewati cek `isCampaign`. Kedua jalur sudah diuji ke RPC sungguhan.
     - Sentio menyarankan gas 1 gwei (publicnode/RPC resmi 0,1 gwei), jadi satu putusan agen ≈ 0,00017 tBNB. Ini masih sangat kecil.
     - **Web** (`VerdictRecorded`, 10 putusan terakhir) tetap memakai publicnode dan langsung memfilter dengan alamat kampanye resmi. Cara ini menggantikan Gelombang 6 butir 7 dan bukan ketentuan PRD.
4. **Registri ERC-8004 resmi** `0x8004A818BFB912233c491871b3d84c89A494BD9e` (dikonfirmasi SDK resmi BNB Chain + repo tim ERC-8004 + pengecekan di chain).
   - ABI agen diambil dari ABI implementasi terverifikasi BscScan.
   - Kontrak BagiPanen tidak berubah (`isAgent` memakai `ownerOf` standar ERC-721).
5. **`agent-card.json` mengikuti format registration file ERC-8004** (`type` registration-v1, `services`, `x402Support`, `active`, `registrations`, `supportedTrust`), ditambah field PRD (`agentWallet`, `bagipanen`).
   - Registri resmi: daftar, lalu `setAgentURI` dengan `registrations` berisi `agentId`.
   - Mock: `agentId` diprediksi dari `totalAgents()+1`.
   - Hasil pendaftaran disimpan di `agent/data/registration.json`, supaya menjalankan ulang tidak mendaftar dua kali.
6. **`script/SeedTestnet.s.sol`** (`npm run seed:testnet`):
   - Admin mengisi ulang tBNB tiap akun demo sampai 0,02 tBNB, setelah mengecek saldonya cukup.
   - Admin mendaftarkan koperasi dan mint mUSDT (investor 5.000, petani 1.000); koperasi mendaftarkan petani.
   - Aman dijalankan ulang.
7. **Verifikasi kontrak** lewat Etherscan API V2: `foundry.toml` `[etherscan] bscTestnet = { key = "${BSCSCAN_API_KEY}", chain = 97, url = "https://api.etherscan.io/v2/api?chainid=97" }`, dipakai oleh `npm run deploy:testnet` (`--verify --slow`). Key gratis bisa memakai endpoint verifikasi di chain 97 (diuji).
8. **Gemini.**
   - Model utama `gemini-3.8-flash` (Flash stabil terbaru, gratis).
   - **Model cadangan** `GEMINI_FALLBACK_MODELS=gemini-3.6-flash,gemini-flash-latest` dicoba berurutan jika model utama sibuk (503), timeout, atau tidak tersedia.
   - **Batas waktu 45 detik per panggilan**, karena saat uji ada model yang menggantung 5 menit.
   - Model yang benar-benar menjawab dicatat di JSON putusan.
   - **Model yang kuota hariannya habis (429 RESOURCE_EXHAUSTED) dilewati 10 menit** (`GEMINI_QUOTA_COOLDOWN_MS`), supaya tiap bukti tidak membuang ±3 detik ke model yang pasti menolak. Model yang 503 tetap dicoba lagi, karena sifatnya sementara.
   - Cuaca Open-Meteo diambil bersamaan dengan unduhan foto (±1–2 detik lebih cepat). Urutan langkah di log tetap seperti PRD.
   - **`thinkingLevel: LOW` diuji, tapi tidak diaktifkan.** Pada foto Tumbuh, waktu jawab turun dari 9,1 ke 6,1 detik dengan putusan yang sama. Uji penolakan foto jagung tidak bisa diselesaikan karena kuota harian habis. Penolakan foto salah adalah inti demo, jadi model tetap memakai tingkat *thinking* bawaannya.
9. **Antrean bukti tertunda** (`agent/data/deferred.json`). Bukti yang gagal 3× (aturan PRD) tidak dibuang, tetapi dijadwalkan ulang dengan jeda 1, 2, 4, … menit (maksimal 10 menit) sampai berhasil atau milestone-nya tidak lagi menunggu putusan. Alasannya: tanpa putusan AI, milestone macet di "Bukti dikirim" dan petani tidak bisa mengunggah ulang.
10. **Gladi resik di fork BSC testnet** (Anvil `--fork-url`) sebelum memakai tBNB sungguhan: deploy dengan registri resmi (biaya ±0,00076 tBNB), seed, pendaftaran agen di registri resmi, agen dengan Gemini + Pinata, dan web mode testnet. Semua berjalan; sisa artefak latihan dihapus.
11. **Uji skenario penuh di BSC testnet** (1 Oktober 2026). Detail ada di [acceptance.md](acceptance.md#bsc-testnet-gelombang-8).
    - Semua transaksi dikirim dengan `cast` dari akun demo, karena MetaMask tidak bisa diotomasi. Foto diunggah lewat API web ke Pinata, dan putusan dibuat oleh agen dengan Gemini.
    - Node RPC publik di belakang load balancer kadang tertinggal satu blok. Akibatnya `fund` langsung setelah `approve` sesekali gagal estimasi gas. Skrip uji mengulang transaksi. Di web risikonya kecil: tombol "Danai" baru aktif setelah allowance baru terbaca, dan jika simulasi tetap gagal, pesan galat tampil dan pengguna cukup menekan ulang.
12. **Petunjuk dompet mengikuti mode.** Di testnet, teks "pilih akun demo di header" diganti "Hubungkan dompet … di header" (tidak ada pemilih akun demo di testnet).

## Gelombang 9 — README & deploy Vercel

1. **Repo GitHub publik** [`MrPrinceAli/bagipanen`](https://github.com/MrPrinceAli/bagipanen) (pilihan pemilik proyek).
   - Sebelum push pertama, email penulis di semua commit diganti ke alamat noreply GitHub, atas persetujuan pemilik proyek.
   - Seluruh riwayat git dipindai terhadap semua nilai rahasia di `.env` dan private key akun demo: 0 temuan.
2. **Proyek Vercel `bagipanen`** dibuat lewat API Vercel dan langsung tertaut ke repo GitHub, dengan root directory `web/` dan framework Next.js.
   - Deploy berasal dari commit di GitHub, jadi file `.env` lokal tidak pernah ikut terunggah.
   - Setiap push ke `main` otomatis di-deploy ulang.
   - Env (production + preview): `NEXT_PUBLIC_APP_MODE=testnet`, `NEXT_PUBLIC_IPFS_GATEWAY`, `NEXT_PUBLIC_BSC_TESTNET_RPC` (publicnode), `NEXT_PUBLIC_IDR_PER_USDT=16000`, dan `PINATA_JWT` bertipe *sensitive* (tidak bisa dibaca ulang dari dashboard).
   - Alamat kontrak diambil dari `web/lib/deployments.ts`.
3. **Batas unggah: PRD 5 MB vs. batas body fungsi Vercel ±4,5 MB.** Opsi paling sederhana: batas API tetap 5 MB sesuai PRD (berlaku penuh di mode lokal). Jika hosting menolak lebih dulu (HTTP 413 tanpa pesan dari API kita), web menampilkan pesan bahasa Indonesia yang menyarankan foto lebih kecil. Foto tidak dikompres, agar EXIF tetap utuh (aturan PRD).
4. **`/api/upload` di Vercel terbuka tanpa login**, karena PRD tidak memakai backend/database. Validasinya lewat isi file (JPEG/PNG/WebP) dan ukuran, serta JSON maks 100 KB dengan field `schema`. Risiko penyalahgunaan kuota Pinata gratis diterima untuk masa hackathon.
5. **WalletConnect project ID tidak diisi.** Pilihan wallet: MetaMask/injected. Di HP, situs dibuka dari browser di dalam aplikasi MetaMask (ditulis di README).
6. **Kampanye terbuka untuk juri** di BSC testnet (`0xff66…74b9`, pendanaan 14 hari sampai 15 Okt 2026), supaya juri bisa mencoba mendanai dengan wallet sendiri.
7. **Proteksi deployment Vercel** dibiarkan bawaan: domain produksi `bagipanen.vercel.app` publik, sedangkan URL per-deployment meminta login Vercel. README hanya memakai domain produksi.

## Perbaikan setelah Gelombang 9 — Rombak UI/UX & bahasa

Atas permintaan pemilik proyek: tampilan harus lebih modern dan megah, dan bahasanya tidak boleh terdengar seperti ketikan robot/AI.

1. **Arah visual (pilihan pemilik proyek): hero gelap + isi terang.**
   - Palet baru di `globals.css`: `hutan` (hijau hutan, warna utama), `emas` (aksen emas padi), `krem` (latar).
   - Font judul Fraunces (serif), isi tetap Plus Jakarta Sans.
   - Ikon dari `lucide-react` (paket gratis).
   - Setiap halaman diawali pita judul gelap (`PageHero`), lalu isinya naik menutupi bagian bawah pita itu (`PageBody`).
2. **Foto hero** `web/public/hero-lahan.jpg`: potongan landscape dari foto *Kebun cabai* (Amelia Citra, CC BY-SA 4.0, Wikimedia Commons). Atribusinya ada di footer.
3. **Sapaan "kamu" (pilihan pemilik proyek).** Pedoman yang dipakai:
   - kalimat pendek dan aktif;
   - "dompet", bukan "wallet"; "tahap", bukan "milestone";
   - tanpa format kaku "Label: a; b" dan tanpa em-dash di teks UI.
   - README tetap memakai bahasa formal, karena pembacanya juri.
4. **Label status baru:**
   - kampanye: Menunggu review, Cari dana, Berjalan, Sudah panen, Gagal, Tidak disetujui, Gagal bayar;
   - tahap: Belum ada bukti, Bukti masuk, Sudah dicek AI, Ditolak, Sengketa, Dana cair.
5. **Ringkasan putusan agen (`summary_id`) kini kalimat biasa.** Contoh: "Foto ditolak. Tanaman di foto terlihat seperti jagung, bukan cabai merah. Fase tanamannya pra-panen, padahal tahap ini tanam."
   - Contoh di PRD ("Disetujui: fase tumbuh, …") hanya contoh nilai, bukan format wajib.
   - Aturan keputusannya tidak berubah.
   - `decide()` sekarang menerima komoditas kampanye agar kalimatnya bisa menyebut tanaman yang seharusnya.
   - Jawaban model seperti "tidak dikenali" tidak dipakai sebagai nama tanaman.
6. **Web menyusun kalimat putusan dari data terstruktur di JSON putusan** (`lib/verdictText.ts`, gayanya sama dengan agen).
   - Dengan cara ini, putusan lama di testnet (format "Ditolak: …; …", sudah permanen di IPFS) juga tampil natural.
   - Tautan "Catatan lengkap (JSON)" tetap membuka dokumen aslinya.
   - Jika datanya tidak lengkap, web memakai `summary_id`.
7. **Statistik beranda tetap sesuai PRD** (total didanai, kampanye aktif, dana cadangan), ditambah jumlah petani dan statistik agen.
8. **Form Ajukan:** GPS foto boleh menimpa koordinat dari "Isi contoh data demo", tetapi tidak menimpa koordinat yang diketik manual.
9. **Tombol dompet memakai `ConnectButton.Custom` RainbowKit**, supaya gayanya sama dengan desain baru. Fungsi dan modal MetaMask tidak berubah.

