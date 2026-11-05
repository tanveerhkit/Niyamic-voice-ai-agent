"use client";

import { useRouter } from "next/navigation";
import { Phone } from "lucide-react";
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

  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => {
        const id = `SES-LIVE-${Date.now().toString(36).toUpperCase()}`;
        router.push(`/call/${id}?agent=${agentId}`);
      }}
    >
      <Phone className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
