"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { HOME_FOR, type Role, useRole } from "@/lib/auth";

/** Shows its children only to `role`. Anyone else goes to sign in, or to their own page. */
export function RequireRole({ role, children }: { role: Role; children: React.ReactNode }) {
  const current = useRole();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (current === undefined || current === role) return;
    if (current) {
      router.replace(HOME_FOR[current]);
      return;
    }
    // Come back here after signing in, for example to a call opened in a new tab.
    const here = pathname + window.location.search;
    router.replace(here === "/" ? "/login" : `/login?next=${encodeURIComponent(here)}`);
  }, [current, role, router, pathname]);

  if (current !== role) return <div className="min-h-screen bg-bg" />;
  return children;
}
