import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type AppRole = "superadmin" | "contractor" | "analyst";

export interface CurrentUser {
  id: string;
  email: string;
  profile: Tables<"profiles"> | null;
  role: AppRole | null;
}

export const currentUserQueryKey = ["current-user"] as const;

export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return null;

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  const priority: AppRole[] = ["superadmin", "contractor", "analyst"];
  const role = priority.find((r) => roles?.some((row) => row.role === r)) ?? null;

  return {
    id: user.id,
    email: user.email ?? "",
    profile: profile ?? null,
    role,
  };
}

export function useCurrentUser() {
  return useQuery({
    queryKey: currentUserQueryKey,
    queryFn: fetchCurrentUser,
    staleTime: 30_000,
  });
}

export const ROLE_LABEL: Record<AppRole, string> = {
  superadmin: "Superadmin",
  contractor: "Contratante",
  analyst: "Analista",
};