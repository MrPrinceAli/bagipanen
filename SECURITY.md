# Kebijakan Keamanan

BagiPanen adalah proyek hackathon yang berjalan di **BSC testnet** dengan stablecoin demo (mUSDT), jadi tidak ada uang
sungguhan. Meski begitu, keamanan escrow dan integritas putusan agen kami anggap serius.

## Melaporkan celah

Mohon **jangan membuka issue publik**. Laporkan secara privat lewat
[GitHub Security Advisories](https://github.com/MrPrinceAli/bagipanen/security/advisories/new) dan sertakan:

- apa yang ditemukan dan di mana (kontrak, fungsi, route, atau agen);
- langkah reproduksi;
- dampaknya (dana escrow bisa ditarik, putusan agen dipalsukan, bagi hasil salah, dll.).

Kami berusaha membalas dalam 72 jam.

## Cakupan

- Penarikan dana escrow di luar alur milestone, refund, atau bagi hasil
- Memalsukan putusan agen, atau `recordVerdict` dari wallet yang bukan pemilik NFT agen ERC-8004
- Melewati salah satu dari dua kunci pencairan (agen AI + koperasi)
- Manipulasi Rapor Petani atau ReservePool
- Kebocoran rahasia (JWT Pinata, API key) lewat web atau log
