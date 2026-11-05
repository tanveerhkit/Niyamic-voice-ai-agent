"use client";

import { useEffect, useState } from "react";
import { seedAgents } from "./agents";
import type { Agent } from "./types";

const AGENTS_KEY = "relay.agents.v1";
const EVENT = "relay:agents";
const isBrowser = () => typeof window !== "undefined";

function readSaved(): Agent[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(AGENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Agent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getAgents(): Agent[] {
  const saved = readSaved();
  const map = new Map<string, Agent>();
  for (const agent of seedAgents) map.set(agent.id, agent);
  for (const agent of saved) map.set(agent.id, agent);
  return [...map.values()].sort((a, b) => {
    const rank = { active: 0, draft: 1, paused: 2 };
    return rank[a.status] - rank[b.status] || a.name.localeCompare(b.name);
  });
}

export function saveAgent(agent: Agent) {
  if (!isBrowser()) return;
  const saved = readSaved();
  const next = [...saved.filter((item) => item.id !== agent.id), agent];
  localStorage.setItem(AGENTS_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(EVENT));
}

export function deleteAgent(id: string) {
  if (!isBrowser()) return;
  const saved = readSaved().filter((agent) => agent.id !== id);
  localStorage.setItem(AGENTS_KEY, JSON.stringify(saved));
  window.dispatchEvent(new Event(EVENT));
}

export function newAgentTemplate(): Agent {
  const now = new Date().toISOString();
  return {
    id: `ag_${Date.now().toString(36)}`,
    name: "New agent",
    role: "Customer Support Specialist",
    description: "",
    persona: "Warm, concise, and helpful. Confirm the customer's issue before proposing a fix.",
    tone: "Empathetic",
    languages: ["en"],
    voice: "en-US-AvaNeural",
    greeting: "Hi, thanks for calling. How can I help today?",
    systemPrompt:
      "You are a customer support voice agent. Be concise and accurate. Verify facts with tools. Escalate when the customer asks for a human, a policy exception is required, or confidence drops below 0.65.",
    knowledge: "",
    tools: ["order_lookup", "knowledge_search"],
    escalation: {
      confidenceThreshold: 0.65,
      onCustomerRequest: true,
      onNegativeSentiment: true,
      onPolicyException: true,
      keywords: ["human", "agent", "supervisor"],
      maxTurns: 8,
      transferTeam: "Tier 2 · Customer care",
      message: "I'll bring in a specialist who can help. You won't need to repeat anything.",
      autoTransferHighRisk: true,
    },
    status: "draft",
    version: 1,
    createdAt: now,
    updatedAt: now,
    color: "lime",
    stats: { sessions: 0, containment: 0, transferRate: 0, csat: 0, avgHandleSec: 0 },
  };
}

export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>(seedAgents);

  useEffect(() => {
    const load = () => setAgents(getAgents());
    load();
    window.addEventListener(EVENT, load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener(EVENT, load);
      window.removeEventListener("storage", load);
    };
  }, []);

  return agents;
}

export function useAgent(id: string) {
  const agents = useAgents();
  return agents.find((agent) => agent.id === id) ?? null;
}
