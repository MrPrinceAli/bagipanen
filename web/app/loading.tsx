import { PlantProgress } from "@/components/PageLoader";

/** Fallback saat segmen halaman sedang dimuat (navigasi App Router). */
export default function Loading() {
  return (
    <div className="grid min-h-[60svh] place-items-center" role="status" aria-label="Memuat halaman">
      <div className="flex flex-col items-center gap-3">
        <PlantProgress value={70} className="size-28" />
        <p className="text-sm font-medium text-stone-500">Menyiapkan halaman…</p>
      </div>
    </div>
  );
}
