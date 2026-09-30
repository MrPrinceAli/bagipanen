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