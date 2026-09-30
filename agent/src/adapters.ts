import { config, requireEnv } from "./config.js";
import { localFileStorage, pinataStorage, type Storage } from "./ipfs.js";
import { geminiVision, mockVision, type VisionAdapter } from "./vision.js";

/** Adapter penyimpanan dipilih dari APP_MODE: local → folder lokal, testnet → Pinata. */
export function createStorage(): Storage {
  if (config.storage === "local") return localFileStorage(config.localIpfsDir);
  return pinataStorage(
    requireEnv("PINATA_JWT", "JWT API key Pinata"),
    requireEnv("IPFS_GATEWAY", "gateway Pinata Anda, mis. xxx.mypinata.cloud"),
  );
}

/** Adapter penilaian foto dipilih dari APP_MODE: local → MockVision, testnet → Gemini. */
export function createVision(): VisionAdapter {
  if (config.vision === "mock") return mockVision;
  return geminiVision(
    requireEnv("GEMINI_API_KEY", "API key Google AI Studio"),
    requireEnv("GEMINI_MODEL", "model Gemini Flash terbaru yang mendukung gambar"),
  );
}
