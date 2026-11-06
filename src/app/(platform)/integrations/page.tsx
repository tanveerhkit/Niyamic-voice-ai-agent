"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  BrainCircuit,
  Cpu,
  Database,
  KeyRound,
  PhoneCall,
  Radio,
  Webhook,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard";
import { Badge, Panel } from "@/components/ui";
import { cn } from "@/lib/utils";

type IntegrationStatus = "connected" | "setup_required" | "not_configured";

type Integration = {
  id: string;
  name: string;
  vendor: string;
  description: string;
  icon: React.ReactNode;
  status: IntegrationStatus;
  tone: "accent" | "cyan" | "violet" | "amber";
  detail: string;
  env: string[];
  capabilities: string[];
};

const INTEGRATIONS: Integration[] = [
  {
    id: "livekit",
    name: "LiveKit",
    vendor: "Realtime transport",
    description: "WebRTC rooms, agent dispatch, and supervisor join for live calls.",
    icon: <Radio className="h-4 w-4" />,
    status: "setup_required",
    tone: "accent",
    detail: "API credentials required",
    env: ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"],
    capabilities: ["Room per session", "Agent dispatch", "Supervisor join", "Room composite recording"],
  },
  {
    id: "azure-speech",
    name: "Azure Speech",
    vendor: "STT + TTS",
    description: "Streaming speech-to-text and neural voices for English, Urdu, and Hindi.",
    icon: <Cpu className="h-4 w-4" />,
    status: "setup_required",
    tone: "cyan",
    detail: "API key and region required",
    env: ["AZURE_SPEECH_KEY", "AZURE_SPEECH_REGION"],
    capabilities: ["Continuous STT", "Language ID", "Neural TTS", "Barge-in support"],
  },
  {
    id: "azure-openai",
    name: "Azure OpenAI",
    vendor: "Reasoning",
    description: "Turn reasoning, tool calling, escalation decisions, and post-call summaries.",
    icon: <BrainCircuit className="h-4 w-4" />,
    status: "setup_required",
    tone: "violet",
    detail: "Endpoint, API key, and deployment required",
    env: ["AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY", "AZURE_OPENAI_DEPLOYMENT"],
    capabilities: ["Tool calling", "Confidence scoring", "Summaries", "Policy checks"],
  },
  {
    id: "crm",
    name: "CRM",
    vendor: "Customer records",
    description: "Customer history before the greeting and a structured note after the call.",
    icon: <Database className="h-4 w-4" />,
    status: "connected",
    tone: "accent",
    detail: "Order lookup, CRM notes, and callback scheduling",
    env: ["CRM_BASE_URL", "CRM_API_TOKEN"],
    capabilities: ["Order lookup", "CRM note", "Callback scheduling"],
  },
  {
    id: "sip",
    name: "SIP trunk",
    vendor: "Telephony",
    description: "Inbound and outbound phone numbers routed into call rooms.",
    icon: <PhoneCall className="h-4 w-4" />,
    status: "not_configured",
    tone: "amber",
    detail: "No phone numbers provisioned",
    env: ["SIP_TRUNK_URI", "SIP_USERNAME", "SIP_PASSWORD"],
    capabilities: ["Inbound numbers", "Outbound dialing", "Number porting"],
  },
  {
    id: "webhooks",
    name: "Webhooks",
    vendor: "Event delivery",
    description:
      "Send session.created, handoff.requested, handoff.accepted, and session.completed events to your systems.",
    icon: <Webhook className="h-4 w-4" />,
    status: "not_configured",
    tone: "cyan",
    detail: "No endpoints registered",
    env: ["WEBHOOK_SECRET"],
    capabilities: ["Session events", "Handoff events", "Signed payloads"],
  },
];

const STATUS_COPY: Record<IntegrationStatus, { label: string; tone: "green" | "amber" | "neutral" }> = {
  connected: { label: "Connected", tone: "green" },
  setup_required: { label: "Setup required", tone: "amber" },
  not_configured: { label: "Not configured", tone: "neutral" },
};

const toneClasses = {
  accent: "border-accent/25 bg-accent/[0.08] text-accent",
  cyan: "border-cyan/25 bg-cyan/[0.08] text-cyan",
  violet: "border-violet/25 bg-violet/[0.08] text-violet",
  amber: "border-amber/25 bg-amber/[0.08] text-amber",
};

function IntegrationCard({ integration }: { integration: Integration }) {
  const [expanded, setExpanded] = useState(false);
  const status = STATUS_COPY[integration.status];

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
            <Badge tone={status.tone} dot>
              {status.label}
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
          <p className="font-mono text-[9px] leading-relaxed text-muted-2">{integration.detail}</p>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="flex shrink-0 items-center gap-1 text-[10px] font-medium text-muted transition-colors hover:text-ink"
          >
            {expanded ? "Hide keys" : "Configure"}
            <ArrowUpRight className={cn("h-2.5 w-2.5 transition-transform", expanded && "rotate-90")} />
          </button>
        </div>

        {expanded ? (
          <div className="mt-2 space-y-1 rounded-xl border border-line bg-surface-2 p-2.5">
            {integration.env.map((key) => (
              <div key={key} className="flex items-center gap-1.5 font-mono text-[9px] text-muted-2">
                <KeyRound className="h-2.5 w-2.5 shrink-0 text-accent/60" />
                {key}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

export default function IntegrationsPage() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 lg:px-7 lg:py-8">
      <PageHeader title="Integrations" />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {INTEGRATIONS.map((integration) => (
          <IntegrationCard key={integration.id} integration={integration} />
        ))}
      </div>
    </div>
  );
}
