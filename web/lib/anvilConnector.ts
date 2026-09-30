import { createConnector } from "wagmi";
import { type Address, type EIP1193RequestFn, getAddress, numberToHex, RpcRequestError, SwitchChainError } from "viem";
import { rpc } from "viem/utils";
import { localChain } from "./config";
import { DEMO_ACCOUNTS } from "./demoAccounts";

const STORAGE_KEY = "bagipanen.demoAccount";

function readStored(): Address | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return DEMO_ACCOUNTS.find((a) => a.address.toLowerCase() === v?.toLowerCase())?.address;
  } catch {
    return undefined;
  }
}

function writeStored(address: Address | undefined) {
  try {
    if (address) window.localStorage.setItem(STORAGE_KEY, address);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // penyimpanan browser tidak tersedia: pilihan akun hanya bertahan selama halaman terbuka
  }
}

/** Simpan pilihan akun demo sebelum connect, agar langsung terhubung ke akun itu. */
export function rememberDemoAccount(address: Address) {
  writeStored(address);
}

type Provider = { request: EIP1193RequestFn };
type Properties = { selectAccount(address: Address): void };

/**
 * Connector wagmi untuk mode lokal: memakai akun bawaan Anvil.
 * Transaksi dikirim sebagai `eth_sendTransaction` ke Anvil, yang menandatanganinya
 * dengan private key bawaannya (akun-akun ini sudah "unlocked" di Anvil), sehingga
 * tidak ada private key di browser. Pola ini sama dengan connector `mock` bawaan wagmi.
 */
export function anvilDemo() {
  let current: Address | undefined;

  return createConnector<Provider, Properties>((config) => {
    const url = localChain.rpcUrls.default.http[0];

    const request: EIP1193RequestFn = async ({ method, params }) => {
      if (method === "eth_accounts" || method === "eth_requestAccounts") return current ? [current] : [];
      if (method === "eth_chainId") return numberToHex(localChain.id);
      if (method === "wallet_switchEthereumChain") {
        const [{ chainId }] = params as [{ chainId: string }];
        if (Number(chainId) !== localChain.id) throw new SwitchChainError(new Error("Hanya chain lokal."));
        return null;
      }
      const body = { method, params };
      const { result, error } = await rpc.http(url, { body });
      if (error) throw new RpcRequestError({ body, error, url });
      return result;
    };
    const provider: Provider = { request };

    return {
      id: "anvilDemo",
      name: "Akun demo (Anvil)",
      type: "anvilDemo",
      async connect() {
        current = readStored() ?? DEMO_ACCOUNTS[0]?.address;
        if (!current) throw new Error("Akun demo tidak ditemukan. Jalankan `npm run dev:chain`.");
        writeStored(current);
        return { accounts: [current] as never, chainId: localChain.id };
      },
      async disconnect() {
        current = undefined;
        writeStored(undefined);
      },
      async getAccounts() {
        return current ? [current] : [];
      },
      async getChainId() {
        return localChain.id;
      },
      async getProvider() {
        return provider;
      },
      async isAuthorized() {
        current = readStored();
        return Boolean(current);
      },
      async switchChain({ chainId }) {
        const chain = config.chains.find((c) => c.id === chainId);
        if (!chain) throw new SwitchChainError(new Error("Chain tidak dikenal."));
        return chain;
      },
      onAccountsChanged(accounts) {
        if (accounts.length === 0) this.onDisconnect();
        else config.emitter.emit("change", { accounts: accounts.map((a) => getAddress(a)) });
      },
      onChainChanged(chainId) {
        config.emitter.emit("change", { chainId: Number(chainId) });
      },
      onDisconnect() {
        current = undefined;
        config.emitter.emit("disconnect");
      },
      /** Ganti akun demo tanpa memutus koneksi (seperti ganti akun di MetaMask). */
      selectAccount(address: Address) {
        current = address;
        writeStored(address);
        config.emitter.emit("change", { accounts: [address] });
      },
    };
  });
}
