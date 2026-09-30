import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

/** Tulis atomik (file sementara lalu rename) agar tidak korup jika proses dihentikan. */
function writeJson(file: string, data: unknown) {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, file);
}

/** Identitas chain: jika berubah (mis. `npm run dev:chain` diulang), state lama dibuang. */
export type ChainIdentity = { chainId: number; factory: string; genesisHash: string };

type StateFile = ChainIdentity & { lastBlock: string };

/** data/state.json — blok terakhir yang sudah diproses. */
export class AgentState {
  private readonly file: string;
  private data: StateFile | null;

  constructor(dir: string) {
    this.file = path.join(dir, "state.json");
    this.data = readJson<StateFile | null>(this.file, null);
  }

  /** true jika state tersimpan milik chain lain (atau belum ada). */
  isStale(id: ChainIdentity): boolean {
    const d = this.data;
    return !d || d.chainId !== id.chainId || d.factory.toLowerCase() !== id.factory.toLowerCase() || d.genesisHash !== id.genesisHash;
  }

  reset(id: ChainIdentity, fromBlock: bigint) {
    this.data = { ...id, lastBlock: (fromBlock - 1n).toString() };
    writeJson(this.file, this.data);
  }

  /** Apakah sudah ada state tersimpan (dari chain mana pun). */
  get exists(): boolean {
    return this.data !== null;
  }

  get lastBlock(): bigint {
    return BigInt(this.data?.lastBlock ?? "-1");
  }

  setLastBlock(block: bigint) {
    if (!this.data) return;
    this.data.lastBlock = block.toString();
    writeJson(this.file, this.data);
  }
}

export type SeenEntry = { campaign: string; milestoneIndex: number; attempt: number; seenAt: string };

/**
 * data/seen-hashes.json — SHA-256 foto yang pernah dinilai. Foto dianggap duplikat jika
 * hash yang sama pernah dipakai untuk KAMPANYE LAIN atau MILESTONE LAIN (PRD).
 * Unggah ulang foto yang sama untuk milestone yang sama bukan duplikat.
 */
export class SeenHashes {
  private readonly file: string;
  private data: Record<string, SeenEntry[]>;

  constructor(dir: string) {
    this.file = path.join(dir, "seen-hashes.json");
    this.data = readJson<Record<string, SeenEntry[]>>(this.file, {});
  }

  /** Entri lain yang membuat hash ini duplikat, atau null. */
  findDuplicate(hash: string, campaign: string, milestoneIndex: number): SeenEntry | null {
    const entries = this.data[hash] ?? [];
    return (
      entries.find((e) => e.campaign.toLowerCase() !== campaign.toLowerCase() || e.milestoneIndex !== milestoneIndex) ?? null
    );
  }

  add(hash: string, entry: Omit<SeenEntry, "seenAt">) {
    const list = (this.data[hash] ??= []);
    const exists = list.some(
      (e) => e.campaign.toLowerCase() === entry.campaign.toLowerCase() && e.milestoneIndex === entry.milestoneIndex && e.attempt === entry.attempt,
    );
    if (!exists) list.push({ ...entry, seenAt: new Date().toISOString() });
    writeJson(this.file, this.data);
  }

  clear() {
    this.data = {};
    writeJson(this.file, this.data);
  }
}
