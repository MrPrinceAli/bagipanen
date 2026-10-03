"use client";

import { type CSSProperties, type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui";

/** true jika pengguna meminta animasi dikurangi (pengaturan sistem). */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

/**
 * Progres gulir 0..1 untuk bagian yang lebih tinggi dari layar (isi sticky di dalamnya):
 * 0 saat puncak bagian menyentuh atas layar, 1 saat dasarnya menyentuh bawah layar.
 * Satu listener pasif + requestAnimationFrame; state hanya berubah per 1/`steps`.
 */
export function useScrollProgress<T extends HTMLElement>(steps = 200): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const raw = total > 0 ? -rect.top / total : rect.top < 0 ? 1 : 0;
      const next = Math.round(Math.min(1, Math.max(0, raw)) * steps) / steps;
      setProgress((prev) => (prev === next ? prev : next));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [steps]);
  return [ref, progress];
}

/** Indeks elemen (dari `count`) yang sedang melewati garis tengah layar. */
export function useActiveIndex(count: number): [(i: number) => (el: HTMLElement | null) => void, number] {
  const els = useRef<(HTMLElement | null)[]>([]);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    els.current.slice(0, count).forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [count]);
  const register = (i: number) => (el: HTMLElement | null) => {
    els.current[i] = el;
    if (el) el.dataset.index = String(i);
  };
  return [register, active];
}

/**
 * Muncul perlahan (naik + memudar masuk) saat pertama kali terlihat. Atribut `data-shown` juga
 * dipakai anak-anaknya (mis. `.grow-x` untuk bar yang memanjang).
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "li" | "section";
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag
      ref={ref as never}
      data-shown={shown ? "" : undefined}
      className={cn("reveal", className)}
      style={delay ? ({ "--reveal-delay": `${delay}ms` } as CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}
