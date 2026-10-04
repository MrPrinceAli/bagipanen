import { createConnector } from "wagmi";
import { type Address, type EIP1193RequestFn, getAddress, numberToHex, RpcRequestError, SwitchChainError } from "viem";
import { rpc } from "viem/utils";
import { testnetChain } from "./config";
import { JUDGE_ACCOUNTS, type JudgeAccount } from "./demoJudge";

const STORAGE_KEY = "bagipanen.judgeAccount";

function readStored(): JudgeAccount | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const key = window.localStorage.getItem(STORAGE_KEY);
    return JUDGE_ACCOUNTS.find((a) => a.key === key);
  } catch {
    return undefined;
  }
}

function writeStored(acc: JudgeAccount | undefined) {
  try {
    if (acc) window.localStorage.setItem(STORAGE_KEY, acc.key);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // penyimpanan diblokir: pilihan hanya bertahan selama halaman terbuka
  }
}

/** Simpan peran demo sebelum connect, agar langsung terhubung sebagai peran itu. */
export function rememberJudgeAccount(key: JudgeAccount["key"]) {
  writeStored(JUDGE_ACCOUNTS.find((a) => a.key === key));
}

type Provider = { request: EIP1193RequestFn };
type Properties = { selectRole(key: JudgeAccount["key"]): void };

/**
 * Connector wagmi "Akun demo juri" (testnet): baca data langsung ke RPC, tetapi
 * `eth_sendTransaction` dikirim ke /api/demo-tx yang menandatanganinya di server dengan akun demo
 * peran itu — tidak ada private key di browser. Admin hanya bisa melihat (transaksi ditolak).
 */
export function judgeDemo() {
  let current: JudgeAccount | undefined;

  return createConnector<Provider, Properties>((config) => {
    const url = testnetChain.rpcUrls.default.http[0];

    const request: EIP1193RequestFn = async ({ method, params }) => {
      if (method === "eth_accounts" || method === "eth_requestAccounts") return current ? [current.address] : [];
      if (method === "eth_chainId") return numberToHex(testnetChain.id);
      if (method === "wallet_switchEthereumChain") {
        const [{ chainId }] = params as [{ chainId: string }];
        if (Number(chainId) !== testnetChain.id) throw new SwitchChainError(new Error("Akun demo hanya di BSC Testnet."));
        return null;
      }
      if (method === "eth_sendTransaction") {
        if (!current || current.readOnly) throw new Error("Akun demo Admin hanya untuk melihat. Transaksi admin tidak tersedia di mode demo.");
        const [tx] = params as [{ to: string; data?: string; value?: string }];
        const res = await fetch("/api/demo-tx", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ role: current.key, to: tx.to, data: tx.data ?? "0x", value: tx.value ?? "0x0" }),
        });
        const out = (await res.json().catch(() => ({}))) as { hash?: string; error?: string };
        if (!res.ok || !out.hash) throw new Error(out.error ?? `Transaksi demo gagal (HTTP ${res.status}).`);
        return out.hash;
      }
      if (method.startsWith("eth_sign") || method === "personal_sign") throw new Error("Akun demo tidak mendukung tanda tangan pesan.");
      const body = { method, params };
      const { result, error } = await rpc.http(url, { body });
      if (error) throw new RpcRequestError({ body, error, url });
      return result;
    };
    const provider: Provider = { request };

    return {
      id: "judgeDemo",
      name: "Akun demo juri",
      type: "judgeDemo",
      async connect() {
        current = readStored() ?? JUDGE_ACCOUNTS[0];
        if (!current) throw new Error("Akun demo juri tidak tersedia.");
        writeStored(current);
        return { accounts: [current.address] as never, chainId: testnetChain.id };
      },
      async disconnect() {
        current = undefined;
        writeStored(undefined);
      },
      async getAccounts() {
        return current ? [current.address] : [];
      },
      async getChainId() {
        return testnetChain.id;
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
      selectRole(key) {
        const next = JUDGE_ACCOUNTS.find((a) => a.key === key);
        if (!next) return;
        current = next;
        writeStored(next);
        config.emitter.emit("change", { accounts: [next.address as Address] });
      },
    };
  });
}
