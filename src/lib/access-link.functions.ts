import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({ userId: z.string().uuid() });

const SITE_URL =
  process.env.SITE_URL ?? "https://insights-radar.exudustech.com.br";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function buildRecoveryLink(email: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${SITE_URL}/reset-password` },
  });
  if (error || !data?.properties?.action_link) {
    throw new Error(error?.message ?? "Falha ao gerar link");
  }
  return data.properties.action_link as string;
}

async function ensureSuperadmin(ctx: {
  supabase: ReturnType<typeof Object>;
  userId: string;
}) {
  const { data, error } = await (ctx.supabase as any).rpc("has_role", {
    _user_id: ctx.userId,
    _role: "superadmin",
  });
  if (error) throw new Error(`Falha ao validar permissão: ${error.message}`);
  if (!data) throw new Error("Apenas superadmin pode executar esta ação.");
}

async function lookupTarget(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("email, full_name")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data?.email) {
    throw new Error(error?.message ?? "Usuário sem email cadastrado");
  }
  return { email: data.email, full_name: data.full_name ?? data.email };
}

export const generateAccessLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    await ensureSuperadmin(context as any);
    const { email } = await lookupTarget(data.userId);
    const link = await buildRecoveryLink(email);
    // Supabase recovery links seguem o OTP_EXPIRY do projeto (default 3600s = 1h).
    return { link, email, expiresInMinutes: 60 as const };
  });

export const sendAccessEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    await ensureSuperadmin(context as any);
    const { email, full_name } = await lookupTarget(data.userId);
    const link = await buildRecoveryLink(email);
    const safeName = escapeHtml(full_name);
    const safeLink = escapeHtml(link);

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) throw new Error("RESEND_API_KEY não configurada");

    const html = `
      <div style="font-family:'DM Sans',Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#ffffff;color:#0f0f0f;">
        <h1 style="font-family:'Syne',Arial,sans-serif;font-size:24px;margin:0 0 16px;">
          Acesso ao ExudusTech Insights Radar
        </h1>
        <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">
          Olá <strong>${safeName}</strong>, um superadmin gerou um novo link de acesso para você.
        </p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 24px;">
          Clique no botão abaixo para definir sua senha e entrar. <strong>O link expira em 1 hora.</strong>
        </p>
        <p style="text-align:center;margin:24px 0;">
          <a href="${safeLink}" style="display:inline-block;background:#c8102e;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">
            Definir senha e acessar
          </a>
        </p>
        <p style="font-size:13px;color:#666;line-height:1.6;margin:24px 0 0;">
          Se o botão não funcionar, copie e cole no navegador:<br/>
          <span style="word-break:break-all;color:#c8102e;">${safeLink}</span>
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:32px 0;"/>
        <p style="font-size:12px;color:#999;margin:0;">ExudusTech — Insights Radar</p>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: "ExudusTech Insights Radar <notifications@exudustech.com.br>",
        to: [email],
        subject: "Seu link de acesso (válido por 1 hora)",
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend ${res.status}: ${body}`);
    }
    return { success: true as const, email };
  });