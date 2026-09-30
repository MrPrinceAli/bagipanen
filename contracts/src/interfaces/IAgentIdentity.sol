// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Bagian minimal dari registri identitas agen yang dipakai BagiPanen.
/// Registri identitas ERC-8004 berbasis ERC-721, sehingga cukup memakai fungsi
/// standar ERC-721 `ownerOf` dan `tokenURI`. Fungsi pendaftaran registri resmi
/// dipanggil off-chain oleh script agen (lihat docs/erc8004-notes.md, Gelombang 8).
interface IAgentIdentity {
    function ownerOf(uint256 agentId) external view returns (address);
    function tokenURI(uint256 agentId) external view returns (string memory);
}
