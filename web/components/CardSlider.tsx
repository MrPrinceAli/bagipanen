"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Children, type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "./ui";

const GAP_PX = 24;
const SWIPE_PX = 50;

/** Jumlah kartu per tampilan mengikuti lebar layar (Tailwind sm/lg). */
function perViewFor(width: number) {
  if (width >= 1024) return 3;
  if (width >= 640) return 2;
  return 1;
}

/**
 * Slider kartu: 3 per tampilan di desktop, 2 di tablet, 1 di HP. Digeser dengan transform, bukan
 * scroll horizontal, sehingga roda mouse/trackpad tidak pernah "nyangkut" ke slider saat menggulir
 * halaman. Di layar sentuh bisa di-swipe (touch-action: pan-y — gulir vertikal tetap milik halaman).
 */
export function CardSlider({ children, label, footer }: { children: ReactNode; label: string; footer?: ReactNode }) {
  const items = Children.toArray(children);
  const n = items.length;
  const [perView, setPerView] = useState(3);
  const [start, setStart] = useState(0);
  const [drag, setDrag] = useState<{ x0: number; y0: number; dx: number; horizontal: boolean | null } | null>(null);
  const moved = useRef(false);

  useEffect(() => {
    const update = () => setPerView(perViewFor(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const maxStart = Math.max(0, n - perView);
  const first = Math.min(start, maxStart);
  const go = (dir: 1 | -1) => setStart(Math.max(0, Math.min(maxStart, first + dir * perView)));

  const cardWidth = `calc((100% - ${(perView - 1) * GAP_PX}px) / ${perView})`;
  const offset = `calc(${-first} * (${cardWidth} + ${GAP_PX}px) + ${drag?.horizontal ? drag.dx : 0}px)`;

  return (
    <div role="region" aria-roledescription="carousel" aria-label={label}>
      <div className="-mx-2 overflow-hidden px-2 pt-1 pb-6">
        <div
          className={cn("flex touch-pan-y", !drag && "transition-transform duration-500 ease-[cubic-bezier(0.2,0.7,0.2,1)]")}
          style={{ gap: GAP_PX, transform: `translateX(${offset})` }}
          onPointerDown={(e) => {
            if (e.pointerType === "mouse" || n <= perView) return;
            moved.current = false;
            setDrag({ x0: e.clientX, y0: e.clientY, dx: 0, horizontal: null });
          }}
          onPointerMove={(e) => {
            if (!drag) return;
            const dx = e.clientX - drag.x0;
            const dy = e.clientY - drag.y0;
            let horizontal = drag.horizontal;
            if (horizontal === null && Math.hypot(dx, dy) > 8) horizontal = Math.abs(dx) > Math.abs(dy);
            if (horizontal) moved.current = true;
            setDrag({ ...drag, dx, horizontal });
          }}
          onPointerUp={() => {
            if (drag?.horizontal && Math.abs(drag.dx) > SWIPE_PX) go(drag.dx < 0 ? 1 : -1);
            setDrag(null);
          }}
          onPointerCancel={() => setDrag(null)}
          onClickCapture={(e) => {
            if (moved.current) {
              e.preventDefault();
              e.stopPropagation();
              moved.current = false;
            }
          }}
        >
          {items.map((child, i) => {
            const visible = i >= first && i < first + perView;
            return (
              <div
                key={i}
                className="shrink-0"
                style={{ width: cardWidth }}
                aria-roledescription="slide"
                aria-label={`${i + 1} dari ${n}`}
                aria-hidden={!visible}
                inert={!visible}
              >
                {child}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <span className="text-sm text-stone-500 tabular-nums">
            <span className="font-semibold text-hutan-950">
              {first + 1}
              {perView > 1 && n > 1 ? `–${Math.min(n, first + perView)}` : ""}
            </span>{" "}
            dari {n}
          </span>
          {footer}
        </div>
        <div className="flex gap-2">
          {[
            { dir: -1 as const, Icon: ChevronLeft, text: "Sebelumnya", disabled: first <= 0 },
            { dir: 1 as const, Icon: ChevronRight, text: "Berikutnya", disabled: first >= maxStart },
          ].map(({ dir, Icon, text, disabled }) => (
            <button
              key={text}
              type="button"
              onClick={() => go(dir)}
              disabled={disabled}
              aria-label={`${text} di daftar proyek`}
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
