// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {console} from "forge-std/console.sol";
import {AnvilAccounts} from "./AnvilAccounts.sol";
import {MockUSDT} from "../src/MockUSDT.sol";
import {CampaignFactory} from "../src/CampaignFactory.sol";

/// @notice Data demo di BSC testnet memakai wallet testnet (TESTNET_MNEMONIC di contracts/.env).
///   forge script script/SeedTestnet.s.sol --rpc-url bscTestnet --broadcast --slow
/// Urutan akun sama dengan mode lokal: 0 Admin, 1 Koperasi, 2 Petani, 3 Rina, 4 Budi, 5 Sari, 6 Agen.
/// - Admin membagikan tBNB untuk gas ke 6 akun lain (isi ulang sampai TBNB_PER_ACCOUNT, bawaan 0,02).
/// - Admin mendaftarkan koperasi & mint mUSDT; koperasi mendaftarkan petani.
/// Membaca alamat dari deployments/bscTestnet.json. Aman dijalankan ulang.
contract SeedTestnet is AnvilAccounts {
    string internal constant COOPERATIVE_NAME = "Koperasi Tani Makmur, Garut";
    string internal constant FARMER_NAME = "Pak Darto";
    uint256 internal constant INVESTOR_BALANCE = 5_000e18;
    uint256 internal constant FARMER_BALANCE = 1_000e18;

    struct Accounts {
        uint256 adminKey;
        uint256 koperasiKey;
        address admin;
        address koperasi;
        address petani;
        address[3] investors;
        address agen;
    }

    function run() external {
        require(block.chainid == BSC_TESTNET_CHAIN_ID, "SeedTestnet hanya untuk BSC testnet (97)");
        string memory json = vm.readFile(_deploymentPath("bscTestnet"));
        CampaignFactory factory = CampaignFactory(vm.parseJsonAddress(json, ".factory"));
        MockUSDT usdt = MockUSDT(vm.parseJsonAddress(json, ".usdt"));
        require(address(factory).code.length > 0, "Factory tidak ada di chain ini; jalankan Deploy.s.sol dulu");

        Accounts memory a = _accounts(vm.envString("TESTNET_MNEMONIC"));
        require(a.admin == factory.owner(), "TESTNET_MNEMONIC tidak cocok dengan admin (owner factory)");

        _distributeGas(a, vm.envOr("TBNB_PER_ACCOUNT", uint256(0.02 ether)));
        _onboard(a, factory, usdt);
        _log(a);
    }

    function _accounts(string memory mnemonic) internal pure returns (Accounts memory a) {
        a.adminKey = vm.deriveKey(mnemonic, IDX_ADMIN);
        a.koperasiKey = vm.deriveKey(mnemonic, IDX_KOPERASI);
        a.admin = vm.addr(a.adminKey);
        a.koperasi = vm.addr(a.koperasiKey);
        a.petani = vm.addr(vm.deriveKey(mnemonic, IDX_PETANI));
        a.investors[0] = vm.addr(vm.deriveKey(mnemonic, IDX_RINA));
        a.investors[1] = vm.addr(vm.deriveKey(mnemonic, IDX_BUDI));
        a.investors[2] = vm.addr(vm.deriveKey(mnemonic, IDX_SARI));
        a.agen = vm.addr(vm.deriveKey(mnemonic, IDX_AGEN));
    }

    /// @dev Isi ulang tBNB tiap akun sampai `perAccount`; cek saldo admin dulu agar gagal dengan pesan jelas.
    function _distributeGas(Accounts memory a, uint256 perAccount) internal {
        address[6] memory others = [a.koperasi, a.petani, a.investors[0], a.investors[1], a.investors[2], a.agen];
        uint256 needed;
        for (uint256 i; i < others.length; ++i) {
            if (others[i].balance < perAccount) needed += perAccount - others[i].balance;
        }
        require(a.admin.balance > needed, "Saldo tBNB admin kurang untuk dibagikan; minta tBNB dari faucet dulu");

        vm.startBroadcast(a.adminKey);
        for (uint256 i; i < others.length; ++i) {
            uint256 bal = others[i].balance;
            if (bal < perAccount) {
                (bool ok,) = payable(others[i]).call{value: perAccount - bal}("");
                require(ok, "Kirim tBNB gagal");
            }
        }
        vm.stopBroadcast();
    }

    function _onboard(Accounts memory a, CampaignFactory factory, MockUSDT usdt) internal {
        vm.startBroadcast(a.adminKey);
        if (!factory.isCooperative(a.koperasi)) factory.registerCooperative(a.koperasi, COOPERATIVE_NAME);
        for (uint256 i; i < a.investors.length; ++i) {
            if (usdt.balanceOf(a.investors[i]) < INVESTOR_BALANCE) usdt.mint(a.investors[i], INVESTOR_BALANCE);
        }
        if (usdt.balanceOf(a.petani) < FARMER_BALANCE) usdt.mint(a.petani, FARMER_BALANCE);
        vm.stopBroadcast();

        vm.startBroadcast(a.koperasiKey);
        if (factory.farmerCooperative(a.petani) == address(0)) factory.registerFarmer(a.petani, FARMER_NAME);
        vm.stopBroadcast();
    }

    function _log(Accounts memory a) internal pure {
        console.log("== Data demo BSC testnet siap");
        console.log("Admin    ", a.admin);
        console.log("Koperasi ", a.koperasi, COOPERATIVE_NAME);
        console.log("Petani   ", a.petani, FARMER_NAME);
        console.log("Rina     ", a.investors[0]);
        console.log("Budi     ", a.investors[1]);
        console.log("Sari     ", a.investors[2]);
        console.log("Agen     ", a.agen);
    }
}
