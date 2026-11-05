import SessionDetailClient from "./session-detail-client";
import { detailedSessions, seedSessions } from "@/lib/seed";

export function generateStaticParams() {
  const ids = new Set<string>();
  detailedSessions.forEach((s) => ids.add(s.id));
  seedSessions.slice(0, 30).forEach((s) => ids.add(s.id));
  return Array.from(ids).map((id) => ({ id }));
}

export default function SessionDetailPage() {
  return <SessionDetailClient />;
}
