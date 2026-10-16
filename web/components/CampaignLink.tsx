"use client";

import { tr, trTerm } from "@/lib/i18n";
import Link from "next/link";
import { useIpfsJson } from "@/lib/campaigns";
import type { CampaignMetadata, CampaignSummary } from "@/lib/types";

/** Judul kampanye (dari metadata IPFS) yang menaut ke halaman detail. */
export function CampaignLink({ c }: { c: CampaignSummary }) {
  const { data: meta } = useIpfsJson<CampaignMetadata>(c.metadataCID);
  return (
    <Link href={`/campaign/${c.address}`} className="font-display text-lg leading-snug font-semibold text-hutan-950 transition hover:text-hutan-700">
      {meta?.title ?? `${trTerm(c.commodity)} ${tr("di", "in")} ${c.locationName}`}
    </Link>
  );
}
