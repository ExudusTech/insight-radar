import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1),
  organization: z.string().optional(),
  role: z.enum(["contractor", "analyst", "superadmin"]),
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

    return { success: true as const, userId: newUserId };
  });