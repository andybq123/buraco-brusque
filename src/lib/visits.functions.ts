import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

type Geo = { city: string | null; region: string | null; country: string | null; lat: number | null; lng: number | null };
const NO_GEO: Geo = { city: null, region: null, country: null, lat: null, lng: null };

// Approximate city from the visitor IP. The IP itself is never stored; coordinates are rounded (~1 km).
async function lookupGeo(ip: string | null): Promise<Geo> {
  if (!ip || /^(127\.|10\.|192\.168\.|::1|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)) return NO_GEO;
  try {
    const r = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,city,region,country,latitude,longitude&lang=pt-BR`, {
      signal: AbortSignal.timeout(2500),
    });
    const j = (await r.json()) as { success?: boolean; city?: string; region?: string; country?: string; latitude?: number; longitude?: number };
    if (!j.success) return NO_GEO;
    const round = (n?: number) => (typeof n === "number" ? Math.round(n * 100) / 100 : null);
    return {
      city: j.city?.slice(0, 80) ?? null,
      region: j.region?.slice(0, 80) ?? null,
      country: j.country?.slice(0, 80) ?? null,
      lat: round(j.latitude),
      lng: round(j.longitude),
    };
  } catch {
    return NO_GEO;
  }
}

// Records one visit. Host comes from request headers (not the client) so the domain is trustworthy.
export const trackVisit = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ path: z.string().max(200), mobile: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const req = getRequest();
    const h = req?.headers;
    const raw = h?.get("x-forwarded-host") ?? h?.get("host") ?? "desconhecido";
    const host = (raw.split(",")[0] ?? raw).trim().toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "").slice(0, 120);
    const ip = h?.get("cf-connecting-ip") ?? h?.get("x-real-ip") ?? h?.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const geo = await lookupGeo(ip);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("site_visits")
      .insert({ host, path: data.path.slice(0, 200), device: data.mobile ? "mobile" : "desktop", ...geo })
      .select("id")
      .single();
    return { id: row?.id ?? null };
  });

// Keeps a visit marked as "online now" while the tab stays open.
export const pingVisit = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("site_visits")
      .update({ last_seen: new Date().toISOString() })
      .eq("id", data.id)
      .gte("created_at", new Date(Date.now() - 12 * 3600_000).toISOString());
    return { ok: true };
  });
