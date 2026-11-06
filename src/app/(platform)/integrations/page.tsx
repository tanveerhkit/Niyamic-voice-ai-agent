"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  AudioLines,
  BrainCircuit,
  Database,
  KeyRound,
  Mic,
  PhoneCall,
  Radio,
  RefreshCw,
  Webhook,
} from "lucide-react";
import { VOICE_API_URL, useVoiceHealth, type VoiceHealth } from "@/lib/voice-api";
import { PageHeader } from "@/components/dashboard";
import { Badge, Button, Panel } from "@/components/ui";
import { cn } from "@/lib/utils";

type IntegrationStatus = "connected" | "setup_required" | "not_configured" | "unknown";

type Integration = {
  id: string;
  name: string;
  vendor: string;
  description: string;
  icon: React.ReactNode;
  tone: "accent" | "cyan" | "violet" | "amber";
  env: string[];
  capabilities: string[];
  href?: string;
  status: (health: VoiceHealth) => { status: IntegrationStatus; detail: string };
};

function provider(key: keyof VoiceHealth["voice"]["providers"], missing: string) {
  return (health: VoiceHealth) => {
    const item = health.voice.providers[key];
    return item.configured
      ? { status: "connected" as const, detail: item.detail ?? "Configured" }
      : { status: "setup_required" as const, detail: missing };
  };
}

const INTEGRATIONS: Integration[] = [
  {
    id: "livekit",
    name: "LiveKit",
    vendor: "Realtime transport",
    description: "WebRTC rooms, audio streaming, and agent dispatch for every call.",
    icon: <Radio className="h-4 w-4" />,
    tone: "accent",
    env: ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"],
    capabilities: ["Room per call", "Agent dispatch", "Live transcript stream"],
    status: provider("livekit", "URL, API key, and secret required"),
  },
  {
    id: "azure-openai",
    name: "Azure OpenAI",
    vendor: "Reasoning",
    description: "Generates replies and decides when to look up customer data.",
    icon: <BrainCircuit className="h-4 w-4" />,
    tone: "violet",
    env: ["AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY", "AZURE_OPENAI_DEPLOYMENT", "AZURE_OPENAI_API_VERSION"],
    capabilities: ["Tool calling", "Grounded answers", "Streaming"],
    status: provider("azureOpenAI", "Endpoint, API key, and deployment required"),
  },
  {
    id: "deepgram",
    name: "Deepgram",
    vendor: "Speech-to-text",
    description: "Streams the caller's speech into text with low latency.",
    icon: <Mic className="h-4 w-4" />,
    tone: "cyan",
    env: ["DEEPGRAM_API_KEY", "DEEPGRAM_MODEL", "DEEPGRAM_LANGUAGE"],
    capabilities: ["Streaming STT", "Interim results", "Smart formatting"],
    status: provider("deepgram", "API key required"),
  },
  {
    id: "smallest-ai",
    name: "Smallest AI",
    vendor: "Text-to-speech",
    description: "Turns the agent's replies into natural speech.",
    icon: <AudioLines className="h-4 w-4" />,
    tone: "amber",
    env: ["SMALLEST_API_KEY", "SMALLEST_VOICE_ID", "SMALLEST_MODEL"],
    capabilities: ["Streaming TTS", "Neural voices"],
    status: provider("smallestAI", "API key required"),
  },
  {
    id: "data",
    name: "Customer data",
    vendor: "Uploaded files",
    description: "Excel and PDF files the agent searches for order, payment, and policy answers.",
    icon: <Database className="h-4 w-4" />,
    tone: "accent",
    env: [],
    capabilities: ["Exact order lookup", "Document search"],
    href: "/data",
    status: (health) =>
      health.data.ready
        ? {
            status: "connected",
            detail: `${health.data.ready} file${health.data.ready === 1 ? "" : "s"} · ${health.data.records.toLocaleString()} rows · ${health.data.chunks} passages`,
          }
        : { status: "not_configured", detail: "No files uploaded" },
  },
  {
    id: "sip",
    name: "SIP trunk",
    vendor: "Telephony",
    description: "Inbound and outbound phone numbers routed into call rooms.",
    icon: <PhoneCall className="h-4 w-4" />,
    tone: "amber",
    env: ["SIP_TRUNK_URI", "SIP_USERNAME", "SIP_PASSWORD"],
    capabilities: ["Inbound numbers", "Outbound dialing"],
    status: () => ({ status: "not_configured", detail: "No phone numbers provisioned" }),
  },
  {
    id: "webhooks",
    name: "Webhooks",
    vendor: "Event delivery",
    description: "Send session and handoff events to your own systems.",
    icon: <Webhook className="h-4 w-4" />,
    tone: "cyan",
    env: ["WEBHOOK_SECRET"],
    capabilities: ["Session events", "Signed payloads"],
    status: () => ({ status: "not_configured", detail: "No endpoints registered" }),
  },
];

const STATUS_COPY: Record<IntegrationStatus, { label: string; tone: "green" | "amber" | "neutral" | "red" }> = {
  connected: { label: "Connected", tone: "green" },
  setup_required: { label: "Setup required", tone: "amber" },
  not_configured: { label: "Not configured", tone: "neutral" },
  unknown: { label: "Unavailable", tone: "red" },
};

function formatSkew(seconds: number) {
  const minutes = Math.round(Math.abs(seconds) / 60);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

const toneClasses = {
  accent: "border-accent/25 bg-accent/[0.08] text-accent",
  cyan: "border-cyan/25 bg-cyan/[0.08] text-cyan",
  violet: "border-violet/25 bg-violet/[0.08] text-violet",
  amber: "border-amber/25 bg-amber/[0.08] text-amber",
};

function IntegrationCard({
  integration,
  health,
}: {
  integration: Integration;
  health: VoiceHealth | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const { status, detail } = health
    ? integration.status(health)
    : { status: "unknown" as const, detail: "Backend not reachable" };
  const copy = STATUS_COPY[status];

  return (
    <Panel className="flex flex-col p-4 transition-colors hover:border-line-strong">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
            toneClasses[integration.tone],
          )}
        >
          {integration.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-[17px] font-normal tracking-[-0.01em] text-ink">{integration.name}</h3>
            <Badge tone={copy.tone} dot>
              {copy.label}
            </Badge>
          </div>
          <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-2">
            {integration.vendor}
          </p>
        </div>
      </div>

      <p className="mt-3 text-[11.5px] leading-relaxed text-muted">{integration.description}</p>

      <div className="mt-3 flex flex-wrap gap-1">
        {integration.capabilities.map((capability) => (
          <span
            key={capability}
            className="rounded-md border border-line bg-surface px-1.5 py-0.5 text-[9px] text-muted-2"
          >
            {capability}
          </span>
        ))}
      </div>

      <div className="mt-auto pt-3">
        <div className="flex items-center justify-between gap-3 border-t border-line pt-2.5">
          <p className="truncate font-mono text-[9px] leading-relaxed text-muted-2">{detail}</p>
          {integration.href ? (
            <Link
              href={integration.href}
              className="flex shrink-0 items-center gap-1 text-[10px] font-medium text-muted transition-colors hover:text-ink"
            >
              Manage
              <ArrowUpRight className="h-2.5 w-2.5" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="flex shrink-0 items-center gap-1 text-[10px] font-medium text-muted transition-colors hover:text-ink"
            >
              {expanded ? "Hide keys" : "Configure"}
              <ArrowUpRight className={cn("h-2.5 w-2.5 transition-transform", expanded && "rotate-90")} />
            </button>
          )}
        </div>

        {expanded ? (
          <div className="mt-2 space-y-1 rounded-xl border border-line bg-surface-2 p-2.5">
            {integration.env.map((key) => (
              <div key={key} className="flex items-center gap-1.5 font-mono text-[9px] text-muted-2">
                <KeyRound className="h-2.5 w-2.5 shrink-0 text-accent/60" />
                {key}
              </div>
            ))}
            <p className="pt-1 text-[9.5px] text-muted-2">Set in .env.local, then restart the backend.</p>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

export default function IntegrationsPage() {
  const { health, error, loading, refresh } = useVoiceHealth();

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 lg:px-7 lg:py-8">
      <PageHeader
        title="Integrations"
        description={
          health ? (health.voice.ready ? "Voice calling is live." : "Voice calling needs setup.") : undefined
        }
        actions={
          <Button variant="outline" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      {error ? (
        <p className="mb-4 border border-red/30 bg-red/[0.05] px-3 py-2 text-[11.5px] text-red">
          {error} Start it from the backend folder: uvicorn api:app --port 8000
        </p>
      ) : null}

      {health && Math.abs(health.clockSkewSeconds) > 120 ? (
        <p className="mb-4 border border-amber/30 bg-amber/[0.05] px-3 py-2 text-[11.5px] text-amber">
          The server&apos;s clock is {formatSkew(health.clockSkewSeconds)}{" "}
          {health.clockSkewSeconds > 0 ? "behind" : "ahead of"} LiveKit. Calls still connect because tokens
          are adjusted, but turn on automatic time sync on this machine.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {INTEGRATIONS.map((integration) => (
          <IntegrationCard key={integration.id} integration={integration} health={health} />
        ))}
      </div>

      <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-2">Backend · {VOICE_API_URL}</p>
    </div>
  );
}
