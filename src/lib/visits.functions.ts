import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

// Records one page visit. Host comes from the request headers (not the client) so the domain is trustworthy.
export const trackVisit = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ path: z.string().max(200), mobile: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const req = getRequest();
    const raw = req?.headers.get("x-forwarded-host") ?? req?.headers.get("host") ?? "desconhecido";
    const host = (raw.split(",")[0] ?? raw).trim().toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "").slice(0, 120);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("site_visits").insert({ host, path: data.path.slice(0, 200), device: data.mobile ? "mobile" : "desktop" });
    return { ok: true };
  });
