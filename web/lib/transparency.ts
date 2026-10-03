"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { mockUSDTAbi } from "./abi/MockUSDT";
import { reservePoolAbi } from "./abi/ReservePool";
import { CONTRACTS_READY, requireAddresses } from "./addresses";
import { REFRESH_MS } from "./config";
import { useAllCampaigns } from "./registry";
import { Status } from "./types";

/**
 * Angka transparansi, semuanya dibaca langsung dari kontrak: dana yang didanai investor, yang sudah
 * cair ke petani, saldo mUSDT yang masih ada di tiap kontrak proyek, hasil panen yang disetor, dan
 * dana cadangan (masuk & keluar). Termasuk proyek uji coba yang tidak tampil di beranda.
 */
export function useTransparency() {
  const client = usePublicClient();
  const { data: rows } = useAllCampaigns();
  return useQuery({
    queryKey: ["transparency", rows?.length, rows?.map((r) => r.summary.status).join("")],
    enabled: Boolean(client && rows && CONTRACTS_READY),
    refetchInterval: REFRESH_MS,
    queryFn: async () => {
      const { usdt, reservePool } = requireAddresses();
      const [balances, reserveBalance, contributed, compensated] = await Promise.all([
        Promise.all(rows!.map((r) => client!.readContract({ address: usdt, abi: mockUSDTAbi, functionName: "balanceOf", args: [r.summary.address] }))),
        client!.readContract({ address: reservePool, abi: reservePoolAbi, functionName: "balance" }),
        client!.readContract({ address: reservePool, abi: reservePoolAbi, functionName: "totalContributed" }),
        client!.readContract({ address: reservePool, abi: reservePoolAbi, functionName: "totalCompensated" }),
      ]);
      const projects = rows!
        .map((r, i) => ({
          ...r,
          released: r.milestones.reduce((sum, m) => sum + m.releasedAmount, 0n),
          escrow: balances[i],
        }))
        .filter((p) => p.summary.status !== Status.Draft && p.summary.status !== Status.Cancelled);
      const sum = (f: (p: (typeof projects)[number]) => bigint) => projects.reduce((acc, p) => acc + f(p), 0n);
      return {
        projects,
        totals: {
          funded: sum((p) => p.summary.raisedAmount),
          released: sum((p) => p.released),
          escrow: sum((p) => p.escrow),
          harvest: sum((p) => p.summary.harvestAmount),
        },
        reserve: { balance: reserveBalance, contributed, compensated },
      };
    },
  });
}
