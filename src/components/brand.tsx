import Link from "next/link";
import { cn, initials, LANGUAGE_NATIVE, LANGUAGE_SHORT } from "@/lib/utils";
import type { AgentColor, AgentState, Language, RiskLevel } from "@/lib/types";
import { Badge } from "./ui";

export function Wordmark({
  tone = "ink",
  size = "md",
}: {
  tone?: "ink" | "light";
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "text-[15px]",
    md: "text-[19px]",
    lg: "text-[26px]",
  };
  return (
    <span
      className={cn(
        "inline-flex select-none items-baseline gap-[0.28em] whitespace-nowrap font-sans leading-none",
        sizes[size],
      )}
    >
      <span
        className={cn(
          "font-bold tracking-[-0.055em]",
          tone === "light" ? "text-[#f8f7f6]" : "text-ink",
        )}
      >
        Niyamic
      </span>
      <span
        className={cn(
          "font-light tracking-[-0.025em]",
          tone === "light" ? "text-[#f8f7f6]/70" : "text-ink/65",
        )}
      >
        Echo
      </span>
    </span>
  );
}

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <Link href="/" className="group inline-flex items-center" aria-label="Niyamic Echo">
      <Wordmark size={compact ? "sm" : "md"} />
    </Link>
  );
}

const avatarColors: Record<AgentColor, string> = {
  lime: "from-[#efece7] via-[#ded8cf] to-[#c6bcb0] text-[#221e1c]",
  cyan: "from-[#e3e9e6] via-[#c8d6d0] to-[#a6bab2] text-[#1f2a27]",
  violet: "from-[#eae4ee] via-[#d6cadd] to-[#bba9c6] text-[#2b2233]",
  amber: "from-[#f1e6d8] via-[#e4cdb2] to-[#cdae8a] text-[#33271a]",
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
          "inline-flex items-center justify-center rounded-full bg-gradient-to-br font-medium tracking-[-0.02em] ring-1 ring-ink/10",
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
      className="inline-flex items-center gap-1.5 rounded-none border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-muted"
      title={LANGUAGE_NATIVE[language]}
    >
      <span className="font-mono text-[9px] font-medium text-ink">{LANGUAGE_SHORT[language]}</span>
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
    <span className="inline-flex items-center gap-1.5 rounded-none border border-red/30 bg-red/[0.06] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-red">
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
