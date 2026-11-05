"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Bot,
  CheckCircle2,
  FlaskConical,
  Layers,
  Plus,
  Sparkles,
  Wrench,
} from "lucide-react";
import { useAgents, newAgentTemplate, saveAgent } from "@/lib/agent-store";
import { useAllSessions } from "@/lib/live-store";
import { computeAgentPerformance } from "@/lib/analytics";
import type { Agent } from "@/lib/types";
import { formatRelative } from "@/lib/utils";
import { AgentAvatar, LanguageStack } from "@/components/brand";
import { PageHeader } from "@/components/dashboard";
import { Badge, Button, Panel, Tabs } from "@/components/ui";

function statusTone(status: Agent["status"]) {
  if (status === "active") return "green" as const;
  if (status === "draft") return "amber" as const;
  return "neutral" as const;
}

function AgentCard({
  agent,
  sessions,
  containment,
  csat,
}: {
  agent: Agent;
  sessions: number;
  containment: number;
  csat: number;
}) {
  return (
    <Panel className="group relative flex flex-col overflow-hidden p-4 transition-colors hover:border-line-strong">
      <div className="flex items-start gap-3">
        <AgentAvatar name={agent.name} color={agent.color} size="lg" status={agent.status} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[15px] font-medium tracking-[-0.015em] text-ink">
              {agent.name}
            </h3>
            <Badge tone={statusTone(agent.status)} dot>
              {agent.status}
            </Badge>
          </div>
          <p className="mt-0.5 truncate text-[11.5px] text-muted">{agent.role}</p>
          <div className="mt-2 flex items-center gap-2">
            <LanguageStack languages={agent.languages} />
            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-2">
              {agent.tools.length} tools
            </span>
          </div>
        </div>
        <Link
          href={`/agents/${agent.id}`}
          className="rounded-lg p-1 text-muted-2 opacity-0 transition-all hover:bg-white/[0.06] hover:text-ink group-hover:opacity-100"
          aria-label="Open agent builder"
        >
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <p className="mt-3 line-clamp-2 text-[11.5px] leading-relaxed text-muted">
        {agent.description || "No description yet. Add a purpose and persona in the builder."}
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-line bg-white/[0.018] p-2.5">
        <div>
          <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-2">Sessions</p>
          <p className="mt-0.5 text-[13px] font-medium text-ink">
            {sessions > 0 ? sessions.toLocaleString() : "—"}
          </p>
        </div>
        <div>
          <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-2">Contained</p>
          <p className="mt-0.5 text-[13px] font-medium text-accent">
            {sessions > 0 ? `${containment.toFixed(0)}%` : "—"}
          </p>
        </div>
        <div>
          <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-2">CSAT</p>
          <p className="mt-0.5 text-[13px] font-medium text-ink">
            {csat > 0 ? csat.toFixed(1) : "—"}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
        <div className="flex items-center gap-2 font-mono text-[9px] text-muted-2">
          <span>v{agent.version}</span>
          <span className="text-line-strong">·</span>
          <span>updated {formatRelative(agent.updatedAt)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Link href={`/agents/${agent.id}/sandbox`}>
            <Button variant="ghost" size="sm">
              <FlaskConical className="h-3 w-3" />
              Sandbox
            </Button>
          </Link>
          <Link href={`/agents/${agent.id}`}>
            <Button variant={agent.status === "draft" ? "primary" : "secondary"} size="sm">
              {agent.status === "draft" ? "Finish setup" : "Builder"}
            </Button>
          </Link>
        </div>
      </div>
    </Panel>
  );
}

export default function AgentsPage() {
  const agents = useAgents();
  const sessions = useAllSessions();
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "active" | "draft">("all");

  const performance = useMemo(() => computeAgentPerformance(sessions), [sessions]);
  const perfById = useMemo(
    () => new Map(performance.map((item) => [item.agent.id, item])),
    [performance],
  );

  const filtered = agents.filter((agent) => {
    if (filter === "all") return true;
    return agent.status === filter;
  });

  const activeCount = agents.filter((agent) => agent.status === "active").length;
  const draftCount = agents.filter((agent) => agent.status === "draft").length;
  const totalLanguages = new Set(agents.flatMap((agent) => agent.languages)).size;

  const createAgent = () => {
    const agent = newAgentTemplate();
    saveAgent(agent);
    router.push(`/agents/${agent.id}`);
  };

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 lg:px-7 lg:py-8">
      <PageHeader
        eyebrow="Agent fleet"
        title={
          <>
            Build the team that <span className="font-serif italic text-accent">never sleeps</span>.
          </>
        }
        description="Each agent has a purpose, persona, language set, knowledge, tools, and an escalation policy. Test in the sandbox before it ever talks to a customer."
        actions={
          <Button variant="primary" onClick={createAgent}>
            <Plus className="h-3.5 w-3.5" />
            New agent
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Panel className="p-3.5">
          <div className="flex items-center gap-2 text-muted-2">
            <Bot className="h-3.5 w-3.5" />
            <span className="font-mono text-[9px] uppercase tracking-[0.14em]">Active</span>
          </div>
          <p className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-ink">{activeCount}</p>
          <p className="text-[10px] text-muted-2">agents in production</p>
        </Panel>
        <Panel className="p-3.5">
          <div className="flex items-center gap-2 text-muted-2">
            <Layers className="h-3.5 w-3.5" />
            <span className="font-mono text-[9px] uppercase tracking-[0.14em]">Languages</span>
          </div>
          <p className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-ink">{totalLanguages}</p>
          <p className="text-[10px] text-muted-2">English · Urdu · Hindi</p>
        </Panel>
        <Panel className="p-3.5">
          <div className="flex items-center gap-2 text-muted-2">
            <Sparkles className="h-3.5 w-3.5" />
            <span className="font-mono text-[9px] uppercase tracking-[0.14em]">Drafts</span>
          </div>
          <p className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-ink">{draftCount}</p>
          <p className="text-[10px] text-muted-2">waiting on a sandbox run</p>
        </Panel>
        <Panel className="p-3.5">
          <div className="flex items-center gap-2 text-muted-2">
            <Wrench className="h-3.5 w-3.5" />
            <span className="font-mono text-[9px] uppercase tracking-[0.14em]">Tools</span>
          </div>
          <p className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-ink">5</p>
          <p className="text-[10px] text-muted-2">mock integrations available</p>
        </Panel>
      </div>

      <div className="mt-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <Tabs
          items={[
            { id: "all", label: `All agents · ${agents.length}` },
            { id: "active", label: `Active · ${activeCount}` },
            { id: "draft", label: `Drafts · ${draftCount}` },
          ]}
          value={filter}
          onChange={setFilter}
        />
        <div className="flex items-center gap-2 text-[10.5px] text-muted-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-green" />
          Sandbox-first · no production tools connected
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {filtered.map((agent) => {
          const stats = perfById.get(agent.id);
          return (
            <AgentCard
              key={agent.id}
              agent={agent}
              sessions={stats?.sessions ?? agent.stats.sessions}
              containment={stats?.containment ?? agent.stats.containment}
              csat={stats?.csat ?? agent.stats.csat}
            />
          );
        })}

        {filter !== "draft" ? (
          <button
            type="button"
            onClick={createAgent}
            className="group flex min-h-[250px] flex-col items-center justify-center rounded-[18px] border border-dashed border-line-strong bg-white/[0.012] p-6 text-center transition-colors hover:border-accent/30 hover:bg-accent/[0.025]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line bg-white/[0.035] text-muted transition-colors group-hover:border-accent/25 group-hover:text-accent">
              <Plus className="h-5 w-5" />
            </span>
            <span className="mt-3 text-[13px] font-medium text-ink">Create a new agent</span>
            <span className="mt-1 max-w-[220px] text-[11px] leading-relaxed text-muted">
              Start from a blank persona, or duplicate an existing agent to keep the escalation policy.
            </span>
          </button>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white/[0.015] px-4 py-3">
        <div className="flex items-center gap-2 text-[10.5px] text-muted-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-accent/70" />
          Changes are saved locally in mock mode. Real agent versions will deploy through LiveKit dispatch.
        </div>
        <Badge tone="outline">Human transfer enabled</Badge>
      </div>
    </div>
  );
}
