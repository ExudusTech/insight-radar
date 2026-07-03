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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUser, ROLE_LABEL, type AppRole } from "@/hooks/use-current-user";
import { Switch } from "@/components/ui/switch";
import { Loader2, ChevronDown, ChevronUp, UserPlus, Search, Mail, Link2, Copy } from "lucide-react";
import { inviteUser } from "@/lib/invite-user.functions";
import { sendAccessEmail, generateAccessLink } from "@/lib/access-link.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  contractor: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  analyst: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};

function UsersPage() {
  const { data: me } = useCurrentUser();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async (): Promise<Row[]> => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, organization, status, created_at, accepts_missions, can_view_strategic"),
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

  const toggleAccepts = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: boolean }) => {
      const { error } = await supabase.from("profiles").update({ accepts_missions: next }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
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

  const sendEmail = useServerFn(sendAccessEmail);
  const sendEmailMut = useMutation({
    mutationFn: (userId: string) => sendEmail({ data: { userId } }),
    onSuccess: (r) => toast.success(`Email de acesso enviado para ${r.email}`),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao enviar"),
  });

  const genLink = useServerFn(generateAccessLink);
  const [linkDialog, setLinkDialog] = useState<{ link: string; email: string } | null>(null);
  const genLinkMut = useMutation({
    mutationFn: (userId: string) => genLink({ data: { userId } }),
    onSuccess: (r) => setLinkDialog({ link: r.link, email: r.email }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao gerar link"),
  });

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (r.full_name ?? "").toLowerCase().includes(q) ||
      (r.email ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
        <Button variant="outline" size="sm" onClick={() => setCreateOpen((v) => !v)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Novo usuário
          {createOpen ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
        </Button>
      </div>

      {createOpen && <CreateUserCard onCreated={() => qc.invalidateQueries({ queryKey: ["admin", "users"] })} />}

      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card className="overflow-x-auto">
        {isLoading ? (
          <div className="grid place-items-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]"></TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Organização</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="h-8 w-8 rounded-full bg-muted grid place-items-center text-xs font-semibold text-foreground/80">
                      {(r.full_name ?? r.email ?? "?").slice(0, 1).toUpperCase()}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{r.full_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.email}</TableCell>
                  <TableCell className="text-muted-foreground">{r.organization ?? "—"}</TableCell>
                  <TableCell>
                    {r.role ? (
                      <Badge variant="outline" className={ROLE_BADGE[r.role]}>
                        {ROLE_LABEL[r.role]}
                      </Badge>
                    ) : (
                      <Badge variant="outline">—</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.status === "blocked" ? "destructive" : "secondary"}>
                      {r.status ?? "active"}
                    </Badge>
                    {r.role === "analyst" && me?.role === "superadmin" && (
                      <div className="flex items-center gap-2 mt-2">
                        <Switch
                          checked={r.accepts_missions ?? true}
                          onCheckedChange={(val) => toggleAccepts.mutate({ id: r.id, next: val })}
                        />
                        <span className="text-xs text-muted-foreground">
                          {r.accepts_missions ?? true ? "Disponível" : "Bloqueado"}
                        </span>
                      </div>
                    )}
                    {me?.role === "superadmin" && (
                      <div className="flex items-center gap-2 mt-2">
                        <Switch
                          checked={r.can_view_strategic ?? false}
                          onCheckedChange={(val) => toggleStrategic.mutate({ id: r.id, next: val })}
                        />
                        <span className="text-xs text-muted-foreground">
                          Visão Estratégica
                        </span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {r.created_at ? new Date(r.created_at).toLocaleDateString("pt-BR") : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Enviar email de acesso"
                        disabled={sendEmailMut.isPending && sendEmailMut.variables === r.id}
                        onClick={() => sendEmailMut.mutate(r.id)}
                      >
                        {sendEmailMut.isPending && sendEmailMut.variables === r.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Mail className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Gerar link de acesso (1h)"
                        disabled={genLinkMut.isPending && genLinkMut.variables === r.id}
                        onClick={() => genLinkMut.mutate(r.id)}
                      >
                        {genLinkMut.isPending && genLinkMut.variables === r.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Link2 className="h-4 w-4" />
                        )}
                      </Button>
                      <Select
                        value={r.role ?? ""}
                        onValueChange={(v) => setRole.mutate({ userId: r.id, role: v as AppRole })}
                      >
                        <SelectTrigger className="w-[150px] h-8">
                          <SelectValue placeholder="Promover" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="superadmin">Superadmin</SelectItem>
                          <SelectItem value="contractor">Cliente</SelectItem>
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
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={!!linkDialog} onOpenChange={(o) => !o && setLinkDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link de acesso para {linkDialog?.email}</DialogTitle>
            <DialogDescription>
              Link válido por <strong>1 hora</strong>. Ao abrir, o usuário será obrigado a cadastrar uma nova senha.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input readOnly value={linkDialog?.link ?? ""} onFocus={(e) => e.currentTarget.select()} />
            <Button
              variant="outline"
              size="icon"
              onClick={async () => {
                if (linkDialog?.link) {
                  await navigator.clipboard.writeText(linkDialog.link);
                  toast.success("Link copiado");
                }
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
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