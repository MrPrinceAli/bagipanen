import Link from "next/link";
import { Card } from "@/components/ui";

export default function NotFound() {
  return (
    <Card className="mx-auto max-w-xl text-center">
      <p className="text-4xl" aria-hidden>
        🌾
      </p>
      <h1 className="mt-2 text-xl font-extrabold text-daun-900">Halaman tidak ditemukan</h1>
      <p className="mt-2 text-sm text-stone-600">Alamat yang Anda buka tidak ada di BagiPanen.</p>
      <Link href="/" className="mt-4 inline-block text-sm text-daun-700 underline">
        ← Kembali ke beranda
      </Link>
    </Card>
  );
}
