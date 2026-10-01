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
