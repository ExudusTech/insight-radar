import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AppFooter } from "@/components/app-footer";
import exudusLogo from "@/assets/exudus-logo-new.jpeg.asset.json";

export const Route = createFileRoute("/auth")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: AuthPage,
});

function AuthPage() {
  return (
    <div className="min-h-screen w-full flex flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex flex-1 min-h-0">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-black via-[oklch(0.12_0.02_25)] to-[oklch(0.18_0.08_25)] relative overflow-hidden flex-1">
        {/* Gradient mesh atmosphere */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-primary/10 blur-2xl" />
        </div>
        <div className="relative flex items-center gap-3">
          <div className="text-base font-semibold tracking-tight">Radar de Mercado IA</div>
          <div className="text-xs text-sidebar-foreground/60">por ExudusTech</div>
        </div>
        <div className="relative flex flex-col items-center justify-center flex-1 py-10">
          <img
            src={exudusLogo.url}
            alt="EXUDUS"
            className="w-full max-w-[360px] mb-8 drop-shadow-[0_0_60px_rgba(255,255,255,0.12)]"
          />
          <div className="max-w-md text-center space-y-5">
            <h1 className="text-5xl font-bold leading-tight tracking-tight font-display">
              Inteligência de mercado, com método e evidência.
            </h1>
            <p className="text-sidebar-foreground/70 text-base leading-relaxed">
              Gerencie missões de pesquisa competitiva ponta a ponta — do documento-base
              às análises com IA, com auditoria e governança em cada etapa.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-4">
              {["Coleta guiada", "Análise por IA", "Timeline de evidências", "Comparativos estratégicos"].map((f) => (
                <div key={f} className="rounded-md border border-white/10 bg-white/5 backdrop-blur-sm px-3 py-2 text-xs text-sidebar-foreground/80 hover:bg-white/10 transition-colors">
                  {f}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="relative text-xs text-sidebar-foreground/40">
          © {new Date().getFullYear()} ExudusTech · Plataforma SaaS B2B
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background text-foreground">
        <Card className="w-full max-w-md p-8 shadow-[var(--shadow-elevated)]">
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <img src={exudusLogo.url} alt="ExudusTech" className="h-9 w-9 rounded-lg object-cover" />
            <div className="text-sm font-semibold">Radar de Mercado IA</div>
          </div>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid grid-cols-2 w-full mb-6">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <SignInForm />
            </TabsContent>
            <TabsContent value="signup">
              <SignUpForm />
            </TabsContent>
          </Tabs>
        </Card>
      </div>
      </div>
      <AppFooter />
    </div>
  );
}

function SignInForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("Falha no login", { description: error.message });
      return;
    }
    toast.success("Bem-vindo de volta");
    navigate({ to: "/dashboard" });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Acesse sua conta</h2>
        <p className="text-sm text-muted-foreground">Entre com seu e-mail corporativo.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="signin-email">E-mail</Label>
        <Input id="signin-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signin-password">Senha</Label>
        <Input id="signin-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Entrar
      </Button>
    </form>
  );
}

function SignUpForm() {
  const [fullName, setFullName] = useState("");
  const [organization, setOrganization] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: fullName, organization },
      },
    });
    setLoading(false);
    if (error) {
      toast.error("Falha ao criar conta", { description: error.message });
      return;
    }
    toast.success("Conta criada", {
      description: "Verifique seu e-mail para confirmar. O Superadmin precisa promover seu acesso.",
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Criar nova conta</h2>
        <p className="text-sm text-muted-foreground">Novos usuários entram como Analista. Um Superadmin pode promover.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2 col-span-2">
          <Label htmlFor="su-name">Nome completo</Label>
          <Input id="su-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-2 col-span-2">
          <Label htmlFor="su-org">Organização</Label>
          <Input id="su-org" value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="ExudusTech" />
        </div>
        <div className="space-y-2 col-span-2">
          <Label htmlFor="su-email">E-mail</Label>
          <Input id="su-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2 col-span-2">
          <Label htmlFor="su-pass">Senha</Label>
          <Input id="su-pass" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Criar conta
      </Button>
    </form>
  );
}