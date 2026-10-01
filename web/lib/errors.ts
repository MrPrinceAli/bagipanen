import { type Abi, decodeErrorResult, type Hex } from "viem";
import { campaignFactoryAbi } from "./abi/CampaignFactory";
import { harvestCampaignAbi } from "./abi/HarvestCampaign";
import { mockUSDTAbi } from "./abi/MockUSDT";
import { reservePoolAbi } from "./abi/ReservePool";

/** Terjemahan custom error kontrak ke Bahasa Indonesia yang mudah dipahami. */
const MESSAGES: Record<string, string> = {
  // HarvestCampaign
  NotFactory: "Langkah ini hanya bisa dilakukan lewat kontrak utama BagiPanen.",
  NotFarmer: "Hanya petani pemilik kampanye ini yang bisa melakukannya.",
  NotCooperative: "Hanya koperasi pendamping kampanye ini yang bisa memutuskan.",
  NotAgent: "Hanya agen AI resmi yang bisa mencatat putusan.",
  NotAdmin: "Hanya admin yang bisa melakukannya.",
  NotReservePool: "Kompensasi hanya bisa dikirim dari dana cadangan.",
  InvalidStatus: "Langkah ini belum bisa dilakukan di tahap kampanye sekarang.",
  InvalidMilestoneStatus: "Langkah ini belum bisa dilakukan di tahap pencairan sekarang.",
  NoMilestoneLeft: "Semua tahap pencairan sudah selesai.",
  MilestonesIncomplete: "Hasil panen baru bisa disetor setelah semua dana tahap cair.",
  FundingClosed: "Waktu pendanaan kampanye ini sudah habis.",
  FundingStillOpen: "Pendanaan masih berjalan, jadi belum bisa ditutup.",
  NotAllowedToFund: "Petani dan koperasi kampanye ini tidak boleh ikut mendanai.",
  ExceedsTarget: "Jumlahnya melebihi sisa target pendanaan.",
  ZeroAmount: "Jumlahnya harus lebih dari 0.",
  EmptyCID: "Fotonya belum terunggah. Coba pilih ulang fotonya.",
  TooManyAttempts: "Kesempatan kirim bukti untuk tahap ini sudah habis (tiga kali).",
  NothingToRefund: "Kamu tidak punya dana yang bisa di-refund di kampanye ini.",
  NothingToClaim: "Belum ada dana yang bisa kamu klaim.",
  GracePeriodActive: "Masa tenggang 30 hari setelah perkiraan panen belum lewat.",
  NonTransferable: "Token porsi tidak bisa dipindahtangankan.",
  // CampaignFactory
  ZeroAddress: "Alamat dompetnya belum diisi.",
  EmptyName: "Namanya belum diisi.",
  AlreadyRegistered: "Alamat ini sudah terdaftar.",
  RoleConflict: "Alamat ini sudah dipakai untuk peran lain. Satu dompet hanya boleh punya satu peran.",
  NotRegisteredFarmer: "Dompet ini belum didaftarkan sebagai petani oleh koperasi.",
  FarmerBlocked: "Petani ini tidak bisa mengajukan kampanye baru karena pernah gagal bayar.",
  ModulesNotSet: "Kontrak belum selesai diatur admin.",
  ModulesAlreadySet: "Modul kontrak sudah pernah diatur.",
  NotCampaign: "Alamat ini bukan kampanye BagiPanen.",
  InvalidParams: "Ada isian pengajuan yang belum benar. Cek lagi formulirnya.",
  AgentNotIndependent: "Dompet agen harus berbeda dari dompet admin, koperasi, dan petani.",
  AgentNotOwner: "Dompet ini bukan pemilik identitas agen tersebut.",
  OwnableUnauthorizedAccount: "Hanya admin yang bisa melakukannya.",
  // MockUSDT / ERC-20
  MintTooLarge: "Paling banyak 10.000 mUSDT sekali minta.",
  ERC20InsufficientBalance: "Saldo mUSDT-mu kurang. Klik \"Minta mUSDT\" untuk isi saldo demo.",
  ERC20InsufficientAllowance: "Izin mUSDT belum cukup. Jalankan langkah \"Izinkan mUSDT\" dulu.",
};

/** Gabungan definisi error semua kontrak, untuk men-decode revert dari kontrak lain (mis. factory → kampanye). */
const ERRORS_ABI = [...harvestCampaignAbi, ...campaignFactoryAbi, ...mockUSDTAbi, ...reservePoolAbi].filter(
  (x) => x.type === "error",
) as Abi;

type ViemLikeError = Error & {
  shortMessage?: string;
  details?: string;
  walk?: (fn?: (e: unknown) => boolean) => unknown;
};
type RevertLike = { name: string; data?: { errorName?: string }; raw?: Hex; reason?: string };

const hasName = (e: unknown, name: string) => typeof e === "object" && e !== null && (e as { name?: string }).name === name;

function errorNameFromRevert(err: RevertLike): string | undefined {
  if (err.data?.errorName) return err.data.errorName;
  if (err.raw) {
    try {
      return decodeErrorResult({ abi: ERRORS_ABI, data: err.raw }).errorName;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Pesan error yang mudah dipahami. Dicocokkan lewat `name` error viem (bukan `instanceof`)
 * agar tetap bekerja walau ada lebih dari satu salinan viem yang termuat.
 */
export function translateError(error: unknown): string {
  const err = error as ViemLikeError;
  if (err && typeof err.walk === "function") {
    const reverted = err.walk((e) => hasName(e, "ContractFunctionRevertedError")) as RevertLike | null;
    if (reverted) {
      const name = errorNameFromRevert(reverted);
      if (name && MESSAGES[name]) return MESSAGES[name];
      if (reverted.reason) return `Transaksi ditolak kontrak: ${reverted.reason}`;
      return "Transaksi ditolak kontrak. Cek lagi isiannya, lalu coba lagi.";
    }
    if (err.walk((e) => hasName(e, "UserRejectedRequestError"))) return "Transaksinya kamu batalkan di dompet.";
    const text = `${err.shortMessage ?? ""} ${err.details ?? ""}`.toLowerCase();
    if (text.includes("insufficient funds")) return "Saldo tBNB untuk biaya gas tidak cukup. Isi dulu dari faucet BNB testnet.";
    if (text.includes("fetch") || text.includes("http request failed"))
      return "Belum bisa terhubung ke jaringan. Cek koneksi internetmu (di mode lokal, pastikan npm run dev:chain masih jalan).";
    return err.shortMessage ?? err.message;
  }
  if (error instanceof Error) return error.message;
  return "Ada kendala yang belum kami kenali. Coba lagi sebentar.";
}
