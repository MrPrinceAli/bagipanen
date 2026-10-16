"use client";

import { tr } from "@/lib/i18n";
import { Sprout } from "lucide-react";
import { ButtonLink, Card, IconBubble, PageBody, PageHero } from "@/components/ui";

export default function NotFound() {
  return (
    <>
      <PageHero eyebrow="404" title={tr("Halamannya tidak ketemu", "Page not found")} />
      <PageBody>
        <Card className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 py-10 text-center">
          <IconBubble icon={Sprout} tone="gold" className="size-12" />
          <p className="text-stone-600">{tr("Mungkin tautannya salah ketik, atau halamannya sudah dipindah.", "The link may have a typo, or the page has moved.")}</p>
          <ButtonLink href="/">{tr("Kembali ke beranda", "Back to home")}</ButtonLink>
        </Card>
      </PageBody>
    </>
  );
}
