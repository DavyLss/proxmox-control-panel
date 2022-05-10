import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/lib/proxmox/auth-context";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { isAuthenticated, isRestored, signOut, ticket } = useAuth();

  useEffect(() => {
    if (isRestored && !isAuthenticated && typeof window !== "undefined") {
      window.location.replace("/login");
    }
  }, [isAuthenticated, isRestored]);

  if (!isRestored) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Restauration de la session…
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Redirection vers la connexion…
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border/60 px-3 sticky top-0 bg-background/80 backdrop-blur z-10">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {ticket?.username} · {ticket?.baseUrl.replace(/^https?:\/\//, "")}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                signOut();
                if (typeof window !== "undefined") {
                  window.location.assign("/login");
                }
              }}
            >
              <LogOut className="h-4 w-4 mr-1.5" />
              Déconnexion
            </Button>
          </header>
          <main className="flex-1 p-4 md:p-6 max-w-[1600px] w-full mx-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
