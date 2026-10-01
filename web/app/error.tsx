"use client"; // error boundary wajib Client Component

import { CloudOff } from "lucide-react";
import { useEffect } from "react";
import { Button, Card, IconBubble, PageBody, PageHero } from "@/components/ui";
import { IS_LOCAL } from "@/lib/config";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <>
      <PageHero eyebrow="Ada kendala" title="Halaman ini gagal dimuat" />
      <PageBody>
        <Card className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 py-10 text-center">
          <IconBubble icon={CloudOff} tone="gold" className="size-12" />
          <p className="text-stone-600">
            Biasanya karena koneksi ke jaringan sedang terputus.{" "}
            {IS_LOCAL ? "Pastikan chain lokal (npm run dev:chain) masih berjalan, lalu coba lagi." : "Cek koneksi internetmu, lalu coba lagi."}
          </p>
          <Button onClick={() => retry()}>Coba lagi</Button>
        </Card>
      </PageBody>
    </>
  );
}
