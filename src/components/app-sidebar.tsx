import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Target,
  Users,
  GitCompareArrows,
  Settings,
  Activity,
  Download,
  Radar,
  Bell,
  Package,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/use-current-user";
import { countUnread, notificationsUnreadKey } from "@/lib/notifications.queries";
import type { AppRole } from "@/hooks/use-current-user";
import { ROLE_LABEL } from "@/hooks/use-current-user";

type NavItem = { title: string; url: string; icon: LucideIcon; group?: string };

const NAV: Record<AppRole, NavItem[]> = {
  superadmin: [
    // Operacional
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, group: "Operacional" },
    { title: "Missões", url: "/missions", icon: Target, group: "Operacional" },
    // Inteligência
    { title: "Relatórios", url: "/reports", icon: Download, group: "Inteligência" },
    { title: "Comparativo", url: "/comparative", icon: GitCompareArrows, group: "Inteligência" },
    // Gestão
    { title: "Clientes", url: "/users", icon: Users, group: "Gestão" },
    { title: "Produtos", url: "/products", icon: Package, group: "Gestão" },
    { title: "Logs", url: "/logs", icon: Activity, group: "Gestão" },
    { title: "Configurações", url: "/settings", icon: Settings, group: "Gestão" },
    { title: "Notificações", url: "/notificacoes", icon: Bell, group: "Gestão" },
  ],
  contractor: [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Minhas Missões", url: "/missions", icon: Target },
    { title: "Relatórios", url: "/reports", icon: Download },
    { title: "Notificações", url: "/notificacoes", icon: Bell },
  ],
  analyst: [
    { title: "Minhas Missões", url: "/missions", icon: Target },
    { title: "Notificações", url: "/notificacoes", icon: Bell },
  ],
};

export function AppSidebar({ role }: { role: AppRole | null }) {
  const items = role ? NAV[role] : [];
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: user } = useCurrentUser();
  const { data: unread = 0 } = useQuery({
    queryKey: notificationsUnreadKey(user?.id ?? ""),
    queryFn: () => countUnread(user!.id),
    enabled: !!user?.id,
    refetchInterval: 30_000,
  });

  const hasGroups = items.some((item) => item.group);

  const renderMenu = (menuItems: NavItem[]) => (
    <SidebarMenu>
      {menuItems.map((item) => {
        const active = pathname === item.url || pathname.startsWith(item.url + "/");
        const isNotif = item.url === "/notificacoes";
        return (
          <SidebarMenuItem key={item.url}>
            <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
              <Link to={item.url} className="flex items-center gap-2">
                <item.icon className="h-4 w-4" />
                <span className="flex-1">{item.title}</span>
                {isNotif && unread > 0 && (
                  <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[10px]">
                    {unread}
                  </Badge>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="grid place-items-center h-8 w-8 rounded-md bg-primary/15 ring-1 ring-primary/30 shrink-0">
            <Radar className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="text-sm font-semibold tracking-tight truncate">Radar de Mercado IA</div>
            <div className="text-[11px] text-sidebar-foreground/60 truncate">
              {role ? ROLE_LABEL[role] : "Carregando..."}
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {hasGroups ? (
          Object.entries(
            items.reduce<Record<string, NavItem[]>>((acc, item) => {
              const group = item.group ?? "Outros";
              acc[group] = acc[group] ?? [];
              acc[group].push(item);
              return acc;
            }, {})
          ).map(([group, groupItems]) => (
            <SidebarGroup key={group}>
              <SidebarGroupLabel>{group}</SidebarGroupLabel>
              <SidebarGroupContent>{renderMenu(groupItems)}</SidebarGroupContent>
            </SidebarGroup>
          ))
        ) : (
          <SidebarGroup>
            <SidebarGroupContent>{renderMenu(items)}</SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="px-2 py-2 text-[11px] text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">
          v0.1 · MVP
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
