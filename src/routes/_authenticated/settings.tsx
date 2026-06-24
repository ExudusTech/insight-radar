import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentUser, currentUserQueryKey } from "@/hooks/use-current-user";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { data: user, isLoading } = useCurrentUser();
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [organization, setOrganization] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (user?.profile) {
      setFullName(user.profile.full_name ?? "");
      setOrganization(user.profile.organization ?? "");
      setPhone(user.profile.phone ?? "");
    }
  }, [user]);

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sem usuário");
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, organization, phone })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perfil atualizado");
      qc.invalidateQueries({ queryKey: currentUserQueryKey });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  if (isLoading) {
    return <div className="grid place-items-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
      <Card className="p-6 space-y-4">
        <h2 className="font-semibold">Perfil</h2>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={user?.email ?? ""} disabled />
        </div>
        <div className="space-y-2">
          <Label>Nome completo</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Organização</Label>
          <Input value={organization} onChange={(e) => setOrganization(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Telefone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
        </Button>
      </Card>
      <Card className="p-6">
        <h2 className="font-semibold">Segurança</h2>
        <p className="text-sm text-muted-foreground mt-2">Em breve.</p>
      </Card>
    </div>
  );
}