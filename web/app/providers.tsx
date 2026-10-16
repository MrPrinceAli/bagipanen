"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { lightTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { WagmiProvider } from "wagmi";
import { ToastProvider } from "@/components/Toast";
import { IS_LOCAL } from "@/lib/config";
import { LangBoundary, LangProvider, useLang } from "@/lib/lang";
import { wagmiConfig } from "@/lib/wagmi";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } }));
  return (
    <LangProvider>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>{IS_LOCAL ? <LangBoundary>{children}</LangBoundary> : <Rainbow>{children}</Rainbow>}</ToastProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </LangProvider>
  );
}

function Rainbow({ children }: { children: ReactNode }) {
  const { lang } = useLang();
  return (
    <RainbowKitProvider
      locale={lang === "en" ? "en-US" : "id-ID"}
      theme={lightTheme({ accentColor: "#1b4130", borderRadius: "large", overlayBlur: "small" })}
    >
      <LangBoundary>{children}</LangBoundary>
    </RainbowKitProvider>
  );
}
