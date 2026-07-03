import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  createMission,
  listProfilesWithRole,
  missionsListKey,
} from "@/lib/missions.queries";
import { listProductsByClient, productsByClientKey } from "@/lib/products.queries";
import { logActivity } from "@/lib/activity-log";
import { useCurrentUser } from "@/hooks/use-current-user";

export function MissionForm({ initialName = "" }: { initialName?: string } = {}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();

  const isContractor = user?.role === "contractor";

  const { data: contractors = [] } = useQuery({
    queryKey: ["profiles", "role", "contractor"],
    queryFn: () => listProfilesWithRole("contractor"),
    enabled: !isContractor,
  });
  const { data: analysts = [] } = useQuery({
    queryKey: ["profiles", "role", "analyst"],
    queryFn: () => listProfilesWithRole("analyst"),
  });

  const [form, setForm] = useState({
    name: initialName,
    description: "",
    objective: "",
    segment: "",
    contractor_id: isContractor ? user!.id : "",
    product_id: "",
    deadline_first: "",
    deadline_final: "",
    target_label: "Concorrente",
  });
  const [selectedAnalysts, setSelectedAnalysts] = useState<string[]>([]);
  const [selectedContractors, setSelectedContractors] = useState<string[]>([]);

  const { data: products = [] } = useQuery({
    queryKey: productsByClientKey(form.contractor_id),
    queryFn: () => listProductsByClient(form.contractor_id),
    enabled: !!form.contractor_id,
  });

  const mutation = useMutation({
    mutationFn: () =>
      createMission({
        name: form.name.trim(),
        description: form.description || null,
        objective: form.objective || null,
        segment: form.segment || null,
        contractor_id:
          user?.role === "contractor"
            ? user.id
            : form.contractor_id || null,
        product_id: form.product_id || null,
        deadline_first: form.deadline_first || null,
        deadline_final: form.deadline_final || null,
        target_label: form.target_label.trim() || "Concorrente",
        analyst_ids: selectedAnalysts,
        contractor_ids: selectedContractors.filter((id) => id !== form.contractor_id),
      }),
    onSuccess: (m) => {
      toast.success("Missão criada");
      qc.invalidateQueries({ queryKey: missionsListKey });
      navigate({ to: "/missions/$missionId", params: { missionId: m.id } });
      if (user?.id) {
        logActivity({
          userId: user.id,
          missionId: m.id,
          action: "mission_created",
          entityType: "mission",
          entityId: m.id,
          details: { name: m.name, segment: m.segment },
        });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.name.trim()) return toast.error("Nome da missão é obrigatório");
        mutation.mutate();
      }}
      className="space-y-6"
    >
      <Card className="p-6 space-y-4">
        <h2 className="text-base font-semibold">Identificação</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nome da missão*" className="sm:col-span-2">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="Segmento">
            <Input value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })} />
          </Field>
          <Field label="Rótulo dos alvos">
            <Input
              value={form.target_label}
              onChange={(e) => setForm({ ...form, target_label: e.target.value })}
              placeholder="Concorrente"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Como cada alvo desta missão será chamado na interface (ex: Concorrente, Consultor, Marca).
            </p>
          </Field>
          <Field label="Descrição" className="sm:col-span-2">
            <Textarea rows={3} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label="Objetivo" className="sm:col-span-2">
            <Textarea rows={3} value={form.objective}
              onChange={(e) => setForm({ ...form, objective: e.target.value })} />
          </Field>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-base font-semibold">Atribuições</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Cliente principal / Responsável">
            {isContractor ? (
              <Input
                value={user?.profile?.full_name || user?.email || "Você"}
                disabled
                readOnly
              />
            ) : (
            <Select value={form.contractor_id} onValueChange={(v) => setForm({ ...form, contractor_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {contractors.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum cliente cadastrado</div>
                )}
                {contractors.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.full_name || c.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            )}
          </Field>
          <Field label="Produto / Serviço analisado">
            {!form.contractor_id ? (
              <p className="text-xs text-muted-foreground">Selecione um cliente primeiro.</p>
            ) : products.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhum produto cadastrado para este cliente.{" "}
                <Link to="/products" className="text-primary underline">Cadastre em /products</Link>.
              </p>
            ) : (
              <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar (opcional)..." /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          {!isContractor && (
            <Field label="Acesso adicional (outros usuários do cliente)">
              <div className="rounded-md border border-border p-2 max-h-40 overflow-y-auto space-y-1.5">
                {contractors.filter((c) => c.id !== form.contractor_id).length === 0 && (
                  <div className="text-xs text-muted-foreground p-2">Nenhum outro cliente disponível</div>
                )}
                {contractors
                  .filter((c) => c.id !== form.contractor_id)
                  .map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={selectedContractors.includes(c.id)}
                        onCheckedChange={(v) =>
                          setSelectedContractors((prev) =>
                            v ? [...prev, c.id] : prev.filter((id) => id !== c.id),
                          )
                        }
                      />
                      <span className="truncate">{c.full_name || c.email}</span>
                    </label>
                  ))}
              </div>
            </Field>
          )}
          <Field label="Analistas atribuídos">
            <div className="rounded-md border border-border p-2 max-h-40 overflow-y-auto space-y-1.5">
              {analysts.length === 0 && (
                <div className="text-xs text-muted-foreground p-2">Nenhum analista cadastrado</div>
              )}
              {analysts.map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedAnalysts.includes(a.id)}
                    onCheckedChange={(v) =>
                      setSelectedAnalysts((prev) =>
                        v ? [...prev, a.id] : prev.filter((id) => id !== a.id),
                      )
                    }
                  />
                  <span className="truncate">{a.full_name || a.email}</span>
                </label>
              ))}
            </div>
          </Field>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-base font-semibold">Prazos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Primeira entrega">
            <Input type="date" value={form.deadline_first}
              onChange={(e) => setForm({ ...form, deadline_first: e.target.value })} />
          </Field>
          <Field label="Entrega final">
            <Input type="date" value={form.deadline_final}
              onChange={(e) => setForm({ ...form, deadline_final: e.target.value })} />
          </Field>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => navigate({ to: "/missions" })}>
          Cancelar
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Criando..." : "Criar missão"}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}