import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser, ROLE_LABEL, type AppRole } from "@/hooks/use-current-user";
import { Switch } from "@/components/ui/switch";
import { Loader2, ChevronDown, ChevronUp, UserPlus, Search, Mail, KeyRound, Copy, MoreHorizontal, Users as UsersIcon, RefreshCw, Eye, EyeOff, ShieldAlert } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { inviteUser } from "@/lib/invite-user.functions";
import { sendAccessEmail, generateAccessLink } from "@/lib/access-link.functions";
import { setInitialPassword } from "@/lib/set-initial-password.functions";
import { logActivity } from "@/lib/activity-log";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/users")({
  beforeLoad: async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw redirect({ to: "/auth" });
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: auth.user.id,
      _role: "superadmin",
    });
    if (!isAdmin) throw redirect({ to: "/dashboard" });
  },
  component: UsersPage,
});

type Row = {
  id: string;
  full_name: string | null;
  email: string | null;
  organization: string | null;
  status: string | null;
  role: AppRole | null;
  created_at?: string | null;
  accepts_missions?: boolean | null;
  can_view_strategic?: boolean | null;
};

const ROLE_BADGE: Record<AppRole, string> = {
  superadmin: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  coordinator: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  contractor: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  analyst: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};

function UsersPage() {
  const { data: me } = useCurrentUser();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState<AppRole | "all">("all");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async (): Promise<Row[]> => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, organization, status, created_at, accepts_missions, can_view_strategic"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const roleMap = new Map<string, AppRole>();
      const priority: AppRole[] = ["superadmin", "coordinator", "contractor", "analyst"];
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

  const toggleAccepts = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: boolean }) => {
      const { error } = await supabase.from("profiles").update({ accepts_missions: next }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      if (me?.id) {
        logActivity({
          userId: me.id,
          action: "analyst_availability_changed",
          entityType: "user",
          entityId: vars.id,
          details: { target_user_id: vars.id, next: vars.next },
        });
      }
      toast.success(vars.next ? "Analista disponível para demandas" : "Analista bloqueado para novas demandas");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const toggleStrategic = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: boolean }) => {
      const { error } = await supabase.from("profiles").update({ can_view_strategic: next }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      if (me?.id) {
        logActivity({
          userId: me.id,
          action: "strategic_access_changed",
          entityType: "user",
          entityId: vars.id,
          details: { target_user_id: vars.id, next: vars.next },
        });
      }
      toast.success(vars.next ? "Acesso à Visão Estratégica concedido" : "Acesso à Visão Estratégica removido");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      if (me?.id) {
        logActivity({
          userId: me.id,
          action: "user_role_changed",
          entityType: "user",
          entityId: vars.userId,
          details: { target_user_id: vars.userId, new_role: vars.role },
        });
      }
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
      return { from: current ?? "active", to: next };
    },
    onSuccess: (res, vars) => {
      if (me?.id) {
        logActivity({
          userId: me.id,
          action: "user_status_changed",
          entityType: "user",
          entityId: vars.id,
          details: { target_user_id: vars.id, from: res.from, to: res.to },
        });
      }
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const sendEmail = useServerFn(sendAccessEmail);
  const sendEmailMut = useMutation({
    mutationFn: (userId: string) => sendEmail({ data: { userId } }),
    onSuccess: (r) => toast.success(`Email de acesso enviado para ${r.email}`),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao enviar"),
  });

  const genLink = useServerFn(generateAccessLink);
  const [resetDialog, setResetDialog] = useState<{ userId: string; email: string } | null>(null);

  const filtered = rows.filter((r) => {
    if (roleFilter !== "all" && r.role !== roleFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (r.full_name ?? "").toLowerCase().includes(q) ||
      (r.email ?? "").toLowerCase().includes(q) ||
      (r.organization ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} de {rows.length} {rows.length === 1 ? "usuário" : "usuários"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setCreateOpen((v) => !v)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Novo usuário
          {createOpen ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
        </Button>
      </div>

      {createOpen && <CreateUserCard onCreated={() => qc.invalidateQueries({ queryKey: ["admin", "users"] })} />}

      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email ou organização..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <ToggleGroup
          type="single"
          value={roleFilter}
          onValueChange={(v) => v && setRoleFilter(v as AppRole | "all")}
          className="justify-start flex-wrap"
        >
          <ToggleGroupItem value="all" size="sm">Todos</ToggleGroupItem>
          <ToggleGroupItem value="superadmin" size="sm">Superadmin</ToggleGroupItem>
          <ToggleGroupItem value="coordinator" size="sm">Coordenador</ToggleGroupItem>
          <ToggleGroupItem value="contractor" size="sm">Cliente</ToggleGroupItem>
          <ToggleGroupItem value="analyst" size="sm">Analista</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-9 w-full" />
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 grid place-items-center text-center">
          <UsersIcon className="h-8 w-8 text-muted-foreground mb-3" />
          <div className="text-sm font-medium">Nenhum usuário encontrado</div>
          <div className="text-xs text-muted-foreground mt-1">Ajuste a busca ou o filtro de role.</div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((r) => (
            <UserCard
              key={r.id}
              row={r}
              isSuperadmin={me?.role === "superadmin"}
              onToggleAccepts={(next) => toggleAccepts.mutate({ id: r.id, next })}
              onToggleStrategic={(next) => toggleStrategic.mutate({ id: r.id, next })}
              onSetRole={(role) => setRole.mutate({ userId: r.id, role })}
              onToggleStatus={() => toggleStatus.mutate({ id: r.id, current: r.status })}
              onResetPassword={() => setResetDialog({ userId: r.id, email: r.email ?? "" })}
              onSendEmail={() => sendEmailMut.mutate(r.id)}
              resetPending={false}
              emailPending={sendEmailMut.isPending && sendEmailMut.variables === r.id}
            />
          ))}
        </div>
      )}

      <ResetPasswordDialog
        target={resetDialog}
        onClose={() => setResetDialog(null)}
        genLink={genLink}
        sendEmailMut={sendEmailMut}
      />
    </div>
  );
}

function UserCard({
  row,
  isSuperadmin,
  onToggleAccepts,
  onToggleStrategic,
  onSetRole,
  onToggleStatus,
  onResetPassword,
  onSendEmail,
  resetPending,
  emailPending,
}: {
  row: Row;
  isSuperadmin: boolean;
  onToggleAccepts: (next: boolean) => void;
  onToggleStrategic: (next: boolean) => void;
  onSetRole: (role: AppRole) => void;
  onToggleStatus: () => void;
  onResetPassword: () => void;
  onSendEmail: () => void;
  resetPending: boolean;
  emailPending: boolean;
}) {
  const blocked = row.status === "blocked";
  const initial = (row.full_name ?? row.email ?? "?").slice(0, 1).toUpperCase();
  return (
    <Card
      className={`p-5 flex flex-col gap-4 transition-opacity ${blocked ? "opacity-70" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-muted grid place-items-center text-sm font-semibold text-foreground/80 border border-white/5 shrink-0">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{row.full_name ?? "—"}</div>
          <div className="text-xs text-muted-foreground truncate">{row.email}</div>
          {row.organization && (
            <div className="text-xs text-muted-foreground/80 truncate">{row.organization}</div>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={async () => {
                if (row.email) {
                  await navigator.clipboard.writeText(row.email);
                  toast.success("Email copiado");
                }
              }}
            >
              Copiar email
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={async () => {
                await navigator.clipboard.writeText(row.id);
                toast.success("ID copiado");
              }}
            >
              Copiar ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onToggleStatus}>
              {blocked ? "Ativar usuário" : "Bloquear usuário"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {row.role ? (
          <Badge variant="outline" className={ROLE_BADGE[row.role]}>
            {ROLE_LABEL[row.role]}
          </Badge>
        ) : (
          <Badge variant="outline">Sem role</Badge>
        )}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className={`h-1.5 w-1.5 rounded-full ${blocked ? "bg-red-500" : "bg-emerald-500"}`}
          />
          {blocked ? "Bloqueado" : "Ativo"}
        </div>
        {row.created_at && (
          <span className="text-xs text-muted-foreground ml-auto">
            {new Date(row.created_at).toLocaleDateString("pt-BR")}
          </span>
        )}
      </div>

      {isSuperadmin && (
        <div className="border-t border-border/50 pt-3 space-y-2">
          {row.role === "analyst" && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground/80">Disponível para missões</span>
              <Switch
                checked={row.accepts_missions ?? true}
                onCheckedChange={onToggleAccepts}
              />
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs text-foreground/80">Visão Estratégica</span>
            <Switch
              checked={row.can_view_strategic ?? false}
              onCheckedChange={onToggleStrategic}
            />
          </div>
        </div>
      )}

      <div className="border-t border-border/50 pt-3 space-y-2 mt-auto">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-12">Role</span>
          <Select
            value={row.role ?? ""}
            onValueChange={(v) => onSetRole(v as AppRole)}
          >
            <SelectTrigger className="h-8 flex-1">
              <SelectValue placeholder="Definir" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="superadmin">Superadmin</SelectItem>
              <SelectItem value="coordinator">Coordenador</SelectItem>
              <SelectItem value="contractor">Cliente</SelectItem>
              <SelectItem value="analyst">Analista</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onResetPassword}
            disabled={resetPending}
          >
            {resetPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <KeyRound className="h-3.5 w-3.5 mr-1" />
            )}
            Senha
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onSendEmail}
            disabled={emailPending}
          >
            {emailPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Mail className="h-3.5 w-3.5 mr-1" />
            )}
            Email
          </Button>
          <Button
            variant={blocked ? "default" : "outline"}
            size="sm"
            onClick={onToggleStatus}
          >
            {blocked ? "Ativar" : "Bloquear"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function CreateUserCard({ onCreated }: { onCreated: () => void }) {
  const invite = useServerFn(inviteUser);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    organization: "",
    role: "analyst" as AppRole,
  });
  const [lastCreated, setLastCreated] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      invite({
        data: {
          email: form.email.trim(),
          full_name: form.full_name.trim(),
          organization: form.organization.trim() || undefined,
          role: form.role,
        },
      }),
    onSuccess: (res) => {
      if (res?.emailSent) {
        toast.success(`Usuário ${form.full_name} criado. Email de acesso enviado.`);
      } else {
        toast.warning(
          `Usuário ${form.full_name} criado, mas o email falhou${res?.emailError ? `: ${res.emailError}` : ""}`,
        );
      }
      setLastCreated(form.full_name);
      setForm({ full_name: "", email: "", organization: "", role: "analyst" });
      onCreated();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao criar usuário"),
  });

  return (
    <Card className="p-6 space-y-4 border-primary/30">
      <h2 className="text-base font-semibold">Criar novo usuário</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.full_name.trim() || !form.email.trim()) {
            toast.error("Nome e email são obrigatórios");
            return;
          }
          mutation.mutate();
        }}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        <Field label="Nome completo *">
          <Input
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            maxLength={100}
            required
          />
        </Field>
        <Field label="Email *">
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            maxLength={255}
            required
          />
        </Field>
        <Field label="Organização">
          <Input
            value={form.organization}
            onChange={(e) => setForm({ ...form, organization: e.target.value })}
            maxLength={150}
          />
        </Field>
        <Field label="Role">
          <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AppRole })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="analyst">Analista</SelectItem>
            <SelectItem value="coordinator">Coordenador</SelectItem>
              <SelectItem value="contractor">Cliente</SelectItem>
              <SelectItem value="superadmin">Superadmin</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div className="sm:col-span-2 flex justify-end">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Criando..." : "Criar usuário"}
          </Button>
        </div>
      </form>
      {lastCreated && (
        <div className="text-xs text-muted-foreground border-t border-border pt-3">
          ✓ <strong>{lastCreated}</strong> criado. O usuário ainda não tem senha — envie o link para redefinição:{" "}
          <a
            href="https://insights-radar.exudustech.com.br/auth"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            insights-radar.exudustech.com.br/auth
          </a>
        </div>
      )}
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}