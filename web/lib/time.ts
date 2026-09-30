"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { REFRESH_MS } from "./config";

/** Waktu sekarang dalam detik unix. */
export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/** Waktu sekarang (detik) yang diperbarui berkala, untuk tenggat & hitung mundur. */
export function useNow(intervalMs = 5_000): number {
  const [now, setNow] = useState(nowSeconds);
  useEffect(() => {
    const id = setInterval(() => setNow(nowSeconds()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Timestamp blok terbaru (detik). */
export function useChainTime() {
  const client = usePublicClient();
  return useQuery({
    queryKey: ["chainTime"],
    enabled: Boolean(client),
    refetchInterval: REFRESH_MS,
    queryFn: async () => (await client!.getBlock()).timestamp,
  });
}

/**
 * Waktu acuan untuk aturan kontrak (tenggat, masa tenggang): max(jam perangkat, blok terbaru).
 * Transaksi berikutnya ditambang dengan timestamp setidaknya sebesar ini — jam perangkat bisa
 * tertinggal dari chain (mis. waktu Anvil dimajukan), dan blok terakhir bisa tertinggal dari
 * waktu nyata (chain sedang idle).
 */
export function useEffectiveNow(): bigint {
  const now = BigInt(useNow());
  const { data: chainTime } = useChainTime();
  return chainTime !== undefined && chainTime > now ? chainTime : now;
}
