"use client";

import { useEffect, useState } from "react";

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
