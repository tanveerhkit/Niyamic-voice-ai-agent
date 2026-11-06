"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  FlaskConical,
  Gauge,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Wand2,
  Wrench,
} from "lucide-react";
import { useAgent } from "@/lib/agent-store";
import type { Language } from "@/lib/types";
import { cn, LANGUAGE_NATIVE, LANGUAGE_SHORT, uid } from "@/lib/utils";
import { AgentAvatar } from "@/components/brand";
import { PageHeader } from "@/components/dashboard";
import { Badge, Button, Input, Panel, Progress, SectionTitle } from "@/components/ui";

type SandboxMessage = {
  id: string;
  role: "agent" | "user" | "system";
  text: string;
  at: number;
  tool?: { label: string; result: string };
  escalated?: boolean;
};

const GREETINGS: Record<Language, string> = {
  en: "Thanks for calling Niyamic Echo support. This is Ayesha. How can I help you today?",
  ur: "Niyamic Echo support se baat kar rahi hoon, main Ayesha. Kaise madad kar sakti hoon?",
  hi: "Niyamic Echo support, main Ayesha. Main aap ki kaise madad kar sakti hoon?",
};

const SAMPLES: Record<Language, string[]> = {
  en: ["I was charged twice for order 4821", "I want to speak to a human", "My order hasn't arrived"],
  ur: ["Mujhe order 4821 par double charge hua hai", "Mujhe insaan se baat karni hai", "Mera order nahi aaya"],
  hi: ["Mere order 4821 par double charge hua hai", "Mujhse koi insaan baat kare", "Mera order nahi aaya"],
};

function responseFor(text: string, language: Language): Omit<SandboxMessage, "id" | "role" | "at"> {
  const value = text.toLowerCase();
  const wantsHuman = ["human", "agent", "person", "supervisor", "insaan", "baat kare", "baat karni", "manager"].some(
    (word) => value.includes(word),
  );

  if (wantsHuman) {
    return {
      text:
        language === "ur"
          ? "Bilkul. Main abhi ek specialist ko call mein la rahi hoon — aap ko kuch dobara nahi batana padega."
          : language === "hi"
            ? "Bilkul. Main abhi ek specialist ko call mein la rahi hoon — aapko kuch dobara nahi batana padega."
            : "Of course. I'll bring in a specialist now — you won't need to repeat anything you've told me.",
      escalated: true,
      tool: {
        label: "Handoff request · Tier 2",
        result: "Context package sent · transcript + intent + confidence",
      },
    };
  }

  if (["refund", "charged", "charge", "duplicate", "paisa", "double"].some((word) => value.includes(word))) {
    return {
      text:
        language === "ur"
          ? "Main dekh sakti hoon ke order 4821 par do charges hain. Ek duplicate lag raha hai — main uski refund shuru kar sakti hoon."
          : language === "hi"
            ? "Main dekh sakti hoon ki order 4821 par do charges hain. Ek duplicate lag raha hai — main uski refund shuru kar sakti hoon."
            : "I can see two charges on order 4821. One looks like a duplicate — I can start a refund for that amount.",
      tool: {
        label: "Order lookup · #4821",
        result: "2 captures of $49.00 · Nov 3 · one flagged duplicate",
      },
    };
  }

  if (value.includes("order") || value.includes("4821") || value.includes("deliver")) {
    return {
      text:
        language === "ur"
          ? "Main order 4821 ka status dekh rahi hoon. Carrier scan do din se update nahi hua — main trace open kar deti hoon."
          : language === "hi"
            ? "Main order 4821 ka status dekh rahi hoon. Carrier scan do din se update nahi hua — main trace open kar deti hoon."
            : "I'm checking order 4821 now. The carrier scan hasn't updated in two days — I'll open a trace and send you an SMS update.",
      tool: {
        label: "Order lookup · #4821",
        result: "In transit · no scan for 48h · trace available",
      },
    };
  }

  if (["cancel", "subscription", "plan"].some((word) => value.includes(word))) {
    return {
      text:
        "I can help with that. I'll confirm the current billing period and what happens to your remaining balance before we make any change.",
    };
  }

  return {
    text:
      language === "ur"
        ? "Main samajh gayi. Main aap ke account ki detail check karti hoon. Order number ya account email bata dijiye."
        : language === "hi"
          ? "Main samajh gayi. Main aapke account ki detail check karti hoon. Order number ya account email bata dijiye."
          : "I understand. Let me check that for you — could you share the order number or the email on the account?",
  };
}

export default function SandboxPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const agent = useAgent(id);

  const [language, setLanguage] = useState<Language>("en");
  const [messages, setMessages] = useState<SandboxMessage[]>(() => [
    {
      id: uid("msg"),
      role: "agent",
      text: GREETINGS.en,
      at: 0,
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluated, setEvaluated] = useState(false);
  const [confidence, setConfidence] = useState(0.94);
  const [risk, setRisk] = useState<"low" | "medium" | "high">("low");
  const scrollRef = useRef<HTMLDivElement>(null);

  const changeLanguage = (next: Language) => {
    setLanguage(next);
    setMessages([
      {
        id: uid("msg"),
        role: "agent",
        text: GREETINGS[next],
        at: 0,
      },
    ]);
    setInput("");
    setThinking(false);
    setConfidence(0.94);
    setRisk("low");
    setEvaluated(false);
  };

  const resetChat = () => {
    changeLanguage(language);
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const send = (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || thinking) return;
    const userMessage: SandboxMessage = {
      id: uid("msg"),
      role: "user",
      text,
      at: messages.length,
    };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setThinking(true);

    window.setTimeout(() => {
      const reply = responseFor(text, language);
      setMessages((current) => [
        ...current,
        {
          id: uid("msg"),
          role: reply.escalated ? "system" : "agent",
          text: reply.text,
          at: current.length,
          tool: reply.tool,
          escalated: reply.escalated,
        },
      ]);
      setConfidence(reply.escalated ? 0.58 : reply.tool ? 0.9 : 0.86);
      setRisk(reply.escalated ? "medium" : "low");
      setThinking(false);
    }, 850);
  };

  const evaluation = useMemo(
    () => [
      { label: "Intent accuracy", value: 94 },
      { label: "Policy compliance", value: 97 },
      { label: "Tone & empathy", value: 91 },
      { label: "Escalation precision", value: 96 },
    ],
    [],
  );

  if (!agent) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-2">Sandbox</p>
        <h1 className="mt-3 text-2xl font-medium text-ink">Agent not found.</h1>
        <Link href="/agents" className="mt-6 inline-block">
          <Button variant="primary">Back to agents</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 lg:px-7 lg:py-8">
      <PageHeader
        eyebrow="02 — Sandbox · isolated test environment"
        title={
          <>
            Test <span className="font-serif italic text-accent">{agent.name}</span> before a customer
            does.
          </>
        }
        description="Sandbox tools, test data, no production access. Try an escalation, a language switch, or a policy edge case."
        actions={
          <>
            <Link href={`/agents/${agent.id}`}>
              <Button variant="secondary">
                <ArrowLeft className="h-3.5 w-3.5" />
                Builder
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={resetChat}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
            <Link href={`/call/SES-SANDBOX?agent=${agent.id}`}>
              <Button variant="primary">
                <Play className="h-3.5 w-3.5" />
                Voice test
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel className="flex min-h-[660px] flex-col overflow-hidden self-start xl:h-[calc(100vh-296px)] xl:min-h-[600px]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div className="flex items-center gap-3">
              <AgentAvatar name={agent.name} color={agent.color} size="md" status="active" />
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-medium text-ink">{agent.name}</p>
                  <Badge tone="cyan" dot>
                    Sandbox
                  </Badge>
                </div>
                <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-2">
                  {agent.id} · sandbox tools · v{agent.version}
                </p>
              </div>
            </div>
            <div className="flex rounded-none border border-line bg-surface p-0.5">
              {(["en", "ur", "hi"] as Language[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => changeLanguage(item)}
                  className={cn(
                    "rounded-none px-2.5 py-1 text-[10.5px] font-medium transition-colors",
                    language === item ? "bg-surface-3 text-ink" : "text-muted hover:text-ink",
                  )}
                >
                  {LANGUAGE_SHORT[item]} · {LANGUAGE_NATIVE[item]}
                </button>
              ))}
            </div>
          </div>

          <div ref={scrollRef} className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-4 py-5">
            {messages.map((message) => {
              if (message.role === "system") {
                return (
                  <div key={message.id} className="mx-auto max-w-md">
                    <div className="rounded-none border border-amber/20 bg-amber/[0.05] p-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-amber/30 bg-amber/15 text-amber">
                          <ArrowUpRight className="h-3 w-3" />
                        </span>
                        <p className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-amber">
                          Handoff requested
                        </p>
                      </div>
                      <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink/90">
                        {message.text}
                      </p>
                      {message.tool ? (
                        <div className="mt-2 rounded-none border border-line bg-surface-2 px-2.5 py-2">
                          <p className="font-mono text-[9px] text-cyan">{message.tool.label}</p>
                          <p className="mt-0.5 text-[10px] text-muted">{message.tool.result}</p>
                        </div>
                      ) : null}
                      <p className="mt-2 font-mono text-[9px] text-muted-2">
                        Context shared instantly · transcript, intent, confidence
                      </p>
                    </div>
                  </div>
                );
              }

              const isUser = message.role === "user";
              return (
                <div
                  key={message.id}
                  className={cn("flex items-start gap-2.5", isUser ? "flex-row-reverse" : "")}
                >
                  {isUser ? (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line bg-surface-2 font-mono text-[8.5px] text-muted">
                      ZA
                    </span>
                  ) : (
                    <AgentAvatar name={agent.name} color={agent.color} size="sm" />
                  )}
                  <div className={cn("max-w-[78%] xl:max-w-[520px]", isUser ? "items-end text-right" : "")}>
                    <div
                      className={cn(
                        "rounded-none px-3.5 py-2.5 text-[12px] leading-relaxed",
                        isUser
                          ? "rounded-tr-md border border-cyan/20 bg-cyan/[0.08] text-ink"
                          : "rounded-tl-md border border-line bg-surface-2 text-ink/90",
                      )}
                    >
                      {message.text}
                    </div>
                    {message.tool ? (
                      <div className="mt-1.5 rounded-none border border-line bg-surface-2 px-3 py-2 text-left">
                        <div className="flex items-center gap-1.5">
                          <Wrench className="h-3 w-3 text-accent" />
                          <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-accent">
                            {message.tool.label}
                          </p>
                        </div>
                        <p className="mt-1 text-[10.5px] text-muted">{message.tool.result}</p>
                      </div>
                    ) : null}
                    <p className="mt-1 px-1 font-mono text-[8.5px] text-muted-2">
                      {isUser ? "You" : agent.name} · {message.at + 1}s
                    </p>
                  </div>
                </div>
              );
            })}

            {thinking ? (
              <div className="flex items-start gap-2.5">
                <AgentAvatar name={agent.name} color={agent.color} size="sm" />
                <div className="rounded-none rounded-tl-md border border-line bg-surface-2 px-3.5 py-3">
                  <div className="flex items-center gap-1">
                    {[0, 1, 2].map((index) => (
                      <span
                        key={index}
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted"
                        style={{ animationDelay: `${index * 120}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-t border-line p-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {SAMPLES[language].map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => send(sample)}
                  className="rounded-none border border-line bg-surface-2/50 px-2.5 py-1 text-[10px] text-muted transition-colors hover:border-line-strong hover:text-ink"
                >
                  {sample}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") send();
                }}
                placeholder={`Message ${agent.name} in ${LANGUAGE_NATIVE[language]}...`}
                className="h-11"
              />
              <Button variant="primary" size="md" onClick={() => send()} disabled={thinking || !input.trim()}>
                <Send className="h-3.5 w-3.5" />
                Send
              </Button>
            </div>
            <p className="mt-2 text-center font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-2">
              Sandbox · simulated responses · no production data
            </p>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel className="p-4">
            <SectionTitle
              title="Test scenarios"
              description="One click to load a realistic case."
              action={<Wand2 className="h-3.5 w-3.5 text-muted-2" />}
            />
            <div className="mt-3 space-y-2">
              {[
                { label: "Duplicate charge", prompt: SAMPLES[language][0], tone: "accent" as const },
                { label: "Ask for a human", prompt: SAMPLES[language][1], tone: "amber" as const },
                { label: "Delivery delay", prompt: SAMPLES[language][2], tone: "cyan" as const },
              ].map((scenario) => (
                <button
                  key={scenario.label}
                  type="button"
                  onClick={() => send(scenario.prompt)}
                  className="flex w-full items-center gap-3 rounded-none border border-line bg-surface-2/50 px-3 py-2.5 text-left transition-colors hover:border-line-strong hover:bg-surface-2"
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-none",
                      scenario.tone === "accent"
                        ? "bg-accent/10 text-accent"
                        : scenario.tone === "amber"
                          ? "bg-amber/10 text-amber"
                          : "bg-cyan/10 text-cyan",
                    )}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11.5px] font-medium text-ink">{scenario.label}</span>
                    <span className="mt-0.5 block truncate text-[9.5px] text-muted-2">
                      {scenario.prompt}
                    </span>
                  </span>
                  <ArrowUpRight className="h-3 w-3 text-muted-2" />
                </button>
              ))}
            </div>
          </Panel>

          <Panel className="p-4">
            <SectionTitle
              title="Evaluation"
              description="Run a regression suite on this agent."
              action={<FlaskConical className="h-3.5 w-3.5 text-muted-2" />}
            />
            {evaluated ? (
              <div className="mt-3 space-y-3">
                {evaluation.map((item) => (
                  <div key={item.label}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[10.5px] text-muted">{item.label}</span>
                      <span className="font-mono text-[10px] text-ink">{item.value}%</span>
                    </div>
                    <Progress
                      value={item.value}
                      tone={item.value >= 95 ? "accent" : item.value >= 90 ? "cyan" : "amber"}
                    />
                  </div>
                ))}
                <div className="flex items-center gap-2 rounded-none border border-green/15 bg-green/[0.04] px-2.5 py-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green" />
                  <p className="text-[10px] text-green">12 / 12 evaluation scenarios passed</p>
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={() => setEvaluated(false)}>
                  Run again
                </Button>
              </div>
            ) : (
              <div className="mt-3">
                <div className="rounded-none border border-line bg-surface-2/50 p-3">
                  <p className="text-[11px] leading-relaxed text-muted">
                    Tests intent handling, policy compliance, tone, and escalation precision against
                    the current version.
                  </p>
                  <div className="mt-2 flex items-center gap-2 font-mono text-[9px] text-muted-2">
                    <Gauge className="h-3 w-3" />
                    12 scenarios · sandbox evaluator
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => {
                    setEvaluating(true);
                    window.setTimeout(() => {
                      setEvaluating(false);
                      setEvaluated(true);
                    }, 1100);
                  }}
                  disabled={evaluating}
                >
                  {evaluating ? (
                    <>
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-accent" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="h-3 w-3" />
                      Run evaluation
                    </>
                  )}
                </Button>
              </div>
            )}
          </Panel>

          <Panel className="p-4">
            <SectionTitle title="Session telemetry" description="Live values from this sandbox chat." />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-none border border-line bg-surface-2/50 p-2.5">
                <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-2">
                  Confidence
                </p>
                <p className={cn("mt-1 text-[15px] font-medium", confidence < 0.65 ? "text-amber" : "text-accent")}>
                  {confidence.toFixed(2)}
                </p>
              </div>
              <div className="rounded-none border border-line bg-surface-2/50 p-2.5">
                <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-2">Risk</p>
                <p className="mt-1 text-[15px] font-medium capitalize text-ink">{risk}</p>
              </div>
              <div className="rounded-none border border-line bg-surface-2/50 p-2.5">
                <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-2">Language</p>
                <p className="mt-1 text-[15px] font-medium text-ink">{LANGUAGE_SHORT[language]}</p>
              </div>
              <div className="rounded-none border border-line bg-surface-2/50 p-2.5">
                <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-2">Latency</p>
                <p className="mt-1 text-[15px] font-medium text-ink">1.2s</p>
              </div>
            </div>
          </Panel>

          <Panel className="p-4">
            <SectionTitle title="Config snapshot" description="What this sandbox is testing." />
            <div className="mt-3 space-y-2 text-[10.5px]">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <span className="text-muted">Escalate below</span>
                <span className="font-mono text-ink">
                  {Math.round(agent.escalation.confidenceThreshold * 100)}%
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-line pb-2">
                <span className="text-muted">Tools enabled</span>
                <span className="font-mono text-ink">{agent.tools.length}</span>
              </div>
              <div className="flex items-center justify-between border-b border-line pb-2">
                <span className="text-muted">Transfer team</span>
                <span className="max-w-[150px] truncate text-right font-mono text-ink">
                  {agent.escalation.transferTeam}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Environment</span>
                <span className="font-mono text-amber">Sandbox</span>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
