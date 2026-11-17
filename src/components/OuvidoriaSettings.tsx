import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Bot, CheckCircle2, Inbox, KeyRound, Mail, RefreshCw, Send, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/potholes";
import { SHARDCLOUD_MAIL_CONNECTION } from "@/lib/ouvidoria-email";
import {
  getOuvidoriaPanel,
  listOuvidoriaAiModels,
  saveOuvidoriaSettings,
  sendOuvidoriaPending,
  syncOuvidoriaReplies,
  testOuvidoriaAiModel,
  testOuvidoriaSettings,
} from "@/lib/ouvidoria.functions";

const STATUS = {
  pending: "Na fila",
  processing: "Enviando",
  sent: "Enviado",
  error: "Falhou",
} as const;

type AiProvider = "gemini" | "groq";
type AiModelOption = { id: string; label: string };

export function OuvidoriaSettings() {
  const qc = useQueryClient();
  const getPanel = useServerFn(getOuvidoriaPanel);
  const saveSettings = useServerFn(saveOuvidoriaSettings);
  const testSettings = useServerFn(testOuvidoriaSettings);
  const listModels = useServerFn(listOuvidoriaAiModels);
  const testModel = useServerFn(testOuvidoriaAiModel);
  const sendPending = useServerFn(sendOuvidoriaPending);
  const syncReplies = useServerFn(syncOuvidoriaReplies);
  const panel = useQuery({ queryKey: ["ouvidoria-panel"], queryFn: () => getPanel() });
  const [busy, setBusy] = useState<string | null>(null);
  const [aiModels, setAiModels] = useState<AiModelOption[]>([]);
  const [aiStatus, setAiStatus] = useState("");
  const [form, setForm] = useState({
    recipientEmail: "", senderEmail: "", senderName: "De Olho na Rua", password: "",
    autoDiscover: false, ...SHARDCLOUD_MAIL_CONNECTION,
    autoSend: true, autoRead: true, syncInterval: 15, aiProvider: "gemini" as AiProvider, aiKey: "", aiModel: "",
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((old) => ({ ...old, [key]: value }));

  useEffect(() => {
    const s = panel.data?.settings;
    if (!s) return;
    setForm((old) => ({
      ...old,
      recipientEmail: s.recipientEmail, senderEmail: s.senderEmail, senderName: s.senderName,
      autoDiscover: !(s.smtpHost && s.imapHost),
      smtpHost: s.smtpHost, smtpPort: s.smtpPort, smtpSecure: s.smtpSecure,
      imapHost: s.imapHost, imapPort: s.imapPort, imapSecure: s.imapSecure,
      autoSend: s.autoSend, autoRead: s.autoRead, syncInterval: s.syncInterval,
      aiProvider: s.aiProvider as AiProvider, aiModel: s.aiModel,
      password: "", aiKey: "",
    }));
  }, [panel.data?.settings]);

  const run = async (name: string, action: () => Promise<unknown>, success: string) => {
    setBusy(name);
    try {
      await action();
      if (success) toast.success(success);
      await qc.invalidateQueries({ queryKey: ["ouvidoria-panel"] });
      await qc.invalidateQueries({ queryKey: ["potholes"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível concluir.");
    } finally {
      setBusy(null);
    }
  };
  const saveCurrent = () => saveSettings({ data: { ...form } });
  const currentModel = form.aiModel || panel.data?.defaults[form.aiProvider] || "";
  const modelOptions = aiModels.some((m) => m.id === currentModel) || !currentModel
    ? aiModels
    : [{ id: currentModel, label: `${currentModel} (salvo)` }, ...aiModels];
  const queue = panel.data?.queue ?? [];
  const replies = panel.data?.replies ?? [];
  const counts = {
    pending: queue.filter((q) => q.status === "pending" || q.status === "processing").length,
    sent: queue.filter((q) => q.status === "sent").length,
    error: queue.filter((q) => q.status === "error").length,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-4"><div className="text-2xl font-bold">{counts.pending}</div><div className="text-xs text-muted-foreground">Aguardando envio</div></div>
        <div className="rounded-xl border bg-card p-4"><div className="text-2xl font-bold">{counts.sent}</div><div className="text-xs text-muted-foreground">E-mails enviados</div></div>
        <div className="rounded-xl border bg-card p-4"><div className="text-2xl font-bold">{counts.error}</div><div className="text-xs text-muted-foreground">Falhas para revisar</div></div>
      </div>

      <form className="space-y-5 rounded-xl border bg-card p-4" onSubmit={(e) => {
        e.preventDefault();
        void run("save", saveCurrent, "Configurações salvas sem alterar a ponte instalada na VPS.");
      }}>
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"><Mail className="h-5 w-5" /></span>
          <div><h2 className="text-lg">Caixa de envio e recebimento</h2><p className="text-sm text-muted-foreground">A Shard Cloud já vem configurada; você também pode usar a descoberta automática.</p></div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1"><Label htmlFor="ouv-recipient">E-mail da Ouvidoria</Label><Input id="ouv-recipient" type="email" required placeholder="ouvidoria@brusque.sc.gov.br" value={form.recipientEmail} onChange={(e) => set("recipientEmail", e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="ouv-sender">Seu e-mail remetente</Label><Input id="ouv-sender" type="email" required placeholder="deolhonarua@brusque.app.br" value={form.senderEmail} onChange={(e) => set("senderEmail", e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="ouv-name">Nome exibido no envio</Label><Input id="ouv-name" required maxLength={100} value={form.senderName} onChange={(e) => set("senderName", e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="ouv-password">Senha da caixa</Label><Input id="ouv-password" type="password" autoComplete="new-password" required={!panel.data?.settings?.hasPassword} placeholder={panel.data?.settings?.hasPassword ? "Senha já salva — deixe vazio para manter" : "Senha da caixa de e-mail"} value={form.password} onChange={(e) => set("password", e.target.value)} /><p className="text-xs text-muted-foreground">A senha fica criptografada e não aparece novamente.</p></div>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border bg-muted/50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div><span className="block font-semibold">Shard Cloud</span><span className="text-muted-foreground">SMTP mail.shardcloud.app:465 · IMAP mail.shardcloud.app:993 · SSL direto</span></div>
          <Button type="button" variant="outline" size="sm" onClick={() => setForm((old) => ({ ...old, autoDiscover: false, ...SHARDCLOUD_MAIL_CONNECTION }))}>Usar Shard Cloud</Button>
        </div>
        <label className="flex items-center justify-between gap-3 rounded-lg bg-muted p-3 text-sm"><span><span className="block font-semibold">Descobrir servidor e porta automaticamente</span><span className="text-muted-foreground">Reconhece Shard Cloud, Gmail, Outlook, Yahoo, Zoho e registros MX.</span></span><Switch checked={form.autoDiscover} onCheckedChange={(v) => set("autoDiscover", v)} /></label>
        {!form.autoDiscover && (
          <div className="grid gap-3 rounded-lg border p-3 md:grid-cols-2">
            <div className="space-y-1"><Label>Servidor de envio (SMTP)</Label><Input required value={form.smtpHost} onChange={(e) => set("smtpHost", e.target.value)} /></div>
            <div className="grid grid-cols-[1fr_auto] items-end gap-2"><div className="space-y-1"><Label>Porta</Label><Input type="number" min={1} max={65535} value={form.smtpPort} onChange={(e) => set("smtpPort", Number(e.target.value))} /></div><label className="flex h-10 items-center gap-2 text-sm"><Switch checked={form.smtpSecure} onCheckedChange={(v) => set("smtpSecure", v)} /> SSL direto</label></div>
            <div className="space-y-1"><Label>Servidor de recebimento (IMAP)</Label><Input required value={form.imapHost} onChange={(e) => set("imapHost", e.target.value)} /></div>
            <div className="grid grid-cols-[1fr_auto] items-end gap-2"><div className="space-y-1"><Label>Porta</Label><Input type="number" min={1} max={65535} value={form.imapPort} onChange={(e) => set("imapPort", Number(e.target.value))} /></div><label className="flex h-10 items-center gap-2 text-sm"><Switch checked={form.imapSecure} onCheckedChange={(v) => set("imapSecure", v)} /> SSL direto</label></div>
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center justify-between rounded-lg border p-3 text-sm"><span><span className="block font-semibold">Enviar novos registros</span><span className="text-muted-foreground">Falhas não impedem o aviso do morador.</span></span><Switch checked={form.autoSend} onCheckedChange={(v) => set("autoSend", v)} /></label>
          <label className="flex items-center justify-between rounded-lg border p-3 text-sm"><span><span className="block font-semibold">Ler respostas automaticamente</span><span className="text-muted-foreground">{form.autoRead ? `A caixa é verificada a cada ${form.syncInterval} minutos.` : "Desligado: verifique pelo botão “Verificar respostas”."}</span></span><Switch checked={form.autoRead} onCheckedChange={(v) => set("autoRead", v)} /></label>
        </div>
        {form.autoRead && (
          <div className="space-y-1 md:max-w-xs"><Label htmlFor="ouv-interval">Verificar respostas a cada (minutos)</Label><Input id="ouv-interval" type="number" min={5} max={1440} step={5} required value={form.syncInterval} onChange={(e) => set("syncInterval", Number(e.target.value))} /><p className="text-xs text-muted-foreground">Entre 5 e 1440 minutos (24 h).</p></div>
        )}

        <div className="space-y-3 border-t pt-4">
          <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground"><Bot className="h-5 w-5" /></span><div><h2 className="text-lg">Leitura do protocolo com IA</h2><p className="text-sm text-muted-foreground">Valide a chave, carregue os modelos disponíveis no provedor e teste o escolhido antes de usar.</p></div></div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1"><Label>Provedor de IA</Label><Select value={form.aiProvider} onValueChange={(v) => { set("aiProvider", v as AiProvider); set("aiModel", ""); setAiModels([]); setAiStatus(""); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="gemini">Google Gemini</SelectItem><SelectItem value="groq">Groq</SelectItem></SelectContent></Select></div>
            <div className="space-y-1"><Label>Modelo</Label><Select value={currentModel} onValueChange={(v) => { set("aiModel", v); setAiStatus(""); }}><SelectTrigger><SelectValue placeholder="Carregue os modelos" /></SelectTrigger><SelectContent>{modelOptions.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}{!modelOptions.length && <SelectItem value={currentModel}>{currentModel}</SelectItem>}</SelectContent></Select></div>
            <div className="space-y-1 md:col-span-2"><Label htmlFor="ai-key">Chave da IA</Label><div className="relative"><KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="ai-key" type="password" autoComplete="new-password" className="pl-9" placeholder={panel.data?.settings?.hasAiKey ? "Chave já salva — deixe vazio para manter" : `Chave do ${form.aiProvider === "gemini" ? "Google AI Studio" : "Groq"}`} value={form.aiKey} onChange={(e) => set("aiKey", e.target.value)} /></div></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void run("models", async () => {
              await saveCurrent();
              const result = await listModels({});
              setAiModels(result.models);
              setAiStatus(`Chave válida: ${result.models.length} modelos de texto disponíveis.`);
            }, "Chave de IA validada e modelos atualizados.")}><RefreshCw className={`mr-1 h-4 w-4 ${busy === "models" ? "animate-spin" : ""}`} />{busy === "models" ? "Validando…" : "Validar chave e buscar modelos"}</Button>
            <Button type="button" variant="outline" disabled={busy !== null || !currentModel} onClick={() => void run("ai-test", async () => {
              await saveCurrent();
              const result = await testModel({ data: { aiModel: currentModel } });
              setAiStatus(`Modelo ${result.model} testado e aprovado.`);
            }, "O modelo respondeu corretamente ao teste.")}><CheckCircle2 className="mr-1 h-4 w-4" />{busy === "ai-test" ? "Testando modelo…" : "Testar modelo selecionado"}</Button>
          </div>
          {aiStatus && <p role="status" className="rounded-lg bg-muted p-3 text-sm">{aiStatus}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy !== null}><Settings2 className="mr-1 h-4 w-4" />{busy === "save" ? "Salvando…" : "Salvar configurações"}</Button>
          <Button type="button" variant="outline" disabled={busy !== null || !panel.data?.settings} onClick={() => void run("test", () => testSettings({}), "SMTP e IMAP conectados com sucesso.")}><CheckCircle2 className="mr-1 h-4 w-4" />{busy === "test" ? "Testando…" : "Testar e-mail"}</Button>
        </div>
      </form>

      <section className="rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div><h2 className="text-lg">Envios e respostas</h2><p className="text-sm text-muted-foreground">Novas tentativas acontecem a cada 5 minutos; as respostas respeitam o intervalo definido acima.</p></div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void run("send", async () => { const r = await sendPending({}); if (!r.sent && r.errors?.length) throw new Error(r.errors[0]); }, "Envio dos registros pendentes concluído.")}><Send className="mr-1 h-4 w-4" />Enviar pendentes</Button>
            <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void run("sync", async () => { const r = await syncReplies({}); const x = r as { read?: number; applied?: number; duplicates?: number; unmatched?: number; skipped?: string };
              if (x.skipped === "configure_email") toast.warning("Salve o e-mail e a senha antes de verificar.");
              else if (!x.read) toast.warning("Nenhuma resposta com o código DOR-… foi encontrada na caixa de entrada (últimos 45 dias).");
              else toast.info(`${x.read} resposta(s) lida(s): ${x.applied ?? 0} protocolo(s) anexado(s), ${x.unmatched ?? 0} sem protocolo identificado, ${x.duplicates ?? 0} já aplicada(s).`); }, "Caixa de respostas verificada.")}><RefreshCw className={`mr-1 h-4 w-4 ${busy === "sync" ? "animate-spin" : ""}`} />Verificar respostas</Button>
          </div>
        </div>
        {panel.data?.settings?.lastSyncStatus && <p className="border-b px-4 py-2 text-xs text-muted-foreground">Última verificação{panel.data.settings.lastSyncAt ? ` concluída em ${formatDate(panel.data.settings.lastSyncAt)}` : ""}: {panel.data.settings.lastSyncStatus}</p>}
        <div className="divide-y">
          {queue.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">Nenhum envio automático registrado ainda.</p>}
          {queue.map((q) => (
            <div key={q.id} className="flex items-start justify-between gap-3 p-4 text-sm">
              <div className="min-w-0"><div className="font-semibold">#{q.potholes.number} · {q.potholes.kind === "iluminacao" ? "Iluminação" : "Buraco"}</div><div className="truncate text-muted-foreground">{q.potholes.address ?? "Endereço não informado"}</div><div className="mt-1 text-xs text-muted-foreground">{q.email_token} · {q.attempts} tentativa(s){q.last_error ? ` · ${q.last_error}` : ""}</div></div>
              <Badge variant={q.status === "error" ? "destructive" : q.status === "sent" ? "default" : "outline"} className="shrink-0">{q.status === "error" ? <AlertTriangle className="mr-1 h-3 w-3" /> : q.status === "sent" ? <Inbox className="mr-1 h-3 w-3" /> : null}{STATUS[q.status as keyof typeof STATUS] ?? q.status}</Badge>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-card">
        <div className="border-b p-4"><h2 className="text-lg">Diagnóstico das respostas</h2><p className="text-sm text-muted-foreground">Veja o que foi identificado e por que uma mensagem não foi aplicada.</p></div>
        <div className="divide-y">
          {!replies.length && <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma resposta processada ainda.</p>}
          {replies.map((r) => (
            <article key={r.id} className="space-y-2 p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><div className="font-semibold">{r.subject || "Sem assunto"}</div><div className="break-all text-xs text-muted-foreground">{r.sender_email} · {formatDate(r.created_at)}</div></div><Badge variant={r.applied ? "default" : r.error ? "destructive" : "outline"}>{r.applied ? "Protocolo anexado" : r.error ? "Precisa revisar" : "Sem aplicação"}</Badge></div>
              {r.protocol && <div>Protocolo identificado: <strong>{r.protocol}</strong>{r.confidence ? ` · confiança ${Math.round(r.confidence * 100)}%` : ""}</div>}
              {r.error && <p className="rounded-lg bg-muted p-2 text-xs">{r.error}</p>}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
