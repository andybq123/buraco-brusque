import { buildOuvidoriaReport, type OuvidoriaInput } from "./ouvidoria";
import { KIND_LABEL } from "./potholes";

export type AiProvider = "gemini" | "groq";
export const AI_DEFAULT_MODEL: Record<AiProvider, string> = {
  gemini: "gemini-2.5-flash",
  groq: "llama-3.3-70b-versatile",
};

export interface MailConnection {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
}

export const SHARDCLOUD_MAIL_CONNECTION: MailConnection = {
  smtpHost: "mail.shardcloud.app",
  smtpPort: 465,
  smtpSecure: true,
  imapHost: "mail.shardcloud.app",
  imapPort: 993,
  imapSecure: true,
};

export interface OuvidoriaEmailInput extends OuvidoriaInput {
  id: string;
}

export function googleMapsLink(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

/** Configurações conhecidas; a ponte da VPS também consulta MX e autoconfig. */
export function commonMailConnection(email: string): MailConnection | null {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (["gmail.com", "googlemail.com"].includes(domain)) {
    return { smtpHost: "smtp.gmail.com", smtpPort: 465, smtpSecure: true, imapHost: "imap.gmail.com", imapPort: 993, imapSecure: true };
  }
  if (["outlook.com", "hotmail.com", "live.com", "msn.com"].includes(domain)) {
    return { smtpHost: "smtp-mail.outlook.com", smtpPort: 587, smtpSecure: false, imapHost: "outlook.office365.com", imapPort: 993, imapSecure: true };
  }
  if (["yahoo.com", "yahoo.com.br"].includes(domain)) {
    return { smtpHost: "smtp.mail.yahoo.com", smtpPort: 465, smtpSecure: true, imapHost: "imap.mail.yahoo.com", imapPort: 993, imapSecure: true };
  }
  if (["zoho.com", "zoho.com.br"].includes(domain)) {
    return { smtpHost: "smtp.zoho.com", smtpPort: 465, smtpSecure: true, imapHost: "imap.zoho.com", imapPort: 993, imapSecure: true };
  }
  if (["brusque.app.br", "shardcloud.app"].includes(domain)) return { ...SHARDCLOUD_MAIL_CONNECTION };
  return null;
}

export function makeEmailToken(number: number, random = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()) {
  return `DOR-${number}-${random}`;
}

export function shouldSkipReplySync(lastSyncAt: string | null, lastSyncStatus: string | null, intervalMinutes: number, now = Date.now()) {
  if (!lastSyncAt || !lastSyncStatus?.startsWith("Leitura concluída:")) return false;
  return now - new Date(lastSyncAt).getTime() < intervalMinutes * 60_000 - 30_000;
}

export function buildOuvidoriaEmail(p: OuvidoriaEmailInput, token: string, origin: string) {
  const data = buildOuvidoriaReport(p, origin.replace(/\/$/, ""));
  const kind = KIND_LABEL[p.kind ?? "buraco"];
  const address = data.endereco;
  const maps = googleMapsLink(p.lat, p.lng);
  const descriptions = (p.descriptions ?? []).filter(Boolean).slice(0, 5);
  const subject = `${kind} nº ${p.number} — ${address} [${token}]`.slice(0, 180);
  const lines = [
    "À Ouvidoria da Prefeitura de Brusque,",
    "",
    `Assunto: ${data.assunto}`,
    `Finalidade: ${data.finalidade}`,
    `Prioridade sugerida: ${data.prioridade}`,
    `Endereço: ${address}`,
    `Coordenadas: ${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`,
    `Localização no Google Maps: ${maps}`,
    `Registro De Olho na Rua: ${origin.replace(/\/$/, "")}/?b=${p.number}`,
    `Código de acompanhamento: ${token}`,
    "",
    "Relato:",
    data.relato,
  ];
  if (descriptions.length) lines.push("", "Relatos dos moradores:", ...descriptions.map((d) => `- ${d}`));
  lines.push(
    "",
    "Solicitamos que o número de protocolo seja informado em resposta a este e-mail.",
    `Por favor, mantenha o código ${token} no assunto da resposta para que o sistema associe o protocolo ao registro correto.`,
    "",
    "Atenciosamente,",
    "De Olho na Rua",
  );
  return { subject, text: lines.join("\n"), data };
}

export function extractEmailToken(text: string) {
  return text.match(/\bDOR-\d{1,8}-[A-Z0-9]{4,12}\b/i)?.[0]?.toUpperCase() ?? null;
}

export function cleanProtocol(value: unknown) {
  const v = String(value ?? "").trim().replace(/[.,;:)\]}"']+$/g, "").slice(0, 60);
  return /^[A-Z0-9][A-Z0-9./-]{1,59}$/i.test(v) && /\d/.test(v) ? v : null;
}

/** Remove o e-mail original citado na resposta, para não confundir o texto pedido com o protocolo. */
export function stripQuotedReply(text: string) {
  const lines = text.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (/^(em|on)\s.+(escreveu|wrote)\s*:?$/i.test(t) || /^-{2,}\s*(mensagem original|original message)/i.test(t) || /^(de|from)\s*:\s*.+@/i.test(t) || t.startsWith("À Ouvidoria da Prefeitura")) break;
    if (t.startsWith(">")) continue;
    out.push(line);
  }
  return out.join("\n").trim();
}

/** Caminho determinístico: não gasta IA quando a resposta já diz “protocolo: …”. */
export function extractLabeledProtocol(text: string) {
  const re = /protocolo(?:\s+(?:de|do|da)\s+[\p{L}]+){0,2}\s*(?:n[ºo°.]*|número|numero|é|e)?\s*[:=\-]?\s*([A-Z0-9][A-Z0-9./-]{1,59})/giu;
  for (const m of text.matchAll(re)) {
    const v = m[1] ? cleanProtocol(m[1]) : null;
    if (v) return v;
  }
  return null;
}

export interface AiProtocolResult {
  protocol: string | null;
  token: string | null;
  potholeNumber: number | null;
  confidence: number;
}

/** Aceita somente o formato combinado; o texto do e-mail nunca vira instrução para o app. */
export function parseAiProtocolResult(raw: string): AiProtocolResult | null {
  try {
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    const value = JSON.parse(cleaned) as Record<string, unknown>;
    const n = Number(value["pothole_number"]);
    const protocol = cleanProtocol(value["protocol"]);
    const token = value["token"] ? extractEmailToken(String(value["token"])) : null;
    const potholeNumber = Number.isInteger(n) && n > 0 ? n : null;
    if (!protocol && !token && !potholeNumber) return null;
    return {
      protocol,
      token,
      potholeNumber,
      confidence: Math.max(0, Math.min(1, Number(value["confidence"]) || 0)),
    };
  } catch {
    return null;
  }
}
