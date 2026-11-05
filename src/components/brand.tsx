import Link from "next/link";
import { cn, initials, LANGUAGE_NATIVE, LANGUAGE_SHORT } from "@/lib/utils";
import type { AgentColor, AgentState, Language, RiskLevel } from "@/lib/types";
import { Badge } from "./ui";

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <Link href="/" className="group flex items-center gap-2.5">
      <span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-[10px] bg-accent text-accent-ink shadow-[0_0_28px_-8px_rgba(201,247,111,0.7)]">
        <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" aria-hidden>
          <path
            d="M3 12h2.4l1.7-6.2L10.4 18l2.5-9.4 1.7 6.2h2.2l1.5-3.8H21"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {!compact ? (
        <span className="text-[17px] font-semibold tracking-[-0.045em] text-ink">
          relay<span className="text-accent">.</span>
        </span>
      ) : null}
    </Link>
  );
}

const avatarColors: Record<AgentColor, string> = {
  lime: "from-[#ddff96] via-[#b9e85a] to-[#6b9528] text-[#121706]",
  cyan: "from-[#a8f5ff] via-[#66d8e8] to-[#257b87] text-[#031619]",
  violet: "from-[#d8ccff] via-[#b6a4ff] to-[#6f59b8] text-[#0f0a24]",
  amber: "from-[#ffe0a8] via-[#ffc36b] to-[#bd7922] text-[#1b1102]",
};

export function AgentAvatar({
  name,
  color = "lime",
  size = "md",
  status,
  className,
}: {
  name: string;
  color?: AgentColor;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  status?: "active" | "draft" | "paused";
  className?: string;
}) {
  const sizes = {
    xs: "h-6 w-6 text-[9px]",
    sm: "h-8 w-8 text-[10px]",
    md: "h-10 w-10 text-[12px]",
    lg: "h-14 w-14 text-[16px]",
    xl: "h-20 w-20 text-[22px]",
  };
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full bg-gradient-to-br font-semibold tracking-[-0.02em] ring-1 ring-white/15",
          avatarColors[color],
          sizes[size],
        )}
      >
        {initials(name)}
      </span>
      {status ? (
        <span
          className={cn(
            "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-bg",
            status === "active" && "bg-green",
            status === "draft" && "bg-amber",
            status === "paused" && "bg-muted-2",
          )}
        />
      ) : null}
    </span>
  );
}

export function LanguageTag({
  language,
  variant = "default",
}: {
  language: Language;
  variant?: "default" | "native" | "compact";
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white/[0.035] px-1.5 py-0.5 text-[10px] font-medium text-muted"
      title={LANGUAGE_NATIVE[language]}
    >
      <span className="font-mono text-[9px] text-accent">{LANGUAGE_SHORT[language]}</span>
      {variant === "default" ? <span>{LANGUAGE_NATIVE[language]}</span> : null}
      {variant === "native" ? <span>{LANGUAGE_NATIVE[language]}</span> : null}
    </span>
  );
}

export function LanguageStack({ languages }: { languages: Language[] }) {
  return (
    <span className="inline-flex items-center -space-x-1">
      {languages.map((language) => (
        <span
          key={language}
          title={LANGUAGE_NATIVE[language]}
          className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-line bg-surface-2 px-1 font-mono text-[8.5px] font-semibold text-muted"
        >
          {LANGUAGE_SHORT[language]}
        </span>
      ))}
    </span>
  );
}

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  if (risk === "high") return <Badge tone="red" dot>High risk</Badge>;
  if (risk === "medium") return <Badge tone="amber" dot>Medium risk</Badge>;
  return <Badge tone="green" dot>Low risk</Badge>;
}

export function AgentStateBadge({ state }: { state: AgentState }) {
  const labels: Record<AgentState, { label: string; tone: "accent" | "cyan" | "amber" | "neutral" | "violet" }> = {
    listening: { label: "Listening", tone: "cyan" },
    thinking: { label: "Thinking", tone: "violet" },
    speaking: { label: "Speaking", tone: "accent" },
    assistive: { label: "Assistive", tone: "amber" },
    muted: { label: "Muted", tone: "neutral" },
  };
  const item = labels[state];
  return <Badge tone={item.tone} dot>{item.label}</Badge>;
}

export function LivePill({ label = "Live" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-red/25 bg-red/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-red">
      <span className="live-dot h-1.5 w-1.5 rounded-full bg-red" />
      {label}
    </span>
  );
}

export function ChannelMark({ channel }: { channel: "web" | "phone" | "sip" }) {
  const labels = { web: "Web call", phone: "Phone", sip: "SIP" };
  return (
    <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-2">
      {labels[channel]}
    </span>
  );
}
