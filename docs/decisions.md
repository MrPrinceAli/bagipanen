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
