"use client";

import { useQuery } from "@tanstack/react-query";
import { type Address, getAbiItem, type Hash, isAddressEqual, zeroAddress } from "viem";
import { usePublicClient } from "wagmi";
import { campaignFactoryAbi } from "./abi/CampaignFactory";
import { harvestCampaignAbi } from "./abi/HarvestCampaign";
import { mockAgentIdentityAbi } from "./abi/MockAgentIdentity";
import { reputationBookAbi } from "./abi/ReputationBook";
import { CONTRACTS_READY, requireAddresses } from "./addresses";
import { IS_LOCAL, REFRESH_MS } from "./config";
import { fetchIpfsJson, ipfsUrl } from "./ipfs";
import { getLogsIncremental, logsClient } from "./logs";
import type { CampaignSummary, Milestone } from "./types";
import { deployments } from "./deployments";

/** Semua kampanye + milestone (untuk antrean koperasi & admin). */
export function useAllCampaigns() {
  const client = usePublicClient();
  return useQuery({
    queryKey: ["allCampaigns"],
    enabled: Boolean(client && CONTRACTS_READY),
    refetchInterval: REFRESH_MS,
    queryFn: async () => {
      const { factory } = requireAddresses();
      const list = await client!.readContract({ address: factory, abi: campaignFactoryAbi, functionName: "getCampaigns" });
      const rows = await Promise.all(
        list.map(async (address) => {
          const [summary, milestones] = await Promise.all([
            client!.readContract({ address, abi: harvestCampaignAbi, functionName: "getSummary" }),
            client!.readContract({ address, abi: harvestCampaignAbi, functionName: "getMilestones" }),
          ]);
          return { summary: { ...summary, address } as CampaignSummary, milestones: milestones as readonly Milestone[] };
        }),
      );
      return rows.reverse();
    },
  });
}

export type Registration = { address: Address; name: string; cooperative?: Address; txHash: Hash; blockNumber: bigint };

/** Koperasi & petani terdaftar, dibaca dari event factory (kontrak tidak menyimpan daftar). */
export function useRegistrations() {
  const client = usePublicClient();
  return useQuery({
    queryKey: ["registrations"],
    enabled: Boolean(client && CONTRACTS_READY),
    refetchInterval: REFRESH_MS,
    queryFn: async () => {
      const { factory } = requireAddresses();
      const latest = await client!.getBlockNumber();
      // Cache yang sama dengan riwayat transaksi kampanye (semua event factory)
      const logs = await getLogsIncremental(`factory:${factory}`, latest, (fromBlock, toBlock) =>
        (logsClient ?? client!).getContractEvents({ address: factory, abi: campaignFactoryAbi, fromBlock, toBlock }),
      );
      const cooperatives: Registration[] = [];
      const farmers: Registration[] = [];
      for (const l of logs) {
        if (l.eventName === "CooperativeRegistered") {
          cooperatives.push({ address: l.args.cooperative!, name: l.args.name ?? "", txHash: l.transactionHash, blockNumber: l.blockNumber });
        } else if (l.eventName === "FarmerRegistered") {
          farmers.push({
            address: l.args.farmer!,
            name: l.args.name ?? "",
            cooperative: l.args.cooperative,
            txHash: l.transactionHash,
            blockNumber: l.blockNumber,
          });
        }
      }
      return { cooperatives, farmers };
    },
  });
}

/** Data Rapor Petani: statistik ReputationBook + nama petani & koperasi. */
export function useFarmerReport(farmer: Address | undefined) {
  const client = usePublicClient();
  return useQuery({
    queryKey: ["farmerReport", farmer],
    enabled: Boolean(client && farmer && CONTRACTS_READY),
    refetchInterval: REFRESH_MS,
    queryFn: async () => {
      const { factory, reputationBook } = requireAddresses();
      const f = farmer as Address;
      const [stats, name, cooperative] = await Promise.all([
        client!.readContract({ address: reputationBook, abi: reputationBookAbi, functionName: "getFarmerStats", args: [f] }),
        client!.readContract({ address: factory, abi: campaignFactoryAbi, functionName: "farmerName", args: [f] }),
        client!.readContract({ address: factory, abi: campaignFactoryAbi, functionName: "farmerCooperative", args: [f] }),
      ]);
      const cooperativeName =
        cooperative === zeroAddress
          ? ""
          : await client!.readContract({ address: factory, abi: campaignFactoryAbi, functionName: "cooperativeName", args: [cooperative] });
      return { stats, name, cooperative, cooperativeName, registered: cooperative !== zeroAddress };
    },
  });
}

export type AgentCard = {
  name?: string;
  description?: string;
  image?: string;
  agentWallet?: string;
  bagipanen?: {
    role?: string;
    regions?: string[];
    commodities?: string[];
    partnerCooperatives?: string[];
    methods?: string[];
    network?: string;
  };
  [key: string]: unknown;
};

/** Ambil dokumen dari URI token (ipfs://, https://, atau data:application/json). */
async function fetchTokenUri(uri: string): Promise<AgentCard> {
  if (uri.startsWith("ipfs://")) return fetchIpfsJson<AgentCard>(uri.slice("ipfs://".length).replace(/^ipfs\//, ""));
  if (uri.startsWith("data:")) {
    const [meta, data] = uri.split(",", 2);
    return JSON.parse(meta.includes(";base64") ? atob(data) : decodeURIComponent(data)) as AgentCard;
  }
  const res = await fetch(uri);
  if (!res.ok) throw new Error(`Agent card tidak bisa diambil (HTTP ${res.status}).`);
  return (await res.json()) as AgentCard;
}

export function tokenUriHref(uri: string): string {
  return uri.startsWith("ipfs://") ? ipfsUrl(uri.slice("ipfs://".length)) : uri;
}

/** Profil agen: konfigurasi di factory, identitas di registri, isi agent card, statistik putusan. */
export function useAgentProfile() {
  const client = usePublicClient();
  return useQuery({
    queryKey: ["agentProfile"],
    enabled: Boolean(client && CONTRACTS_READY),
    refetchInterval: REFRESH_MS,
    queryFn: async () => {
      const { factory, reputationBook } = requireAddresses();
      const [identityRegistry, agentId, agentWallet, stats] = await Promise.all([
        client!.readContract({ address: factory, abi: campaignFactoryAbi, functionName: "identityRegistry" }),
        client!.readContract({ address: factory, abi: campaignFactoryAbi, functionName: "agentId" }),
        client!.readContract({ address: factory, abi: campaignFactoryAbi, functionName: "agentWallet" }),
        client!.readContract({ address: reputationBook, abi: reputationBookAbi, functionName: "getAgentStats" }),
      ]);
      const configured = agentWallet !== zeroAddress;
      const isAgent = configured
        ? await client!.readContract({ address: factory, abi: campaignFactoryAbi, functionName: "isAgent", args: [agentWallet] })
        : false;
      let tokenURI = "";
      let card: AgentCard | null = null;
      let cardError = "";
      if (configured) {
        try {
          // ownerOf/tokenURI adalah fungsi standar ERC-721 (registri identitas ERC-8004 berbasis ERC-721)
          tokenURI = await client!.readContract({ address: identityRegistry, abi: mockAgentIdentityAbi, functionName: "tokenURI", args: [agentId] });
          card = await fetchTokenUri(tokenURI);
        } catch (e) {
          cardError = e instanceof Error ? e.message : "Agent card tidak bisa dibaca.";
        }
      }
      return { identityRegistry, agentId, agentWallet, configured, isAgent, stats, tokenURI, card, cardError };
    },
  });
}

/** Apakah registri yang dipakai adalah MockAgentIdentity (fallback) — ditampilkan jujur di UI. */
export function identityIsMock(registry: Address | undefined): boolean {
  const all = deployments as unknown as Record<"anvil" | "bscTestnet", { identityRegistry: Address; identityIsMock: boolean } | null>;
  const dep = all[IS_LOCAL ? "anvil" : "bscTestnet"];
  if (!dep || !registry) return true;
  // Registri lain yang diset admin lewat setAgent dianggap registri ERC-8004 resmi.
  return isAddressEqual(dep.identityRegistry, registry) ? dep.identityIsMock : false;
}

export type VerdictEntry = {
  campaign: Address;
  index: number;
  approved: boolean;
  reasonCID: string;
  milestoneName: string;
  commodity: string;
  txHash: Hash;
  timestamp: bigint;
};

const verdictEvent = getAbiItem({ abi: harvestCampaignAbi, name: "VerdictRecorded" });

/** Putusan agen terbaru di semua kampanye (event VerdictRecorded, difilter ke kampanye resmi). */
export function useRecentVerdicts(limit = 10) {
  const client = usePublicClient();
  return useQuery({
    queryKey: ["recentVerdicts", limit],
    enabled: Boolean(client && CONTRACTS_READY),
    refetchInterval: REFRESH_MS,
    queryFn: async (): Promise<VerdictEntry[]> => {
      const { factory } = requireAddresses();
      // RPC publik BSC testnet menolak getLogs tanpa alamat → filter dengan daftar kampanye resmi.
      // Kunci cache memuat jumlah kampanye agar kampanye baru memicu pembacaan ulang dari awal.
      const campaignList = await client!.readContract({ address: factory, abi: campaignFactoryAbi, functionName: "getCampaigns" });
      if (campaignList.length === 0) return [];
      const latest = await client!.getBlockNumber();
      const logs = await getLogsIncremental(`verdicts:${campaignList.length}`, latest, (fromBlock, toBlock) =>
        (logsClient ?? client!).getLogs({ address: [...campaignList], event: verdictEvent, fromBlock, toBlock }),
      );
      const recent = logs
        .sort((a, b) => (a.blockNumber === b.blockNumber ? b.logIndex - a.logIndex : Number(b.blockNumber - a.blockNumber)))
        .slice(0, limit * 3);
      const campaigns = [...new Set(recent.map((l) => l.address.toLowerCase()))] as Address[];
      const info = new Map<string, { ok: boolean; names: string[]; commodity: string }>();
      await Promise.all(
        campaigns.map(async (c) => {
          const ok = await client!.readContract({ address: factory, abi: campaignFactoryAbi, functionName: "isCampaign", args: [c] });
          if (!ok) return info.set(c, { ok, names: [], commodity: "" });
          const [ms, summary] = await Promise.all([
            client!.readContract({ address: c, abi: harvestCampaignAbi, functionName: "getMilestones" }),
            client!.readContract({ address: c, abi: harvestCampaignAbi, functionName: "getSummary" }),
          ]);
          info.set(c, { ok, names: ms.map((m) => m.name), commodity: summary.commodity });
        }),
      );
      const genuine = recent.filter((l) => info.get(l.address.toLowerCase())?.ok).slice(0, limit);
      const blocks = [...new Set(genuine.map((l) => l.blockNumber))];
      const times = new Map<bigint, bigint>();
      await Promise.all(blocks.map(async (b) => times.set(b, (await client!.getBlock({ blockNumber: b })).timestamp)));
      return genuine.map((l) => {
        const meta = info.get(l.address.toLowerCase())!;
        const index = Number(l.args.index);
        return {
          campaign: l.address,
          index,
          approved: Boolean(l.args.approved),
          reasonCID: l.args.reasonCID ?? "",
          milestoneName: meta.names[index] ?? `#${index + 1}`,
          commodity: meta.commodity,
          txHash: l.transactionHash,
          timestamp: times.get(l.blockNumber) ?? 0n,
        };
      });
    },
  });
}
