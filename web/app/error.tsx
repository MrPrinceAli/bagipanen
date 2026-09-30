"use client"; // error boundary wajib Client Component

import { useEffect } from "react";
import { Button, Card } from "@/components/ui";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <Card className="mx-auto max-w-xl text-center">
      <h1 className="text-xl font-extrabold text-daun-900">Terjadi kesalahan</h1>
      <p className="mt-2 text-sm text-stone-600">
        Halaman ini gagal dimuat. Periksa koneksi ke jaringan (mode lokal: pastikan `npm run dev:chain` berjalan), lalu coba lagi.
      </p>
      <Button className="mt-4" onClick={() => retry()}>
        Coba lagi
      </Button>
    </Card>
  );
}
