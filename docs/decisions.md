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
