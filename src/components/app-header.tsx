import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Bell, LogOut, User as UserIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import type { CurrentUser } from "@/hooks/use-current-user";
import { ROLE_LABEL } from "@/hooks/use-current-user";
import { countUnread, notificationsUnreadKey } from "@/lib/notifications.queries";

function initials(name?: string | null) {
  if (!name) return "U";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function titleFor(path: string): string {
  const map: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/missions": "Missões",
    "/documents": "Documento-base",
    "/targets": "Alvos",
    "/collection": "Coleta Guiada",
    "/evidences": "Evidências",
    "/timeline": "Timeline",
    "/comparative": "Comparativo",
    "/reports": "Relatórios",
    "/users": "Usuários",
    "/change-requests": "Solicitações de Mudança",
    "/logs": "Logs",
    "/settings": "Configurações",
    "/journey": "Jornada",
    "/ask-ai": "Perguntar à IA",
    "/downloads": "Downloads",
    "/next-actions": "Próximas Ações",
    "/pending": "Pendências",
  };
  return map[path] ?? "Radar";
}

export function AppHeader({ user }: { user: CurrentUser | null }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
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

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card/95 backdrop-blur px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs text-muted-foreground">Radar</span>
        <span className="text-xs text-muted-foreground">/</span>
        <span className="text-sm font-medium truncate">{titleFor(pathname)}</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={() => navigate({ to: "/notificacoes" })}
          aria-label="Notificações"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]" variant="destructive">
              {unread}
            </Badge>
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {initials(user?.profile?.full_name ?? user?.email)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col items-start leading-tight">
                <span className="text-xs font-medium">{user?.profile?.full_name ?? user?.email}</span>
                <span className="text-[10px] text-muted-foreground">
                  {user?.role ? ROLE_LABEL[user.role] : "—"}
                </span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <UserIcon className="h-4 w-4" />
              <span>Meu perfil</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}