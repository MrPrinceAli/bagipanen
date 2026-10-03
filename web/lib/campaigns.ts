"use client";

import { useQuery } from "@tanstack/react-query";
import { type Address, type Hash, isAddressEqual } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { campaignFactoryAbi } from "./abi/CampaignFactory";
import { harvestCampaignAbi } from "./abi/HarvestCampaign";
import { mockUSDTAbi } from "./abi/MockUSDT";
import { reservePoolAbi } from "./abi/ReservePool";
import { CONTRACTS_READY, requireAddresses } from "./addresses";
import { REFRESH_MS } from "./config";
import { fetchIpfsJson } from "./ipfs";
import { getLogsIncremental, logsClient } from "./logs";
import type { CampaignSummary } from "./types";

/** Semua kampanye + ringkasannya (terbaru di atas). */
export function useCampaignList() {
  const client = usePublicClient();
  return useQuery({
    queryKey: ["campaigns"],
    enabled: Boolean(client && CONTRACTS_READY),
    refetchInterval: REFRESH_MS,
    queryFn: async (): Promise<CampaignSummary[]> => {
      const { factory } = requireAddresses();
      const list = await client!.readContract({ address: factory, abi: campaignFactoryAbi, functionName: "getCampaigns" });
      const summaries = await Promise.all(
        list.map((address) => client!.readContract({ address, abi: harvestCampaignAbi, functionName: "getSummary" })),
      );
      return list.map((address, i) => ({ ...summaries[i], address })).reverse();
    },
  });
}

/** Detail satu kampanye: ringkasan, milestone, nama petani & koperasi. */
export function useCampaign(address: Address | undefined) {
  const client = usePublicClient();
  return useQuery({
    queryKey: ["campaign", address],
    enabled: Boolean(client && address && CONTRACTS_READY),
    refetchInterval: REFRESH_MS,
    queryFn: async () => {
      const { factory } = requireAddresses();
      const c = address as Address;
      const isCampaign = await client!.readContract({
        address: factory,
        abi: campaignFactoryAbi,
        functionName: "isCampaign",
        args: [c],
      });
      if (!isCampaign) return null;
      const [summary, milestones, symbol] = await Promise.all([
        client!.readContract({ address: c, abi: harvestCampaignAbi, functionName: "getSummary" }),
        client!.readContract({ address: c, abi: harvestCampaignAbi, functionName: "getMilestones" }),
        client!.readContract({ address: c, abi: harvestCampaignAbi, functionName: "symbol" }),
      ]);
      const [farmerName, cooperativeName] = await Promise.all([
        client!.readContract({ address: factory, abi: campaignFactoryAbi, functionName: "farmerName", args: [summary.farmer] }),
        client!.readContract({
          address: factory,
          abi: campaignFactoryAbi,
          functionName: "cooperativeName",
          args: [summary.cooperative],
        }),
      ]);
      return { summary: { ...summary, address: c }, milestones, symbol, farmerName, cooperativeName };
    },
  });
}

/** Dokumen JSON di IPFS (tidak berubah, jadi di-cache selamanya). */
export function useIpfsJson<T>(cid: string | undefined) {
  return useQuery({
    queryKey: ["ipfs", cid],
    enabled: Boolean(cid),
    staleTime: Infinity,
    retry: 2,
    queryFn: () => fetchIpfsJson<T>(cid as string),
  });
}

/** Posisi wallet yang login di satu kampanye: porsi, klaim, saldo & allowance mUSDT. */
export function usePosition(campaign: Address | undefined) {
  const client = usePublicClient();
  const { address } = useAccount();
  return useQuery({
    queryKey: ["position", campaign, address],
    enabled: Boolean(client && campaign && address && CONTRACTS_READY),
    refetchInterval: REFRESH_MS,
    queryFn: async () => {
      const { usdt } = requireAddresses();
      const c = campaign as Address;
      const user = address as Address;
      const [shares, claimable, paidOut, usdtBalance, allowance] = await Promise.all([
        client!.readContract({ address: c, abi: harvestCampaignAbi, functionName: "balanceOf", args: [user] }),
        client!.readContract({ address: c, abi: harvestCampaignAbi, functionName: "claimable", args: [user] }),
        client!.readContract({ address: c, abi: harvestCampaignAbi, functionName: "paidOut", args: [user] }),
        client!.readContract({ address: usdt, abi: mockUSDTAbi, functionName: "balanceOf", args: [user] }),
        client!.readContract({ address: usdt, abi: mockUSDTAbi, functionName: "allowance", args: [user, c] }),
      ]);
      return { shares, claimable, paidOut, usdtBalance, allowance };
    },
  });
}

/** Saldo mUSDT wallet yang login. */
export function useUsdtBalance() {
  const client = usePublicClient();
  const { address } = useAccount();
  return useQuery({
    queryKey: ["usdtBalance", address],
    enabled: Boolean(client && address && CONTRACTS_READY),
    refetchInterval: REFRESH_MS,
    queryFn: async () => {
      const { usdt } = requireAddresses();
      return client!.readContract({ address: usdt, abi: mockUSDTAbi, functionName: "balanceOf", args: [address as Address] });
    },
  });
}

export function useReserveBalance() {
  const client = usePublicClient();
  return useQuery({
    queryKey: ["reserveBalance"],
    enabled: Boolean(client && CONTRACTS_READY),
    refetchInterval: REFRESH_MS,
    queryFn: async () => {
      const { reservePool } = requireAddresses();
      return client!.readContract({ address: reservePool, abi: reservePoolAbi, functionName: "balance" });
    },
  });
}

export type ActivityEntry = {
  key: string;
  eventName: string;
  args: Record<string, unknown>;
  blockNumber: bigint;
  timestamp?: bigint;
  txHash: Hash;
};

const blockTimes = new Map<bigint, bigint>();

/** Riwayat transaksi satu kampanye (event kampanye + persetujuan admin di factory). */
export function useCampaignActivity(campaign: Address | undefined) {
  const client = usePublicClient();
  return useQuery({
    queryKey: ["activity", campaign],
    enabled: Boolean(client && campaign && CONTRACTS_READY),
    refetchInterval: REFRESH_MS,
    queryFn: async (): Promise<ActivityEntry[]> => {
      const { factory } = requireAddresses();
      const c = campaign as Address;
      const latest = await client!.getBlockNumber();
      const [campaignLogs, factoryLogs] = await Promise.all([
        getLogsIncremental(`campaign:${c}`, latest, (fromBlock, toBlock) =>
          (logsClient ?? client!).getContractEvents({ address: c, abi: harvestCampaignAbi, fromBlock, toBlock }),
        ),
        getLogsIncremental(`factory:${factory}`, latest, (fromBlock, toBlock) =>
          (logsClient ?? client!).getContractEvents({ address: factory, abi: campaignFactoryAbi, fromBlock, toBlock }),
        ),
      ]);
      const relevantFactory = factoryLogs.filter((log) => {
        const args = log.args as { campaign?: Address };
        return (
          ["CampaignCreated", "CampaignApproved", "CampaignRejected"].includes(log.eventName) &&
          args.campaign !== undefined &&
          isAddressEqual(args.campaign, c)
        );
      });
      const logs = [...relevantFactory, ...campaignLogs]
        // Transfer (mint/burn token porsi) sudah tercermin di event Funded/Refunded
        .filter((log) => !["Transfer", "Approval"].includes(log.eventName))
        .sort((a, b) =>
          a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : Number(a.blockNumber - b.blockNumber),
        );
      const blocks = [...new Set(logs.map((l) => l.blockNumber))].filter((b) => !blockTimes.has(b));
      await Promise.all(
        blocks.map(async (b) => {
          const block = await client!.getBlock({ blockNumber: b });
          blockTimes.set(b, block.timestamp);
        }),
      );
      return logs.map((log) => ({
        key: `${log.transactionHash}-${log.logIndex}`,
        eventName: log.eventName,
        args: log.args as Record<string, unknown>,
        blockNumber: log.blockNumber,
        timestamp: blockTimes.get(log.blockNumber),
        txHash: log.transactionHash,
      }));
    },
  });
}

/** Posisi investor yang login di semua kampanye (hanya yang pernah didanai). */
export function useMyPositions(campaigns: CampaignSummary[] | undefined) {
  const client = usePublicClient();
  const { address } = useAccount();
  return useQuery({
    queryKey: ["myPositions", address, campaigns?.map((c) => c.address).join(",")],
    enabled: Boolean(client && address && campaigns && CONTRACTS_READY),
    refetchInterval: REFRESH_MS,
    queryFn: async () => {
      const user = address as Address;
      const rows = await Promise.all(
        campaigns!.map(async (c) => {
          const [shares, claimable, paidOut] = await Promise.all([
            client!.readContract({ address: c.address, abi: harvestCampaignAbi, functionName: "balanceOf", args: [user] }),
            client!.readContract({ address: c.address, abi: harvestCampaignAbi, functionName: "claimable", args: [user] }),
            client!.readContract({ address: c.address, abi: harvestCampaignAbi, functionName: "paidOut", args: [user] }),
          ]);
          return { campaign: c, shares, claimable, paidOut };
        }),
      );
      return rows.filter((r) => r.shares > 0n || r.paidOut > 0n);
    },
  });
}

/** Kampanye milik seorang petani + milestone-nya (untuk dashboard & Rapor Petani). */
export function useFarmerCampaigns(farmer: Address | undefined) {
  const client = usePublicClient();
  return useQuery({
    queryKey: ["farmerCampaigns", farmer],
    enabled: Boolean(client && farmer && CONTRACTS_READY),
    refetchInterval: REFRESH_MS,
    queryFn: async () => {
      const { factory } = requireAddresses();
      const list = await client!.readContract({
        address: factory,
        abi: campaignFactoryAbi,
        functionName: "getCampaignsByFarmer",
        args: [farmer as Address],
      });
      const rows = await Promise.all(
        list.map(async (address) => {
          const [summary, milestones] = await Promise.all([
            client!.readContract({ address, abi: harvestCampaignAbi, functionName: "getSummary" }),
            client!.readContract({ address, abi: harvestCampaignAbi, functionName: "getMilestones" }),
          ]);
          return { summary: { ...summary, address } as CampaignSummary, milestones };
        }),
      );
      return rows.reverse();
    },
  });
}
