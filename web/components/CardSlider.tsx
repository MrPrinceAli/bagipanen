"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Children, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "./ui";

/**
 * Slider kartu horizontal: 3 kartu per tampilan di desktop, 2 di tablet, 1 (dengan kartu berikutnya
 * mengintip) di HP. Memakai scroll-snap bawaan browser, jadi swipe, trackpad, dan keyboard terasa
 * natural; tombol panah menggeser satu halaman. Lebar gutter ikut Container (px-4/6/8).
 */
export function CardSlider({ children, label, footer }: { children: ReactNode; label: string; footer?: ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const items = Children.toArray(children);
  const [pos, setPos] = useState({ first: 1, last: Math.min(3, items.length), atStart: true, atEnd: items.length <= 3 });

  const measure = useCallback(() => {
    const el = track.current;
    const card = el?.firstElementChild as HTMLElement | null;
    if (!el || !card) return;
    const step = card.offsetWidth + parseFloat(getComputedStyle(el).columnGap || "0");
    const perView = Math.max(1, Math.round((el.clientWidth - parseFloat(getComputedStyle(el).paddingLeft) * 2 + 1) / step));
    const first = Math.min(items.length, Math.round(el.scrollLeft / step) + 1);
    setPos({
      first,
      last: Math.min(items.length, first + perView - 1),
      atStart: el.scrollLeft < 8,
      atEnd: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8,
    });
  }, [items.length]);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const page = (dir: 1 | -1) => {
    const el = track.current;
    if (el) el.scrollBy({ left: dir * (el.clientWidth - parseFloat(getComputedStyle(el).paddingLeft) * 2), behavior: "smooth" });
  };

  return (
    <div role="region" aria-roledescription="carousel" aria-label={label}>
      <div
        ref={track}
        onScroll={measure}
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-6 overflow-x-auto px-4 pt-1 pb-6 [scrollbar-width:none] sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:-mx-8 lg:scroll-px-8 lg:px-8 [&::-webkit-scrollbar]:hidden"
      >
        {items.map((child, i) => (
          <div
            key={i}
            className="w-[85%] shrink-0 snap-start sm:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-3rem)/3)]"
            aria-roledescription="slide"
            aria-label={`${i + 1} dari ${items.length}`}
          >
            {child}
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <span className="text-sm text-stone-500 tabular-nums">
            <span className="font-semibold text-hutan-950">
              {pos.first}
              {pos.last > pos.first ? `–${pos.last}` : ""}
            </span>{" "}
            dari {items.length}
          </span>
          {footer}
        </div>
        <div className="flex gap-2">
          {[
            { dir: -1 as const, Icon: ChevronLeft, label: "Sebelumnya", disabled: pos.atStart },
            { dir: 1 as const, Icon: ChevronRight, label: "Berikutnya", disabled: pos.atEnd },
          ].map(({ dir, Icon, label: l, disabled }) => (
            <button
              key={l}
              type="button"
              onClick={() => page(dir)}
              disabled={disabled}
              aria-label={`${l} di daftar proyek`}
              className={cn(
                "grid size-11 place-items-center rounded-full border transition",
                disabled ? "cursor-not-allowed border-krem-200 text-stone-300" : "border-hutan-900 bg-hutan-900 text-white hover:bg-hutan-700",
              )}
            >
              <Icon className="size-5" aria-hidden />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
