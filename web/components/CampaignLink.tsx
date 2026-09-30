"use client";

import Link from "next/link";
import { useIpfsJson } from "@/lib/campaigns";
import type { CampaignMetadata, CampaignSummary } from "@/lib/types";

/** Judul kampanye (dari metadata IPFS) yang menaut ke halaman detail. */
export function CampaignLink({ c }: { c: CampaignSummary }) {
  const { data: meta } = useIpfsJson<CampaignMetadata>(c.metadataCID);
  return (
    <Link href={`/campaign/${c.address}`} className="font-semibold text-stone-900 hover:text-daun-800 hover:underline">
      {meta?.title ?? `${c.commodity} · ${c.locationName}`}
    </Link>
  );
}
