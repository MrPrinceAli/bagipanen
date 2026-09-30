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
