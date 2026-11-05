import CallClient from "./call-client";
import { demoLiveSessions } from "@/lib/seed";

export function generateStaticParams() {
  return [
    { sessionId: "demo" },
    ...demoLiveSessions.map((s) => ({ sessionId: s.id })),
  ];
}

export default function CallPage() {
  return <CallClient />;
}
