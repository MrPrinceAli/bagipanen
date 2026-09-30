/** Log konsol yang mudah dibaca saat demo: `16:10:05 [BUKTI] Kampanye 0x98A0..a11e …` */
const tty = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: number) => (s: string) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const green = paint(32);
const red = paint(31);
const yellow = paint(33);
const cyan = paint(36);
const gray = paint(90);
const bold = paint(1);

const TAG_COLOR: Record<string, (s: string) => string> = {
  AGEN: bold,
  BUKTI: cyan,
  FOTO: gray,
  EXIF: gray,
  CUACA: gray,
  AI: yellow,
  PUTUSAN: bold,
  LEWATI: gray,
  ULANG: yellow,
  ERROR: red,
  DAFTAR: cyan,
};

const clock = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "Asia/Jakarta",
});

export function log(tag: keyof typeof TAG_COLOR, message: string) {
  const color = TAG_COLOR[tag] ?? ((s: string) => s);
  const line = `${gray(clock.format(new Date()))} ${color(`[${tag}]`)} ${message}`;
  if (tag === "ERROR") console.error(line);
  else console.log(line);
}

export const fmt = { green, red, yellow, bold, gray };

export function shortAddr(a: string): string {
  return `${a.slice(0, 6)}..${a.slice(-4)}`;
}

export function shortHash(h: string): string {
  return `${h.slice(0, 10)}…`;
}
