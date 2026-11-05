import AgentClient from "./agent-client";
import { seedAgents } from "@/lib/agents";

export function generateStaticParams() {
  return seedAgents.map((agent) => ({ id: agent.id }));
}

export default function AgentBuilderPage() {
  return <AgentClient />;
}
