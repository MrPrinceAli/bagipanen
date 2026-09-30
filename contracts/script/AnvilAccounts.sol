// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";

/// @notice Pemetaan akun bawaan Anvil ke peran demo (hanya mode lokal).
/// Satu-satunya sumber kebenaran: Deploy.s.sol menulis pemetaan ini ke
/// deployments/anvil.json, lalu web & agen membacanya lewat `npm run sync`.
abstract contract AnvilAccounts is Script {
    /// @dev Mnemonic bawaan Anvil. Publik dan BUKAN rahasia; hanya dipakai di chain lokal 31337.
    string internal constant ANVIL_MNEMONIC = "test test test test test test test test test test test junk";
    uint256 internal constant ANVIL_CHAIN_ID = 31337;
    uint256 internal constant BSC_TESTNET_CHAIN_ID = 97;

    uint32 internal constant IDX_ADMIN = 0;
    uint32 internal constant IDX_KOPERASI = 1;
    uint32 internal constant IDX_PETANI = 2;
    uint32 internal constant IDX_RINA = 3;
    uint32 internal constant IDX_BUDI = 4;
    uint32 internal constant IDX_SARI = 5;
    uint32 internal constant IDX_AGEN = 6;

    function _anvilKey(uint32 index) internal pure returns (uint256) {
        return vm.deriveKey(ANVIL_MNEMONIC, index);
    }

    function _anvilAddr(uint32 index) internal pure returns (address) {
        return vm.addr(_anvilKey(index));
    }

    function _deploymentPath(string memory network) internal view returns (string memory) {
        return string.concat(vm.projectRoot(), "/../deployments/", network, ".json");
    }
}
