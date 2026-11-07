import { AppShell } from "@/components/app-shell";
import { RequireRole } from "@/components/require-role";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole role="supervisor">
      <AppShell>{children}</AppShell>
    </RequireRole>
  );
}
