"use client";

import { useSyncExternalStore } from "react";

/** Supervisors use the whole workspace; customers only get the page that calls support. */
export type Role = "supervisor" | "customer";

// Kept per tab, so a supervisor and a customer can be signed in side by side in one browser.
const ROLE_KEY = "niyamic.role";

const LOGIN_IDS: Record<string, Role> = {
  supervisor: "supervisor",
  customer: "customer",
};

/** Where each role lands after signing in. */
export const HOME_FOR: Record<Role, string> = {
  supervisor: "/",
  customer: "/support",
};

const listeners = new Set<() => void>();
// Used only when the browser blocks storage; then the sign-in lasts until a reload.
let fallbackRole: Role | null = null;

export function roleForLoginId(loginId: string): Role | null {
  return LOGIN_IDS[loginId.trim().toLowerCase()] ?? null;
}

function readRole(): Role | null {
  try {
    const value = sessionStorage.getItem(ROLE_KEY);
    return value === "supervisor" || value === "customer" ? value : null;
  } catch {
    return fallbackRole;
  }
}

function writeRole(role: Role | null) {
  fallbackRole = role;
  try {
    if (role) sessionStorage.setItem(ROLE_KEY, role);
    else sessionStorage.removeItem(ROLE_KEY);
  } catch {
    // keep the in-memory role
  }
  listeners.forEach((listener) => listener());
}

export function signIn(role: Role) {
  writeRole(role);
}

export function signOut() {
  writeRole(null);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The signed-in role, null when signed out, or undefined until the browser has been checked. */
export function useRole(): Role | null | undefined {
  return useSyncExternalStore<Role | null | undefined>(subscribe, readRole, () => undefined);
}
