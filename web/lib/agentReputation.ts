"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { usePublicClient } from "wagmi";
import { erc8004ReputationRegistryAbi } from "./abi/ERC8004ReputationRegistry";
import { REPUTATION_REGISTRY } from "./addresses";
import { REFRESH_MS } from "./config";
import type { CampaignSummary, Milestone } from "./types";

/**
 * Feedback koperasi → agen AI di ERC-8004 ReputationRegistry resmi (docs/erc8004-notes.md):
 * nilai 100 = koperasi setuju dengan putusan agen, 0 = tidak setuju (desimal 0), sehingga
 * getSummary langsung berupa persentase kesepakatan. Agen tidak boleh menilai dirinya sendiri.
 */
export const FEEDBACK_TAG = "verdictAgreement";

/** tag2 unik per putusan: <kampanye>:m<tahap>:a<percobaan> — dipakai juga untuk cegah feedback ganda. */
export function feedbackKey(campaign: Address, milestoneIndex: number, attempt: number): string {
  return `${campaign.toLowerCase()}:m${milestoneIndex + 1}:a${attempt}`;
}

/** Tahap yang sudah diputus agen DAN koperasi (pasangan putusan yang bisa dinilai). */
export function decidedPairs(c: CampaignSummary, milestones: readonly Milestone[]) {
  return milestones
    .map((m, index) => ({ m, index, key: feedbackKey(c.address, index, m.attempts) }))
    .filter(({ m }) => m.aiDecided && m.verifierDecided);
}

/** tag2 feedback yang sudah diberikan `client` untuk agen ini. */
export function useGivenFeedback(agentId: bigint | undefined, client: Address | undefined) {
  const pc = usePublicClient();
  return useQuery({
    queryKey: ["erc8004Feedback", agentId?.toString(), client],
    enabled: Boolean(pc && REPUTATION_REGISTRY && agentId !== undefined && client),
    refetchInterval: REFRESH_MS,
    queryFn: async () => {
      const [, , , , , tag2s] = await pc!.readContract({
        address: REPUTATION_REGISTRY!,
        abi: erc8004ReputationRegistryAbi,
        functionName: "readAllFeedback",
        args: [agentId!, [client!], FEEDBACK_TAG, "", true],
      });
      return new Set(tag2s);
    },
  });
}

/**
 * Ringkasan reputasi agen dari klien tepercaya saja (koperasi terdaftar), karena siapa pun bisa
 * memberi feedback ke registri publik. Hasil: jumlah penilaian & persentase kesepakatan.
 */
export function useAgentReputation(agentId: bigint | undefined, trustedClients: readonly Address[] | undefined) {
  const pc = usePublicClient();
  return useQuery({
    queryKey: ["erc8004Reputation", agentId?.toString(), trustedClients?.join(",")],
    enabled: Boolean(pc && REPUTATION_REGISTRY && agentId !== undefined && trustedClients && trustedClients.length > 0),
    refetchInterval: REFRESH_MS,
    queryFn: async () => {
      const [count, value, decimals] = await pc!.readContract({
        address: REPUTATION_REGISTRY!,
        abi: erc8004ReputationRegistryAbi,
        functionName: "getSummary",
        args: [agentId!, [...trustedClients!], FEEDBACK_TAG, ""],
      });
      return { count: Number(count), agreement: count > 0n ? Number(value) / 10 ** decimals / 100 : null };
    },
  });
}
