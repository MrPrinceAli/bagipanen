# Foto contoh untuk demo & presentasi

Foto berlisensi bebas dari [Wikimedia Commons](https://commons.wikimedia.org), diperkecil menjadi lebar 1.280 px (tanpa perubahan lain), ditambah satu nota contoh buatan sendiri.

**Ini bukan foto lapangan BagiPanen.** Foto-foto ini hanya ilustrasi untuk demo dan presentasi. Tidak ada data GPS/tanggal (EXIF) yang ditambahkan atau dipalsukan, sehingga agen mencatatnya sebagai "EXIF tidak ada".

| File | Dipakai untuk | Judul asli | Pembuat | Lisensi |
| --- | --- | --- | --- | --- |
| `lahan-awal.jpg` | Foto lahan awal (sampul kampanye) | [Kebun cabai.jpg](https://commons.wikimedia.org/wiki/File:Kebun_cabai.jpg) | Amelia Citra | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| `tanam.jpg` | Milestone Tanam | [Capsicum annuum 2020-05-21 8787.jpg](https://commons.wikimedia.org/wiki/File:Capsicum_annuum_2020-05-21_8787.jpg) | Salicyna | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| `tumbuh.jpg` | Milestone Tumbuh | [Jaringan Listrik dan Tanaman Cabai - panoramio.jpg](https://commons.wikimedia.org/wiki/File:Jaringan_Listrik_dan_Tanaman_Cabai_-_panoramio.jpg) | wowo_s | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0) |
| `pra-panen.jpg` | Milestone Pra-panen | [Tanaman Cabai Merah.jpg](https://commons.wikimedia.org/wiki/File:Tanaman_Cabai_Merah.jpg) | Fhikri Latifi | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0) |
| `foto-salah-jagung.jpg` | Contoh foto salah (komoditas lain: jagung) | [Maize field in Bavaria in Summer 2013.JPG](https://commons.wikimedia.org/wiki/File:Maize_field_in_Bavaria_in_Summer_2013.JPG) | High Contrast | [CC BY 3.0 de](https://creativecommons.org/licenses/by/3.0/de/deed.en) |
| `nota-penjualan-contoh.jpg` | Foto nota saat setor hasil panen | Dibuat untuk proyek ini, bertanda "CONTOH · DATA DEMO" (nama & angka fiktif, sesuai data demo PRD) | Tim BagiPanen | — |

Foto hero di beranda (`web/public/hero-lahan.jpg`) adalah potongan landscape dari `lahan-awal.jpg`. Atribusinya tercantum di footer situs.

## Cara pakai

- **Mode lokal (MockVision).** Semua foto disetujui, kecuali `foto-salah-jagung.jpg` (nama filenya mengandung "salah"). Cocok untuk demo alur ditolak lalu diunggah ulang.
- **Mode testnet (Gemini).** Gemini menilai isi foto sungguhan. Prompt agen meminta Gemini menolak gambar dari internet, jadi hasilnya bisa berbeda dari mode lokal. Untuk demo testnet, foto lapangan asli tetap paling baik. Hasil uji 1 Okt 2026:
  - `tanam.jpg` **disetujui** (yakin 0,92);
  - `foto-salah-jagung.jpg` **ditolak** ("komoditas jagung, tidak sesuai");
  - foto Tumbuh pertama (*Kebun Cabai*, AntaraTV) **ditolak** karena tanamannya sudah berbunga/berbuah (fase Pra-panen), sehingga diganti foto barisan cabai muda di lahan.
  - pada skenario penuh di BSC testnet: `tumbuh.jpg` **disetujui** (fase Tumbuh, yakin 0,90). `pra-panen.jpg` **disetujui** (fase Pra-panen, yakin 0,90), tetapi Gemini menilai kondisinya "buruk" dan memberi catatan: daun keriting, polybag di pekarangan. Sesuai aturan PRD, kondisi tanaman tidak ikut menentukan putusan, tetapi catatannya tampil untuk koperasi. Jika ingin tampilan demo yang lebih meyakinkan, ganti dengan foto cabai berbuah merah di lahan terbuka;
  - foto yang sama diunggah ke kampanye lain → **ditolak sebagai duplikat** (hash SHA-256 sama).
- **Koordinat lahan.** Foto tidak punya GPS. Tombol "Isi contoh data demo" di halaman Ajukan sudah mengisi koordinat Cikajang (-7,356436, 107,80699; sumber: [Wikipedia](https://id.wikipedia.org/wiki/Cikajang,_Garut)).

## Foto enam proyek contoh (`showcase/`)

Dipakai oleh `agent/scripts/seed-showcase.ts` untuk proyek contoh di BSC testnet (Nganjuk, Karo, Kulon Progo, Lombok Tengah, Sidrap, Tanah Laut, ditambah skenario gagal pendanaan di Dieng dan gagal panen di Demak). Semuanya dari Wikimedia Commons, diperkecil menjadi lebar 1.280 px oleh Wikimedia (tanpa perubahan lain). Sebelum dikirim ke kontrak, setiap foto bukti diuji dulu ke Gemini dengan `npm run cek-foto` agar kesempatan unggah tidak terbuang. Contohnya, foto jagung bertunas bunga ditolak untuk tahap Tumbuh karena fasenya sudah pra-panen, lalu diganti. Nama petani & koperasi fiktif; koordinat lahan adalah perkiraan pusat kecamatan.

| File | Dipakai untuk | Judul asli | Pembuat | Lisensi |
| --- | --- | --- | --- | --- |
| `nganjuk-sampul.jpg` | Sampul bawang merah, Nganjuk | [Pertanian Bawang Merah (Red Onion Field).jpg](https://commons.wikimedia.org/wiki/File:Pertanian_Bawang_Merah_(Red_Onion_Field).jpg) | Nizambagusp | CC BY-SA 4.0 |
| `karo-sampul.jpg` | Sampul kentang, Karo | [Potato Field.jpg](https://commons.wikimedia.org/wiki/File:Potato_Field.jpg) | Dzikra Imron | CC BY-SA 4.0 |
| `kulonprogo-sampul.jpg` | Sampul cabai rawit, Kulon Progo | [Chilli plantation bali.jpg](https://commons.wikimedia.org/wiki/File:Chilli_plantation_bali.jpg) | Okkisafire | CC BY-SA 4.0 |
| `lombok-sampul.jpg` | Sampul padi, Lombok Tengah | [Rice field in Lombok.jpg](https://commons.wikimedia.org/wiki/File:Rice_field_in_Lombok.jpg) | Lasthib | CC0 |
| `lombok-tanam.jpg` | Bukti Tanam, Lombok Tengah | [Tandur (tanam mundur).jpg](https://commons.wikimedia.org/wiki/File:Tandur_(tanam_mundur).jpg) | Galeri ega | CC BY-SA 4.0 |
| `sidrap-sampul.jpg` | Sampul padi, Sidrap | [Membajak Sawah Menggunakan Tenaga Sapi.jpg](https://commons.wikimedia.org/wiki/File:Membajak_Sawah_Menggunakan_Tenaga_Sapi.jpg) | Anis Mujahid Akbar | CC BY-SA 4.0 |
| `sidrap-tanam.jpg` | Bukti Tanam, Sidrap | [Sawah hijau.jpg](https://commons.wikimedia.org/wiki/File:Sawah_hijau.jpg) | Mochammad Taufik | CC BY-SA 4.0 |
| `sidrap-tumbuh.jpg` | Bukti Tumbuh, Sidrap | [Padi.jpg](https://commons.wikimedia.org/wiki/File:Padi.jpg) | Helito | CC BY-SA 4.0 |
| `sidrap-pra-panen.jpg` | Bukti Pra-panen, Sidrap | [Ripening rice plants in paddy field, Indonesia.jpg](https://commons.wikimedia.org/wiki/File:Ripening_rice_plants_in_paddy_field,_Indonesia.jpg) | Undeka 11 | CC BY-SA 4.0 |
| `tanahlaut-sampul.jpg` | Sampul jagung, Tanah Laut | [Ladang Jagung Di Bontotiro.jpg](https://commons.wikimedia.org/wiki/File:Ladang_Jagung_Di_Bontotiro.jpg) | Kurniawan Maulana | CC BY-SA 4.0 |
| `tanahlaut-tanam.jpg` | Bukti Tanam, Tanah Laut | [Corn shoots - Mısır filizleri 01.jpg](https://commons.wikimedia.org/wiki/File:Corn_shoots_-_M%C4%B1s%C4%B1r_filizleri_01.jpg) | Zeynel Cebeci | CC BY-SA 4.0 |
| `tanahlaut-tumbuh.jpg` | Bukti Tumbuh, Tanah Laut | [A maize and cassava farm.jpg](https://commons.wikimedia.org/wiki/File:A_maize_and_cassava_farm.jpg) | Phina001 | CC BY-SA 4.0 |
| `tanahlaut-pra-panen.jpg` | Bukti Pra-panen, Tanah Laut | [Jagung Yang Sudah Siap Di Panen.jpg](https://commons.wikimedia.org/wiki/File:Jagung_Yang_Sudah_Siap_Di_Panen.jpg) | SATELITBM | CC BY-SA 4.0 |
| `dieng-sampul.jpg` | Sampul kentang, Dieng (skenario gagal pendanaan) | [Gubuk kecil ditengah hamparan ladang kentang.jpg](https://commons.wikimedia.org/wiki/File:Gubuk_kecil_ditengah_hamparan_ladang_kentang.jpg) | Ahmadwahyudi7 | CC BY-SA 4.0 |
| `demak-sampul.jpg` | Sampul padi, Demak (skenario gagal panen) | [Hamparan Sawah Desa Ngampel.jpg](https://commons.wikimedia.org/wiki/File:Hamparan_Sawah_Desa_Ngampel.jpg) | Dzaky Badawi | CC BY-SA 4.0 |
| `demak-tanam.jpg` | Bukti Tanam, Demak | [Young rice seedlings in muddy rice field, Indonesia.jpg](https://commons.wikimedia.org/wiki/File:Young_rice_seedlings_in_muddy_rice_field,_Indonesia.jpg) | Undeka 11 | CC BY-SA 4.0 |
| `kulonprogo-tanam.jpg` | Bukti Tanam, Kulon Progo (dikirim manual untuk uji pemicu agen langsung `/api/agent-wake`, 4 Okt 2026) | [Peppers planted at SOIL's experimental farm in Pernier, Port-au-Prince, Haiti (16407252610).jpg](https://commons.wikimedia.org/wiki/File:Peppers_planted_at_SOIL%27s_experimental_farm_in_Pernier,_Port-au-Prince,_Haiti_(16407252610).jpg) | SuSanA Secretariat | CC BY 2.0 |
| `sidrap-nota.jpg`, `tanahlaut-nota.jpg` | Nota setor hasil panen | Dibuat untuk proyek ini, bertanda "CONTOH · DATA DEMO" (nama & angka fiktif) | Tim BagiPanen | — |

## Proyek demo juri (`juri/` dan `web/public/demo/foto-contoh/`)

Dipakai `agent/scripts/seed-demo-judges.ts` (akun demo juri) dan halaman /masuk. Semua dari Wikimedia Commons, diperkecil.

| File | Dipakai untuk | Judul asli | Pembuat | Lisensi |
| --- | --- | --- | --- | --- |
| `juri/sampul-jagung.jpg` | Sampul proyek demo juri | [Ladang Jagung.jpg](https://commons.wikimedia.org/wiki/File:Ladang_Jagung.jpg) | Shiroemon | CC BY-SA 4.0 |
| `foto-contoh/1-tanam-jagung.jpg` | Foto contoh tahap Tanam | [Little bitty corn plants.jpg](https://commons.wikimedia.org/wiki/File:Little_bitty_corn_plants.jpg) | Valerie Everett | CC BY-SA 2.0 |
| `foto-contoh/2-tumbuh-jagung.jpg` | Foto contoh tahap Tumbuh | [Corn field in Cayce, Richland County, SC.jpg](https://commons.wikimedia.org/wiki/File:Corn_field_in_Cayce,_Richland_County,_SC.jpg) | Dr. Blazer | CC BY-SA 4.0 |
| `foto-contoh/3-pra-panen-jagung.jpg` | Foto contoh tahap Pra-panen | [Kebun Jagung Wonoayu.jpg](https://commons.wikimedia.org/wiki/File:Kebun_Jagung_Wonoayu.jpg) | Kkn12 wonoayu | CC BY-SA 4.0 |

