# Catatan riset ERC-8004 di BSC testnet

Diriset 1 Oktober 2026. Setiap butir dicek dari sumber primer, dan alamat/ABI juga dicek langsung di chain. Tidak ada yang ditebak.

## Alamat registri (BSC testnet, chain ID 97)

| Kontrak | Alamat |
| --- | --- |
| **IdentityRegistry** (proxy) | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| Implementasi saat ini (slot EIP-1967) | `0x7274e874ca62410a93bd8bf61c69d8045e399c02` |
| ReputationRegistry (tidak dipakai BagiPanen) | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |

Sumber alamat:

1. **SDK resmi BNB Chain** [`bnb-chain/bnbagent-sdk`](https://github.com/bnb-chain/bnbagent-sdk) (commit `7a7a431`, 23 Sep 2026):
   - `typescript/src/config.ts`: `registryContract: "0x8004A818BFB912233c491871b3d84c89A494BD9e"` untuk BSC Testnet;
   - `python/bnbagent/erc8004/README.md`: tabel "BSC Testnet · Active · 97 · `0x8004A818…BD9e`".
2. **Repo kontrak tim ERC-8004** [`erc-8004/erc-8004-contracts`](https://github.com/erc-8004/erc-8004-contracts): tabel deployment BSC Testnet, alamat sama.
3. **Pengecekan di chain** (RPC resmi `bsc-testnet-dataseed.bnbchain.org`):
   - alamat berisi proxy (130 byte);
   - implementasinya berisi kode 14.474 byte;
   - `name()` = `"AgentIdentity"`, `symbol()` = `"AGENT"`.

Untuk perbandingan, SDK yang sama mencatat alamat BSC **mainnet** `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`. Alamat ini tidak dipakai di proyek.

## Fungsi yang relevan

Dicocokkan antara ABI implementasi yang **terverifikasi di BscScan** (63 item, diambil lewat Etherscan API V2 `getabi`) dan ABI di SDK BNB Chain (`typescript/src/abis/identityRegistry.ts`). Keduanya sama.

```solidity
function register(string agentURI) returns (uint256 agentId)              // dipakai BagiPanen
function register(string agentURI, (string metadataKey, bytes metadataValue)[] metadata) returns (uint256 agentId)
function register() returns (uint256 agentId)
function setAgentURI(uint256 agentId, string newURI)
function ownerOf(uint256 tokenId) view returns (address)                  // ERC-721 — dipakai isAgent
function tokenURI(uint256 tokenId) view returns (string)                  // ERC-721 — dibaca halaman /agent
function getAgentWallet(uint256 agentId) view returns (address)
event Registered(uint256 indexed agentId, string agentURI, address indexed owner)
event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy)
```

Dari [spesifikasi EIP-8004](https://eips.ethereum.org/EIPS/eip-8004):
- `agentWallet` *"initially set to the owner's address"*;
- `agentURI` boleh berupa `ipfs://`, `https://`, atau `data:application/json;base64,…`;
- format *registration file*: `type`, `name`, `description`, `image`, `services`, `x402Support`, `active`, `registrations[{agentId, agentRegistry: "eip155:97:<registry>"}]`, `supportedTrust`. Field tambahan boleh.

## Dampak ke BagiPanen

- **Kontrak tidak perlu diubah.** `CampaignFactory.isAgent` hanya memakai `ownerOf(agentId) == agentWallet`, dan `setAgent` memvalidasi hal yang sama. Itu fungsi standar ERC-721 yang ada di registri resmi.
- **Deploy:** isi `ERC8004_IDENTITY_REGISTRY=0x8004A818BFB912233c491871b3d84c89A494BD9e` di `contracts/.env`. `Deploy.s.sol` lalu **tidak** men-deploy `MockAgentIdentity` dan mencatat `identityIsMock: false`.
- **Pendaftaran agen** (`agent/scripts/register-agent.ts`, jalur registri resmi):
  1. unggah agent card ke IPFS (Pinata);
  2. `register(ipfs://<cid>)` dari wallet agen (wallet ini otomatis menjadi pemilik dan `agentWallet`) dan baca `agentId` dari event `Registered`;
  3. unggah ulang agent card dengan `registrations[{agentId, agentRegistry: "eip155:97:0x8004A818…BD9e"}]`, lalu `setAgentURI`;
  4. admin memanggil `factory.setAgent(registry, agentId, agentWallet)`.
- **Reputasi** tetap dicatat di `ReputationBook` milik BagiPanen. Reputation Registry resmi tidak dipakai (sesuai PRD: di luar lingkup MVP).
- **Label di UI:** halaman `/agent` otomatis menampilkan "Registri identitas ERC-8004" karena registri yang dipakai bukan mock hasil deploy.

## Temuan infrastruktur terkait

**`eth_getLogs` ditolak RPC publik resmi BNB** ("limit exceeded", bahkan untuk 10 blok) di `bsc-testnet-dataseed.bnbchain.org`, `bsc-testnet.bnbchain.org`, dan `data-seed-prebsc-1-s1.bnbchain.org:8545`. Dokumentasi BNB menyarankan endpoint pihak ketiga untuk membaca log.

Hasil uji RPC publik dari daftar Chainlist:

| RPC | Hasil uji |
| --- | --- |
| `https://bsc-testnet-rpc.publicnode.com` | ✓ `getLogs` sampai **50.000 blok** per panggilan, tapi **wajib dengan filter alamat** |
| `https://rpc.sentio.xyz/bsc-testnet` | ✓ `getLogs` **tanpa filter alamat** sampai ≥ 100.000 blok (batasnya tidak didokumentasikan); harga gas yang disarankan 1 gwei |
| drpc / zan / onfinality | ✗ dibatasi paket gratis |

BSC testnet ≈ 0,45 detik per blok ≈ 192.000 blok per hari.

Keputusan:
- Deploy memakai RPC resmi BNB.
- Agen dan web membagi `getLogs` per 50.000 blok.
- publicnode juga **mewajibkan filter `address`** di `eth_getLogs` ("Please specify an address in your request"). Masalah ini baru terlihat di testnet sungguhan, tidak di fork Anvil.
  - Agen memakai **sentio**, supaya polling `ProofSubmitted` tetap tanpa filter alamat sesuai PRD. Jika RPC-nya menolak, agen otomatis beralih ke filter `factory.getCampaigns()`.
  - Web memakai publicnode dengan filter alamat kampanye resmi.
- Web menyimpan log yang sudah dibaca dan hanya mengambil blok baru di setiap refresh.

## Status

- **Dikonfirmasi pemilik proyek (1 Oktober 2026):** pakai registri resmi `0x8004A818BFB912233c491871b3d84c89A494BD9e`. Nilainya sudah diisi di `ERC8004_IDENTITY_REGISTRY` pada `contracts/.env`.
- Fallback `MockAgentIdentity` tetap tersedia jika diperlukan: kosongkan `ERC8004_IDENTITY_REGISTRY`.
