import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Target,
  Users2,
  Building2,
  Settings,
  Activity,
  Bell,
  Package,
  Sun,
  Moon,
  LogOut,
  User as UserIcon,
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
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/use-current-user";
import { countUnread, notificationsUnreadKey } from "@/lib/notifications.queries";
import type { AppRole } from "@/hooks/use-current-user";
import { ROLE_LABEL } from "@/hooks/use-current-user";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";
import exudusLogo from "@/assets/exudus-logo.png.asset.json";

type NavItem = { title: string; url: string; icon: LucideIcon; group?: string };

const NAV: Record<AppRole, NavItem[]> = {
  superadmin: [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, group: "Operacional" },
    { title: "Missões", url: "/missions", icon: Target, group: "Operacional" },
    { title: "Clientes", url: "/users", icon: Users, group: "Gestão" },
    { title: "Produtos", url: "/products", icon: Package, group: "Gestão" },
    { title: "Logs", url: "/logs", icon: Activity, group: "Gestão" },
    { title: "Configurações", url: "/settings", icon: Settings, group: "Gestão" },
    { title: "Notificações", url: "/notificacoes", icon: Bell, group: "Gestão" },
  ],
  contractor: [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Minhas Missões", url: "/missions", icon: Target },
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
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { theme, toggleTheme } = useTheme();
  const { data: unread = 0 } = useQuery({
    queryKey: notificationsUnreadKey(user?.id ?? ""),
    queryFn: () => countUnread(user!.id),
    enabled: !!user?.id,
    refetchInterval: 30_000,
  });

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const displayName =
    user?.profile?.full_name?.trim() || user?.email || "Usuário";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  const hasGroups = items.some((item) => item.group);

  const renderMenu = (menuItems: NavItem[]) => (
    <SidebarMenu>
      {menuItems.map((item) => {
        const active = pathname === item.url || pathname.startsWith(item.url + "/");
        const isNotif = item.url === "/notificacoes";
        return (
          <SidebarMenuItem key={item.url}>
            <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
              <Link to={item.url} className="flex items-center gap-2 w-full">
                <item.icon className={`h-4 w-4 shrink-0 ${active ? "text-primary" : ""}`} />
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
        <div className="flex flex-col items-center gap-2 px-2 py-3">
          <img
            src={exudusLogo.url}
            alt="ExudusTech"
            className="h-14 w-auto object-contain group-data-[collapsible=icon]:h-8"
          />
          <div className="text-[10px] font-semibold tracking-[0.25em] text-sidebar-foreground/60 uppercase group-data-[collapsible=icon]:hidden">
            Radar IA
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

      <SidebarFooter className="border-t border-sidebar-border gap-1 p-2">
        <button
          type="button"
          onClick={() => navigate({ to: "/settings" })}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-sidebar-accent transition-colors"
        >
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarFallback className="bg-primary/20 text-primary text-[11px] font-semibold">
              {initials || <UserIcon className="h-3.5 w-3.5" />}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <div className="text-xs font-medium truncate text-sidebar-foreground">
              {displayName}
            </div>
            <div className="text-[10px] text-sidebar-foreground/60 truncate">
              {role ? ROLE_LABEL[role] : "—"}
            </div>
          </div>
        </button>

        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          className="justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4 shrink-0" />
          ) : (
            <Moon className="h-4 w-4 shrink-0" />
          )}
          <span className="group-data-[collapsible=icon]:hidden">
            {theme === "dark" ? "Modo Claro" : "Modo Escuro"}
          </span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="justify-start gap-2 text-primary hover:bg-primary/10 hover:text-primary"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span className="group-data-[collapsible=icon]:hidden">Sair</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
