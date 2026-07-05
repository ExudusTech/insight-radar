import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logServerActivity } from "@/lib/activity-log.server";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const inputSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1),
  organization: z.string().optional(),
  role: z.enum(["contractor", "analyst", "superadmin", "coordinator"]),
});

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Verify caller is superadmin
    const { data: isSuperadmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "superadmin",
    });
    if (roleErr) throw new Error(`Falha ao verificar permissão: ${roleErr.message}`);
    if (!isSuperadmin) throw new Error("Apenas superadmin pode convidar usuários.");

    // 2. Create user with admin client (so we get the UUID immediately)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name,
        organization: data.organization ?? null,
      },
    });

    if (createErr || !created?.user) {
      throw new Error(`Falha ao criar usuário: ${createErr?.message ?? "desconhecido"}`);
    }

    const newUserId = created.user.id;

    // 3. Upsert role (handle_new_user trigger already inserts 'analyst' by default)
    if (data.role !== "analyst") {
      // Remove default role first if assigning a different one
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", newUserId)
        .eq("role", "analyst");
    }

    const { error: roleInsertErr } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: newUserId, role: data.role },
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );

    if (roleInsertErr) {
      throw new Error(`Usuário criado, mas falha ao atribuir role: ${roleInsertErr.message}`);
    }

    // 4. Generate a password-setup link (recovery flow) and email it via Resend
    let emailSent = false;
    let emailError: string | null = null;
    try {
      const siteUrl =
        process.env.SITE_URL ?? process.env.VITE_SITE_URL ?? "https://insights-radar.exudustech.com.br";

      const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: data.email,
        options: { redirectTo: `${siteUrl}/reset-password` },
      });
      if (linkErr || !linkData?.properties?.action_link) {
        throw new Error(linkErr?.message ?? "Falha ao gerar link de acesso");
      }
      const actionLink = linkData.properties.action_link;

      const resendKey = process.env.RESEND_API_KEY;
      if (!resendKey) throw new Error("RESEND_API_KEY não configurada");

      const roleLabel =
        data.role === "superadmin"
          ? "Superadmin"
          : data.role === "coordinator"
          ? "Coordenador"
          : data.role === "contractor"
          ? "Cliente"
          : "Analista";
      const safeName = escapeHtml(data.full_name);
      const safeRole = escapeHtml(roleLabel);
      const safeLink = escapeHtml(actionLink);

      const html = `
        <div style="font-family:'DM Sans',Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#ffffff;color:#0f0f0f;">
          <h1 style="font-family:'Syne',Arial,sans-serif;font-size:24px;margin:0 0 16px;color:#0f0f0f;">
            Bem-vindo(a) ao ExudusTech Insights Radar
          </h1>
          <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">
            Olá <strong>${safeName}</strong>, sua conta foi criada com o perfil <strong>${safeRole}</strong>.
          </p>
          <p style="font-size:15px;line-height:1.6;margin:0 0 24px;">
            Para definir sua senha e acessar a plataforma, clique no botão abaixo:
          </p>
          <p style="text-align:center;margin:24px 0;">
            <a href="${safeLink}" style="display:inline-block;background:#c8102e;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">
              Definir senha e acessar
            </a>
          </p>
          <p style="font-size:13px;color:#666;line-height:1.6;margin:24px 0 0;">
            Se o botão não funcionar, copie e cole este link no navegador:<br/>
            <span style="word-break:break-all;color:#c8102e;">${safeLink}</span>
          </p>
          <hr style="border:none;border-top:1px solid #eee;margin:32px 0;"/>
          <p style="font-size:12px;color:#999;margin:0;">
            ExudusTech — Insights Radar
          </p>
        </div>
      `;

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: "ExudusTech Insights Radar <notifications@exudustech.com.br>",
          to: [data.email],
          subject: "Seu acesso ao ExudusTech Insights Radar",
          html,
        }),
      });

      if (!resendRes.ok) {
        const errBody = await resendRes.text();
        throw new Error(`Resend ${resendRes.status}: ${errBody}`);
      }
      emailSent = true;
    } catch (err) {
      emailError = err instanceof Error ? err.message : String(err);
      console.error("[inviteUser] Falha ao enviar email:", emailError);
    }

    await logServerActivity({
      userId: context.userId,
      action: "user_invited",
      entityType: "user",
      entityId: newUserId,
      details: {
        email: data.email,
        full_name: data.full_name,
        organization: data.organization ?? null,
        role: data.role,
        email_sent: emailSent,
        email_error: emailError,
      },
    });

    return { success: true as const, userId: newUserId, emailSent, emailError };
  });