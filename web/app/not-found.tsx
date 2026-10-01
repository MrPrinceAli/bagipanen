import { Sprout } from "lucide-react";
import { ButtonLink, Card, IconBubble, PageBody, PageHero } from "@/components/ui";

export default function NotFound() {
  return (
    <>
      <PageHero eyebrow="404" title="Halamannya tidak ketemu" />
      <PageBody>
        <Card className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 py-10 text-center">
          <IconBubble icon={Sprout} tone="gold" className="size-12" />
          <p className="text-stone-600">Mungkin tautannya salah ketik, atau halamannya sudah dipindah.</p>
          <ButtonLink href="/">Kembali ke beranda</ButtonLink>
        </Card>
      </PageBody>
    </>
  );
}
