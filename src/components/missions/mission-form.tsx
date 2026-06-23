import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
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

export function MissionForm() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: contractors = [] } = useQuery({
    queryKey: ["profiles", "role", "contractor"],
    queryFn: () => listProfilesWithRole("contractor"),
  });
  const { data: analysts = [] } = useQuery({
    queryKey: ["profiles", "role", "analyst"],
    queryFn: () => listProfilesWithRole("analyst"),
  });

  const [form, setForm] = useState({
    name: "",
    description: "",
    objective: "",
    segment: "",
    contractor_id: "",
    deadline_first: "",
    deadline_final: "",
    target_label: "Concorrente",
  });
  const [selectedAnalysts, setSelectedAnalysts] = useState<string[]>([]);

  const mutation = useMutation({
    mutationFn: () =>
      createMission({
        name: form.name.trim(),
        description: form.description || null,
        objective: form.objective || null,
        segment: form.segment || null,
        contractor_id: form.contractor_id || null,
        deadline_first: form.deadline_first || null,
        deadline_final: form.deadline_final || null,
        target_label: form.target_label.trim() || "Concorrente",
        analyst_ids: selectedAnalysts,
      }),
    onSuccess: (m) => {
      toast.success("Missão criada");
      qc.invalidateQueries({ queryKey: missionsListKey });
      navigate({ to: "/missions/$missionId", params: { missionId: m.id } });
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
          <Field label="Contratante">
            <Select value={form.contractor_id} onValueChange={(v) => setForm({ ...form, contractor_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {contractors.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum contratante cadastrado</div>
                )}
                {contractors.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.full_name || c.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
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