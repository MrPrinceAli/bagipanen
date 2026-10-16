"use client";

import type { Lang } from "@/lib/i18n";
import { I18N_PUBLIC, tr } from "@/lib/i18n";
import { useLang } from "@/lib/lang";
import { cn } from "./ui";

const OPTIONS: { value: Lang; label: string; name: string }[] = [
  { value: "id", label: "ID", name: "Bahasa Indonesia" },
  { value: "en", label: "EN", name: "English" },
];

/** Toggle bahasa ID / EN di header. */
export function LangToggle({ className }: { className?: string }) {
  const { lang, setLang } = useLang();
  if (!I18N_PUBLIC) return null;
  return (
    <div
      role="radiogroup"
      aria-label={tr("Bahasa", "Language")}
      className={cn("flex shrink-0 items-center rounded-full bg-white/8 p-0.5 ring-1 ring-white/15", className)}
    >
      {OPTIONS.map((o) => {
        const active = lang === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.name}
            onClick={() => !active && setLang(o.value)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-bold tracking-wide transition",
              active ? "bg-emas-400 text-hutan-950 shadow-sm" : "text-white/65 hover:text-white",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
