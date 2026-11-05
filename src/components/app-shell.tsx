"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  BarChart3,
  Bot,
  Headphones,
  LayoutDashboard,
  Menu,
  PhoneCall,
  Plug,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentAvatar, Logo } from "./brand";
import { Badge, Button, Dot, Kbd } from "./ui";
import { StartCallButton } from "./start-call";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/sessions", label: "Sessions", icon: PhoneCall },
  { href: "/supervisor", label: "Supervisor", icon: Headphones, live: true },
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
  if (pathname.startsWith("/sessions/")) return "Sessions / Detail";
  if (pathname.startsWith("/sessions")) return "Sessions";
  if (pathname.startsWith("/supervisor")) return "Supervisor";
  if (pathname.startsWith("/analytics")) return "Analytics";
  if (pathname.startsWith("/integrations")) return "Integrations";
  return "Niyamic-Voice-AI-Agent";
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Logo />
        <Badge tone="outline" className="font-mono text-[9px] tracking-[0.14em]">
          v0.1
        </Badge>
      </div>

      <div className="px-5 pb-4">
        <div className="flex items-center gap-2 rounded-lg border border-amber/20 bg-amber/[0.06] px-2.5 py-1.5">
          <Dot tone="amber" pulse />
          <span className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-amber">
            Sandbox · Mock mode
          </span>
        </div>
      </div>

      <div className="px-3">
        <p className="px-2 pb-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-2">
          Workspace
        </p>
        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] font-medium transition-colors",
                  active
                    ? "bg-white/[0.075] text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    : "text-muted hover:bg-white/[0.04] hover:text-ink",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    active ? "text-accent" : "text-muted-2 group-hover:text-muted",
                  )}
                />
                <span className="flex-1">{item.label}</span>
                {item.live ? (
                  <span className="flex items-center gap-1 rounded-full border border-red/20 bg-red/10 px-1.5 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.1em] text-red">
                    <span className="h-1 w-1 rounded-full bg-red" />
                    Live
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="px-3 pt-5">
        <p className="px-2 pb-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-2">
          System
        </p>
        <nav className="space-y-0.5">
          {secondaryItems.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] font-medium transition-colors",
                  active ? "bg-white/[0.075] text-ink" : "text-muted hover:bg-white/[0.04] hover:text-ink",
                )}
              >
                <Icon className={cn("h-4 w-4", active ? "text-accent" : "text-muted-2")} />
                <span className="flex-1">{item.label}</span>
                <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-muted-2">
                  Mock
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto p-3">
        <div className="rounded-xl border border-line bg-white/[0.025] p-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-accent/20 bg-accent/[0.08] text-accent">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="text-[11.5px] font-medium text-ink">Mock runtime online</p>
              <p className="font-mono text-[9px] text-muted-2">LiveKit + Azure queued</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-2">
              Latency
            </span>
            <span className="font-mono text-[10px] text-green">1.23s simulated</span>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2.5 rounded-xl px-1 py-1">
          <AgentAvatar name="Tanveer Khan" color="cyan" size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium text-ink">Tanveer Khan</p>
            <p className="truncate text-[10px] text-muted-2">Workspace owner</p>
          </div>
          <Kbd>⌘K</Kbd>
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
      <aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 border-r border-line bg-[#090b0d] lg:block">
        <SidebarContent />
      </aside>

      <AnimatePresence>
        {mobileOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
              className="relative h-full w-[260px] border-r border-line bg-[#090b0d]"
            >
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-muted hover:bg-white/[0.06] hover:text-ink"
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
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-line bg-bg/80 px-4 backdrop-blur-xl lg:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-1.5 text-muted hover:bg-white/[0.06] hover:text-ink lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex min-w-0 items-center gap-2 text-[12px]">
              <span className="hidden font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-2 sm:inline">
                Niyamic-Voice-AI-Agent
              </span>
              <span className="hidden text-muted-2 sm:inline">/</span>
              <span className="truncate font-medium text-ink">{crumbFor(pathname)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-lg border border-line bg-white/[0.025] px-2.5 py-1.5 text-[11px] text-muted-2 md:flex">
              <Search className="h-3.5 w-3.5" />
              <span>Search sessions</span>
              <Kbd>⌘K</Kbd>
            </div>
            <Badge tone="amber" className="hidden font-mono sm:inline-flex">
              Mock
            </Badge>
            <Link href="/supervisor" className="hidden sm:block">
              <Button variant="secondary" size="sm">
                <Headphones className="h-3.5 w-3.5" />
                Supervisor
              </Button>
            </Link>
            <StartCallButton size="sm" />
          </div>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
