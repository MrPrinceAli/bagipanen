import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl border border-tanah-200 bg-white p-4 shadow-sm sm:p-5", className)}>{children}</div>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-lg font-semibold text-daun-900">{children}</h2>
      {action}
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  loading?: boolean;
};

export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...rest }: ButtonProps) {
  const styles = {
    primary: "bg-daun-700 text-white hover:bg-daun-800 disabled:bg-daun-300",
    secondary: "border border-daun-700 bg-white text-daun-800 hover:bg-daun-50 disabled:border-stone-300 disabled:text-stone-400",
    danger: "bg-red-700 text-white hover:bg-red-800 disabled:bg-red-300",
    ghost: "text-daun-800 hover:bg-daun-50 disabled:text-stone-400",
  }[variant];
  const sizes = size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2.5 text-sm";
  return (
    <button
      className={cn("inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed", styles, sizes, className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent", className)}
    />
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", TONES[tone])}>{children}</span>;
}

export type Tone = "neutral" | "green" | "yellow" | "red" | "brown" | "blue";
const TONES: Record<Tone, string> = {
  neutral: "bg-stone-100 text-stone-700",
  green: "bg-daun-100 text-daun-800",
  yellow: "bg-padi-100 text-padi-700",
  red: "bg-red-100 text-red-800",
  brown: "bg-tanah-100 text-tanah-700",
  blue: "bg-sky-100 text-sky-800",
};

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" | "error" | "success" }) {
  const styles = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    warn: "border-padi-500/40 bg-padi-100 text-padi-700",
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-daun-200 bg-daun-50 text-daun-800",
  }[tone];
  return <div className={cn("rounded-xl border px-3 py-2.5 text-sm", styles)}>{children}</div>;
}

export function ProgressBar({ value, max }: { value: bigint; max: bigint }) {
  const pct = max === 0n ? 0 : Math.min(100, Number((value * 10_000n) / max) / 100);
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-tanah-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-daun-600 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium text-stone-800">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-stone-500">{hint}</p>}
    </div>
  );
}

const inputBase =
  "w-full rounded-xl border border-tanah-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-daun-500 focus:ring-2 focus:ring-daun-200 focus:outline-none disabled:bg-stone-100";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputBase, props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputBase, "min-h-24", props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputBase, props.className)} />;
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-tanah-200 bg-white p-4">
      <p className="text-xs font-medium tracking-wide text-stone-500 uppercase">{label}</p>
      <p className="mt-1 text-xl font-bold text-daun-900">{value}</p>
      {sub && <p className="text-xs text-stone-500">{sub}</p>}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-tanah-200 bg-white/60 p-6 text-center">
      <p className="font-semibold text-stone-700">{title}</p>
      {children && <div className="mt-1 text-sm text-stone-500">{children}</div>}
    </div>
  );
}
