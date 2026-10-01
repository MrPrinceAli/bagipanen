import type { Address, ContractFunctionReturnType } from "viem";
import type { harvestCampaignAbi } from "./abi/HarvestCampaign";

/** Enum kontrak HarvestCampaign (urutan harus sama dengan Solidity). */
export const Status = {
  Draft: 0,
  Funding: 1,
  Active: 2,
  Harvested: 3,
  Failed: 4,
  Cancelled: 5,
  Defaulted: 6,
} as const;

export const FailType = { None: 0, Funding: 1, Crop: 2 } as const;

export const MStatus = {
  Pending: 0,
  ProofSubmitted: 1,
  AIReviewed: 2,
  Rejected: 3,
  Disputed: 4,
  Released: 5,
} as const;

export const STATUS_LABEL: Record<number, string> = {
  [Status.Draft]: "Menunggu review",
  [Status.Funding]: "Cari dana",
  [Status.Active]: "Berjalan",
  [Status.Harvested]: "Sudah panen",
  [Status.Failed]: "Gagal",
  [Status.Cancelled]: "Tidak disetujui",
  [Status.Defaulted]: "Gagal bayar",
};

export const MSTATUS_LABEL: Record<number, string> = {
  [MStatus.Pending]: "Belum ada bukti",
  [MStatus.ProofSubmitted]: "Bukti masuk",
  [MStatus.AIReviewed]: "Sudah dicek AI",
  [MStatus.Rejected]: "Ditolak",
  [MStatus.Disputed]: "Sengketa",
  [MStatus.Released]: "Dana cair",
};

export type Summary = ContractFunctionReturnType<typeof harvestCampaignAbi, "view", "getSummary">;
export type Milestone = ContractFunctionReturnType<typeof harvestCampaignAbi, "view", "getMilestones">[number];
export type CampaignSummary = Summary & { address: Address };

/** Metadata kampanye di IPFS (PRD: bagipanen.campaign.v1). */
export type CampaignMetadata = {
  schema: "bagipanen.campaign.v1";
  title: string;
  story: string;
  farmerName: string;
  cooperativeName: string;
  commodity: string;
  costPlan: { item: string; usdt: number }[];
  coverImageCID?: string;
};

/** Putusan agen di IPFS (PRD: bagipanen.verdict.v1). */
export type VerdictDocument = {
  schema: "bagipanen.verdict.v1";
  campaign: Address;
  milestoneIndex: number;
  attempt: number;
  proofCID: string;
  approved: boolean;
  summary_id: string;
  vision?: {
    is_farm_photo?: boolean;
    commodity_match?: boolean;
    detected_commodity?: string;
    detected_stage?: string;
    stage_match?: boolean;
    plant_condition?: string;
    confidence?: number;
    estimated_days_to_harvest?: number;
    reason_id?: string;
    red_flags?: string[];
  };
  exif?: { status: "ok" | "missing" | "mismatch"; distanceKm?: number | null; takenAt?: string | null };
  weather?: { precip14dMm?: number; maxDailyPrecipMm?: number; extreme?: boolean };
  duplicate?: boolean;
  agent?: { registry?: string; agentId?: string; model?: string };
  decidedAt?: string;
};
