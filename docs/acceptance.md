# Hasil uji acceptance — mode lokal

Tanggal uji: 30 September 2026 · Mode: `APP_MODE=local` (Anvil, penyimpanan lokal, MockVision) · Agen AI berjalan sungguhan.

Skenario "Data demo" PRD dijalankan penuh **lewat browser**, di layar 360 px, dengan pemilih akun demo:

1. **Pengajuan.** Pak Darto mengajukan kampanye cabai merah (5.000 m², Cikajang, Garut). Target 1.000 mUSDT, estimasi penjualan 1.650, durasi 10 menit. Koordinat terisi dari GPS foto lahan.
2. **Persetujuan.** Admin menyetujui kampanye dari `/admin`.
3. **Pendanaan.** Rina 500, Budi 300, dan Sari 200 mendanai lewat stepper *Setujui mUSDT → Danai*. Status berubah menjadi **Berjalan**.
4. **Tanam, percobaan 1.** Foto `foto-salah.jpg` **ditolak agen** dengan alasan: "bukan foto lahan pertanian; komoditas tidak sesuai; fase tidak sesuai; keyakinan AI 0,20 di bawah 0,70". Koperasi memutuskan dari antrean. Petani melihat alasan penolakan, lalu mengunggah ulang.
5. **Tanam, Tumbuh, Pra-panen** disetujui agen dan koperasi, lalu dana cair 400, 350, dan 250.
6. **Panen.** Petani menyetor hasil panen 1.650 + foto nota (*Unggah nota → Setujui mUSDT → Setor*). Petani menerima **357,5**, dana cadangan **32,5**.
7. **Klaim.** Rina, Budi, dan Sari mengklaim **630 / 378 / 252** (imbal hasil 26%). Saldo escrow akhir **0**.

Kondisi khusus juga diuji lewat UI (Gelombang 6 dan 7):

- sengketa (ditolak 3×) → admin mencairkan;
- gagal panen → klaim → kompensasi dana cadangan → klaim lagi;
- gagal bayar setelah perkiraan panen + 30 hari → petani diblokir;
- pendanaan gagal → tutup pendanaan → refund 100%.

## Checklist acceptance

| Butir PRD | Status | Bukti |
| --- | --- | --- |
| Semua kontrak ter-deploy dan terverifikasi di BscScan testnet | ⏳ testnet | Gelombang 8. Di lokal: semua kontrak ter-deploy lewat `npm run dev:chain`. |
| Agen terdaftar di registri ERC-8004 (resmi atau fallback) dan tampil di `/agent` | ✅ lokal (fallback) | Agen #1 di `MockAgentIdentity`, diberi label jujur di UI. Statistik 4 putusan (3 setuju, 1 tolak). Registri resmi dicek di Gelombang 8. |
| Satu kampanye demo lengkap dari pengajuan sampai semua investor klaim | ✅ | Langkah 1–7 di atas; angka persis sama dengan tabel PRD. |
| Minimal satu milestone ditolak AI dengan alasan jelas, lalu disetujui setelah unggah ulang | ✅ | Tanam percobaan 1 ditolak (alasan tampil di timeline, riwayat, dan panel unggah ulang), percobaan 2 disetujui. |
| Putusan agen muncul di UI ≤ 30 detik setelah bukti dikirim | ✅ | 10,4 / 10,4 / 10,4 / 20,5 detik (maks 20,5), tanpa reload. Polling agen 10 detik + refresh UI 10 detik. |
| Rapor Petani menampilkan statistik yang benar setelah kampanye selesai | ✅ | 1 didanai · 1 panen · 100% tepat waktu · 100% akurasi estimasi · 0 gagal panen · 0 gagal bayar |
| Semua halaman bisa dipakai di layar 360 px dan berbahasa Indonesia | ✅ | 11 halaman × peran (tamu, petani, investor, koperasi, admin, termasuk 404): tanpa scroll horizontal, semua gambar termuat, `lang="id"`, tanpa teks bocor (`undefined`/`NaN`/Inggris) |
| README: deskripsi, arsitektur, alamat kontrak, cara menjalankan | ✅ lokal | [README.md](../README.md). Alamat BSC testnet dan link Vercel ditambahkan di Gelombang 8–9. |

## Test otomatis

| Paket | Hasil |
| --- | --- |
| `contracts/` | `forge test`: 90 test lulus, cakupan 100% baris/statement/cabang/fungsi, semua skenario wajib PRD termasuk fuzz pembulatan |
| `agent/` | `npm test`: 40 unit test lulus |
| `web/` | `tsc`, `eslint`, dan `next build` bersih (mode lokal & testnet) |

## Bug yang ditemukan & diperbaiki di Gelombang 7

1. **Halaman 404 dan error masih bawaan Next (bahasa Inggris).** Ditambahkan `app/not-found.tsx` dan `app/error.tsx` berbahasa Indonesia.
2. **Pesan sukses hilang sebelum sempat terbaca.** Setelah admin menyetujui kampanye (atau koperasi memutuskan), data di-refresh; itemnya keluar dari daftar dan pesan suksesnya ikut hilang. Sekarang ada notifikasi (toast) global ±6 detik, lengkap dengan tautan transaksi.
3. **Navigasi header terpotong di 360 px.** Label diperpendek di layar kecil ("Ajukan", "Minta mUSDT"); label lengkap tetap tampil di layar ≥ 640 px.
4. **Keputusan berbasis waktu bisa keliru.** Panel "Danai" / "Tutup pendanaan" dan tombol gagal bayar sebelumnya memakai jam perangkat saja, atau blok terakhir saja. Sekarang memakai `max(jam perangkat, waktu blok terbaru)`, yaitu waktu minimal transaksi berikutnya akan ditambang.
