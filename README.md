# BagiPanen

Modal tanam yang adil untuk petani, transparan untuk investor, diverifikasi AI, tercatat onchain.

BagiPanen adalah platform pendanaan modal tanam untuk petani Indonesia di BNB Chain: investor mendanai satu musim tanam dengan stablecoin, dana cair bertahap setelah diverifikasi agen AI dan koperasi, lalu hasil panen dibagi otomatis oleh smart contract.

> README lengkap (arsitektur, alamat kontrak, cara menjalankan) ditulis di Gelombang 9.
> Acuan utama pengembangan: [docs/PRD.md](docs/PRD.md).

## Struktur

| Folder | Isi |
| --- | --- |
| `contracts/` | Smart contract (Foundry, Solidity ^0.8.24, OpenZeppelin v5) |
| `web/` | Frontend (Next.js App Router + TypeScript + Tailwind) |
| `agent/` | Agen AI verifikator (Node.js + TypeScript) |
| `deployments/` | Alamat kontrak hasil deploy (ditulis oleh script deploy) |
| `docs/` | PRD, catatan keputusan, catatan ERC-8004 |
