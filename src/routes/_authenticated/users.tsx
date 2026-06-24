import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUser, ROLE_LABEL, type AppRole } from "@/hooks/use-current-user";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/users")({
  component: UsersPage,
});

type Row = {
  id: string;
  full_name: string | null;
  email: string | null;
  organization: string | null;
  status: string | null;
  role: AppRole | null;
};

function UsersPage() {
  const { data: me, isLoading: meLoading } = useCurrentUser();

  if (!meLoading && me?.role !== "superadmin") {
    throw redirect({ to: "/dashboard" });
  }

  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async (): Promise<Row[]> => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, organization, status"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const roleMap = new Map<string, AppRole>();
      const priority: AppRole[] = ["superadmin", "contractor", "analyst"];
      for (const r of roles ?? []) {
        const cur = roleMap.get(r.user_id);
        if (!cur || priority.indexOf(r.role as AppRole) < priority.indexOf(cur)) {
          roleMap.set(r.user_id, r.role as AppRole);
        }
      }
      return (profiles ?? []).map((p) => ({
        ...p,
        role: roleMap.get(p.id) ?? null,
      }));
    },
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role atualizada");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, current }: { id: string; current: string | null }) => {
      const next = current === "blocked" ? "active" : "blocked";
      const { error } = await supabase.from("profiles").update({ status: next }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
      <Card className="overflow-x-auto">
        {isLoading ? (
          <div className="grid place-items-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Organização</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.full_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.email}</TableCell>
                  <TableCell className="text-muted-foreground">{r.organization ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "blocked" ? "destructive" : "secondary"}>
                      {r.status ?? "active"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{r.role ? ROLE_LABEL[r.role] : "—"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Select
                        value={r.role ?? ""}
                        onValueChange={(v) => setRole.mutate({ userId: r.id, role: v as AppRole })}
                      >
                        <SelectTrigger className="w-[150px] h-8">
                          <SelectValue placeholder="Promover" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="superadmin">Superadmin</SelectItem>
                          <SelectItem value="contractor">Contratante</SelectItem>
                          <SelectItem value="analyst">Analista</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant={r.status === "blocked" ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleStatus.mutate({ id: r.id, current: r.status })}
                      >
                        {r.status === "blocked" ? "Ativar" : "Bloquear"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}