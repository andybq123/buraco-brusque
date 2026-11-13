import { createServerFn } from "@tanstack/react-start";

/** Gera um link de envio de uso único para uma foto (o app escolhe o nome, não o visitante). */
export const createPhotoUploadUrl = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const name = `${crypto.randomUUID().replace(/-/g, "")}.jpg`;
  const { data, error } = await supabaseAdmin.storage.from("fotos").createSignedUploadUrl(name);
  if (error || !data) throw new Error("upload_indisponivel");
  return { path: data.path, token: data.token };
});
