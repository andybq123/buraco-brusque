import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { runCycle } from "@/lib/ouvidoria-mail.server";

export const Route = createFileRoute("/api/public/ouvidoria-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        try {
          const result = await runCycle();
          return Response.json({ success: true, ...result });
        } catch (error) {
          return Response.json({ success: false, error: error instanceof Error ? error.message : "Falha na sincronização." }, { status: 500 });
        }
      },
    },
  },
});
