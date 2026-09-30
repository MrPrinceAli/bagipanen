import Link from "next/link";
import { Card } from "./ui";

/** Penanda halaman yang dibangun di tahap berikutnya. */
export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <Card className="mx-auto max-w-xl text-center">
      <h1 className="text-xl font-extrabold text-daun-900">{title}</h1>
      <p className="mt-2 text-sm text-stone-600">{description}</p>
      <p className="mt-2 text-xs text-stone-500">Halaman ini sedang disiapkan.</p>
      <Link href="/" className="mt-4 inline-block text-sm text-daun-700 underline">
        ← Kembali ke beranda
      </Link>
    </Card>
  );
}
