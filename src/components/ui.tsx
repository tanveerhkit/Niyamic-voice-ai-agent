"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "subtle";
type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-ink border border-accent hover:bg-[#3a332f] hover:border-[#3a332f]",
  secondary:
    "bg-surface text-ink border border-line hover:bg-surface-2 hover:border-line-strong",
  ghost: "text-muted border border-transparent hover:text-ink hover:bg-surface-2",
  danger: "bg-red/[0.06] text-red border border-red/30 hover:bg-red/10 hover:border-red/50",
  outline:
    "bg-transparent text-ink border border-line-strong hover:border-ink hover:bg-ink hover:text-accent-ink",
  subtle: "bg-surface-2 text-ink border border-line hover:bg-surface-3",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[9.5px] gap-1.5",
  md: "h-9 px-4 text-[10px] gap-2",
  lg: "h-11 px-6 text-[10.5px] gap-2",
  icon: "h-9 w-9",
  "icon-sm": "h-8 w-8",
};

export function buttonStyles(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
  className?: string,
) {
  return cn(
    "inline-flex select-none items-center justify-center rounded-none font-mono font-medium uppercase tracking-[0.14em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-40 whitespace-nowrap",
    buttonVariants[variant],
    buttonSizes[size],
    className,
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant = "secondary", size = "md", className, ...props }: ButtonProps) {
  return <button className={buttonStyles(variant, size, className)} {...props} />;
}

/* ------------------------------------------------------------------ */
/* Badge                                                               */
/* ------------------------------------------------------------------ */

type BadgeTone =
  | "neutral"
  | "accent"
  | "green"
  | "amber"
  | "red"
  | "cyan"
  | "violet"
  | "outline"
  | "human";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-muted border-line",
  accent: "bg-accent text-accent-ink border-accent",
  green: "bg-green/[0.06] text-green border-green/30",
  amber: "bg-amber/[0.07] text-amber border-amber/30",
  red: "bg-red/[0.06] text-red border-red/30",
  cyan: "bg-cyan/[0.06] text-cyan border-cyan/30",
  violet: "bg-violet/[0.06] text-violet border-violet/30",
  outline: "bg-transparent text-ink/65 border-line-strong",
  human: "bg-cyan/[0.06] text-cyan border-cyan/30",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
}

export function Badge({ tone = "neutral", dot, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-none border px-2 py-1 font-mono text-[9px] font-medium uppercase leading-none tracking-[0.13em]",
        badgeTones[tone],
        className,
      )}
      {...props}
    >
      {dot ? <span className="h-1 w-1 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Surfaces                                                           */
/* ------------------------------------------------------------------ */

export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("panel", className)} {...props} />;
}

export function Eyebrow({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("eyebrow", className)} {...props} />
  );
}

export function SectionTitle({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div>
        <h2 className="font-display text-[17px] font-normal leading-snug tracking-[-0.02em] text-ink">
          {title}
        </h2>
        {description ? <p className="mt-1 text-[12px] leading-relaxed text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Form controls                                                      */
/* ------------------------------------------------------------------ */

const fieldBase =
  "w-full rounded-none border border-line bg-white px-3.5 text-[13px] text-ink placeholder:text-muted-2 transition-colors focus:border-ink focus:outline-none focus:ring-0 disabled:opacity-50";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, "h-10", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, "min-h-24 resize-y py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(fieldBase, "h-10 appearance-none pr-9 [&>option]:bg-surface-2", className)}
        {...props}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function Label({
  className,
  children,
  hint,
  htmlFor,
}: {
  className?: string;
  children: React.ReactNode;
  hint?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("mb-2 flex items-baseline justify-between gap-3", className)}>
      <label htmlFor={htmlFor} className="font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-muted">
        {children}
      </label>
      {hint ? <span className="font-mono text-[9px] text-muted-2">{hint}</span> : null}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label hint={hint}>{label}</Label>
      {children}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      {label ? (
        <div>
          <p className="text-[13px] font-medium text-ink">{label}</p>
          {description ? <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">{description}</p> : null}
        </div>
      ) : null}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-[20px] w-[36px] shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20 disabled:opacity-40",
          checked ? "border-accent bg-accent" : "border-line-strong bg-surface-3",
        )}
      >
        <span
          className={cn(
            "absolute top-1/2 h-[14px] w-[14px] -translate-y-1/2 rounded-full transition-all",
            checked ? "left-[18px] bg-accent-ink" : "left-[2px] bg-white",
          )}
        />
      </button>
    </div>
  );
}

export function Range({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">{label}</span>
        <span className="font-mono text-[10px] text-ink">{display}</span>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tabs                                                               */
/* ------------------------------------------------------------------ */

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: Array<{ id: T; label: string; icon?: React.ReactNode }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-0 border border-line bg-surface p-1", className)}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-none px-3 py-1.5 font-mono text-[9.5px] font-medium uppercase tracking-[0.12em] transition-colors",
            value === item.id
              ? "bg-accent text-accent-ink"
              : "text-muted hover:bg-surface-2 hover:text-ink",
          )}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Progress                                                           */
/* ------------------------------------------------------------------ */

export function Progress({
  value,
  tone = "accent",
  className,
}: {
  value: number;
  tone?: "accent" | "cyan" | "amber" | "red" | "green" | "violet";
  className?: string;
}) {
  const tones = {
    accent: "bg-accent",
    cyan: "bg-cyan",
    amber: "bg-amber",
    red: "bg-red",
    green: "bg-green",
    violet: "bg-violet",
  };
  return (
    <div className={cn("h-[3px] w-full overflow-hidden rounded-none bg-ink/10", className)}>
      <div
        className={cn("h-full rounded-none transition-[width] duration-500", tones[tone])}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modal                                                              */
/* ------------------------------------------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const [mounted] = React.useState(() => typeof document !== "undefined");

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const widths = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl" };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        className="absolute inset-0 bg-[#221e1c]/35 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
        className={cn("panel-raised relative z-10 w-full overflow-hidden", widths[size])}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <p className="eyebrow mb-1.5">Niyamic Echo</p>
            <h2 className="font-display text-[22px] font-normal leading-tight tracking-[-0.02em] text-ink">{title}</h2>
            {description ? <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-none p-1 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children ? <div className="px-5 py-4">{children}</div> : null}
        {footer ? <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-2 px-5 py-3.5">{footer}</div> : null}
      </motion.div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Misc                                                               */
/* ------------------------------------------------------------------ */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-none border border-line bg-surface-2 text-muted">
          {icon}
        </div>
      ) : null}
      <h3 className="font-display text-[18px] font-normal tracking-[-0.02em] text-ink">{title}</h3>
      <p className="mt-1.5 max-w-sm text-[12px] leading-relaxed text-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-none border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[9px] text-muted">
      {children}
    </kbd>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-line", className)} />;
}

export function Dot({ tone = "green", pulse }: { tone?: "green" | "red" | "amber" | "muted"; pulse?: boolean }) {
  const tones = { green: "bg-green", red: "bg-red", amber: "bg-amber", muted: "bg-muted-2" };
  return (
    <span className="relative flex h-2 w-2">
      {pulse ? <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-50", tones[tone])} /> : null}
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", tones[tone])} />
    </span>
  );
}
