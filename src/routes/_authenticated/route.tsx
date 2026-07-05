import { createFileRoute, Outlet, redirect, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { AppFooter } from "@/components/app-footer";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { userId: data.user.id };
  },
  component: AuthenticatedShell,
});

function AuthenticatedShell() {
  const { data: user, isLoading } = useCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();
  const mustChange = user?.profile?.must_change_password === true;

  useEffect(() => {
    if (mustChange) {
      navigate({ to: "/reset-password", search: { forced: 1 } as never, replace: true });
    }
  }, [mustChange, navigate, location.pathname]);

  if (isLoading || mustChange) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar role={user?.role ?? null} />
        <SidebarInset className="flex flex-col flex-1 min-w-0">
          <AppHeader user={user ?? null} />
          <main className="flex-1 p-6 bg-background">
            <Outlet />
          </main>
          <AppFooter />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}