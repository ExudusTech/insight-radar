import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Supabase pode devolver erro no hash (#error=...&error_code=otp_expired&error_description=...)
    if (typeof window !== "undefined" && window.location.hash) {
      const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const errCode = params.get("error_code") || params.get("error");
      const errDesc = params.get("error_description");
      if (errCode) {
        const msg =
          errCode === "otp_expired"
            ? "Este link expirou (validade de 1 hora). Solicite um novo link de acesso ao administrador."
            : errDesc?.replace(/\+/g, " ") || "Link inválido. Solicite um novo ao administrador.";
        setLinkError(msg);
        setReady(true);
        return;
      }
    }
    // Caso normal: Supabase processa o token de recovery e cria sessão.
    const sub = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setHasSession(true);
      setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setReady(true);
    });
    return () => sub.data.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não conferem.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Senha definida com sucesso.");
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen w-full grid place-items-center bg-sidebar text-sidebar-foreground p-6">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold font-display">Definir nova senha</h1>
          <p className="text-sm text-muted-foreground">
            Por segurança, cadastre uma nova senha para acessar o sistema.
          </p>
        </div>

        {!ready ? (
          <div className="grid place-items-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : linkError || !hasSession ? (
          <div className="space-y-3 text-sm">
            <p className="text-destructive">
              {linkError ?? "Link inválido ou expirado. Solicite um novo link de acesso ao administrador."}
            </p>
            <Button variant="outline" onClick={() => navigate({ to: "/auth" })}>
              Ir para login
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nova senha</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Confirmar nova senha</Label>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar e entrar
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}