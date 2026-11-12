<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- Pothole grouping and Brusque bounds are enforced in the `report_pothole` SQL function; keep `src/lib/potholes.ts` constants in sync (UI pre-checks only).
- Admin access = `admin` row in `user_roles`, synced by triggers from `admin_emails`; admins create/remove panel users via service-role server functions in `src/lib/admin.functions.ts`. First admin is created from ADMIN_EMAIL/ADMIN_PASSWORD env (auto on /auth when no admin exists, or `scripts/create-admin.ts`).
- Photos live in the private `fotos` bucket (public buckets are blocked); admins view them via signed URLs.
- Maps use Leaflet with the OpenFreeMap "liberty" vector style via maplibre-gl-leaflet, loaded client-only via `LazyMap`.
- Mobile-first: safe-area utilities (safe-top/safe-bottom), 16px inputs (no iOS zoom), raster OSM fallback when WebGL is missing, photo upload falls back to original file when the device cannot shrink it.
