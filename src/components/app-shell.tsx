"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  BarChart3,
  Bot,
  Database,
  Headphones,
  LayoutDashboard,
  Menu,
  PhoneCall,
  Plug,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLiveSessions } from "@/lib/live-store";
import { AgentAvatar, Wordmark } from "./brand";
import { StartCallButton } from "./start-call";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/data", label: "Data", icon: Database },
  { href: "/sessions", label: "Sessions", icon: PhoneCall },
  { href: "/supervisor", label: "Supervisor", icon: Headphones },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

const secondaryItems = [{ href: "/integrations", label: "Integrations", icon: Plug }];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function crumbFor(pathname: string) {
  if (pathname === "/") return "Overview";
  if (pathname.startsWith("/agents/")) return "Agents / Builder";
  if (pathname.startsWith("/agents")) return "Agents";
  if (pathname.startsWith("/data")) return "Data";
  if (pathname.startsWith("/sessions/")) return "Sessions / Detail";
  if (pathname.startsWith("/sessions")) return "Sessions";
  if (pathname.startsWith("/supervisor")) return "Supervisor";
  if (pathname.startsWith("/analytics")) return "Analytics";
  if (pathname.startsWith("/integrations")) return "Integrations";
  return "Niyamic Echo";
}

function NavLink({
  href,
  label,
  icon: Icon,
  count,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: typeof Bot;
  count?: number;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "group relative flex items-center gap-3 border-l-2 py-2.5 pl-5 pr-4 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors",
        active
          ? "border-ink bg-surface-2 text-ink"
          : "border-transparent text-muted hover:border-line-strong hover:bg-surface-2/60 hover:text-ink",
      )}
    >
      <Icon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-ink" : "text-muted-2")} />
      <span className="flex-1">{label}</span>
      {count ? (
        <span className="min-w-4 bg-amber px-1 text-center font-mono text-[9px] leading-4 tracking-normal text-white">
          {count}
        </span>
      ) : null}
    </Link>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const waiting = useLiveSessions().filter((session) => session.status === "escalating").length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[64px] items-center border-b border-line px-5">
        <Wordmark />
      </div>

      <div className="pt-5">
        <p className="px-5 pb-2 font-mono text-[8.5px] uppercase tracking-[0.2em] text-muted-2">
          Workspace
        </p>
        <nav>
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              count={item.href === "/supervisor" ? waiting : undefined}
              active={isActive(pathname, item.href)}
              onNavigate={onNavigate}
            />
          ))}
        </nav>
      </div>

      <div className="mt-6">
        <p className="px-5 pb-2 font-mono text-[8.5px] uppercase tracking-[0.2em] text-muted-2">
          Settings
        </p>
        <nav>
          {secondaryItems.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              active={isActive(pathname, item.href)}
              onNavigate={onNavigate}
            />
          ))}
        </nav>
      </div>

      <div className="mt-auto border-t border-line p-4">
        <div className="flex items-center gap-2.5 px-1">
          <AgentAvatar name="Tanveer Khan" color="cyan" size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11.5px] font-medium text-ink">Tanveer Khan</p>
            <p className="truncate font-mono text-[8.5px] uppercase tracking-[0.1em] text-muted-2">
              Workspace owner
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-bg">
      <aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 border-r border-line bg-surface lg:block">
        <SidebarContent />
      </aside>

      <AnimatePresence>
        {mobileOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#221e1c]/35 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
              className="relative h-full w-[260px] border-r border-line bg-surface"
            >
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-3 z-10 p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-line bg-bg/85 px-4 backdrop-blur-xl lg:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="p-1.5 text-muted hover:bg-surface-2 hover:text-ink lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex min-w-0 items-center gap-2.5 font-mono text-[9px] uppercase tracking-[0.16em]">
              <span className="hidden text-muted-2 sm:inline">Niyamic Echo</span>
              <span className="hidden text-line-strong sm:inline">/</span>
              <span className="truncate text-ink">{crumbFor(pathname)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/sessions"
              className="hidden items-center gap-2 border border-line bg-surface px-2.5 py-1.5 text-muted-2 transition-colors hover:border-line-strong hover:text-ink md:flex"
            >
              <Search className="h-3 w-3" />
              <span className="font-mono text-[9px] uppercase tracking-[0.1em]">Search sessions</span>
            </Link>
            <StartCallButton size="sm" />
          </div>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
