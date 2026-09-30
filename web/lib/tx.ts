"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import type { Abi, ContractFunctionArgs, ContractFunctionName, Hash, TransactionReceipt } from "viem";
import { useConfig } from "wagmi";
import { type SimulateContractParameters, simulateContract, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { translateError } from "./errors";
import type { wagmiConfig } from "./wagmi";

type AppConfig = typeof wagmiConfig;
type Mutability = "nonpayable" | "payable";

export type TxState =
  | { status: "idle" }
  | { status: "signing" }
  | { status: "pending"; hash: Hash }
  | { status: "success"; hash: Hash }
  | { status: "error"; message: string; hash?: Hash };

/**
 * Simulasikan dulu (eth_call), baru kirim. Revert tertangkap sebelum transaksi dikirim
 * — lengkap dengan nama custom error untuk diterjemahkan — dan tidak ada gas terbuang.
 */
export async function simulateAndWrite<
  const abi extends Abi | readonly unknown[],
  functionName extends ContractFunctionName<abi, Mutability>,
  args extends ContractFunctionArgs<abi, Mutability, functionName>,
>(config: AppConfig, params: SimulateContractParameters<abi, functionName, args, AppConfig>): Promise<Hash> {
  // Tipe parameter sudah dicek ketat di pemanggil; cast hanya untuk meneruskan generik wagmi.
  const { request } = await simulateContract(config, params as never);
  return writeContract(config, request as never);
}

/**
 * Status satu transaksi: menunggu tanda tangan → menunggu konfirmasi → sukses / gagal.
 * Setelah sukses, semua data di-refresh agar UI langsung menampilkan hasilnya.
 */
export function useTx() {
  const config = useConfig();
  const queryClient = useQueryClient();
  const [state, setState] = useState<TxState>({ status: "idle" });

  const run = useCallback(
    async (send: () => Promise<Hash>): Promise<TransactionReceipt | null> => {
      setState({ status: "signing" });
      let hash: Hash | undefined;
      try {
        hash = await send();
        setState({ status: "pending", hash });
        const receipt = await waitForTransactionReceipt(config, { hash });
        if (receipt.status !== "success") throw new Error("Transaksi gagal dieksekusi di chain.");
        setState({ status: "success", hash });
        await queryClient.invalidateQueries();
        return receipt;
      } catch (e) {
        setState({ status: "error", message: translateError(e), hash });
        return null;
      }
    },
    [config, queryClient],
  );

  /** Kirim transaksi kontrak (dengan simulasi lebih dulu). */
  const write = useCallback(
    <
      const abi extends Abi | readonly unknown[],
      functionName extends ContractFunctionName<abi, Mutability>,
      args extends ContractFunctionArgs<abi, Mutability, functionName>,
    >(
      params: SimulateContractParameters<abi, functionName, args, AppConfig>,
    ) => run(() => simulateAndWrite(config, params as never)),
    [config, run],
  );

  const fail = useCallback((message: string) => setState({ status: "error", message }), []);
  const reset = useCallback(() => setState({ status: "idle" }), []);
  const busy = state.status === "signing" || state.status === "pending";
  return { state, run, write, fail, reset, busy };
}
