import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/lib/proxmox/auth-context";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { isAuthenticated, signOut, ticket } = useAuth();
  const navigate = useNavigate();

  if (!isAuthenticated) {
    // client-side redirect (auth lives in sessionStorage, not router context)
    throw redirect({ to: "/login" });
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
                navigate({ to: "/login" });
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