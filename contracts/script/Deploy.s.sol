// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {console} from "forge-std/console.sol";
import {AnvilAccounts} from "./AnvilAccounts.sol";
import {MockUSDT} from "../src/MockUSDT.sol";
import {MockAgentIdentity} from "../src/MockAgentIdentity.sol";
import {CampaignFactory} from "../src/CampaignFactory.sol";
import {ReputationBook} from "../src/ReputationBook.sol";
import {ReservePool} from "../src/ReservePool.sol";
import {ICampaignFactory, IReputationBook, IReservePool} from "../src/interfaces/IBagiPanen.sol";

/// @notice Deploy semua kontrak BagiPanen (urutan sesuai PRD).
///   Anvil (31337):       forge script script/Deploy.s.sol --rpc-url anvil --broadcast
///   BSC testnet (97):    forge script script/Deploy.s.sol --rpc-url bscTestnet --broadcast
/// Anvil memakai akun bawaan #0 sebagai admin dan selalu MockAgentIdentity.
/// Testnet memakai DEPLOYER_PRIVATE_KEY dan ERC8004_IDENTITY_REGISTRY dari contracts/.env
/// (kosong = deploy MockAgentIdentity sebagai fallback).
/// Hasil ditulis ke deployments/<anvil|bscTestnet>.json.
contract Deploy is AnvilAccounts {
    struct Result {
        address deployer;
        uint256 startBlock;
        address usdt;
        address identityRegistry;
        bool identityIsMock;
        address factory;
        address campaignDeployer;
        address reputationBook;
        address reservePool;
    }

    function run() external returns (Result memory r) {
        (string memory network, bool local) = _network();
        uint256 pk = local ? _anvilKey(IDX_ADMIN) : vm.envUint("DEPLOYER_PRIVATE_KEY");
        address registry = local ? address(0) : _envAddressOrZero("ERC8004_IDENTITY_REGISTRY");
        if (registry != address(0)) {
            require(registry.code.length > 0, "ERC8004_IDENTITY_REGISTRY bukan alamat kontrak");
        }

        r.deployer = vm.addr(pk);
        r.startBlock = block.number;

        vm.startBroadcast(pk);
        // 1. MockUSDT
        MockUSDT usdt = new MockUSDT();
        // 2. MockAgentIdentity (hanya jika registri resmi tidak diisi)
        r.identityIsMock = registry == address(0);
        r.identityRegistry = r.identityIsMock ? address(new MockAgentIdentity()) : registry;
        // 3. CampaignFactory(usdt) — sekaligus membuat CampaignDeployer
        CampaignFactory factory = new CampaignFactory(usdt);
        // 4. ReputationBook(factory) dan ReservePool(factory, usdt)
        ReputationBook rep = new ReputationBook(ICampaignFactory(address(factory)));
        ReservePool reserve = new ReservePool(ICampaignFactory(address(factory)), usdt);
        // 5. factory.setModules(reputationBook, reservePool)
        factory.setModules(IReputationBook(address(rep)), IReservePool(address(reserve)));
        vm.stopBroadcast();

        r.usdt = address(usdt);
        r.factory = address(factory);
        r.campaignDeployer = address(factory.deployer());
        r.reputationBook = address(rep);
        r.reservePool = address(reserve);

        // 6. Tulis semua alamat + nomor blok
        string memory path = _deploymentPath(network);
        vm.writeJson(_toJson(network, local, r), path);

        console.log("== BagiPanen ter-deploy ke", network);
        console.log("CampaignFactory  ", r.factory);
        console.log("MockUSDT         ", r.usdt);
        console.log("Identity registry", r.identityRegistry, r.identityIsMock ? "(MockAgentIdentity)" : "(ERC-8004)");
        console.log("ReputationBook   ", r.reputationBook);
        console.log("ReservePool      ", r.reservePool);
        console.log("Start block      ", r.startBlock);
        console.log("Ditulis ke", path);
    }

    function _network() internal view returns (string memory network, bool local) {
        if (block.chainid == ANVIL_CHAIN_ID) return ("anvil", true);
        if (block.chainid == BSC_TESTNET_CHAIN_ID) return ("bscTestnet", false);
        revert("Jaringan tidak didukung: pakai Anvil (31337) atau BSC testnet (97)");
    }

    function _envAddressOrZero(string memory name) internal view returns (address) {
        string memory value = vm.envOr(name, string(""));
        if (bytes(value).length == 0) return address(0);
        return vm.parseAddress(value);
    }

    function _toJson(string memory network, bool local, Result memory r) internal returns (string memory json) {
        string memory o = "deployment";
        vm.serializeString(o, "network", network);
        vm.serializeUint(o, "chainId", block.chainid);
        vm.serializeUint(o, "startBlock", r.startBlock);
        vm.serializeAddress(o, "deployer", r.deployer);
        vm.serializeAddress(o, "usdt", r.usdt);
        vm.serializeAddress(o, "identityRegistry", r.identityRegistry);
        vm.serializeBool(o, "identityIsMock", r.identityIsMock);
        vm.serializeAddress(o, "factory", r.factory);
        vm.serializeAddress(o, "campaignDeployer", r.campaignDeployer);
        vm.serializeAddress(o, "reputationBook", r.reputationBook);
        json = vm.serializeAddress(o, "reservePool", r.reservePool);
        if (local) {
            vm.serializeString(o, "mnemonic", ANVIL_MNEMONIC);
            json = vm.serializeString(o, "accounts", _accountsJson());
        }
    }

    /// @dev { peran: { index, address } } — label tampilan ditentukan di web.
    function _accountsJson() internal returns (string memory json) {
        string[7] memory roles = ["admin", "koperasi", "petani", "rina", "budi", "sari", "agen"];
        uint32[7] memory idx = [IDX_ADMIN, IDX_KOPERASI, IDX_PETANI, IDX_RINA, IDX_BUDI, IDX_SARI, IDX_AGEN];
        for (uint256 i; i < roles.length; ++i) {
            vm.serializeUint(roles[i], "index", idx[i]);
            string memory acc = vm.serializeAddress(roles[i], "address", _anvilAddr(idx[i]));
            json = vm.serializeString("accounts", roles[i], acc);
        }
    }
}
