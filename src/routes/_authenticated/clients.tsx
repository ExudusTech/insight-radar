import { createFileRoute } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/clients")({
  component: ClientsPage,
  head: () => ({
    meta: [
      { title: "Clientes — Exudus Radar" },
      { name: "description", content: "Gestão comercial de clientes" },
    ],
  }),
});

function ClientsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">Gestão comercial de clientes</p>
        </div>
      </div>

      <Card className="border border-dashed border-muted-foreground/30 bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Em breve</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Gestão de clientes — em breve. Aqui serão exibidos planos, cobranças e contatos comerciais.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
