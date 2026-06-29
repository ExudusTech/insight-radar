import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ChevronDown, ChevronUp, Plus, Search, Pencil, Trash2 } from "lucide-react";
import {
  createProduct,
  deleteProduct,
  listProducts,
  productsListKey,
  updateProduct,
} from "@/lib/products.queries";
import { listProfilesWithRole } from "@/lib/missions.queries";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/products")({
  beforeLoad: async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw redirect({ to: "/auth" });
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: auth.user.id,
      _role: "superadmin",
    });
    if (!isAdmin) throw redirect({ to: "/dashboard" });
  },
  component: ProductsPage,
});

function ProductsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: productsListKey,
    queryFn: listProducts,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["profiles", "role", "contractor"],
    queryFn: () => listProfilesWithRole("contractor"),
  });

  const removeMut = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      toast.success("Produto excluído");
      qc.invalidateQueries({ queryKey: productsListKey });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const filtered = products.filter((p) =>
    !search.trim() ? true : (p.name ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Produtos</h1>
        <Button variant="outline" size="sm" onClick={() => setCreateOpen((v) => !v)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo produto
          {createOpen ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
        </Button>
      </div>

      {createOpen && (
        <ProductForm
          clients={clients}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: productsListKey });
            setCreateOpen(false);
          }}
        />
      )}

      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome..."
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
                <TableHead>Nome</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const client = (p as { client?: { full_name: string | null; email: string | null } | null }).client;
                const isEditing = editing === p.id;
                if (isEditing) {
                  return (
                    <TableRow key={p.id}>
                      <TableCell colSpan={5}>
                        <ProductForm
                          clients={clients}
                          initial={p}
                          onSaved={() => {
                            qc.invalidateQueries({ queryKey: productsListKey });
                            setEditing(null);
                          }}
                          onCancel={() => setEditing(null)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                }
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {client?.full_name || client?.email || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.segment ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {p.created_at ? new Date(p.created_at).toLocaleDateString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditing(p.id)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (confirm(`Excluir "${p.name}"?`)) removeMut.mutate(p.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                    Nenhum produto cadastrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

type ClientLite = { id: string; full_name: string | null; email: string | null };

function ProductForm({
  clients,
  initial,
  onSaved,
  onCancel,
}: {
  clients: ClientLite[];
  initial?: { id: string; client_id: string; name: string; description: string | null; segment: string | null };
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState({
    client_id: initial?.client_id ?? "",
    name: initial?.name ?? "",
    segment: initial?.segment ?? "",
    description: initial?.description ?? "",
  });

  const mut = useMutation({
    mutationFn: async () => {
      const payload = {
        client_id: form.client_id,
        name: form.name.trim(),
        segment: form.segment.trim() || null,
        description: form.description.trim() || null,
      };
      if (initial) return updateProduct(initial.id, payload);
      return createProduct(payload);
    },
    onSuccess: () => {
      toast.success(initial ? "Produto atualizado" : "Produto criado");
      onSaved();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <Card className="p-6 space-y-4 border-primary/30">
      <h2 className="text-base font-semibold">{initial ? "Editar produto" : "Novo produto"}</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.name.trim()) return toast.error("Nome é obrigatório");
          if (!form.client_id) return toast.error("Cliente é obrigatório");
          mut.mutate();
        }}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Nome do produto *</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Cliente *</Label>
          <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
            <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
            <SelectContent>
              {clients.length === 0 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum cliente cadastrado</div>
              )}
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.full_name || c.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Segmento</Label>
          <Input value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs font-medium">Descrição</Label>
          <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="sm:col-span-2 flex justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
          )}
          <Button type="submit" disabled={mut.isPending}>
            {mut.isPending ? "Salvando..." : initial ? "Salvar" : "Criar produto"}
          </Button>
        </div>
      </form>
    </Card>
  );
}