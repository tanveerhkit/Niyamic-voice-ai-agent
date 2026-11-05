"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  Copy,
  FlaskConical,
  Mic2,
  Plus,
  Rocket,
  Save,
  Sparkles,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import { saveAgent, useAgent } from "@/lib/agent-store";
import { TOOLS, VOICES } from "@/lib/agents";
import type { Agent, Language, ToolId } from "@/lib/types";
import { cn, formatRelative, LANGUAGE_NATIVE, LANGUAGE_SHORT } from "@/lib/utils";
import { AgentAvatar, LanguageStack } from "@/components/brand";
import { PageHeader } from "@/components/dashboard";
import {
  Badge,
  Button,
  Field,
  Input,
  Label,
  Panel,
  Progress,
  Range,
  SectionTitle,
  Select,
  Switch,
  Tabs,
  Textarea,
} from "@/components/ui";

type BuilderTab = "persona" | "voice" | "knowledge" | "tools" | "escalation";

const TONES = ["Empathetic", "Direct", "Friendly", "Consultative", "Formal", "Playful"];
const TEAMS = [
  "Tier 1 · Customer care",
  "Tier 2 · Customer care",
  "Tier 2 · Billing",
  "Account management",
  "Retention desk",
];
const LANGUAGES: Language[] = ["en", "ur", "hi"];

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-line pb-6 last:border-0 last:pb-0">
      <div className="mb-4">
        <h3 className="text-[13.5px] font-medium text-ink">{title}</h3>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Readiness({ agent }: { agent: Agent }) {
  const checks = [
    { label: "Persona & greeting", ok: agent.persona.length > 20 && agent.greeting.length > 10 },
    { label: "Languages selected", ok: agent.languages.length > 0 },
    { label: "Knowledge added", ok: agent.knowledge.trim().length > 40 },
    { label: "Tools connected", ok: agent.tools.length > 0 },
    {
      label: "Escalation policy",
      ok:
        agent.escalation.onCustomerRequest ||
        agent.escalation.onNegativeSentiment ||
        agent.escalation.onPolicyException,
    },
  ];
  const done = checks.filter((check) => check.ok).length;
  const score = Math.round((done / checks.length) * 100);

  return (
    <Panel className="p-4">
      <SectionTitle
        title="Readiness"
        description="What the sandbox will verify."
        action={<span className="font-mono text-[10px] text-accent">{score}%</span>}
      />
      <Progress value={score} className="mt-3" />
      <div className="mt-4 space-y-2.5">
        {checks.map((check) => (
          <div key={check.label} className="flex items-center gap-2.5">
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-full border",
                check.ok
                  ? "border-accent/30 bg-accent/15 text-accent"
                  : "border-line bg-white/[0.03] text-muted-2",
              )}
            >
              {check.ok ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
            </span>
            <span className={cn("text-[11.5px]", check.ok ? "text-ink/85" : "text-muted-2")}>
              {check.label}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export default function AgentBuilderPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const existing = useAgent(id);
  const router = useRouter();
  const [form, setForm] = useState<Agent | null>(existing);
  const loadedId = useRef(existing?.id);
  const [tab, setTab] = useState<BuilderTab>("persona");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [keywordDraft, setKeywordDraft] = useState("");
  const [sources, setSources] = useState([
    { name: "Refund policy.pdf", chunks: 18, status: "Indexed" },
    { name: "Billing runbook.md", chunks: 42, status: "Indexed" },
    { name: "Delivery FAQ", chunks: 27, status: "Indexed" },
  ]);

  useEffect(() => {
    if (existing && loadedId.current !== existing.id) {
      loadedId.current = existing.id;
      setForm(existing);
    }
  }, [existing]);

  const update = <K extends keyof Agent>(key: K, value: Agent[K]) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  };

  const updateEscalation = (patch: Partial<Agent["escalation"]>) => {
    setForm((current) =>
      current ? { ...current, escalation: { ...current.escalation, ...patch } } : current,
    );
  };

  const save = (status?: Agent["status"]) => {
    if (!form) return;
    const next: Agent = {
      ...form,
      status: status ?? form.status,
      version: form.version + 1,
      updatedAt: new Date().toISOString(),
    };
    setForm(next);
    saveAgent(next);
    setSavedAt(Date.now());
    window.setTimeout(() => setSavedAt(null), 2400);
  };

  const duplicate = () => {
    if (!form) return;
    const copy: Agent = {
      ...form,
      id: `ag_${Date.now().toString(36)}`,
      name: `${form.name} copy`,
      status: "draft",
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      stats: { sessions: 0, containment: 0, transferRate: 0, csat: 0, avgHandleSec: 0 },
    };
    saveAgent(copy);
    router.push(`/agents/${copy.id}`);
  };

  const readiness = useMemo(() => {
    if (!form) return 0;
    const checks = [
      form.persona.length > 20,
      form.languages.length > 0,
      form.knowledge.trim().length > 40,
      form.tools.length > 0,
      form.escalation.onCustomerRequest ||
        form.escalation.onNegativeSentiment ||
        form.escalation.onPolicyException,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [form]);

  if (!form) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-2">
          Agent not found
        </p>
        <h1 className="mt-3 text-2xl font-medium text-ink">This agent doesn&apos;t exist yet.</h1>
        <p className="mt-2 text-[13px] text-muted">
          The agent may be stored in another browser profile, or it was never created.
        </p>
        <Link href="/agents" className="mt-6 inline-block">
          <Button variant="primary">Back to agents</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 lg:px-7 lg:py-8">
      <PageHeader
        eyebrow={`Agent builder · ${form.id}`}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {form.name}
            <Badge tone={form.status === "active" ? "green" : form.status === "draft" ? "amber" : "neutral"} dot>
              {form.status}
            </Badge>
            <span className="font-mono text-[10px] font-normal tracking-normal text-muted-2">
              v{form.version}
            </span>
          </span>
        }
        description={form.role}
        actions={
          <>
            {savedAt ? (
              <span className="flex items-center gap-1.5 text-[11px] text-green">
                <Check className="h-3.5 w-3.5" /> Saved
              </span>
            ) : null}
            <Link href={`/agents/${form.id}/sandbox`}>
              <Button variant="secondary">
                <FlaskConical className="h-3.5 w-3.5" />
                Test in sandbox
              </Button>
            </Link>
            {form.status === "draft" ? (
              <Button variant="primary" onClick={() => save("active")}>
                <Rocket className="h-3.5 w-3.5" />
                Activate agent
              </Button>
            ) : (
              <Button variant="primary" onClick={() => save()}>
                <Save className="h-3.5 w-3.5" />
                Save changes
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
        <Panel className="overflow-hidden">
          <div className="flex flex-col justify-between gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
            <Tabs
              items={[
                { id: "persona", label: "Persona", icon: <UserRound className="h-3.5 w-3.5" /> },
                { id: "voice", label: "Voice", icon: <Mic2 className="h-3.5 w-3.5" /> },
                { id: "knowledge", label: "Knowledge", icon: <BookOpen className="h-3.5 w-3.5" /> },
                { id: "tools", label: "Tools", icon: <Wrench className="h-3.5 w-3.5" /> },
                { id: "escalation", label: "Escalation", icon: <ArrowUpRight className="h-3.5 w-3.5" /> },
              ]}
              value={tab}
              onChange={setTab}
            />
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-2">
              {readiness}% ready
            </span>
          </div>

          <div className="space-y-6 p-5">
            {tab === "persona" ? (
              <>
                <FormSection
                  title="Identity"
                  description="Who the customer is talking to, and how they introduce themselves."
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Agent name">
                      <Input value={form.name} onChange={(event) => update("name", event.target.value)} />
                    </Field>
                    <Field label="Role">
                      <Input value={form.role} onChange={(event) => update("role", event.target.value)} />
                    </Field>
                  </div>
                  <Field label="Purpose" hint="One sentence" className="mt-4">
                    <Textarea
                      value={form.description}
                      onChange={(event) => update("description", event.target.value)}
                      className="min-h-16"
                      placeholder="What this agent is responsible for..."
                    />
                  </Field>
                </FormSection>

                <FormSection
                  title="Personality"
                  description="Tone is a product setting — it shapes every response the model generates."
                >
                  <Label>Tone</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {TONES.map((tone) => (
                      <button
                        key={tone}
                        type="button"
                        onClick={() => update("tone", tone)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-[11.5px] transition-colors",
                          form.tone === tone
                            ? "border-accent/40 bg-accent/10 text-accent"
                            : "border-line bg-white/[0.02] text-muted hover:border-line-strong hover:text-ink",
                        )}
                      >
                        {tone}
                      </button>
                    ))}
                  </div>
                  <Field label="Persona instructions" className="mt-4">
                    <Textarea
                      value={form.persona}
                      onChange={(event) => update("persona", event.target.value)}
                      className="min-h-20"
                    />
                  </Field>
                  <Field label="Opening line" hint="Spoken first" className="mt-4">
                    <Textarea
                      value={form.greeting}
                      onChange={(event) => update("greeting", event.target.value)}
                      className="min-h-16"
                    />
                  </Field>
                </FormSection>

                <FormSection
                  title="System prompt"
                  description="The full instruction set sent to the model. Keep policies in knowledge, not here."
                >
                  <Textarea
                    value={form.systemPrompt}
                    onChange={(event) => update("systemPrompt", event.target.value)}
                    className="min-h-40 font-mono text-[11px] leading-relaxed"
                  />
                  <p className="mt-2 font-mono text-[9px] text-muted-2">
                    {form.systemPrompt.length} chars · model gpt-4.1-mini · temperature 0.4
                  </p>
                </FormSection>
              </>
            ) : null}

            {tab === "voice" ? (
              <>
                <FormSection
                  title="Languages"
                  description="The agent detects language changes mid-call and replies in kind."
                >
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {LANGUAGES.map((language) => {
                      const selected = form.languages.includes(language);
                      return (
                        <button
                          key={language}
                          type="button"
                          onClick={() =>
                            update(
                              "languages",
                              selected
                                ? form.languages.filter((item) => item !== language)
                                : [...form.languages, language],
                            )
                          }
                          className={cn(
                            "flex items-center justify-between rounded-xl border px-3 py-3 text-left transition-colors",
                            selected
                              ? "border-accent/35 bg-accent/[0.07]"
                              : "border-line bg-white/[0.02] hover:border-line-strong",
                          )}
                        >
                          <div>
                            <p className="text-[12.5px] font-medium text-ink">
                              {LANGUAGE_NATIVE[language]}
                            </p>
                            <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-2">
                              {LANGUAGE_SHORT[language]} · auto-detect
                            </p>
                          </div>
                          <span
                            className={cn(
                              "flex h-5 w-5 items-center justify-center rounded-full border",
                              selected
                                ? "border-accent/40 bg-accent text-accent-ink"
                                : "border-line-strong text-transparent",
                            )}
                          >
                            <Check className="h-3 w-3" />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </FormSection>

                <FormSection
                  title="Voice"
                  description="Azure Neural voices. Real audio will stream through LiveKit when wired."
                >
                  <div className="space-y-2">
                    {VOICES.map((voice) => {
                      const selected = form.voice === voice.id;
                      return (
                        <button
                          key={voice.id}
                          type="button"
                          onClick={() => update("voice", voice.id)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                            selected
                              ? "border-accent/35 bg-accent/[0.06]"
                              : "border-line bg-white/[0.02] hover:border-line-strong",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-full border",
                              selected
                                ? "border-accent/30 bg-accent/15 text-accent"
                                : "border-line bg-white/[0.03] text-muted-2",
                            )}
                          >
                            <Mic2 className="h-3.5 w-3.5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[12px] font-medium text-ink">
                              {voice.label}
                              <span className="ml-2 font-mono text-[9px] font-normal text-muted-2">
                                {voice.provider}
                              </span>
                            </span>
                            <span className="mt-0.5 block font-mono text-[9px] text-muted">
                              {voice.accent} · {voice.id}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "h-2 w-2 rounded-full",
                              selected ? "bg-accent" : "bg-white/15",
                            )}
                          />
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Range
                      label="Speaking rate"
                      value={1}
                      min={0.8}
                      max={1.2}
                      step={0.05}
                      display="1.0×"
                      onChange={() => undefined}
                    />
                    <Range
                      label="Interruption sensitivity"
                      value={70}
                      min={0}
                      max={100}
                      display="High"
                      onChange={() => undefined}
                    />
                  </div>

                  <div className="mt-4 flex items-center justify-between rounded-xl border border-line bg-white/[0.022] px-3 py-2.5">
                    <div>
                      <p className="text-[11.5px] font-medium text-ink">Voice preview</p>
                      <p className="mt-0.5 text-[10px] text-muted-2">
                        Mock mode — real TTS arrives with Azure keys.
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setPreviewing(true);
                        window.setTimeout(() => setPreviewing(false), 2200);
                      }}
                    >
                      {previewing ? (
                        <>
                          <span className="flex items-end gap-0.5">
                            {[3, 6, 9, 5, 8].map((height, index) => (
                              <span
                                key={index}
                                className="w-0.5 animate-pulse rounded-full bg-accent"
                                style={{ height, animationDelay: `${index * 100}ms` }}
                              />
                            ))}
                          </span>
                          Playing
                        </>
                      ) : (
                        "Play sample"
                      )}
                    </Button>
                  </div>
                </FormSection>
              </>
            ) : null}

            {tab === "knowledge" ? (
              <>
                <FormSection
                  title="Knowledge base"
                  description="Policies, runbooks, and FAQs the agent can cite. Retrieved at call time."
                >
                  <Textarea
                    value={form.knowledge}
                    onChange={(event) => update("knowledge", event.target.value)}
                    className="min-h-52 text-[12px] leading-relaxed"
                    placeholder="Paste policies, refund rules, product details..."
                  />
                  <div className="mt-2 flex items-center justify-between font-mono text-[9px] text-muted-2">
                    <span>{form.knowledge.length} characters</span>
                    <span>~{Math.ceil(form.knowledge.length / 4)} tokens</span>
                  </div>
                </FormSection>

                <FormSection
                  title="Sources"
                  description="Mock documents. In production these sync from your help center or Drive."
                >
                  <div className="space-y-2">
                    {sources.map((source) => (
                      <div
                        key={source.name}
                        className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.02] px-3 py-2.5"
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white/[0.03] text-muted">
                          <BookOpen className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11.5px] font-medium text-ink">{source.name}</p>
                          <p className="mt-0.5 font-mono text-[9px] text-muted-2">
                            {source.chunks} chunks · {source.status}
                          </p>
                        </div>
                        <span className="h-1.5 w-1.5 rounded-full bg-green" />
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() =>
                      setSources((current) => [
                        ...current,
                        {
                          name: `Support macro ${current.length + 1}.md`,
                          chunks: 6 + current.length * 3,
                          status: "Indexed",
                        },
                      ])
                    }
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add mock source
                  </Button>
                </FormSection>

                <FormSection
                  title="Retrieval"
                  description="How many chunks the agent can pull into a single response."
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Range label="Top K" value={4} min={1} max={10} display="4 chunks" onChange={() => undefined} />
                    <Range label="Minimum similarity" value={72} min={0} max={100} display="0.72" onChange={() => undefined} />
                  </div>
                </FormSection>
              </>
            ) : null}

            {tab === "tools" ? (
              <FormSection
                title="Tools"
                description="Each tool is mocked in the sandbox. Connect real systems before production."
              >
                <div className="space-y-2">
                  {TOOLS.map((tool) => {
                    const enabled = form.tools.includes(tool.id);
                    return (
                      <div
                        key={tool.id}
                        className={cn(
                          "flex items-start gap-3 rounded-xl border px-3 py-3 transition-colors",
                          enabled ? "border-accent/25 bg-accent/[0.035]" : "border-line bg-white/[0.018]",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg border",
                            enabled
                              ? "border-accent/25 bg-accent/10 text-accent"
                              : "border-line bg-white/[0.03] text-muted-2",
                          )}
                        >
                          <Wrench className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[12px] font-medium text-ink">{tool.name}</p>
                            <Badge tone="outline" className="px-1.5 py-0 text-[8.5px]">
                              Mock
                            </Badge>
                          </div>
                          <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted">
                            {tool.description}
                          </p>
                        </div>
                        <Switch
                          checked={enabled}
                          onChange={(value) =>
                            update(
                              "tools",
                              value
                                ? [...form.tools, tool.id as ToolId]
                                : form.tools.filter((item) => item !== tool.id),
                            )
                          }
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 rounded-xl border border-amber/15 bg-amber/[0.04] px-3 py-2.5">
                  <p className="text-[10.5px] leading-relaxed text-amber/90">
                    Sandbox isolation is on. Tools return test data only — no production records are
                    read or written.
                  </p>
                </div>
              </FormSection>
            ) : null}

            {tab === "escalation" ? (
              <>
                <FormSection
                  title="When to hand off"
                  description="Escalation is a policy object, evaluated on every turn."
                >
                  <div className="space-y-4">
                    <Switch
                      checked={form.escalation.onCustomerRequest}
                      onChange={(value) => updateEscalation({ onCustomerRequest: value })}
                      label="Customer asks for a human"
                      description="Phrases like 'human', 'agent', 'supervisor', or 'manager'."
                    />
                    <Switch
                      checked={form.escalation.onNegativeSentiment}
                      onChange={(value) => updateEscalation({ onNegativeSentiment: value })}
                      label="Negative sentiment"
                      description="Frustration, anger, or repeated complaints."
                    />
                    <Switch
                      checked={form.escalation.onPolicyException}
                      onChange={(value) => updateEscalation({ onPolicyException: value })}
                      label="Policy exception required"
                      description="Refunds above the AI limit, contract changes, legal requests."
                    />
                    <Switch
                      checked={form.escalation.autoTransferHighRisk}
                      onChange={(value) => updateEscalation({ autoTransferHighRisk: value })}
                      label="Auto-transfer on high risk"
                      description="Skip the offer and connect immediately when risk is high."
                    />
                  </div>
                </FormSection>

                <FormSection
                  title="Confidence threshold"
                  description="Below this score, the agent offers a human instead of guessing."
                >
                  <Range
                    label="Escalate below"
                    value={form.escalation.confidenceThreshold * 100}
                    min={30}
                    max={95}
                    step={1}
                    display={`${Math.round(form.escalation.confidenceThreshold * 100)}%`}
                    onChange={(value) => updateEscalation({ confidenceThreshold: value / 100 })}
                  />
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Max turns before escalation">
                      <Input
                        type="number"
                        min={2}
                        max={30}
                        value={form.escalation.maxTurns}
                        onChange={(event) => updateEscalation({ maxTurns: Number(event.target.value) })}
                      />
                    </Field>
                    <Field label="Transfer to">
                      <Select
                        value={form.escalation.transferTeam}
                        onChange={(event) => updateEscalation({ transferTeam: event.target.value })}
                      >
                        {TEAMS.map((team) => (
                          <option key={team} value={team}>
                            {team}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                </FormSection>

                <FormSection
                  title="Trigger keywords"
                  description="Extra phrases that should always escalate, in any supported language."
                >
                  <div className="flex flex-wrap gap-1.5">
                    {form.escalation.keywords.map((keyword) => (
                      <span
                        key={keyword}
                        className="inline-flex items-center gap-1 rounded-full border border-line bg-white/[0.035] px-2 py-1 text-[10.5px] text-muted"
                      >
                        {keyword}
                        <button
                          type="button"
                          onClick={() =>
                            updateEscalation({
                              keywords: form.escalation.keywords.filter((item) => item !== keyword),
                            })
                          }
                          className="text-muted-2 hover:text-red"
                          aria-label={`Remove ${keyword}`}
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Input
                      value={keywordDraft}
                      onChange={(event) => setKeywordDraft(event.target.value)}
                      placeholder="Add a phrase..."
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && keywordDraft.trim()) {
                          event.preventDefault();
                          updateEscalation({
                            keywords: [...form.escalation.keywords, keywordDraft.trim()],
                          });
                          setKeywordDraft("");
                        }
                      }}
                    />
                    <Button
                      variant="secondary"
                      onClick={() => {
                        if (!keywordDraft.trim()) return;
                        updateEscalation({
                          keywords: [...form.escalation.keywords, keywordDraft.trim()],
                        });
                        setKeywordDraft("");
                      }}
                    >
                      Add
                    </Button>
                  </div>
                </FormSection>

                <FormSection
                  title="Handoff message"
                  description="What the customer hears right before the specialist joins."
                >
                  <Textarea
                    value={form.escalation.message}
                    onChange={(event) => updateEscalation({ message: event.target.value })}
                    className="min-h-20"
                  />
                </FormSection>
              </>
            ) : null}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel className="overflow-hidden">
            <div className="dot-bg relative border-b border-line bg-gradient-to-b from-white/[0.03] to-transparent p-4">
              <div className="flex items-center justify-between">
                <Badge tone="accent" dot>
                  Live preview
                </Badge>
                <span className="font-mono text-[9px] text-muted-2">mock audio</span>
              </div>
              <div className="mt-5 flex flex-col items-center text-center">
                <AgentAvatar name={form.name} color={form.color} size="xl" status={form.status} />
                <h3 className="mt-3 text-[15px] font-medium text-ink">{form.name}</h3>
                <p className="text-[10.5px] text-muted">{form.role}</p>
                <div className="mt-2">
                  <LanguageStack languages={form.languages} />
                </div>
                <div className="mt-4 flex items-end justify-center gap-1">
                  {[5, 10, 16, 22, 16, 26, 12, 18, 8, 14, 6].map((height, index) => (
                    <span
                      key={index}
                      className="w-1 rounded-full bg-accent/60"
                      style={{ height, opacity: 0.35 + (index % 3) * 0.2 }}
                    />
                  ))}
                </div>
              </div>
              <div className="mt-5 rounded-xl border border-line bg-black/20 px-3 py-2.5">
                <p className="text-[11px] leading-relaxed text-muted">&ldquo;{form.greeting}&rdquo;</p>
              </div>
            </div>
            <div className="p-4">
              <Link href={`/agents/${form.id}/sandbox`}>
                <Button variant="primary" className="w-full">
                  <FlaskConical className="h-3.5 w-3.5" />
                  Open sandbox
                </Button>
              </Link>
              <p className="mt-2 text-center text-[9.5px] text-muted-2">
                Runs against mock tools and test data
              </p>
            </div>
          </Panel>

          <Readiness agent={form} />

          <Panel className="p-4">
            <SectionTitle
              title="Version history"
              description="Every save is a new version."
              action={<Copy className="h-3.5 w-3.5 text-muted-2" />}
            />
            <div className="mt-3 space-y-2">
              {[0, 1, 2].map((offset) => (
                <div key={offset} className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full border font-mono text-[8.5px]",
                      offset === 0
                        ? "border-accent/30 bg-accent/10 text-accent"
                        : "border-line bg-white/[0.025] text-muted-2",
                    )}
                  >
                    v{Math.max(1, form.version - offset)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10.5px] text-ink">
                      {offset === 0 ? "Current" : offset === 1 ? "Escalation tuning" : "Initial setup"}
                    </p>
                    <p className="font-mono text-[8.5px] text-muted-2">
                      {offset === 0 ? formatRelative(form.updatedAt) : offset === 1 ? "2 days ago" : "3 weeks ago"}
                    </p>
                  </div>
                  {offset === 0 ? <span className="h-1.5 w-1.5 rounded-full bg-accent" /> : null}
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={duplicate}>
                <Copy className="h-3 w-3" />
                Duplicate
              </Button>
              <Button variant="outline" size="sm" onClick={() => save()}>
                <Save className="h-3 w-3" />
                Save
              </Button>
            </div>
          </Panel>

          <Panel className="p-4">
            <div className="flex items-start gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-amber/20 bg-amber/[0.07] text-amber">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <div>
                <p className="text-[11.5px] font-medium text-ink">Sandbox only</p>
                <p className="mt-1 text-[10px] leading-relaxed text-muted">
                  This agent has no production tools or phone numbers. Connect LiveKit and Azure to
                  deploy.
                </p>
                <Link
                  href="/integrations"
                  className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-accent hover:underline"
                >
                  View integrations <ArrowUpRight className="h-2.5 w-2.5" />
                </Link>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
