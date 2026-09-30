// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {console} from "forge-std/console.sol";
import {AnvilAccounts} from "./AnvilAccounts.sol";
import {MockUSDT} from "../src/MockUSDT.sol";
import {CampaignFactory} from "../src/CampaignFactory.sol";

/// @notice Data demo PRD di Anvil: koperasi, petani, dan saldo mUSDT investor.
///   forge script script/Seed.s.sol --rpc-url anvil --broadcast
/// Membaca alamat dari deployments/anvil.json (jalankan Deploy.s.sol dulu).
/// Aman dijalankan ulang: pendaftaran yang sudah ada dilewati.
contract Seed is AnvilAccounts {
    string internal constant COOPERATIVE_NAME = "Koperasi Tani Makmur, Garut";
    string internal constant FARMER_NAME = "Pak Darto";
    uint256 internal constant INVESTOR_BALANCE = 5_000e18;
    uint256 internal constant FARMER_BALANCE = 1_000e18; // modal awal untuk setor hasil panen di demo

    function run() external {
        require(block.chainid == ANVIL_CHAIN_ID, "Seed hanya untuk Anvil (mode lokal)");
        string memory json = vm.readFile(_deploymentPath("anvil"));
        CampaignFactory factory = CampaignFactory(vm.parseJsonAddress(json, ".factory"));
        MockUSDT usdt = MockUSDT(vm.parseJsonAddress(json, ".usdt"));
        require(address(factory).code.length > 0, "Factory tidak ada di chain ini; jalankan Deploy.s.sol dulu");

        address koperasi = _anvilAddr(IDX_KOPERASI);
        address petani = _anvilAddr(IDX_PETANI);
        address[3] memory investors = [_anvilAddr(IDX_RINA), _anvilAddr(IDX_BUDI), _anvilAddr(IDX_SARI)];

        // Fase 1 — onboarding: admin mendaftarkan koperasi
        vm.startBroadcast(_anvilKey(IDX_ADMIN));
        if (!factory.isCooperative(koperasi)) factory.registerCooperative(koperasi, COOPERATIVE_NAME);
        for (uint256 i; i < investors.length; ++i) {
            usdt.mint(investors[i], INVESTOR_BALANCE);
        }
        usdt.mint(petani, FARMER_BALANCE);
        vm.stopBroadcast();

        // Koperasi mendaftarkan petani anggotanya
        vm.startBroadcast(_anvilKey(IDX_KOPERASI));
        if (factory.farmerCooperative(petani) == address(0)) factory.registerFarmer(petani, FARMER_NAME);
        vm.stopBroadcast();

        console.log("== Data demo siap");
        console.log("Koperasi ", koperasi, COOPERATIVE_NAME);
        console.log("Petani   ", petani, FARMER_NAME);
        console.log("Rina     ", investors[0]);
        console.log("Budi     ", investors[1]);
        console.log("Sari     ", investors[2]);
        console.log("Saldo mUSDT: investor 5.000 masing-masing, petani 1.000");
    }
}
