"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Phone } from "lucide-react";
import { voiceApi } from "@/lib/voice-api";
import { Button } from "./ui";

export function StartCallButton({
  label = "Start live call",
  size = "md",
  variant = "primary",
  agentId = "ag_ayesha",
}: {
  label?: string;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "outline";
  agentId?: string;
}) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  // Real voice calls when every provider is configured; the scripted demo otherwise.
  const start = async () => {
    setChecking(true);
    const live = await voiceApi.health().then(
      (health) => health.voice.ready,
      () => false,
    );
    const id = `SES-LIVE-${Date.now().toString(36).toUpperCase()}`;
    router.push(`/call/${id}?agent=${agentId}${live ? "&mode=live" : ""}`);
  };

  return (
    <Button variant={variant} size={size} onClick={() => void start()} disabled={checking}>
      {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Phone className="h-3.5 w-3.5" />}
      {label}
    </Button>
  );
}
