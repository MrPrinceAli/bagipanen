"use client"; // error boundary wajib Client Component

import { tr } from "@/lib/i18n";
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
      <PageHero eyebrow={tr("Ada kendala", "Something went wrong")} title={tr("Halaman ini gagal dimuat", "This page failed to load")} />
      <PageBody>
        <Card className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 py-10 text-center">
          <IconBubble icon={CloudOff} tone="gold" className="size-12" />
          <p className="text-stone-600">
            {tr("Biasanya karena koneksi ke jaringan sedang terputus.", "This usually means the network connection dropped.")}{" "}
            {IS_LOCAL
              ? tr("Pastikan chain lokal (npm run dev:chain) masih berjalan, lalu coba lagi.", "Make sure the local chain (npm run dev:chain) is still running, then try again.")
              : tr("Cek koneksi internetmu, lalu coba lagi.", "Check your internet connection, then try again.")}
          </p>
          <Button onClick={() => retry()}>{tr("Coba lagi", "Try again")}</Button>
        </Card>
      </PageBody>
    </>
  );
}
