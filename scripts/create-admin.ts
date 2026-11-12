/**
 * Cria o primeiro administrador na instalação (VPS).
 * Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ADMIN_EMAIL=... ADMIN_PASSWORD=... bun scripts/create-admin.ts
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!url || !key || !email || !password) {
  console.error("Defina SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL e ADMIN_PASSWORD");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });
const { error: e1 } = await sb.from("admin_emails").upsert({ email });
if (e1) throw e1;
const { error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
if (error && !/already/i.test(error.message)) throw error;
console.log(`Administrador pronto: ${email}`);
