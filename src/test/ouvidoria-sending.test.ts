import { beforeEach, describe, expect, it, vi } from "vitest";
import { needsOuvidoriaEmail, photoAttachment } from "@/lib/ouvidoria-email";

const state = vi.hoisted(() => ({ settings: {} as Record<string, unknown>, reports: [] as Record<string, any>[], queue: [] as Record<string, any>[], downloads: [] as string[], failPhoto: false }));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from(table: string) {
      let action = "select";
      let payload: any;
      let countOnly = false;
      const filters: ((r: any) => boolean)[] = [];
      let limit = Infinity;
      let from = 0;
      const field = (r: any, key: string) => key.startsWith("potholes.") ? r.potholes?.[key.slice(9)] : r[key];
      const execute = () => {
        if (table === "ouvidoria_settings") return { data: state.settings, error: null };
        const source = table === "potholes" ? state.reports : state.queue;
        if (action === "upsert") {
          for (const row of payload) if (!state.queue.some((q) => q["pothole_id"] === row.pothole_id)) state.queue.push({ ...row, id: `q-${row.pothole_id}`, status: "pending", attempts: 0, available_at: "2020-01-01T00:00:00.000Z", created_at: "2020-01-01T00:00:00.000Z" });
          return { data: null, error: null };
        }
        const rows = source.map((r) => table === "ouvidoria_email_queue" ? Object.assign(r, { potholes: state.reports.find((p) => p["id"] === r["pothole_id"]) }) : r).filter((r) => filters.every((f) => f(r)));
        if (action === "update") rows.forEach((r) => Object.assign(r, payload));
        return { data: countOnly ? null : rows.slice(from, from + limit), count: rows.length, error: null };
      };
      const query: any = {
        select(_columns: string, options?: { head?: boolean }) { countOnly = options?.head ?? false; return query; },
        eq(key: string, value: unknown) { filters.push((r) => field(r, key) === value); return query; },
        is(key: string, value: unknown) { filters.push((r) => field(r, key) === value); return query; },
        in(key: string, values: unknown[]) { filters.push((r) => values.includes(field(r, key))); return query; },
        lt(key: string, value: number) { filters.push((r) => field(r, key) < value); return query; },
        lte(key: string, value: string) { filters.push((r) => field(r, key) <= value); return query; },
        order() { return query; },
        limit(n: number) { limit = n; return query; },
        range(a: number, b: number) { from = a; limit = b - a + 1; return query; },
        update(value: any) { action = "update"; payload = value; return query; },
        upsert(value: any) { action = "upsert"; payload = value; return query; },
        maybeSingle() { const result = execute(); return Promise.resolve({ ...result, data: Array.isArray(result.data) ? result.data[0] ?? null : result.data }); },
        then(resolve: (result: unknown) => unknown) { return Promise.resolve(execute()).then(resolve); },
      };
      return query;
    },
    storage: { from: () => ({ download: async (path: string) => {
      state.downloads.push(path);
      return state.failPhoto ? { data: null, error: { message: "missing" } } : { data: { arrayBuffer: async () => new Uint8Array([255, 216, 255, 224]).buffer }, error: null };
    } }) },
  },
}));

import { encryptSetting, enqueueUnsentReports, sendPending } from "@/lib/ouvidoria-mail.server";

function report(id: string, kind = "buraco") {
  return { id, number: kind === "buraco" ? 42 : 43, kind, status: "aberto", ouvidoria_protocol: null, ouvidoria_email_sent_at: null, address: "Rua de teste, 720", lat: -27.09, lng: -48.91, photos: [`${id}/foto.jpg`], descriptions: [], hazards: [], created_at: "2026-11-17T00:00:00Z", report_count: 1, size: "pequeno" };
}

beforeEach(() => {
  vi.stubEnv("APP_SECRETS_KEY", "test-only-settings-key");
  vi.stubEnv("MAIL_BRIDGE_TOKEN", "test-only-bridge-token");
  state.settings = { recipient_email: "recipient@example.test", sender_email: "sender@example.test", sender_name: "Teste", password_ciphertext: encryptSetting("test-only-password"), auto_send: true, smtp_host: "mail.example.test", smtp_port: 465, smtp_secure: true, imap_host: "mail.example.test", imap_port: 993, imap_secure: true };
  state.reports = [];
  state.queue = [];
  state.downloads = [];
  state.failPhoto = false;
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ messageId: "<test@example.test>" }), { status: 200 })));
});

describe("envios com fotos e registros antigos", () => {
  it.each(["buraco", "iluminacao"])("anexa a foto privada ao e-mail de %s e grava o sucesso", async (kind) => {
    state.reports = [report("antigo", kind)];
    const result = await sendPending({ force: true });
    expect(result.sent).toBe(1);
    expect(state.downloads).toEqual(["antigo/foto.jpg"]);
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0]?.[1]?.body as string);
    expect(body.attachments).toEqual([{ filename: `registro-${kind === "buraco" ? 42 : 43}-foto-1.jpg`, content: "/9j/4A==", contentType: "image/jpeg", encoding: "base64" }]);
    expect(state.queue[0]?.["status"]).toBe("sent");
    expect(state.reports[0]?.["ouvidoria_email_sent_at"]).toBeTruthy();
  });

  it("inclui todos os registros antigos em páginas e preserva os já enviados", async () => {
    state.reports = Array.from({ length: 503 }, (_, i) => report(`legacy-${i}`, i % 2 ? "iluminacao" : "buraco"));
    state.queue = [{ id: "existing", pothole_id: "legacy-0", status: "sent", email_token: "DOR-42-PRESERVE" }];
    await enqueueUnsentReports();
    await enqueueUnsentReports();
    expect(state.queue).toHaveLength(503);
    expect(state.queue[0]).toMatchObject({ status: "sent", email_token: "DOR-42-PRESERVE" });
  });

  it("não duplica o envio ao executar novamente", async () => {
    state.reports = [report("antigo")];
    await sendPending({ force: true });
    await sendPending({ force: true });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(state.queue).toHaveLength(1);
  });

  it("envia registros sem foto normalmente", async () => {
    state.reports = [{ ...report("sem-foto", "iluminacao"), photos: [] }];
    const result = await sendPending({ force: true });
    expect(result.sent).toBe(1);
    expect(state.downloads).toEqual([]);
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0]?.[1]?.body as string);
    expect(body.attachments).toEqual([]);
  });

  it("não encaminha problemas resolvidos, removidos, protocolados ou já enviados", () => {
    const p = report("antigo");
    expect(needsOuvidoriaEmail(p)).toBe(true);
    for (const change of [{ status: "consertado" }, { status: "removido" }, { ouvidoria_protocol: "2026/123" }, { ouvidoria_email_sent_at: "2026-11-17T00:00:00Z" }]) expect(needsOuvidoriaEmail({ ...p, ...change })).toBe(false);
  });

  it("mantém o envio com erro para tentar novamente se não conseguir anexar a foto", async () => {
    state.reports = [report("antigo")];
    state.failPhoto = true;
    const result = await sendPending({ force: true });
    expect(result.sent).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
    expect(state.queue[0]?.["status"]).toBe("error");
    expect(state.reports[0]?.["ouvidoria_email_sent_at"]).toBeNull();
  });

  it("recusa conteúdo que não seja imagem", () => {
    expect(() => photoAttachment(42, 0, new TextEncoder().encode("not an image"))).toThrow("formato inválido");
  });
});