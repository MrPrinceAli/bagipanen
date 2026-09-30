// File ini dibuat otomatis oleh `npm run sync`. Jangan diedit manual.
export const reputationBookAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "factory_",
        "type": "address",
        "internalType": "contract ICampaignFactory"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "factory",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract ICampaignFactory"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getAgentStats",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct ReputationBook.AgentStats",
        "components": [
          {
            "name": "verdicts",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "approvals",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "rejections",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "overturned",
            "type": "uint32",
            "internalType": "uint32"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getFarmerStats",
    "inputs": [
      {
        "name": "farmer",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct ReputationBook.FarmerStats",
        "components": [
          {
            "name": "campaignsFunded",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "harvestsCompleted",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "onTimeHarvests",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "cropFailures",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "defaults",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "totalReported",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "totalEstimated",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isBlocked",
    "inputs": [
      {
        "name": "farmer",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "recordCropFailure",
    "inputs": [
      {
        "name": "farmer",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "recordDefault",
    "inputs": [
      {
        "name": "farmer",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "recordFunded",
    "inputs": [
      {
        "name": "farmer",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "recordHarvest",
    "inputs": [
      {
        "name": "farmer",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "reported",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "estimated",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "onTime",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "recordOverturn",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "recordVerdict",
    "inputs": [
      {
        "name": "approved",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "error",
    "name": "NotCampaign",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ZeroAddress",
    "inputs": []
  }
] as const;
