"use client";

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { explorerTxUrl } from "@/lib/config";
import { shortHash } from "@/lib/format";

type Toast = { id: number; text: string; hash?: string };
type ToastApi = { push(t: { text: string; hash?: string }): void };

const ToastContext = createContext<ToastApi | null>(null);
const DURATION_MS = 6000;
let nextId = 0;

/**
 * Notifikasi singkat di bawah layar. Dipakai agar pesan sukses transaksi tetap terlihat
 * walaupun komponen asalnya hilang setelah data di-refresh (mis. kampanye keluar dari antrean).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((t: { text: string; hash?: string }) => {
    const id = ++nextId;
    setItems((xs) => [...xs.filter((x) => x.hash === undefined || x.hash !== t.hash), { ...t, id }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), DURATION_MS);
  }, []);
  const api = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((t) => {
          const url = t.hash ? explorerTxUrl(t.hash) : null;
          return (
            <div
              key={t.id}
              role="status"
              className="pointer-events-auto flex max-w-md flex-wrap items-center gap-x-2 rounded-xl bg-daun-800 px-4 py-2.5 text-sm text-white shadow-lg"
            >
              <span>✓ {t.text}</span>
              {t.hash &&
                (url ? (
                  <a href={url} target="_blank" rel="noreferrer" className="font-mono text-xs text-daun-100 underline">
                    {shortHash(t.hash)} ↗
                  </a>
                ) : (
                  <span className="font-mono text-xs text-daun-200">tx {shortHash(t.hash)}</span>
                ))}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi | null {
  return useContext(ToastContext);
}
