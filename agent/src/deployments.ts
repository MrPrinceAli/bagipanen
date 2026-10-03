// File ini dibuat otomatis oleh `npm run sync`. Jangan diedit manual.
export const deployments = {
  "anvil": {
    "accounts": {
      "admin": {
        "address": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        "index": 0
      },
      "agen": {
        "address": "0x976EA74026E726554dB657fA54763abd0C3a0aa9",
        "index": 6
      },
      "budi": {
        "address": "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
        "index": 4
      },
      "koperasi": {
        "address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        "index": 1
      },
      "petani": {
        "address": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        "index": 2
      },
      "rina": {
        "address": "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
        "index": 3
      },
      "sari": {
        "address": "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
        "index": 5
      }
    },
    "campaignDeployer": "0x75537828f2ce51be7289709686A69CbFDbB714F1",
    "chainId": 31337,
    "deployer": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "factory": "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
    "identityIsMock": true,
    "identityRegistry": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    "mnemonic": "test test test test test test test test test test test junk",
    "network": "anvil",
    "reputationBook": "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    "reservePool": "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
    "startBlock": 0,
    "usdt": "0x5FbDB2315678afecb367f032d93F642f64180aa3"
  },
  "bscTestnet": {
    "campaignDeployer": "0x41c4704112dd0089C218C8386F56beC21AD86FCe",
    "chainId": 97,
    "deployer": "0x871af3D3767e91939FA5c18235370A00612c8f70",
    "factory": "0xDaAAb760e8ba84dFBB209a1ec944875d71584809",
    "identityIsMock": false,
    "identityRegistry": "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    "network": "bscTestnet",
    "reputationBook": "0xE10414172fB887d9789AA2b33B6D062cb5432B90",
    "reputationRegistry": "0x8004B663056A597Dffe9eCcC1965A193B7388713",
    "reservePool": "0x9e4C939F7DD58b13cBB1148bff4fC15433E0978b",
    "startBlock": 134247179,
    "usdt": "0x09E5561C0d52eD66c8d65F2DA5c7EF4708555642"
  }
} as const;
