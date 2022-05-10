import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ProxmoxCredentials, ProxmoxTfaChallenge, ProxmoxTicket } from "./client";
import { isTicketValid, login as apiLogin, loginTfa as apiLoginTfa, refreshTicket } from "./client";

const STORAGE_KEY = "pve.ticket.v1";
const REFRESH_INTERVAL_MS = 1000 * 60 * 60; // renew every hour (TTL ~2h)

function getStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

interface AuthContextValue {
  ticket: ProxmoxTicket | null;
  isAuthenticated: boolean;
  isRestored: boolean;
  signIn: (c: ProxmoxCredentials) => Promise<{ tfa?: ProxmoxTfaChallenge }>;
  completeTfa: (c: ProxmoxTfaChallenge, code: string, kind?: "totp" | "recovery") => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ticket, setTicket] = useState<ProxmoxTicket | null>(null);
  const [isRestored, setIsRestored] = useState(false);

  useEffect(() => {
    try {
      const storage = getStorage();
      const raw = storage?.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ProxmoxTicket;
      if (isTicketValid(parsed)) setTicket(parsed);
      else storage?.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    } finally {
      setIsRestored(true);
    }
  }, []);

  // Auto-renew the ticket periodically so a refresh / long session never
  // logs the user out unexpectedly.
  useEffect(() => {
    if (!ticket) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const fresh = await refreshTicket(ticket);
        if (cancelled) return;
        getStorage()?.setItem(STORAGE_KEY, JSON.stringify(fresh));
        setTicket(fresh);
      } catch {
        /* keep current ticket; next call will surface the error */
      }
    };
    const id = window.setInterval(tick, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [ticket]);

  const signIn = useCallback(async (c: ProxmoxCredentials) => {
    const result = await apiLogin(c);
    if (result.kind === "tfa") return { tfa: result.challenge };
    getStorage()?.setItem(STORAGE_KEY, JSON.stringify(result.ticket));
    setTicket(result.ticket);
    return {};
  }, []);

  const completeTfa = useCallback(
    async (c: ProxmoxTfaChallenge, code: string, kind: "totp" | "recovery" = "totp") => {
      const t = await apiLoginTfa(c, code, kind);
      getStorage()?.setItem(STORAGE_KEY, JSON.stringify(t));
      setTicket(t);
    },
    [],
  );

  const signOut = useCallback(() => {
    getStorage()?.removeItem(STORAGE_KEY);
    setTicket(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ticket,
      isAuthenticated: isTicketValid(ticket),
      isRestored,
      signIn,
      completeTfa,
      signOut,
    }),
    [ticket, isRestored, signIn, completeTfa, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function useTicketOrThrow() {
  const { ticket } = useAuth();
  if (!ticket) throw new Error("Non authentifié");
  return ticket;
}