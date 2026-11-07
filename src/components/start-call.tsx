"use client";

import { Lock } from "lucide-react";
import { Button } from "./ui";

/**
 * Live calls are placed by customers from their support page, so in the workspace the
 * button is shown switched off.
 */
export function StartCallButton({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  return (
    <span title="Only customers can start a live call" className="inline-flex cursor-not-allowed">
      <Button variant="primary" size={size} disabled>
        <Lock className="h-3.5 w-3.5" />
        Start live call
      </Button>
    </span>
  );
}
