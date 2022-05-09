import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ProxmoxCredentials, ProxmoxTfaChallenge, ProxmoxTicket } from "./client";
import { isTicketValid, login as apiLogin, loginTfa as apiLoginTfa } from "./client";

const STORAGE_KEY = "pve.ticket.v1";

function getSessionStorage() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

interface AuthContextValue {
  ticket: ProxmoxTicket | null;
  isAuthenticated: boolean;
  signIn: (c: ProxmoxCredentials) => Promise<{ tfa?: ProxmoxTfaChallenge }>;
  completeTfa: (c: ProxmoxTfaChallenge, code: string, kind?: "totp" | "recovery") => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ticket, setTicket] = useState<ProxmoxTicket | null>(null);

  useEffect(() => {
    try {
      const storage = getSessionStorage();
      const raw = storage?.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ProxmoxTicket;
      if (isTicketValid(parsed)) setTicket(parsed);
      else storage?.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const signIn = useCallback(async (c: ProxmoxCredentials) => {
    const result = await apiLogin(c);
    if (result.kind === "tfa") return { tfa: result.challenge };
    getSessionStorage()?.setItem(STORAGE_KEY, JSON.stringify(result.ticket));
    setTicket(result.ticket);
    return {};
  }, []);

  const completeTfa = useCallback(
    async (c: ProxmoxTfaChallenge, code: string, kind: "totp" | "recovery" = "totp") => {
      const t = await apiLoginTfa(c, code, kind);
      getSessionStorage()?.setItem(STORAGE_KEY, JSON.stringify(t));
      setTicket(t);
    },
    [],
  );

  const signOut = useCallback(() => {
    getSessionStorage()?.removeItem(STORAGE_KEY);
    setTicket(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ticket, isAuthenticated: isTicketValid(ticket), signIn, completeTfa, signOut }),
    [ticket, signIn, completeTfa, signOut],
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