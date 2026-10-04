# Berkontribusi ke BagiPanen

Terima kasih sudah ingin membantu petani Indonesia mendapat modal yang adil! 🌾

## Prinsip

- **Dana hanya bergerak lewat smart contract.** Admin tidak boleh bisa menarik dana escrow.
- **Dua kunci pencairan.** Agen AI dan koperasi sama-sama harus setuju; jangan buat jalan pintas.
- **Jangan mengarang alamat atau ABI ERC-8004.** Selalu cek dokumentasi resmi BNB Chain.
- **Rahasia hanya di `.env`.** Lihat `.env.example`, dan jangan pernah commit `.env`.
- UI berbahasa Indonesia, mobile-first, Tailwind.

## Alur kerja

1. Fork repo atau buat branch: `feat-…`, `fix-…`, `docs-…`.
2. Jalankan mode lokal (Anvil + MockVision) sesuai [README](README.md#-menjalankan-di-lokal).
3. Setiap fungsi kontrak wajib punya test Foundry. Jalankan gerbang berikut:
   ```bash
   npm run test:contracts                  # forge test
   npm run test:agent                      # unit test agen
   (cd web && npm run lint && npm run build)
   ```
4. Buka pull request ke `main` dan jelaskan perubahan serta cara mengujinya.
5. Catat keputusan teknis yang tidak jelas dengan sendirinya di [`docs/decisions.md`](docs/decisions.md).

## Melaporkan bug & ide

Gunakan template issue. Masalah keamanan dilaporkan sesuai [SECURITY.md](SECURITY.md), bukan lewat issue publik.
