import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Target,
  FileText,
  Users,
  ClipboardList,
  History,
  GitCompareArrows,
  FolderOpen,
  Settings,
  Activity,
  MessageSquare,
  Download,
  Radar,
  AlertTriangle,
  ListChecks,
  CalendarClock,
  Sparkles,
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
import type { AppRole } from "@/hooks/use-current-user";
import { ROLE_LABEL } from "@/hooks/use-current-user";

type NavItem = { title: string; url: string; icon: LucideIcon };

const NAV: Record<AppRole, NavItem[]> = {
  superadmin: [
    { title: "Dashboard Global", url: "/dashboard", icon: LayoutDashboard },
    { title: "Missões", url: "/missions", icon: Target },
    { title: "Documento-base", url: "/documents", icon: FileText },
    { title: "Alvos", url: "/targets", icon: Sparkles },
    { title: "Coleta Guiada", url: "/collection", icon: ClipboardList },
    { title: "Evidências", url: "/evidences", icon: FolderOpen },
    { title: "Timeline", url: "/timeline", icon: History },
    { title: "Comparativo", url: "/comparative", icon: GitCompareArrows },
    { title: "Relatórios", url: "/reports", icon: Download },
    { title: "Usuários", url: "/users", icon: Users },
    { title: "Solicitações", url: "/change-requests", icon: AlertTriangle },
    { title: "Logs", url: "/logs", icon: Activity },
    { title: "Configurações", url: "/settings", icon: Settings },
  ],
  contractor: [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Roteiro / Documento-base", url: "/documents", icon: FileText },
    { title: "Jornada", url: "/journey", icon: CalendarClock },
    { title: "Alvos", url: "/targets", icon: Sparkles },
    { title: "Comparativo", url: "/comparative", icon: GitCompareArrows },
    { title: "Evidências", url: "/evidences", icon: FolderOpen },
    { title: "Relatórios", url: "/reports", icon: Download },
    { title: "Perguntar à IA", url: "/ask-ai", icon: MessageSquare },
    { title: "Downloads", url: "/downloads", icon: Download },
    { title: "Solicitações", url: "/change-requests", icon: AlertTriangle },
  ],
  analyst: [
    { title: "Minha Missão", url: "/dashboard", icon: LayoutDashboard },
    { title: "Próximas Ações", url: "/next-actions", icon: ListChecks },
    { title: "Roteiro", url: "/documents", icon: FileText },
    { title: "Alvos", url: "/targets", icon: Sparkles },
    { title: "Coleta Guiada", url: "/collection", icon: ClipboardList },
    { title: "Timeline", url: "/timeline", icon: History },
    { title: "Evidências", url: "/evidences", icon: FolderOpen },
    { title: "Pendências", url: "/pending", icon: AlertTriangle },
    { title: "Relatório Preliminar", url: "/reports", icon: Download },
  ],
};

export function AppSidebar({ role }: { role: AppRole | null }) {
  const items = role ? NAV[role] : [];
  const pathname = useRouterState({ select: (s) => s.location.pathname });

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
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = pathname === item.url || pathname.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url} className="flex items-center gap-2">
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

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="px-2 py-2 text-[11px] text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">
          v0.1 · MVP
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}