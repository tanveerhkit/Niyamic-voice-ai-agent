import SandboxClient from "./sandbox-client";
import { seedAgents } from "@/lib/agents";

export function generateStaticParams() {
  return seedAgents.map((agent) => ({ id: agent.id }));
}

export default function SandboxPage() {
  return <SandboxClient />;
}
