import CallClient from "./call-client";
import { RequireRole } from "@/components/require-role";
import { demoLiveSessions } from "@/lib/seed";

export function generateStaticParams() {
  return [
    { sessionId: "demo" },
    ...demoLiveSessions.map((s) => ({ sessionId: s.id })),
  ];
}

// Scripted test calls for supervisors. Customers place real calls from /support.
export default function CallPage() {
  return (
    <RequireRole role="supervisor">
      <CallClient />
    </RequireRole>
  );
}
