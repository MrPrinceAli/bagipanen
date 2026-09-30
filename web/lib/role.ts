"use client";

import { useQuery } from "@tanstack/react-query";
import { type Address, isAddressEqual, zeroAddress } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { campaignFactoryAbi } from "./abi/CampaignFactory";
import { CONTRACTS_READY, requireAddresses } from "./addresses";
import { REFRESH_MS } from "./config";

export type Role = "tamu" | "admin" | "koperasi" | "petani" | "agen" | "investor";

export const ROLE_LABEL: Record<Role, string> = {
  tamu: "Tamu",
  admin: "Admin",
  koperasi: "Koperasi",
  petani: "Petani",
  agen: "Agen AI",
  investor: "Investor",
};

/**
 * Peran ditentukan otomatis dari alamat wallet (PRD, Aktor & peran):
 * admin = owner factory, koperasi = isCooperative, petani = farmerCooperative ≠ 0,
 * agen = agentWallet, selain itu investor.
 */
export function useRole() {
  const { address, isConnected } = useAccount();
  const client = usePublicClient();

  const query = useQuery({
    queryKey: ["role", address],
    enabled: Boolean(address && client && CONTRACTS_READY),
    refetchInterval: REFRESH_MS,
    queryFn: async () => {
      const { factory } = requireAddresses();
      const user = address as Address;
      const [owner, isCoop, farmerCoop, agentWallet] = await Promise.all([
        client!.readContract({ address: factory, abi: campaignFactoryAbi, functionName: "owner" }),
        client!.readContract({ address: factory, abi: campaignFactoryAbi, functionName: "isCooperative", args: [user] }),
        client!.readContract({
          address: factory,
          abi: campaignFactoryAbi,
          functionName: "farmerCooperative",
          args: [user],
        }),
        client!.readContract({ address: factory, abi: campaignFactoryAbi, functionName: "agentWallet" }),
      ]);
      let role: Role = "investor";
      if (isAddressEqual(owner, user)) role = "admin";
      else if (isCoop) role = "koperasi";
      else if (farmerCoop !== zeroAddress) role = "petani";
      else if (agentWallet !== zeroAddress && isAddressEqual(agentWallet, user)) role = "agen";
      return { role, farmerCooperative: farmerCoop };
    },
  });

  const role: Role | undefined = !isConnected ? "tamu" : query.data?.role;
  return { address, isConnected, role, farmerCooperative: query.data?.farmerCooperative, loading: query.isLoading };
}
