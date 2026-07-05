import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logServerActivity } from "@/lib/activity-log.server";

const input = z.object({
  userId: z.string().uuid(),
  password: z.string().min(8).max(72),
});

export const setInitialPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isSuperadmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "superadmin",
    });
    if (roleErr) throw new Error(`Falha ao validar permissão: ${roleErr.message}`);
    if (!isSuperadmin) throw new Error("Apenas superadmin pode redefinir senhas.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (updErr) throw new Error(`Falha ao redefinir senha: ${updErr.message}`);

    const { error: flagErr } = await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", data.userId);
    if (flagErr) throw new Error(`Senha alterada, mas falha ao marcar troca obrigatória: ${flagErr.message}`);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", data.userId)
      .maybeSingle();

    await logServerActivity({
      userId: context.userId,
      action: "password_reset_by_admin",
      entityType: "user",
      entityId: data.userId,
      details: { target_email: profile?.email ?? null },
    });

    return { success: true as const, email: profile?.email ?? null };
  });