import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import { injectedWallet, metaMaskWallet } from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { anvilDemo } from "./anvilConnector";
import { judgeDemo } from "./judgeConnector";
import { IS_LOCAL, localChain, targetChain, testnetChain, WALLETCONNECT_PROJECT_ID } from "./config";

/**
 * Adapter jaringan: mode lokal memakai akun demo Anvil, mode testnet memakai
 * MetaMask lewat RainbowKit (+ akun demo juri tanpa dompet). Keduanya satu chain saja (`targetChain`).
 */
const connectors = IS_LOCAL
  ? [anvilDemo()]
  : [
      ...connectorsForWallets([{ groupName: "Disarankan", wallets: [metaMaskWallet, injectedWallet] }], {
        appName: "BagiPanen",
        projectId: WALLETCONNECT_PROJECT_ID || "bagipanen-local",
      }),
      // Akun demo juri (halaman /masuk); transaksi ditandatangani di server, lihat lib/judgeConnector.ts
      judgeDemo(),
    ];

export const wagmiConfig = createConfig({
  chains: [targetChain],
  connectors,
  // Hanya `targetChain` yang aktif; transport chain lain didefinisikan agar tipe wagmi lengkap.
  transports: { [localChain.id]: http(), [testnetChain.id]: http() },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
