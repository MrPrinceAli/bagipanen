import { createStorage, createVision } from "./adapters.js";
import { genesisHash, getProofLogs, type ProofLog, publicClient, readAgentConfig } from "./chain.js";
import { config } from "./config.js";
import { fmt, log } from "./log.js";
import { processProof } from "./pipeline.js";
import { AgentState, DeferredProofs, type DeferredItem, SeenHashes } from "./state.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const storage = createStorage();
const vision = createVision();
const state = new AgentState(config.dataDir);
const seen = new SeenHashes(config.dataDir);
const deferred = new DeferredProofs(config.dataDir);

/** Revert kontrak = keadaan sudah berubah; mengulang tidak ada gunanya. */
function isContractRevert(e: unknown): boolean {
  const err = e as { walk?: (fn: (x: unknown) => boolean) => unknown };
  return typeof err?.walk === "function" && Boolean(err.walk((x) => (x as { name?: string })?.name === "ContractFunctionRevertedError"));
}

function message(e: unknown): string {
  const err = e as { shortMessage?: string; message?: string };
  const msg = err?.shortMessage ?? err?.message ?? String(e);
  // Galat API Gemini berupa JSON panjang — ringkas jadi kode & status
  const code = msg.match(/"code":\s*(\d+)/)?.[1];
  const status = msg.match(/"status":\s*"([A-Z_]+)"/)?.[1];
  return code || status ? `API ${code ?? ""} ${status ?? ""}`.trim() : msg.slice(0, 200);
}

function toDeferred(p: ProofLog): Omit<DeferredItem, "key" | "tries" | "nextAt"> {
  return { ...p, blockNumber: p.blockNumber.toString() };
}

function fromDeferred(d: DeferredItem): ProofLog {
  return {
    campaign: d.campaign as ProofLog["campaign"],
    index: d.index,
    cid: d.cid,
    attempt: d.attempt,
    blockNumber: BigInt(d.blockNumber),
    txHash: d.txHash as ProofLog["txHash"],
    logIndex: d.logIndex,
  };
}

/** Satu percobaan untuk bukti yang tertunda; gagal lagi → dijadwalkan ulang dengan jeda lebih lama. */
async function processDeferred(d: DeferredItem) {
  try {
    const outcome = await processProof(fromDeferred(d), { storage, vision, seen });
    if (outcome.kind === "skipped") log("LEWATI", outcome.reason);
    deferred.remove(d.key);
  } catch (e) {
    if (isContractRevert(e)) {
      log("LEWATI", `kontrak menolak putusan (${message(e)}) — keadaan milestone sudah berubah`);
      deferred.remove(d.key);
      return;
    }
    const next = deferred.schedule(toDeferred(fromDeferred(d)));
    log("ULANG", `bukti ${d.cid.slice(0, 12)}… masih gagal (${message(e)}) — dicoba lagi dalam ${Math.round((next.nextAt - Date.now()) / 60_000)} menit`);
  }
}

/** Coba ulang maksimal 3 kali dengan jeda 15 detik, lalu catat tanpa menghentikan loop (PRD). */
async function processWithRetry(p: ProofLog) {
  for (let attempt = 1; attempt <= config.retryAttempts; attempt++) {
    try {
      const outcome = await processProof(p, { storage, vision, seen });
      if (outcome.kind === "skipped") log("LEWATI", outcome.reason);
      return;
    } catch (e) {
      if (isContractRevert(e)) {
        log("LEWATI", `kontrak menolak putusan (${message(e)}) — keadaan milestone sudah berubah`);
        return;
      }
      if (attempt < config.retryAttempts) {
        log("ULANG", `percobaan ${attempt}/${config.retryAttempts} gagal: ${message(e)} — ulang dalam ${config.retryDelayMs / 1000} detik`);
        await sleep(config.retryDelayMs);
      } else {
        const next = deferred.schedule(toDeferred(p));
        log(
          "ERROR",
          `bukti ${p.cid.slice(0, 12)}… gagal ${config.retryAttempts}× (${message(e)}) — dijadwalkan ulang dalam ${Math.round((next.nextAt - Date.now()) / 60_000)} menit`,
        );
      }
    }
  }
}

let warnedNotRegistered = false;

async function tick(chainId: number) {
  const id = { chainId, factory: config.factory, genesisHash: await genesisHash() };
  if (state.isStale(id)) {
    log(
      "AGEN",
      state.exists
        ? `chain berbeda terdeteksi (mis. dev:chain diulang) — state lama dibuang, mulai dari blok ${config.startBlock}`
        : `belum ada state — mulai membaca dari blok ${config.startBlock}`,
    );
    state.reset(id, config.startBlock);
    seen.clear();
    deferred.clear();
  }

  const agent = await readAgentConfig();
  if (!agent.isAgent) {
    if (!warnedNotRegistered) {
      log("AGEN", fmt.yellow("wallet agen belum terdaftar di factory — jalankan `npm run register` (menunggu…)"));
      warnedNotRegistered = true;
    }
    return;
  }
  if (warnedNotRegistered) {
    log("AGEN", fmt.green(`terdaftar sebagai agen #${agent.agentId} — mulai memproses bukti`));
    warnedNotRegistered = false;
  }

  for (const d of deferred.due()) await processDeferred(d);

  const latest = await publicClient.getBlockNumber();
  const from = state.lastBlock + 1n;
  if (from > latest) return;
  const logs = (await getProofLogs(from, latest)).sort((a, b) =>
    a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : Number(a.blockNumber - b.blockNumber),
  );
  for (const p of logs) await processWithRetry(p);
  state.setLastBlock(latest);
}

async function main() {
  const chainId = await publicClient.getChainId();
  const agent = await readAgentConfig();
  log("AGEN", fmt.bold("BagiPanen Verifier Agent"));
  log("AGEN", `mode ${config.mode} · chain ${chainId} · RPC ${config.rpcUrl}`);
  log("AGEN", `wallet ${config.account.address} · agen #${agent.configured ? agent.agentId : "–"} · registri ${agent.identityRegistry}`);
  log("AGEN", `factory ${config.factory} · penyimpanan ${storage.name} · penilai foto ${vision.model}`);
  log("AGEN", `polling setiap ${config.pollMs / 1000} detik… (Ctrl+C untuk berhenti)`);
  if (deferred.size) log("AGEN", `${deferred.size} bukti tertunda akan dicoba ulang`);

  for (;;) {
    try {
      await tick(chainId);
    } catch (e) {
      log("ERROR", `gagal membaca chain: ${message(e)}`);
    }
    await sleep(config.pollMs);
  }
}

process.on("SIGINT", () => {
  log("AGEN", "berhenti.");
  process.exit(0);
});

main().catch((e) => {
  log("ERROR", message(e));
  process.exit(1);
});
