// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

/// @notice Fallback registri identitas agen (ERC-721 minimal) jika registri
/// ERC-8004 resmi tidak tersedia. Dipakai juga di mode lokal (Anvil).
contract MockAgentIdentity is ERC721URIStorage {
    uint256 public totalAgents;

    event AgentRegistered(uint256 indexed agentId, address indexed owner, string uri);

    constructor() ERC721("BagiPanen Mock Agent Identity", "MOCK-AGENT") {}

    /// @notice Daftarkan agen baru; pemanggil menjadi pemilik identitas.
    function register(string calldata uri) external returns (uint256 agentId) {
        agentId = ++totalAgents;
        _mint(msg.sender, agentId);
        _setTokenURI(agentId, uri);
        emit AgentRegistered(agentId, msg.sender, uri);
    }
}
