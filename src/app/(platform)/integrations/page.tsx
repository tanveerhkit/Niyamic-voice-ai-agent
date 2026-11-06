"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  Cloud,
  Cpu,
  Database,
  KeyRound,
  PhoneCall,
  Plug,
  Radio,
  Server,
  ShieldCheck,
  Sparkles,
  Webhook,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard";
import { Badge, Button, Panel, SectionTitle, Switch } from "@/components/ui";
import { cn } from "@/lib/utils";

type IntegrationStatus = "connected" | "queued" | "not_configured";

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
    description:
      "WebRTC rooms, agent dispatch, and the human takeover path. The customer and specialist share one room, so a handoff never drops audio.",
    icon: <Radio className="h-4 w-4" />,
    status: "queued",
    tone: "accent",
    detail: "Waiting on LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET",
    env: ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"],
    capabilities: ["Room per session", "Agent dispatch", "Supervisor join", "Room composite recording"],
  },
  {
    id: "azure-speech",
    name: "Azure Speech",
    vendor: "STT + TTS",
    description:
      "Streaming speech-to-text with automatic language detection for English, Urdu, and Hindi. Neural voices return audio in the same language the customer used.",
    icon: <Cpu className="h-4 w-4" />,
    status: "queued",
    tone: "cyan",
    detail: "Waiting on AZURE_SPEECH_KEY and AZURE_SPEECH_REGION",
    env: ["AZURE_SPEECH_KEY", "AZURE_SPEECH_REGION"],
    capabilities: ["Continuous STT", "Language ID", "Neural TTS", "Barge-in support"],
  },
  {
    id: "azure-openai",
    name: "Azure OpenAI",
    vendor: "Reasoning",
    description:
      "Turn-by-turn reasoning, tool selection, and escalation decisions. The mock runtime already follows the same event shape the model will produce.",
    icon: <Sparkles className="h-4 w-4" />,
    status: "queued",
    tone: "violet",
    detail: "Waiting on AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY",
    env: ["AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY", "AZURE_OPENAI_DEPLOYMENT"],
    capabilities: ["Tool calling", "Confidence scoring", "Summaries", "Policy checks"],
  },
  {
    id: "crm",
    name: "CRM",
    vendor: "Customer records",
    description:
      "Read customer history before the greeting and write a structured note after the call. Currently backed by local mock tools.",
    icon: <Database className="h-4 w-4" />,
    status: "connected",
    tone: "accent",
    detail: "Mock provider active — order lookup, CRM note, and calendar tools",
    env: ["CRM_BASE_URL", "CRM_API_TOKEN"],
    capabilities: ["Order lookup", "CRM note", "Callback scheduling"],
  },
  {
    id: "sip",
    name: "SIP trunk",
    vendor: "Telephony",
    description:
      "Inbound and outbound phone numbers routed into LiveKit rooms. Not required for the laptop demo, which runs browser calls only.",
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
      "Emit session.created, handoff.requested, handoff.accepted, and session.completed events to your own systems.",
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
  queued: { label: "Queued", tone: "amber" },
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

      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="mt-3 flex items-center gap-1 self-start text-[10px] font-medium text-muted transition-colors hover:text-ink"
      >
        {expanded ? "Hide setup" : "Setup details"}
        <ArrowUpRight className={cn("h-2.5 w-2.5 transition-transform", expanded && "rotate-90")} />
      </button>

      {expanded ? (
        <div className="mt-2 rounded-xl border border-line bg-surface-2 p-2.5">
          <p className="text-[10px] leading-relaxed text-muted">{integration.detail}</p>
          <div className="mt-2 space-y-1">
            {integration.env.map((key) => (
              <div key={key} className="flex items-center gap-1.5 font-mono text-[9px] text-muted-2">
                <KeyRound className="h-2.5 w-2.5 shrink-0 text-accent/60" />
                {key}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-3 border-t border-line pt-2.5 font-mono text-[9px] leading-relaxed text-muted-2">
          {integration.detail}
        </p>
      )}
    </Panel>
  );
}

export default function IntegrationsPage() {
  const [mockRuntime, setMockRuntime] = useState(true);
  const [sandboxTools, setSandboxTools] = useState(true);

  const counts = useMemo(
    () => ({
      connected: INTEGRATIONS.filter((item) => item.status === "connected").length,
      queued: INTEGRATIONS.filter((item) => item.status === "queued").length,
      missing: INTEGRATIONS.filter((item) => item.status === "not_configured").length,
    }),
    [],
  );

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 lg:px-7 lg:py-8">
      <PageHeader
        eyebrow="06 — Integrations · environment"
        title={
          <>
            Mock today. <span className="font-serif italic text-accent">Real audio</span> when the keys
            land.
          </>
        }
        description="The full product runs on a local mock runtime with no credentials. Each integration below swaps in behind the same event model — no screen or flow needs to change."
        actions={
          <>
            <Link href="/agents/ag_ayesha">
              <Button variant="secondary">
                <Plug className="h-3.5 w-3.5" />
                Agent config
              </Button>
            </Link>
            <Link href="/supervisor">
              <Button variant="primary">
                <PhoneCall className="h-3.5 w-3.5" />
                Test a live call
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Panel className="p-3.5">
          <div className="flex items-center gap-2 text-muted-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-green" />
            <span className="font-mono text-[9px] uppercase tracking-[0.14em]">Ready</span>
          </div>
          <p className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-green">
            {counts.connected}
          </p>
          <p className="text-[10px] text-muted-2">mock provider active</p>
        </Panel>
        <Panel className="p-3.5">
          <div className="flex items-center gap-2 text-muted-2">
            <Server className="h-3.5 w-3.5 text-amber" />
            <span className="font-mono text-[9px] uppercase tracking-[0.14em]">Queued</span>
          </div>
          <p className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-amber">{counts.queued}</p>
          <p className="text-[10px] text-muted-2">waiting on credentials</p>
        </Panel>
        <Panel className="p-3.5">
          <div className="flex items-center gap-2 text-muted-2">
            <Cloud className="h-3.5 w-3.5" />
            <span className="font-mono text-[9px] uppercase tracking-[0.14em]">Optional</span>
          </div>
          <p className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-ink">{counts.missing}</p>
          <p className="text-[10px] text-muted-2">not needed for laptop demo</p>
        </Panel>
        <Panel className="p-3.5">
          <div className="flex items-center gap-2 text-muted-2">
            <ShieldCheck className="h-3.5 w-3.5 text-accent" />
            <span className="font-mono text-[9px] uppercase tracking-[0.14em]">Mode</span>
          </div>
          <p className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-accent">Mock</p>
          <p className="text-[10px] text-muted-2">no production data touched</p>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {INTEGRATIONS.map((integration) => (
          <IntegrationCard key={integration.id} integration={integration} />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel className="p-4">
          <SectionTitle
            title="Runtime switches"
            description="These are local demo settings. They do not call any external service."
            action={<Badge tone="outline">Local only</Badge>}
          />
          <div className="mt-4 space-y-4">
            <Switch
              checked={mockRuntime}
              onChange={setMockRuntime}
              label="Mock runtime"
              description="Use the scripted call engine, localStorage session store, and BroadcastChannel handoff."
            />
            <Switch
              checked={sandboxTools}
              onChange={setSandboxTools}
              label="Sandbox tools"
              description="Tools return deterministic test data. No CRM, refund, or calendar calls leave the browser."
            />
          </div>

          <div className="mt-4 rounded-xl border border-line bg-surface-2/50 p-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-2">
              What replaces what
            </p>
            <div className="mt-2 space-y-2 text-[10.5px]">
              {[
                ["Scripted call engine", "LiveKit agent worker + Azure STT/LLM/TTS pipeline"],
                ["localStorage + BroadcastChannel", "LiveKit room state + server-side session store"],
                ["Mock order + refund tools", "Your CRM and payment provider APIs"],
                ["Seeded analytics", "Warehouse queries over real session events"],
              ].map(([now, later]) => (
                <div key={now} className="flex flex-col gap-0.5 border-b border-line pb-2 last:border-0 last:pb-0">
                  <span className="text-ink/85">{now}</span>
                  <span className="flex items-center gap-1 font-mono text-[9px] text-accent/75">
                    <ArrowUpRight className="h-2.5 w-2.5" />
                    {later}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel className="p-4">
            <SectionTitle
              title="Demo status"
              description="Everything needed for the 1-day walkthrough."
              action={<CheckCircle2 className="h-4 w-4 text-green" />}
            />
            <div className="mt-3 space-y-2">
              {[
                "Agent builder with escalation policy",
                "Sandbox chat + evaluation",
                "Live call console with transcript",
                "Cross-tab human handoff",
                "Post-call summary + recording",
                "Analytics over 1,284 sessions",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-[10.5px] text-muted">
                  <CheckCircle2 className="h-3 w-3 shrink-0 text-green" />
                  {item}
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="p-4">
            <div className="flex items-start gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-cyan/20 bg-cyan/[0.07] text-cyan">
                <Radio className="h-3.5 w-3.5" />
              </span>
              <div>
                <p className="text-[11.5px] font-medium text-ink">Real-audio path</p>
                <p className="mt-1 text-[10px] leading-relaxed text-muted">
                  A Python LiveKit agent worker joins each room, streams Azure STT into the LLM, and
                  returns Azure TTS audio. Human takeover is a participant join — the room stays alive.
                </p>
                <p className="mt-2 font-mono text-[9px] text-muted-2">
                  worker cannot run on Vercel · needs a long-lived host
                </p>
              </div>
            </div>
          </Panel>

          <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2 px-3 py-2.5">
            <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-muted-2">
              Mock runtime · v0.1
            </span>
            <Badge tone="amber" dot>
              Sandbox
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
