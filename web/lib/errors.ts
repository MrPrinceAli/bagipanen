import { tr, trMap } from "./i18n";
import { type Abi, decodeErrorResult, type Hex } from "viem";
import { campaignFactoryAbi } from "./abi/CampaignFactory";
import { harvestCampaignAbi } from "./abi/HarvestCampaign";
import { mockUSDTAbi } from "./abi/MockUSDT";
import { reservePoolAbi } from "./abi/ReservePool";

/** Terjemahan custom error kontrak ke bahasa sehari-hari (ID/EN). */
const MESSAGES = trMap<string>({
  // HarvestCampaign
  NotFactory: ["Langkah ini hanya bisa dilakukan lewat kontrak utama BagiPanen.", "This step can only be done through the main BagiPanen contract."],
  NotFarmer: ["Hanya petani pemilik proyek ini yang bisa melakukannya.", "Only the farmer who owns this project can do this."],
  NotCooperative: ["Hanya koperasi pendamping proyek ini yang bisa memutuskan.", "Only this project's supporting cooperative can decide."],
  NotAgent: ["Hanya agen AI resmi yang bisa mencatat putusan.", "Only the official AI agent can record verdicts."],
  NotAdmin: ["Hanya admin yang bisa melakukannya.", "Only the admin can do this."],
  NotReservePool: ["Kompensasi hanya bisa dikirim dari dana cadangan.", "Compensation can only come from the reserve fund."],
  InvalidStatus: ["Langkah ini belum bisa dilakukan di tahap proyek sekarang.", "This step isn't available at the project's current stage."],
  InvalidMilestoneStatus: ["Langkah ini belum bisa dilakukan di tahap pencairan sekarang.", "This step isn't available at the current release stage."],
  NoMilestoneLeft: ["Semua tahap pencairan sudah selesai.", "All release stages are already done."],
  MilestonesIncomplete: ["Hasil panen baru bisa disetor setelah semua dana tahap cair.", "The harvest can only be deposited after all stage funds are released."],
  FundingClosed: ["Waktu pendanaan proyek ini sudah habis.", "This project's funding period has ended."],
  FundingStillOpen: ["Pendanaan masih berjalan, jadi belum bisa ditutup.", "Funding is still open, so it can't be closed yet."],
  NotAllowedToFund: ["Petani dan koperasi proyek ini tidak boleh ikut mendanai.", "This project's farmer and cooperative can't fund it."],
  ExceedsTarget: ["Jumlahnya melebihi sisa target pendanaan.", "The amount exceeds the remaining funding target."],
  ZeroAmount: ["Jumlahnya harus lebih dari 0.", "The amount must be more than 0."],
  EmptyCID: ["Fotonya belum terunggah. Coba pilih ulang fotonya.", "The photo hasn't uploaded yet. Try choosing it again."],
  TooManyAttempts: ["Kesempatan kirim bukti untuk tahap ini sudah habis (tiga kali).", "No more proof attempts left for this stage (three tries)."],
  NothingToRefund: ["Kamu tidak punya dana yang bisa di-refund di proyek ini.", "You have nothing to refund in this project."],
  NothingToClaim: ["Belum ada dana yang bisa kamu klaim.", "There's nothing for you to claim yet."],
  GracePeriodActive: ["Masa tenggang 30 hari setelah perkiraan panen belum lewat.", "The 30-day grace period after the expected harvest hasn't passed yet."],
  NonTransferable: ["Token porsi tidak bisa dipindahtangankan.", "Share tokens can't be transferred."],
  // CampaignFactory
  ZeroAddress: ["Alamat dompetnya belum diisi.", "The wallet address is empty."],
  EmptyName: ["Namanya belum diisi.", "The name is empty."],
  AlreadyRegistered: ["Alamat ini sudah terdaftar.", "This address is already registered."],
  RoleConflict: ["Alamat ini sudah dipakai untuk peran lain. Satu dompet hanya boleh punya satu peran.", "This address is already used for another role. One wallet can only have one role."],
  NotRegisteredFarmer: ["Dompet ini belum didaftarkan sebagai petani oleh koperasi.", "This wallet hasn't been registered as a farmer by a cooperative."],
  FarmerBlocked: ["Petani ini tidak bisa mengajukan proyek baru karena pernah gagal bayar.", "This farmer can't propose new projects because they defaulted before."],
  ModulesNotSet: ["Kontrak belum selesai diatur admin.", "The admin hasn't finished setting up the contracts."],
  ModulesAlreadySet: ["Modul kontrak sudah pernah diatur.", "The contract modules are already set."],
  NotCampaign: ["Alamat ini bukan proyek BagiPanen.", "This address isn't a BagiPanen project."],
  InvalidParams: ["Ada isian pengajuan yang belum benar. Cek lagi formulirnya.", "Some proposal fields aren't right yet. Check the form again."],
  AgentNotIndependent: ["Dompet agen harus berbeda dari dompet admin, koperasi, dan petani.", "The agent wallet must differ from the admin, cooperative, and farmer wallets."],
  AgentNotOwner: ["Dompet ini bukan pemilik identitas agen tersebut.", "This wallet doesn't own that agent identity."],
  OwnableUnauthorizedAccount: ["Hanya admin yang bisa melakukannya.", "Only the admin can do this."],
  // MockUSDT / ERC-20
  MintTooLarge: ["Paling banyak 10.000 mUSDT sekali minta.", "At most 10,000 mUSDT per request."],
  ERC20InsufficientBalance: ["Saldo mUSDT-mu kurang. Klik \"Minta mUSDT\" untuk isi saldo demo.", "Your mUSDT balance is too low. Click \"Get mUSDT\" to top up your demo balance."],
  ERC20InsufficientAllowance: ["Izin mUSDT belum cukup. Jalankan langkah \"Izinkan mUSDT\" dulu.", "The mUSDT approval isn't enough. Do the \"Approve mUSDT\" step first."],
});

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
      if (reverted.reason) return `${tr("Transaksi ditolak kontrak:", "The contract rejected the transaction:")} ${reverted.reason}`;
      return tr("Transaksi ditolak kontrak. Cek lagi isiannya, lalu coba lagi.", "The contract rejected the transaction. Check your inputs and try again.");
    }
    if (err.walk((e) => hasName(e, "UserRejectedRequestError"))) return tr("Transaksinya kamu batalkan di dompet.", "You cancelled the transaction in your wallet.");
    const text = `${err.shortMessage ?? ""} ${err.details ?? ""}`.toLowerCase();
    if (text.includes("insufficient funds")) return tr("Saldo tBNB untuk biaya gas tidak cukup. Isi dulu dari faucet BNB testnet.", "Not enough tBNB for gas. Top up from a BNB testnet faucet first.");
    if (text.includes("fetch") || text.includes("http request failed"))
      return tr(
        "Belum bisa terhubung ke jaringan. Cek koneksi internetmu (di mode lokal, pastikan npm run dev:chain masih jalan).",
        "Can't reach the network yet. Check your internet connection (in local mode, make sure npm run dev:chain is still running).",
      );
    return err.shortMessage ?? err.message;
  }
  if (error instanceof Error) return error.message;
  return tr("Ada kendala yang belum kami kenali. Coba lagi sebentar.", "Something went wrong that we don't recognize. Try again in a moment.");
}
