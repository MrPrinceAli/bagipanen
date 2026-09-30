import { type Abi, decodeErrorResult, type Hex } from "viem";
import { campaignFactoryAbi } from "./abi/CampaignFactory";
import { harvestCampaignAbi } from "./abi/HarvestCampaign";
import { mockUSDTAbi } from "./abi/MockUSDT";
import { reservePoolAbi } from "./abi/ReservePool";

/** Terjemahan custom error kontrak ke Bahasa Indonesia yang mudah dipahami. */
const MESSAGES: Record<string, string> = {
  // HarvestCampaign
  NotFactory: "Aksi ini hanya bisa dilakukan lewat factory BagiPanen.",
  NotFarmer: "Hanya petani pemilik kampanye ini yang bisa melakukan aksi ini.",
  NotCooperative: "Hanya koperasi pendamping kampanye ini yang bisa memutuskan.",
  NotAgent: "Hanya agen AI terdaftar yang bisa mencatat putusan.",
  NotAdmin: "Hanya admin yang bisa melakukan aksi ini.",
  NotReservePool: "Kompensasi hanya bisa dikirim dari dana cadangan.",
  InvalidStatus: "Aksi ini tidak tersedia pada status kampanye saat ini.",
  InvalidMilestoneStatus: "Aksi ini tidak tersedia pada status milestone saat ini.",
  NoMilestoneLeft: "Semua milestone sudah selesai.",
  MilestonesIncomplete: "Hasil panen baru bisa disetor setelah semua milestone cair.",
  FundingClosed: "Masa pendanaan sudah berakhir.",
  FundingStillOpen: "Masa pendanaan belum berakhir.",
  NotAllowedToFund: "Petani dan koperasi kampanye ini tidak boleh ikut mendanai.",
  ExceedsTarget: "Jumlah melebihi sisa target pendanaan.",
  ZeroAmount: "Jumlah harus lebih dari 0.",
  EmptyCID: "File bukti belum diunggah.",
  TooManyAttempts: "Batas 3 kali percobaan untuk milestone ini sudah habis.",
  NothingToRefund: "Anda tidak punya dana untuk di-refund di kampanye ini.",
  NothingToClaim: "Belum ada dana yang bisa Anda klaim.",
  GracePeriodActive: "Masa tenggang 30 hari setelah perkiraan panen belum lewat.",
  NonTransferable: "Token porsi tidak bisa dipindahtangankan.",
  // CampaignFactory
  ZeroAddress: "Alamat tidak boleh kosong.",
  EmptyName: "Nama tidak boleh kosong.",
  AlreadyRegistered: "Alamat ini sudah terdaftar.",
  RoleConflict: "Alamat ini sudah memegang peran lain (satu wallet satu peran).",
  NotRegisteredFarmer: "Wallet ini belum didaftarkan sebagai petani oleh koperasi.",
  FarmerBlocked: "Petani ini diblokir membuat kampanye baru karena pernah gagal bayar.",
  ModulesNotSet: "Kontrak belum dikonfigurasi lengkap oleh admin.",
  ModulesAlreadySet: "Modul kontrak sudah pernah diatur.",
  NotCampaign: "Alamat ini bukan kampanye BagiPanen.",
  InvalidParams: "Data pengajuan tidak valid. Periksa kembali isian formulir.",
  AgentNotIndependent: "Wallet agen harus berbeda dari admin, koperasi, dan petani.",
  AgentNotOwner: "Wallet agen bukan pemilik identitas agen tersebut.",
  OwnableUnauthorizedAccount: "Hanya admin yang bisa melakukan aksi ini.",
  // MockUSDT / ERC-20
  MintTooLarge: "Maksimal 10.000 mUSDT per permintaan.",
  ERC20InsufficientBalance: "Saldo mUSDT tidak cukup. Gunakan tombol \"Minta mUSDT demo\".",
  ERC20InsufficientAllowance: "Izin penggunaan mUSDT belum cukup. Lakukan langkah \"Setujui mUSDT\" dulu.",
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
      return "Transaksi ditolak kontrak.";
    }
    if (err.walk((e) => hasName(e, "UserRejectedRequestError"))) return "Transaksi dibatalkan di wallet.";
    const text = `${err.shortMessage ?? ""} ${err.details ?? ""}`.toLowerCase();
    if (text.includes("insufficient funds")) return "Saldo koin gas (tBNB) tidak cukup untuk biaya transaksi.";
    if (text.includes("fetch") || text.includes("http request failed"))
      return "Tidak bisa terhubung ke jaringan. Pastikan chain berjalan (mode lokal: npm run dev:chain).";
    return err.shortMessage ?? err.message;
  }
  if (error instanceof Error) return error.message;
  return "Terjadi kesalahan yang tidak diketahui.";
}
