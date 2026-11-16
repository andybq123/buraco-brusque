import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const reportSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  photo: z.string().regex(/^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/).nullable(),
  address: z.string().trim().max(200).nullable(),
  size: z.enum(["pequeno", "medio", "grande"]).nullable(),
  hazards: z.array(z.enum(["moto", "pneu", "noite", "agua"])).max(4),
  kind: z.enum(["buraco", "iluminacao"]),
  description: z.string().trim().max(500).nullable(),
});

function requestOrigin() {
  const headers = getRequest()?.headers;
  const host = (headers?.get("x-forwarded-host") || headers?.get("host") || "brusque.app.br").split(",")[0]!.trim();
  const safeHost = /^[a-z0-9.-]+(?::\d+)?$/i.test(host) ? host : "brusque.app.br";
  const proto = headers?.get("x-forwarded-proto")?.split(",")[0] === "http" ? "http" : "https";
  return `${proto}://${safeHost}`;
}

/** Mantém o cadastro público, mas o destinatário e o texto do e-mail nunca vêm do navegador. */
export const submitPublicReport = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => reportSchema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const sb = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
      global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      } },
    });
    const { data: result, error } = await sb.rpc("report_pothole", {
      _lat: data.lat,
      _lng: data.lng,
      ...(data.photo ? { _photo: data.photo } : {}),
      ...(data.address ? { _address: data.address } : {}),
      ...(data.size ? { _size: data.size } : {}),
      _hazards: data.hazards,
      _kind: data.kind,
      ...(data.description ? { _description: data.description } : {}),
    });
    if (error) throw new Error(error.message);
    const parsed = result as { id?: string; grouped?: boolean } | null;
    if (parsed?.id && !parsed.grouped) {
      try {
        const server = await import("./ouvidoria-mail.server");
        await server.enqueueNewReport(parsed.id, requestOrigin());
      } catch (cause) {
        // O registro do morador nunca é desfeito por indisponibilidade do e-mail.
        console.error("Falha ao encaminhar novo registro à Ouvidoria:", cause instanceof Error ? cause.message : cause);
      }
    }
    return { id: parsed?.id ?? null, grouped: !!parsed?.grouped };
  });
