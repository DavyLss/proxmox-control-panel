import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ProxmoxCredentials, ProxmoxTicket } from "./client";
import { isTicketValid, login as apiLogin } from "./client";

const STORAGE_KEY = "pve.ticket.v1";

interface AuthContextValue {
  ticket: ProxmoxTicket | null;
  isAuthenticated: boolean;
  signIn: (c: ProxmoxCredentials) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ticket, setTicket] = useState<ProxmoxTicket | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ProxmoxTicket;
      if (isTicketValid(parsed)) setTicket(parsed);
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const signIn = useCallback(async (c: ProxmoxCredentials) => {
    const t = await apiLogin(c);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(t));
    setTicket(t);
  }, []);

  const signOut = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setTicket(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ticket, isAuthenticated: isTicketValid(ticket), signIn, signOut }),
    [ticket, signIn, signOut],
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