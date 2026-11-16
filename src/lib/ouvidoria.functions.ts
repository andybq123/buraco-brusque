import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { AI_DEFAULT_MODEL } from "./ouvidoria-email";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Sem permissão");
}

const email = z.string().trim().toLowerCase().email().max(200);
const host = z.string().trim().toLowerCase().max(253).regex(/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/);
const optionalText = (max: number) => z.string().trim().max(max).optional().default("");

export const getOuvidoriaPanel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: settings }, { data: queue, error }] = await Promise.all([
      supabaseAdmin.from("ouvidoria_settings").select("*").eq("id", true).maybeSingle(),
      supabaseAdmin.from("ouvidoria_email_queue").select("id, pothole_id, email_token, status, attempts, last_error, created_at, sent_at, potholes(number, address, kind)").order("created_at", { ascending: false }).limit(30),
    ]);
    if (error) throw new Error(error.message);
    return {
      settings: settings ? {
        recipientEmail: settings.recipient_email ?? "",
        senderEmail: settings.sender_email ?? "",
        senderName: settings.sender_name,
        smtpHost: settings.smtp_host ?? "",
        smtpPort: settings.smtp_port ?? 465,
        smtpSecure: settings.smtp_secure,
        imapHost: settings.imap_host ?? "",
        imapPort: settings.imap_port ?? 993,
        imapSecure: settings.imap_secure,
        autoSend: settings.auto_send,
        autoRead: settings.auto_read,
        syncInterval: settings.sync_interval_minutes ?? 15,
        aiProvider: settings.ai_provider,
        aiModel: settings.ai_model ?? "",
        hasPassword: !!settings.password_ciphertext,
        hasAiKey: !!settings.ai_key_ciphertext,
        lastSyncAt: settings.last_sync_at,
        lastSyncStatus: settings.last_sync_status,
      } : null,
      queue: queue ?? [],
      defaults: AI_DEFAULT_MODEL,
    };
  });

const saveSchema = z.object({
  recipientEmail: email,
  senderEmail: email,
  senderName: z.string().trim().min(2).max(100),
  password: optionalText(300),
  autoDiscover: z.boolean(),
  smtpHost: optionalText(253),
  smtpPort: z.number().int().min(1).max(65535),
  smtpSecure: z.boolean(),
  imapHost: optionalText(253),
  imapPort: z.number().int().min(1).max(65535),
  imapSecure: z.boolean(),
  autoSend: z.boolean(),
  autoRead: z.boolean(),
  syncInterval: z.number().int().min(5).max(1440),
  aiProvider: z.enum(["gemini", "groq"]),
  aiKey: optionalText(300),
  aiModel: optionalText(100),
});

export const saveOuvidoriaSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => saveSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: previous } = await supabaseAdmin.from("ouvidoria_settings").select("*").eq("id", true).maybeSingle();
    const server = await import("./ouvidoria-mail.server");
    const current = previous?.smtp_host && previous.smtp_port && previous.imap_host && previous.imap_port ? {
      smtpHost: previous.smtp_host, smtpPort: previous.smtp_port, smtpSecure: previous.smtp_secure,
      imapHost: previous.imap_host, imapPort: previous.imap_port, imapSecure: previous.imap_secure,
    } : null;
    let connection = current;
    if (data.autoDiscover) connection = await server.discoverConnection(data.senderEmail, current);
    else {
      connection = {
        smtpHost: host.parse(data.smtpHost), smtpPort: data.smtpPort, smtpSecure: data.smtpSecure,
        imapHost: host.parse(data.imapHost), imapPort: data.imapPort, imapSecure: data.imapSecure,
      };
    }
    if (!connection) throw new Error("Não foi possível identificar os servidores. Preencha a configuração manual.");
    const password = data.password || (previous?.password_ciphertext ? server.decryptSetting(previous.password_ciphertext) : "");
    if (!password) throw new Error("Informe a senha da caixa de e-mail.");
    const aiKey = data.aiKey || (previous?.ai_key_ciphertext ? server.decryptSetting(previous.ai_key_ciphertext) : "");
    if (data.aiModel && !/^[a-zA-Z0-9._-]{2,100}$/.test(data.aiModel)) throw new Error("Nome de modelo de IA inválido.");
    const { error } = await supabaseAdmin.from("ouvidoria_settings").upsert({
      id: true,
      recipient_email: data.recipientEmail,
      sender_email: data.senderEmail,
      sender_name: data.senderName,
      password_ciphertext: server.encryptSetting(password),
      smtp_host: connection.smtpHost,
      smtp_port: connection.smtpPort,
      smtp_secure: connection.smtpSecure,
      imap_host: connection.imapHost,
      imap_port: connection.imapPort,
      imap_secure: connection.imapSecure,
      auto_send: data.autoSend,
      auto_read: data.autoRead,
      sync_interval_minutes: data.syncInterval,
      ai_provider: data.aiProvider,
      ai_key_ciphertext: aiKey ? server.encryptSetting(aiKey) : null,
      ai_model: data.aiModel || null,
      updated_at: new Date().toISOString(),
      updated_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true, connection: { smtpHost: connection.smtpHost, smtpPort: connection.smtpPort, imapHost: connection.imapHost, imapPort: connection.imapPort } };
  });

export const testOuvidoriaSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const server = await import("./ouvidoria-mail.server");
    return server.testConnection();
  });

export const sendOuvidoriaPending = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const server = await import("./ouvidoria-mail.server");
    const { error } = await (await import("@/integrations/supabase/client.server")).supabaseAdmin.from("ouvidoria_email_queue").update({ status: "pending", available_at: new Date().toISOString(), last_error: null }).eq("status", "error");
    if (error) throw new Error(error.message);
    return server.sendPending({ force: true, limit: 20 });
  });

export const syncOuvidoriaReplies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const server = await import("./ouvidoria-mail.server");
    return server.syncReplies({ force: true });
  });
