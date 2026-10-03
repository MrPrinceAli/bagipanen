import { useId } from "react";
import { cn } from "./ui";

/**
 * Avatar ilustrasi petani (SVG buatan sendiri, bukan foto orang sungguhan). Setiap petani mendapat
 * kombinasi berbeda: penutup kepala, warna kulit & baju, ekspresi, aksesori, latar, dan komoditas.
 * Petani contoh punya gaya tetap; petani lain mendapat variasi deterministik dari alamatnya.
 */

type Hat = "caping" | "peci" | "kupluk" | "topi" | "kerudung";
type Crop = "padi" | "cabai" | "jagung" | "kentang" | "bawang";
type Style = {
  hat: Hat;
  skin: string;
  shirt: string;
  accent: string; // warna kerudung / kupluk / topi / handuk
  sky: [string, string];
  age: "muda" | "paruh" | "tua";
  mustache?: boolean;
  glasses?: boolean;
  smile?: "lebar" | "tipis";
  crop: Crop;
};

const SKINS = ["#c68a5c", "#b07849", "#d49d6f", "#9c6640", "#e0b088"];
const SHIRTS = ["#2c6a48", "#3b5b8c", "#8d5a1c", "#6b4f8a", "#a8442e", "#3d7f7a"];
const ACCENTS = ["#e6b043", "#c0392b", "#2f6f9f", "#7a8f3a", "#d4952a"];
const SKIES: [string, string][] = [
  ["#f4dca0", "#fdf9ee"],
  ["#bcdcc8", "#f1f7f3"],
  ["#f8d3b0", "#fdf2e6"],
  ["#c9dcef", "#f2f7fc"],
];

/** Gaya tetap untuk petani contoh (nama fiktif) agar setiap orang terasa berbeda. */
const KNOWN: Record<string, Style> = {
  "Pak Darto": { hat: "caping", skin: SKINS[1], shirt: SHIRTS[2], accent: ACCENTS[1], sky: SKIES[2], age: "paruh", mustache: true, crop: "cabai" },
  "Pak Sarmin": { hat: "peci", skin: SKINS[0], shirt: SHIRTS[5], accent: ACCENTS[0], sky: SKIES[0], age: "tua", mustache: true, smile: "tipis", crop: "bawang" },
  "Pak Edi Sembiring": { hat: "kupluk", skin: SKINS[4], shirt: SHIRTS[1], accent: ACCENTS[2], sky: SKIES[3], age: "paruh", glasses: true, crop: "kentang" },
  "Bu Sumarni": { hat: "kerudung", skin: SKINS[2], shirt: SHIRTS[4], accent: ACCENTS[3], sky: SKIES[2], age: "paruh", crop: "cabai" },
  "Pak Lalu Hamdi": { hat: "caping", skin: SKINS[3], shirt: SHIRTS[0], accent: ACCENTS[4], sky: SKIES[1], age: "muda", smile: "lebar", crop: "padi" },
  "Pak Andi Baso": { hat: "peci", skin: SKINS[1], shirt: SHIRTS[3], accent: ACCENTS[0], sky: SKIES[0], age: "paruh", crop: "padi" },
  "Pak Rahmadi": { hat: "topi", skin: SKINS[0], shirt: SHIRTS[0], accent: ACCENTS[1], sky: SKIES[3], age: "muda", smile: "lebar", crop: "jagung" },
  "Pak Slamet": { hat: "kupluk", skin: SKINS[2], shirt: SHIRTS[2], accent: ACCENTS[4], sky: SKIES[1], age: "tua", mustache: true, crop: "kentang" },
  "Pak Kasmuri": { hat: "caping", skin: SKINS[3], shirt: SHIRTS[1], accent: ACCENTS[2], sky: SKIES[0], age: "tua", glasses: true, smile: "tipis", crop: "padi" },
};

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function cropOf(commodity?: string): Crop {
  const c = (commodity ?? "").toLowerCase();
  if (c.includes("cabai") || c.includes("cabe")) return "cabai";
  if (c.includes("jagung")) return "jagung";
  if (c.includes("kentang")) return "kentang";
  if (c.includes("bawang")) return "bawang";
  return "padi";
}

function styleFor(name: string, seed: string, commodity?: string): Style {
  if (KNOWN[name]) return KNOWN[name];
  const h = hash(seed || name);
  const female = /^(bu|ibu)\b/i.test(name);
  const pick = <T,>(arr: T[], shift: number) => arr[(h >>> shift) % arr.length];
  return {
    hat: female ? "kerudung" : pick<Hat>(["caping", "peci", "kupluk", "topi"], 1),
    skin: pick(SKINS, 4),
    shirt: pick(SHIRTS, 7),
    accent: pick(ACCENTS, 10),
    sky: pick(SKIES, 13),
    age: pick<Style["age"]>(["muda", "paruh", "tua"], 16),
    mustache: !female && (h >>> 19) % 3 === 0,
    glasses: (h >>> 21) % 4 === 0,
    smile: (h >>> 23) % 2 ? "lebar" : "tipis",
    crop: cropOf(commodity),
  };
}

/** Menggelapkan warna hex (untuk bayangan). */
function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 - amount))));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, "0")).join("")}`;
}

function CropBadge({ crop }: { crop: Crop }) {
  return (
    <g transform="translate(92 92)">
      <circle r="15" fill="#fffdf6" stroke="#0b1d15" strokeOpacity="0.12" strokeWidth="1.5" />
      {crop === "padi" && (
        <g stroke="#8d5a1c" strokeWidth="1.4" fill="none" strokeLinecap="round">
          <path d="M-1 10 C-1 0 1 -6 6 -10" />
          {[-7, -3, 1, 5].map((y, i) => (
            <g key={i}>
              <ellipse cx={4 - i * 1.6} cy={y} rx="2.2" ry="1.2" fill="#e6b043" stroke="none" transform={`rotate(-35 ${4 - i * 1.6} ${y})`} />
              <ellipse cx={-1 - i * 0.6} cy={y + 2.5} rx="2" ry="1.1" fill="#d4952a" stroke="none" transform={`rotate(30 ${-1 - i * 0.6} ${y + 2.5})`} />
            </g>
          ))}
          <path d="M-1 10 C-5 4 -7 0 -9 -3" stroke="#5fa27b" />
        </g>
      )}
      {crop === "cabai" && (
        <g>
          <path d="M-3 -6 C4 -7 9 -1 7 6 C6 10 2 11 1 8 C2 3 -1 -1 -5 -2 Z" fill="#c0392b" />
          <path d="M-3 -6 C1 -6.5 4 -5 5 -3" stroke="#fff" strokeOpacity="0.45" strokeWidth="1.1" fill="none" strokeLinecap="round" />
          <path d="M-4 -4 C-6 -7 -6 -9 -3 -10" stroke="#2c6a48" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M-6 -4 Q-3 -7 0 -5" fill="#3d855d" />
        </g>
      )}
      {crop === "jagung" && (
        <g>
          <path d="M-2 9 C-9 4 -8 -6 -3 -10 C-4 -3 -2 3 -2 9 Z" fill="#5fa27b" />
          <path d="M2 9 C9 4 8 -6 3 -10 C4 -3 2 3 2 9 Z" fill="#3d855d" />
          <ellipse cx="0" cy="-1" rx="4.2" ry="8.5" fill="#edc56a" />
          {[-7, -4, -1, 2, 5].map((y) => (
            <path key={y} d={`M-3.6 ${y} H3.6`} stroke="#d4952a" strokeWidth="0.8" />
          ))}
          <path d="M-1.3 -9 V7 M1.3 -9 V7" stroke="#d4952a" strokeWidth="0.8" />
        </g>
      )}
      {crop === "kentang" && (
        <g>
          <path d="M-8 1 C-9 -6 -2 -9 3 -7 C9 -5 10 2 6 6 C2 10 -7 9 -8 1 Z" fill="#c69a63" />
          <path d="M-8 1 C-6 6 -1 8 4 6" stroke="#8d5a1c" strokeOpacity="0.5" strokeWidth="1.2" fill="none" />
          {[
            [-3, -3],
            [2, -4],
            [4, 2],
            [-4, 3],
            [0, 1],
          ].map(([x, y]) => (
            <circle key={`${x}${y}`} cx={x} cy={y} r="0.9" fill="#73491d" />
          ))}
        </g>
      )}
      {crop === "bawang" && (
        <g>
          <path d="M0 -9 C1 -5 7 -3 7 3 C7 8 3 10 0 10 C-3 10 -7 8 -7 3 C-7 -3 -1 -5 0 -9 Z" fill="#a03a6a" />
          <path d="M0 -6 C-3 -2 -4 4 -2 9 M0 -6 C3 -2 4 4 2 9" stroke="#fff" strokeOpacity="0.35" strokeWidth="1" fill="none" />
          <path d="M-1 -9 L-3 -12 M1 -9 L2 -12" stroke="#5fa27b" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M-2 10 L-3 12 M0 10 V12.5 M2 10 L3 12" stroke="#c69a63" strokeWidth="0.8" strokeLinecap="round" />
        </g>
      )}
    </g>
  );
}

export function FarmerAvatar({
  name,
  seed,
  commodity,
  className,
}: {
  name: string;
  seed?: string;
  commodity?: string;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const s = styleFor(name, seed ?? name, commodity);
  const skinDark = shade(s.skin, 0.18);
  const skinDeep = shade(s.skin, 0.32);
  const hair = "#2a211b";
  const grayHair = s.age === "tua" ? "#9a958e" : hair;
  const wide = s.smile === "lebar";

  return (
    <svg viewBox="0 0 120 120" className={cn("block", className)} role="img" aria-label={`Ilustrasi ${name}`}>
      <defs>
        <clipPath id={`clip-${uid}`}>
          <rect width="120" height="120" rx="30" />
        </clipPath>
        <linearGradient id={`sky-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={s.sky[0]} />
          <stop offset="1" stopColor={s.sky[1]} />
        </linearGradient>
        <radialGradient id={`face-${uid}`} cx="0.42" cy="0.38" r="0.75">
          <stop offset="0" stopColor={shade(s.skin, -0.08)} />
          <stop offset="1" stopColor={s.skin} />
        </radialGradient>
      </defs>
      <g clipPath={`url(#clip-${uid})`}>
        {/* Latar: langit, matahari, bukit, sawah bertingkat */}
        <rect width="120" height="120" fill={`url(#sky-${uid})`} />
        <circle cx="94" cy="26" r="11" fill="#fff" opacity="0.55" />
        <circle cx="94" cy="26" r="7" fill="#edc56a" opacity="0.8" />
        <path d="M0 78 C18 62 34 66 50 74 C66 62 88 58 120 70 V120 H0 Z" fill="#8fc2a3" opacity="0.55" />
        <path d="M0 88 C22 78 44 82 64 88 C84 80 104 80 120 86 V120 H0 Z" fill="#5fa27b" opacity="0.6" />
        <path d="M0 96 C30 90 60 92 120 96" stroke="#fff" strokeOpacity="0.35" strokeWidth="1" fill="none" />
        <path d="M0 103 C30 98 70 99 120 103" stroke="#fff" strokeOpacity="0.3" strokeWidth="1" fill="none" />

        {/* Badan & baju */}
        <path d="M14 124 C14 102 28 92 46 89 L74 89 C92 92 106 102 106 124 Z" fill={s.shirt} />
        <path d="M46 89 L60 106 L74 89" fill={shade(s.shirt, 0.22)} />
        <path d="M51 89 L60 100 L69 89" fill={skinDark} />
        <path d="M60 106 V124" stroke={shade(s.shirt, 0.3)} strokeWidth="1" />
        {[110, 117].map((y) => (
          <circle key={y} cx="60" cy={y} r="1.3" fill={shade(s.shirt, 0.4)} />
        ))}
        <rect x="70" y="104" width="11" height="8" rx="1.5" fill="none" stroke={shade(s.shirt, 0.3)} strokeWidth="1" />
        {/* Handuk di leher (kecuali berkerudung) */}
        {s.hat !== "kerudung" && (
          <g>
            <path d="M40 92 C46 96 52 98 60 98 C68 98 74 96 80 92 L82 97 C74 102 46 102 38 97 Z" fill="#f8f3e8" />
            <path d="M40 94.5 C50 99.5 70 99.5 80 94.5" stroke={s.accent} strokeWidth="1.2" fill="none" />
            <path d="M80 92 L86 112 L80 113 L76 96 Z" fill="#efe6d3" />
            <path d="M80.5 104 L85 104" stroke={s.accent} strokeWidth="1.1" />
          </g>
        )}

        {/* Leher */}
        <path d="M52 76 H68 V92 C64 95 56 95 52 92 Z" fill={skinDark} />

        {/* Kerudung belakang */}
        {s.hat === "kerudung" && (
          <path d="M34 60 C34 34 48 26 60 26 C72 26 86 34 86 60 C86 78 82 88 92 98 C78 104 42 104 28 98 C38 88 34 78 34 60 Z" fill={s.accent} />
        )}

        {/* Telinga */}
        {s.hat !== "kerudung" && (
          <g>
            <ellipse cx="38.5" cy="62" rx="4.5" ry="6.5" fill={skinDark} />
            <ellipse cx="81.5" cy="62" rx="4.5" ry="6.5" fill={skinDark} />
            <path d="M38 59 C36.5 61 36.8 64 38.6 65.5" stroke={skinDeep} strokeWidth="1" fill="none" />
            <path d="M82 59 C83.5 61 83.2 64 81.4 65.5" stroke={skinDeep} strokeWidth="1" fill="none" />
          </g>
        )}

        {/* Kepala */}
        <path d="M40 56 C40 40 49 33 60 33 C71 33 80 40 80 56 C80 72 72 83 60 83 C48 83 40 72 40 56 Z" fill={`url(#face-${uid})`} />
        <path d="M44 70 C47 79 53 83 60 83 C67 83 73 79 76 70 C72 77 66 80 60 80 C54 80 48 77 44 70 Z" fill={skinDark} opacity="0.55" />

        {/* Rambut samping (tampak di bawah penutup kepala) */}
        {s.hat !== "kerudung" && (
          <g fill={grayHair}>
            <path d="M40 54 C39 46 42 42 45 41 L44 56 C42.5 56 41 55.5 40 54 Z" />
            <path d="M80 54 C81 46 78 42 75 41 L76 56 C77.5 56 79 55.5 80 54 Z" />
          </g>
        )}

        {/* Kerudung depan membingkai wajah */}
        {s.hat === "kerudung" && (
          <g>
            <path d="M38 58 C38 40 48 32 60 32 C72 32 82 40 82 58 C82 52 78 41 60 40 C42 41 38 52 38 58 Z" fill={shade(s.accent, 0.12)} />
            <path d="M40 74 C44 84 52 88 60 88 C68 88 76 84 80 74 C80 86 72 92 60 92 C48 92 40 86 40 74 Z" fill={shade(s.accent, 0.12)} />
            <path d="M48 36 C54 34 66 34 72 36" stroke="#fff" strokeOpacity="0.3" strokeWidth="1.2" fill="none" />
            <circle cx="79" cy="77" r="1.8" fill="#e6b043" />
          </g>
        )}

        {/* Alis */}
        <path d={`M47 ${s.age === "tua" ? 51 : 50} Q51.5 47.5 55.5 49.5`} stroke={s.age === "tua" ? "#6d6760" : hair} strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <path d={`M64.5 49.5 Q68.5 47.5 73 ${s.age === "tua" ? 51 : 50}`} stroke={s.age === "tua" ? "#6d6760" : hair} strokeWidth="2.2" fill="none" strokeLinecap="round" />

        {/* Mata */}
        {wide ? (
          <g stroke="#1c1a17" strokeWidth="2" fill="none" strokeLinecap="round">
            <path d="M47.5 57 Q51.5 53.5 55.5 57" />
            <path d="M64.5 57 Q68.5 53.5 72.5 57" />
          </g>
        ) : (
          <g>
            <ellipse cx="51.5" cy="56.5" rx="3.6" ry="2.6" fill="#fff" />
            <ellipse cx="68.5" cy="56.5" rx="3.6" ry="2.6" fill="#fff" />
            <circle cx="52" cy="56.7" r="1.9" fill="#2a211b" />
            <circle cx="69" cy="56.7" r="1.9" fill="#2a211b" />
            <circle cx="52.7" cy="56" r="0.6" fill="#fff" />
            <circle cx="69.7" cy="56" r="0.6" fill="#fff" />
            <path d="M47.8 55.3 Q51.5 52.8 55.3 55.3 M64.7 55.3 Q68.5 52.8 72.2 55.3" stroke={skinDeep} strokeWidth="1" fill="none" />
          </g>
        )}
        {s.age !== "muda" && (
          <path d="M45.5 60 Q47 61.5 49 61.2 M74.5 60 Q73 61.5 71 61.2" stroke={skinDeep} strokeWidth="0.8" fill="none" opacity="0.8" />
        )}
        {s.age === "tua" && <path d="M51 45.5 Q60 44 69 45.5 M53 43 Q60 42 67 43" stroke={skinDeep} strokeWidth="0.7" fill="none" opacity="0.7" />}

        {/* Kacamata */}
        {s.glasses && (
          <g stroke="#3b2f25" strokeWidth="1.4" fill="#fff" fillOpacity="0.12">
            <rect x="45.5" y="52" width="12" height="9" rx="3.5" />
            <rect x="62.5" y="52" width="12" height="9" rx="3.5" />
            <path d="M57.5 56 Q60 54.5 62.5 56 M45.5 55.5 L41 54 M74.5 55.5 L79 54" fill="none" />
          </g>
        )}

        {/* Hidung, pipi, mulut */}
        <path d="M60 58 C59 62 57.5 65 58 66.5 C59 67.3 61 67.3 62 66.5" stroke={skinDeep} strokeWidth="1.3" fill="none" strokeLinecap="round" />
        <ellipse cx="48" cy="66" rx="4" ry="2.4" fill="#e07a6a" opacity="0.28" />
        <ellipse cx="72" cy="66" rx="4" ry="2.4" fill="#e07a6a" opacity="0.28" />
        {s.mustache && <path d="M52.5 70.5 C55 68.5 58 68.8 60 70 C62 68.8 65 68.5 67.5 70.5 C64.5 71.8 62 71.5 60 71 C58 71.5 55.5 71.8 52.5 70.5 Z" fill={grayHair} />}
        {wide ? (
          <g>
            <path d="M52.5 72 Q60 80.5 67.5 72 Z" fill="#7a2e2a" />
            <path d="M54 72.6 Q60 75 66 72.6 L65.6 73.8 Q60 75.8 54.4 73.8 Z" fill="#fff" />
          </g>
        ) : (
          <path d="M54 73 Q60 77 66 73" stroke="#7a2e2a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        )}

        {/* Penutup kepala */}
        {s.hat === "caping" && (
          <g>
            <path d="M12 47 C30 42 90 42 108 47 C96 52 24 52 12 47 Z" fill="#b8955a" />
            <path d="M14 46 L60 14 L106 46 C88 41 32 41 14 46 Z" fill="#d9b874" />
            <path d="M60 14 L106 46 C92 42 76 41 60 41 Z" fill="#c4a062" />
            <g stroke="#a07c44" strokeWidth="0.8" opacity="0.8" fill="none">
              {[-36, -26, -16, -6, 4, 14, 24, 34].map((dx) => (
                <path key={dx} d={`M60 14 L${60 + dx * 1.25} ${44 - Math.abs(dx) * 0.06}`} />
              ))}
              <path d="M44 25 C54 23.6 66 23.6 76 25" />
              <path d="M34 32 C50 30 70 30 86 32" />
              <path d="M24 39 C46 36.5 74 36.5 96 39" />
            </g>
            <path d="M12 47 C24 52 96 52 108 47" stroke="#8d6a36" strokeWidth="1.4" fill="none" />
            <path d="M42 50 C44 66 46 76 52 84 M78 50 C76 66 74 76 68 84" stroke="#6b5130" strokeWidth="0.9" fill="none" opacity="0.7" />
          </g>
        )}
        {s.hat === "peci" && (
          <g>
            <path d="M42 46 C42 38 43 32 45 30 L75 30 C77 32 78 38 78 46 C70 43.5 50 43.5 42 46 Z" fill="#1c1a17" />
            <path d="M45 30 L75 30 C73 28.5 47 28.5 45 30 Z" fill="#2f2b27" />
            <path d="M42.5 44 C52 41.5 68 41.5 77.5 44" stroke={s.accent} strokeWidth="1.2" fill="none" opacity="0.9" />
            <path d="M47 33 L73 33" stroke="#fff" strokeOpacity="0.12" strokeWidth="1.5" />
          </g>
        )}
        {s.hat === "kupluk" && (
          <g>
            <path d="M39 50 C38 33 48 24 60 24 C72 24 82 33 81 50 C70 46 50 46 39 50 Z" fill={s.accent} />
            {[30, 36, 42].map((y) => (
              <path key={y} d={`M${41 + (42 - y) * 0.3} ${y} C52 ${y - 2.5} 68 ${y - 2.5} ${79 - (42 - y) * 0.3} ${y}`} stroke="#fff" strokeOpacity="0.35" strokeWidth="1.6" fill="none" />
            ))}
            <path d="M38.5 50 C50 45 70 45 81.5 50 L81.5 55 C70 51 50 51 38.5 55 Z" fill={shade(s.accent, 0.2)} />
            {[42, 48, 54, 60, 66, 72, 78].map((x) => (
              <path key={x} d={`M${x} 48.5 V53.5`} stroke="#000" strokeOpacity="0.15" strokeWidth="1" />
            ))}
            <circle cx="60" cy="22" r="5" fill="#f8f3e8" />
          </g>
        )}
        {s.hat === "topi" && (
          <g>
            <path d="M40 48 C40 34 49 28 60 28 C71 28 80 34 80 48 C70 45 50 45 40 48 Z" fill={s.accent} />
            <path d="M60 28 V46" stroke="#000" strokeOpacity="0.15" strokeWidth="1" />
            <path d="M38 48 C48 44 72 44 82 48 L94 51 C92 54 84 54 80 52 C70 49 50 49 40 52 Z" fill={shade(s.accent, 0.22)} />
            <circle cx="60" cy="28.5" r="1.6" fill={shade(s.accent, 0.3)} />
            <rect x="52" y="34" width="16" height="7" rx="2" fill="#fffdf6" opacity="0.9" />
            <path d="M55 37.5 H65" stroke={s.shirt} strokeWidth="1.4" />
          </g>
        )}

        <CropBadge crop={s.crop} />
      </g>
    </svg>
  );
}
