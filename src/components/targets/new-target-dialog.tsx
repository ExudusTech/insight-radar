import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { createTarget, targetsByMissionKey } from "@/lib/targets.queries";
import { TARGET_PRIORITY_LABEL, TARGET_PRIORITY_ORDER, type TargetPriority } from "@/lib/target-status";

export function NewTargetDialog({ missionId, targetLabel }: { missionId: string; targetLabel: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    brand: "",
    category: "",
    site: "",
    instagram: "",
    whatsapp: "",
    linkedin: "",
    other_links: "",
    notes: "",
    priority: "medium" as TargetPriority,
  });

  const mutation = useMutation({
    mutationFn: () =>
      createTarget({
        mission_id: missionId,
        name: form.name.trim(),
        brand: form.brand || null,
        category: form.category || null,
        site: form.site || null,
        instagram: form.instagram || null,
        whatsapp: form.whatsapp || null,
        linkedin: form.linkedin || null,
        other_links: form.other_links || null,
        notes: form.notes || null,
        priority: form.priority,
      }),
    onSuccess: () => {
      toast.success(`${targetLabel} criado`);
      qc.invalidateQueries({ queryKey: targetsByMissionKey(missionId) });
      setOpen(false);
      setForm({
        name: "", brand: "", category: "", site: "", instagram: "",
        whatsapp: "", linkedin: "", other_links: "", notes: "", priority: "medium",
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Novo {targetLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo {targetLabel}</DialogTitle>
        </DialogHeader>
        <form
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.name.trim()) {
              toast.error("Nome é obrigatório");
              return;
            }
            mutation.mutate();
          }}
        >
          <Field label="Nome*" className="sm:col-span-2">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="Marca">
            <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
          </Field>
          <Field label="Categoria / segmento">
            <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </Field>
          <Field label="Site" className="sm:col-span-2">
            <Input type="url" placeholder="https://..." value={form.site}
              onChange={(e) => setForm({ ...form, site: e.target.value })} />
          </Field>
          <Field label="Instagram (URL)">
            <Input type="url" placeholder="https://instagram.com/..." value={form.instagram}
              onChange={(e) => setForm({ ...form, instagram: e.target.value })} />
          </Field>
          <Field label="WhatsApp">
            <Input placeholder="+55..." value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
          </Field>
          <Field label="LinkedIn">
            <Input type="url" placeholder="https://linkedin.com/..." value={form.linkedin}
              onChange={(e) => setForm({ ...form, linkedin: e.target.value })} />
          </Field>
          <Field label="Outros links">
            <Input placeholder="Site pessoal, YouTube, etc." value={form.other_links}
              onChange={(e) => setForm({ ...form, other_links: e.target.value })} />
          </Field>
          <Field label="Prioridade">
            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as TargetPriority })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TARGET_PRIORITY_ORDER.map((p) => (
                  <SelectItem key={p} value={p}>{TARGET_PRIORITY_LABEL[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Observações" className="sm:col-span-2">
            <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Criando..." : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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