# Hasil uji acceptance — mode lokal & BSC testnet

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
| Semua kontrak ter-deploy dan terverifikasi di BscScan testnet | ✅ testnet | 5 kontrak ter-deploy dan terverifikasi (lihat [bagian BSC testnet](#bsc-testnet-gelombang-8)). |
| Agen terdaftar di registri ERC-8004 (resmi atau fallback) dan tampil di `/agent` | ✅ lokal (fallback) · ✅ testnet (resmi) | Lokal: agen #1 di `MockAgentIdentity`, diberi label jujur di UI. Testnet: **agen #2544 di registri resmi** `0x8004A818…BD9e`, label "Registri identitas ERC-8004". |
| Satu kampanye demo lengkap dari pengajuan sampai semua investor klaim | ✅ lokal · ✅ testnet | Langkah 1–7 di atas; angka persis sama dengan tabel PRD, di kedua mode. |
| Minimal satu milestone ditolak AI dengan alasan jelas, lalu disetujui setelah unggah ulang | ✅ lokal · ✅ testnet | Tanam percobaan 1 ditolak (alasan tampil di timeline, riwayat, dan panel unggah ulang), percobaan 2 disetujui. Di testnet Gemini menolak foto jagung: "komoditas tidak sesuai (terdeteksi: Jagung)". |
| Putusan agen muncul di UI ≤ 30 detik setelah bukti dikirim | ✅ lokal · ⚠️ testnet | Lokal (MockVision): 10,4 / 10,4 / 10,4 / 20,5 detik, tanpa reload. Testnet: putusan tercatat di chain 32–49 detik setelah bukti dikirim (ditambah ≤ 10 detik refresh UI). Penyebab dan perbaikannya ada di bagian BSC testnet. |
| Rapor Petani menampilkan statistik yang benar setelah kampanye selesai | ✅ lokal · ✅ testnet | Lokal: 1 didanai · 1 panen · 100% tepat waktu · 100% akurasi estimasi · 0 gagal panen · 0 gagal bayar. Testnet: sama, dengan 2 kampanye didanai. |
| Semua halaman bisa dipakai di layar 360 px dan berbahasa Indonesia | ✅ lokal · ✅ Vercel | 11 halaman × peran (tamu, petani, investor, koperasi, admin, termasuk 404): tanpa scroll horizontal, semua gambar termuat, `lang="id"`, tanpa teks bocor (`undefined`/`NaN`/Inggris). Vercel (testnet): 7 halaman di 360 px tanpa scroll horizontal dan tanpa teks bocor, tanpa error konsol |
| README: deskripsi, arsitektur, alamat kontrak, cara menjalankan | ✅ | [README.md](../README.md): link demo Vercel, alamat BSC testnet + BscScan, agen #2544, arsitektur, cara mencoba untuk juri, cara menjalankan lokal/testnet/Vercel. |

## Test otomatis

| Paket | Hasil |
| --- | --- |
| `contracts/` | `forge test`: 90 test lulus, cakupan 100% baris/statement/cabang/fungsi, semua skenario wajib PRD termasuk fuzz pembulatan |
| `agent/` | `npm test`: 46 unit test lulus (Gelombang 8) |
| `web/` | `tsc`, `eslint`, dan `next build` bersih (mode lokal & testnet) |

## Bug yang ditemukan & diperbaiki di Gelombang 7

1. **Halaman 404 dan error masih bawaan Next (bahasa Inggris).** Ditambahkan `app/not-found.tsx` dan `app/error.tsx` berbahasa Indonesia.
2. **Pesan sukses hilang sebelum sempat terbaca.** Setelah admin menyetujui kampanye (atau koperasi memutuskan), data di-refresh; itemnya keluar dari daftar dan pesan suksesnya ikut hilang. Sekarang ada notifikasi (toast) global ±6 detik, lengkap dengan tautan transaksi.
3. **Navigasi header terpotong di 360 px.** Label diperpendek di layar kecil ("Ajukan", "Minta mUSDT"); label lengkap tetap tampil di layar ≥ 640 px.
4. **Keputusan berbasis waktu bisa keliru.** Panel "Danai" / "Tutup pendanaan" dan tombol gagal bayar sebelumnya memakai jam perangkat saja, atau blok terakhir saja. Sekarang memakai `max(jam perangkat, waktu blok terbaru)`, yaitu waktu minimal transaksi berikutnya akan ditambang.

## BSC testnet (Gelombang 8)

Tanggal uji: 1 Oktober 2026. Mode `APP_MODE=testnet`: BSC testnet (chain 97), Pinata, Gemini, dan registri ERC-8004 resmi.

**Kontrak** (semua terverifikasi di BscScan, blok deploy 134247179):

| Kontrak | Alamat |
| --- | --- |
| CampaignFactory | [`0xDaAAb760e8ba84dFBB209a1ec944875d71584809`](https://testnet.bscscan.com/address/0xDaAAb760e8ba84dFBB209a1ec944875d71584809#code) |
| MockUSDT | [`0x09E5561C0d52eD66c8d65F2DA5c7EF4708555642`](https://testnet.bscscan.com/address/0x09E5561C0d52eD66c8d65F2DA5c7EF4708555642#code) |
| CampaignDeployer | [`0x41c4704112dd0089C218C8386F56beC21AD86FCe`](https://testnet.bscscan.com/address/0x41c4704112dd0089C218C8386F56beC21AD86FCe#code) |
| ReputationBook | [`0xE10414172fB887d9789AA2b33B6D062cb5432B90`](https://testnet.bscscan.com/address/0xE10414172fB887d9789AA2b33B6D062cb5432B90#code) |
| ReservePool | [`0x9e4C939F7DD58b13cBB1148bff4fC15433E0978b`](https://testnet.bscscan.com/address/0x9e4C939F7DD58b13cBB1148bff4fC15433E0978b#code) |
| IdentityRegistry ERC-8004 (resmi, bukan milik BagiPanen) | [`0x8004A818BFB912233c491871b3d84c89A494BD9e`](https://testnet.bscscan.com/address/0x8004A818BFB912233c491871b3d84c89A494BD9e) |

**Agen:** #2544 di registri resmi, wallet `0x0837FE45C0faf7a101C98d70D71476db81806022`, agent card di IPFS (Pinata).

**Skenario penuh:** kampanye [`0xa13f0bB50045F5e8cA1054b9AeF070CD9D9c58bE`](https://testnet.bscscan.com/address/0xa13f0bB50045F5e8cA1054b9AeF070CD9D9c58bE).
- Transaksi dikirim dengan `cast` dari akun demo (MetaMask tidak bisa diotomasi).
- Foto diunggah lewat API web ke Pinata.
- Putusan dibuat oleh agen yang berjalan sungguhan dengan Gemini.

| Langkah | Hasil |
| --- | --- |
| Pengajuan → persetujuan admin → pendanaan 500/300/200 | Status **Berjalan** |
| Tanam #1: `foto-salah-jagung.jpg` | **Ditolak** agen (32 dtk): "komoditas tidak sesuai (terdeteksi: Jagung); fase tidak sesuai". Koperasi juga menolak |
| Tanam #2: `tanam.jpg` | **Disetujui** agen (49 dtk, yakin 0,92) + koperasi → cair 400 |
| Tumbuh: `tumbuh.jpg` | **Disetujui** (35 dtk, yakin 0,90) → cair 350 |
| Pra-panen: `pra-panen.jpg` | **Disetujui** (38 dtk, yakin 0,90; kondisi "buruk" dicatat) → cair 250 |
| Setor panen 1.650 + nota | Petani **357,5**, dana cadangan **32,5**, status **Panen** |
| Klaim Rina / Budi / Sari | **630 / 378 / 252**, saldo escrow **0** |
| Kampanye kedua [`0xB0C1…cb75`](https://testnet.bscscan.com/address/0xB0C1d27dd190d3d95327676f689E06D18930cb75): foto Tanam yang sama diunggah ulang | **Ditolak sebagai duplikat** (hash sama dengan kampanye pertama). Keputusan koperasi sengaja dibiarkan menunggu, sebagai bahan demo antrean koperasi |

**Web mode testnet** (headless Chrome, tanpa wallet), semua halaman tanpa error konsol:
- beranda dan detail kampanye: metadata, foto, dan JSON putusan dari Pinata, plus 26 tautan transaksi BscScan;
- `/agent`: label "Registri identitas ERC-8004", agen #2544, 5 putusan (3 setuju, 2 tolak);
- Rapor Petani: angka benar;
- tombol RainbowKit "Hubungkan Dompet" membuka pilihan MetaMask; pemilih akun demo tidak tampil.

**Latensi putusan di testnet.** Waktu dari bukti dikirim sampai putusan tercatat di chain: 32 / 49 / 35 / 38 detik. Kampanye kedua 62 detik, karena semua model Gemini sempat 503/429 sehingga agen mengulang setelah 15 detik. Rinciannya:

| Komponen | Waktu |
| --- | --- |
| Agen mendeteksi bukti (polling 10 dtk, sesuai PRD) | rata-rata 5 dtk, maks. 10 dtk |
| Unduh foto dari Pinata | ±2 dtk |
| Model utama Gemini menolak (503/429) sebelum pindah ke model cadangan | ±3 dtk |
| Jawaban Gemini | ±7–10 dtk |
| Unggah JSON putusan ke Pinata + transaksi | ±8 dtk |

Perbaikan yang sudah diterapkan:
- model yang kuotanya habis (429) dilewati selama 10 menit;
- cuaca diambil bersamaan dengan unduhan foto.

Perkiraan setelah perbaikan: ±25–35 detik sampai muncul di UI. Hasilnya tetap bergantung pada beban dan kuota Gemini gratis, jadi butir "≤ 30 detik" di testnet belum bisa dijamin.

Biaya gas: satu skenario penuh ≈ 0,0005 tBNB untuk petani. Satu putusan agen ≈ 0,00017 tBNB (agen memakai RPC sentio dengan harga gas 1 gwei).

