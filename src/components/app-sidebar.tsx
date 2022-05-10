import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Server, Plus, Boxes, Save } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";

const items = [
  { title: "Vue d'ensemble", url: "/dashboard", icon: LayoutDashboard },
  { title: "Machines", url: "/guests", icon: Boxes },
  { title: "Nœuds", url: "/nodes", icon: Server },
  { title: "Créer", url: "/create", icon: Plus },
  { title: "Sauvegardes", url: "/backups", icon: Save },
];

export function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="grid place-items-center h-8 w-8 rounded-md bg-primary/15 text-primary">
            <Server className="h-4 w-4" />
          </div>
          <span className="font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            Proxmox Console
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = path === item.url || path.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link
                        to={
                          item.url as "/dashboard" | "/guests" | "/nodes" | "/create" | "/backups"
                        }
                        className="flex items-center gap-2"
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
