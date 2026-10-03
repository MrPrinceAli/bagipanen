import { AlertTriangle, CheckCircle2, Info, type LucideIcon, XCircle } from "lucide-react";
import Link from "next/link";
import type {
  ButtonHTMLAttributes,
  ComponentProps,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ */
/* Tata letak                                                          */
/* ------------------------------------------------------------------ */

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 2xl:max-w-[88rem]", className)}>{children}</div>;
}

/**
 * Pita judul gelap di atas setiap halaman, menyambung dengan header.
 * Isi halaman (`PageBody`) naik sedikit menutupi bagian bawahnya.
 */
export function PageHero({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="glow-hutan relative overflow-hidden bg-hutan-950 text-white">
      <div className="pola-bedengan absolute inset-0" aria-hidden />
      <Container className="relative pt-10 pb-24 sm:pt-14 sm:pb-28">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl animate-fade-up">
            {eyebrow && <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-emas-300 uppercase">{eyebrow}</p>}
            <h1 className="font-display text-3xl leading-[1.1] font-semibold text-balance sm:text-5xl">{title}</h1>
            {description && <div className="mt-4 max-w-2xl text-base text-pretty text-white/70 sm:text-lg">{description}</div>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
        {children && <div className="mt-8">{children}</div>}
      </Container>
    </section>
  );
}

/** Isi halaman: naik menutupi bagian bawah `PageHero`. */
export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <Container className={cn("relative -mt-14 flex flex-col gap-8 pb-20 sm:-mt-16", className)}>{children}</Container>;
}

/* ------------------------------------------------------------------ */
/* Kartu & judul bagian                                                */
/* ------------------------------------------------------------------ */

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-3xl border border-krem-200 bg-white p-5 shadow-soft sm:p-6", className)}>{children}</div>;
}

export function CardTitle({
  children,
  description,
  icon: Icon,
  action,
}: {
  children: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {Icon && <IconBubble icon={Icon} />}
        <div>
          <h2 className="font-display text-xl font-semibold text-hutan-950">{children}</h2>
          {description && <p className="mt-0.5 text-sm text-stone-600">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function SectionTitle({
  children,
  eyebrow,
  description,
  action,
}: {
  children: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="max-w-2xl">
        {eyebrow && <p className="mb-1.5 text-xs font-semibold tracking-[0.18em] text-emas-600 uppercase">{eyebrow}</p>}
        <h2 className="font-display text-2xl font-semibold text-balance text-hutan-950 sm:text-3xl">{children}</h2>
        {description && <p className="mt-1.5 text-balance text-stone-600">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function IconBubble({ icon: Icon, tone = "green", className }: { icon: LucideIcon; tone?: "green" | "gold" | "dark"; className?: string }) {
  const tones = {
    green: "bg-hutan-50 text-hutan-700 ring-hutan-100",
    gold: "bg-emas-50 text-emas-700 ring-emas-100",
    dark: "bg-white/10 text-emas-300 ring-white/10",
  }[tone];
  return (
    <span className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-2xl ring-1", tones, className)}>
      <Icon className="size-5" aria-hidden />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Tombol                                                              */
/* ------------------------------------------------------------------ */

export type ButtonVariant = "primary" | "gold" | "secondary" | "ghost" | "danger" | "light";
type ButtonSize = "sm" | "md" | "lg";

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  const styles = {
    primary: "bg-hutan-800 text-white shadow-sm hover:bg-hutan-700 disabled:bg-hutan-200 disabled:text-white",
    gold: "bg-emas-400 text-hutan-950 shadow-sm hover:bg-emas-300 disabled:bg-emas-100 disabled:text-emas-700/60",
    secondary: "border border-krem-300 bg-white text-hutan-900 hover:border-hutan-300 hover:bg-hutan-50 disabled:text-stone-400",
    ghost: "text-hutan-800 hover:bg-hutan-50 disabled:text-stone-400",
    danger: "bg-red-700 text-white shadow-sm hover:bg-red-800 disabled:bg-red-200",
    light: "border border-white/20 bg-white/5 text-white backdrop-blur hover:bg-white/15 disabled:text-white/40",
  }[variant];
  const sizes = { sm: "h-9 px-3.5 text-sm", md: "h-11 px-5 text-sm", lg: "h-13 px-7 text-base" }[size];
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition duration-200 focus-visible:ring-2 focus-visible:ring-emas-400 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100",
    styles,
    sizes,
    className,
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean };

export function Button({ variant, size, loading, className, children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}

/** Tautan internal bergaya tombol. */
export function ButtonLink({
  variant,
  size,
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent", className)}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Label, pemberitahuan, progres                                       */
/* ------------------------------------------------------------------ */

export type Tone = "neutral" | "green" | "yellow" | "red" | "brown" | "blue" | "glass";
const TONES: Record<Tone, string> = {
  neutral: "bg-stone-100 text-stone-700 ring-stone-200",
  green: "bg-hutan-50 text-hutan-800 ring-hutan-200",
  yellow: "bg-emas-50 text-emas-800 ring-emas-200",
  red: "bg-red-50 text-red-800 ring-red-200",
  brown: "bg-krem-100 text-emas-800 ring-krem-300",
  blue: "bg-sky-50 text-sky-800 ring-sky-200",
  glass: "bg-hutan-950/55 text-white ring-white/20 backdrop-blur-md",
};
const DOTS: Record<Tone, string> = {
  neutral: "bg-stone-400",
  green: "bg-hutan-500",
  yellow: "bg-emas-500",
  red: "bg-red-500",
  brown: "bg-emas-600",
  blue: "bg-sky-500",
  glass: "bg-emas-300",
};

export function Badge({ children, tone = "neutral", dot = false }: { children: ReactNode; tone?: Tone; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset", TONES[tone])}>
      {dot && <span className={cn("size-1.5 rounded-full", DOTS[tone])} aria-hidden />}
      {children}
    </span>
  );
}

const NOTICE = {
  info: { box: "border-sky-200 bg-sky-50/80 text-sky-950", icon: Info, iconClass: "text-sky-600" },
  warn: { box: "border-emas-200 bg-emas-50 text-emas-900", icon: AlertTriangle, iconClass: "text-emas-600" },
  error: { box: "border-red-200 bg-red-50 text-red-900", icon: XCircle, iconClass: "text-red-600" },
  success: { box: "border-hutan-200 bg-hutan-50 text-hutan-900", icon: CheckCircle2, iconClass: "text-hutan-600" },
};

export function Notice({ children, tone = "info", className }: { children: ReactNode; tone?: keyof typeof NOTICE; className?: string }) {
  const { box, icon: Icon, iconClass } = NOTICE[tone];
  return (
    <div className={cn("flex gap-3 rounded-2xl border px-4 py-3 text-sm leading-relaxed", box, className)}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", iconClass)} aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function ProgressBar({ value, max, dark = false, className }: { value: bigint; max: bigint; dark?: boolean; className?: string }) {
  const pct = max === 0n ? 0 : Math.min(100, Number((value * 10_000n) / max) / 100);
  return (
    <div
      className={cn("h-2.5 w-full overflow-hidden rounded-full", dark ? "bg-white/15" : "bg-krem-200", className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-full bg-linear-to-r from-emas-500 to-emas-300 transition-all duration-700" style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Formulir                                                            */
/* ------------------------------------------------------------------ */

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-hutan-950">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs leading-relaxed text-stone-500">{hint}</p>}
    </div>
  );
}

const inputBase =
  "w-full rounded-2xl border border-krem-300 bg-krem-50/60 px-4 py-2.5 text-sm text-stone-900 transition placeholder:text-stone-400 hover:border-krem-400 focus:border-hutan-500 focus:bg-white focus:ring-4 focus:ring-hutan-100 focus:outline-none disabled:bg-stone-100";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputBase, "h-11", props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputBase, "min-h-28 leading-relaxed", props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputBase, "h-11 pr-9", props.className)} />;
}

/* ------------------------------------------------------------------ */
/* Angka & keadaan kosong                                              */
/* ------------------------------------------------------------------ */

export function Stat({
  label,
  value,
  sub,
  icon: Icon,
  variant = "light",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: LucideIcon;
  variant?: "light" | "glass";
}) {
  const glass = variant === "glass";
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-3xl p-5",
        glass ? "border border-white/10 bg-white/[0.06] backdrop-blur-md" : "border border-krem-200 bg-white shadow-soft",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={cn("text-xs font-semibold tracking-wide uppercase", glass ? "text-white/60" : "text-stone-500")}>{label}</p>
        {Icon && <Icon className={cn("size-4", glass ? "text-emas-300" : "text-hutan-500")} aria-hidden />}
      </div>
      <p className={cn("font-display text-3xl font-semibold tracking-tight", glass ? "text-white" : "text-hutan-950")}>{value}</p>
      {sub && <p className={cn("text-xs leading-relaxed", glass ? "text-white/55" : "text-stone-500")}>{sub}</p>}
    </div>
  );
}

export function EmptyState({ title, children, icon: Icon }: { title: string; children?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-krem-300 bg-white/60 px-6 py-10 text-center">
      {Icon && <IconBubble icon={Icon} tone="gold" />}
      <p className="font-display text-lg font-semibold text-hutan-950">{title}</p>
      {children && <div className="max-w-md text-sm text-stone-600">{children}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-krem-200/70", className)} aria-hidden />;
}

/** Baris "memuat" kecil dengan teks. */
export function Loading({ children = "Memuat data…" }: { children?: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-sm text-stone-500">
      <Spinner /> {children}
    </p>
  );
}
