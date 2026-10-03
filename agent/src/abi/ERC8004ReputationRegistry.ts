// ABI ERC-8004 ReputationRegistry (BSC testnet 0x8004B663056A597Dffe9eCcC1965A193B7388713, versi 2.0.0).
// Disaring dari ABI implementasi yang terverifikasi di BscScan (0x16e0fa7f7c56b9a767e34b192b51f921be31da34),
// identik dengan abis/ReputationRegistry.json di github.com/erc-8004/erc-8004-contracts (lihat docs/erc8004-notes.md).
export const erc8004ReputationRegistryAbi = [
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "agentId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "clientAddress",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint64",
        "name": "feedbackIndex",
        "type": "uint64"
      },
      {
        "indexed": false,
        "internalType": "int128",
        "name": "value",
        "type": "int128"
      },
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "valueDecimals",
        "type": "uint8"
      },
      {
        "indexed": true,
        "internalType": "string",
        "name": "indexedTag1",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "tag1",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "tag2",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "endpoint",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "feedbackURI",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "feedbackHash",
        "type": "bytes32"
      }
    ],
    "name": "NewFeedback",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "agentId",
        "type": "uint256"
      }
    ],
    "name": "getClients",
    "outputs": [
      {
        "internalType": "address[]",
        "name": "",
        "type": "address[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getIdentityRegistry",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "agentId",
        "type": "uint256"
      },
      {
        "internalType": "address[]",
        "name": "clientAddresses",
        "type": "address[]"
      },
      {
        "internalType": "string",
        "name": "tag1",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "tag2",
        "type": "string"
      }
    ],
    "name": "getSummary",
    "outputs": [
      {
        "internalType": "uint64",
        "name": "count",
        "type": "uint64"
      },
      {
        "internalType": "int128",
        "name": "summaryValue",
        "type": "int128"
      },
      {
        "internalType": "uint8",
        "name": "summaryValueDecimals",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getVersion",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "agentId",
        "type": "uint256"
      },
      {
        "internalType": "int128",
        "name": "value",
        "type": "int128"
      },
      {
        "internalType": "uint8",
        "name": "valueDecimals",
        "type": "uint8"
      },
      {
        "internalType": "string",
        "name": "tag1",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "tag2",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "endpoint",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "feedbackURI",
        "type": "string"
      },
      {
        "internalType": "bytes32",
        "name": "feedbackHash",
        "type": "bytes32"
      }
    ],
    "name": "giveFeedback",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "agentId",
        "type": "uint256"
      },
      {
        "internalType": "address[]",
        "name": "clientAddresses",
        "type": "address[]"
      },
      {
        "internalType": "string",
        "name": "tag1",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "tag2",
        "type": "string"
      },
      {
        "internalType": "bool",
        "name": "includeRevoked",
        "type": "bool"
      }
    ],
    "name": "readAllFeedback",
    "outputs": [
      {
        "internalType": "address[]",
        "name": "clients",
        "type": "address[]"
      },
      {
        "internalType": "uint64[]",
        "name": "feedbackIndexes",
        "type": "uint64[]"
      },
      {
        "internalType": "int128[]",
        "name": "values",
        "type": "int128[]"
      },
      {
        "internalType": "uint8[]",
        "name": "valueDecimals",
        "type": "uint8[]"
      },
      {
        "internalType": "string[]",
        "name": "tag1s",
        "type": "string[]"
      },
      {
        "internalType": "string[]",
        "name": "tag2s",
        "type": "string[]"
      },
      {
        "internalType": "bool[]",
        "name": "revokedStatuses",
        "type": "bool[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;
