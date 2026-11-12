import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Sem permissão");
}

function validEmail(e: unknown): string {
  const s = String(e ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) || s.length > 200) throw new Error("E-mail inválido");
  return s;
}

/** Cria um administrador já confirmado (usado pelo painel e pela instalação). */
export async function createAdminAccount(email: string, password: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // 1) autoriza o e-mail (trigger concede o papel quando a conta existir)
  const { error: e1 } = await supabaseAdmin.from("admin_emails").upsert({ email });
  if (e1) throw new Error(e1.message);
  // 2) cria a conta confirmada
  const { error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error && !/already/i.test(error.message)) throw new Error(error.message);
}

export const listAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase.from("admin_emails").select("email, created_at").order("created_at");
    if (error) throw new Error(error.message);
    return data as { email: string; created_at: string }[];
  });

export const createAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; password: string }) => {
    const email = validEmail(d?.email);
    const password = String(d?.password ?? "");
    if (password.length < 8 || password.length > 72) throw new Error("A senha precisa ter de 8 a 72 caracteres");
    return { email, password };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    await createAdminAccount(data.email, data.password);
    return { ok: true };
  });

export const removeAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string }) => ({ email: validEmail(d?.email) }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin.from("admin_emails").select("*", { count: "exact", head: true });
    if ((count ?? 0) <= 1) throw new Error("Não é possível remover o último administrador");
    const { data: me } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    if (me.user?.email?.toLowerCase() === data.email) throw new Error("Você não pode remover a si mesmo");
    await supabaseAdmin.from("admin_emails").delete().eq("email", data.email);
    // apaga a conta também
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const u = list?.users.find((x) => x.email?.toLowerCase() === data.email);
    if (u) await supabaseAdmin.auth.admin.deleteUser(u.id);
    return { ok: true };
  });

/**
 * Instalação: se ainda não existe nenhum administrador e as variáveis
 * ADMIN_EMAIL e ADMIN_PASSWORD estão definidas no servidor, cria o primeiro.
 * Não faz nada depois que existe algum administrador.
 */
export const bootstrapAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const email = process.env["ADMIN_EMAIL"];
  const password = process.env["ADMIN_PASSWORD"];
  if (!email || !password) return { created: false };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin.from("admin_emails").select("*", { count: "exact", head: true });
  if ((count ?? 0) > 0) return { created: false };
  await createAdminAccount(validEmail(email), password);
  return { created: true };
});
