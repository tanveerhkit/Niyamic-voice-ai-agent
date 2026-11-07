"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { agentById, seedAgents } from "@/lib/agents";
import { useAgent } from "@/lib/agent-store";
import { signOut } from "@/lib/auth";
import { Wordmark } from "@/components/brand";
import { LiveCall } from "@/components/live/live-call";
import { RequireRole } from "@/components/require-role";
import { Button } from "@/components/ui";

const SUPPORT_AGENT_ID = "ag_ayesha";

function newSessionId() {
  return `SES-LIVE-${Date.now().toString(36).toUpperCase()}`;
}

function SupportCall() {
  const agent = useAgent(SUPPORT_AGENT_ID) ?? agentById(SUPPORT_AGENT_ID) ?? seedAgents[0];
  const [sessionId, setSessionId] = useState(newSessionId);

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line px-4 lg:px-6">
        <Wordmark size="sm" />
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut className="h-3 w-3" />
          Sign out
        </Button>
      </header>
      {/* A new key gives each call a fresh LiveKit room. */}
      <LiveCall
        key={sessionId}
        sessionId={sessionId}
        agent={agent}
        onDone={() => setSessionId(newSessionId())}
      />
    </div>
  );
}

/** The only page a customer sees: one button that calls support. */
export default function SupportPage() {
  return (
    <RequireRole role="customer">
      <SupportCall />
    </RequireRole>
  );
}
