"use client";

import { Globe } from "lucide-react";
import type { Lang } from "@/lib/i18n";
import { I18N_PUBLIC, tr } from "@/lib/i18n";
import { useLang } from "@/lib/lang";
import { cn } from "./ui";

const OPTIONS: { value: Lang; label: string; name: string }[] = [
  { value: "id", label: "ID", name: "Bahasa Indonesia" },
  { value: "en", label: "EN", name: "English" },
];

/**
 * Pemilih bahasa ID / EN di header, sengaja dibuat tenang (garis tipis, tanpa isi emas) supaya tidak
 * tertukar dengan tombol Login/dompet di sebelahnya.
 */
export function LangToggle({ className }: { className?: string }) {
  const { lang, setLang } = useLang();
  if (!I18N_PUBLIC) return null;
  return (
    <div
      role="radiogroup"
      aria-label={tr("Bahasa", "Language")}
      className={cn("flex h-9 shrink-0 items-center gap-1 rounded-lg border border-white/15 pr-1 pl-2 text-white/50", className)}
    >
      <Globe className="size-3.5" aria-hidden />
      {OPTIONS.map((o, i) => {
        const active = lang === o.value;
        return (
          <span key={o.value} className="flex items-center">
            {i > 0 && <span className="text-white/25" aria-hidden>/</span>}
            <button
              type="button"
              role="radio"
              aria-checked={active}
              title={o.name}
              onClick={() => !active && setLang(o.value)}
              className={cn(
                "rounded-md px-1.5 py-1 text-xs font-semibold tracking-wide transition",
                active ? "text-white underline decoration-emas-300 decoration-2 underline-offset-4" : "text-white/50 hover:text-white",
              )}
            >
              {o.label}
            </button>
          </span>
        );
      })}
    </div>
  );
}
