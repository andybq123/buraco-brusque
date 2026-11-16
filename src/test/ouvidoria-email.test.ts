import { describe, expect, it } from "vitest";
import {
  buildOuvidoriaEmail,
  commonMailConnection,
  extractEmailToken,
  extractLabeledProtocol,
  googleMapsLink,
  makeEmailToken,
  parseAiProtocolResult,
  shouldSkipReplySync,
} from "@/lib/ouvidoria-email";

const report = {
  id: "123e4567-e89b-42d3-a456-426614174000",
  number: 42,
  kind: "buraco" as const,
  address: "Rua Horácio Anacleto da Silva, 720",
  lat: -27.0977,
  lng: -48.9175,
  size: "grande" as const,
  hazards: ["moto"],
  report_count: 2,
  created_at: "2026-11-16T12:00:00Z",
  descriptions: ["Buraco na faixa da direita"],
};

describe("e-mail da Ouvidoria", () => {
  it("inclui o endereço com número e as coordenadas exatas do Google Maps", () => {
    const mail = buildOuvidoriaEmail(report, "DOR-42-ABC12345", "https://exemplo.com.br/");
    expect(mail.text).toContain("Rua Horácio Anacleto da Silva, 720");
    expect(mail.text).toContain("Coordenadas: -27.097700, -48.917500");
    expect(mail.text).toContain("https://www.google.com/maps?q=-27.097700,-48.917500");
    expect(mail.subject).toContain("DOR-42-ABC12345");
    expect(googleMapsLink(-27.0977, -48.9175)).toBe("https://www.google.com/maps?q=-27.097700,-48.917500");
  });

  it("pede o protocolo em resposta e preserva o código de ligação", () => {
    const mail = buildOuvidoriaEmail(report, "DOR-42-ABC12345", "https://exemplo.com.br");
    expect(mail.text).toContain("número de protocolo seja informado em resposta");
    expect(mail.text).toContain("mantenha o código DOR-42-ABC12345 no assunto");
  });

  it("reconhece protocolos comuns sem depender da IA", () => {
    expect(extractLabeledProtocol("Seu atendimento foi registrado. Protocolo: 2026/001234.")).toBe("2026/001234");
    expect(extractLabeledProtocol("O número do protocolo é 12.345/2026")).toBe("12.345/2026");
    expect(extractEmailToken("Re: buraco [dor-42-abc12345]")).toBe("DOR-42-ABC12345");
  });

  it("só aceita resposta da IA com protocolo, registro e confiança válidos", () => {
    expect(parseAiProtocolResult('{"protocol":"2026/001234","token":"DOR-42-ABC12345","pothole_number":42,"confidence":0.98}')).toEqual({
      protocol: "2026/001234", token: "DOR-42-ABC12345", potholeNumber: 42, confidence: 0.98,
    });
    expect(parseAiProtocolResult('{"protocol":"instrução inválida","confidence":1}')).toBeNull();
    expect(parseAiProtocolResult("não é JSON")).toBeNull();
  });

  it("gera códigos diferentes para cada solicitação", () => {
    expect(makeEmailToken(42, "ABC12345")).toBe("DOR-42-ABC12345");
    expect(makeEmailToken(42, "XYZ99999")).not.toBe(makeEmailToken(42, "ABC12345"));
  });

  it("preenche automaticamente Gmail e Outlook", () => {
    expect(commonMailConnection("equipe@gmail.com")?.smtpHost).toBe("smtp.gmail.com");
    expect(commonMailConnection("equipe@outlook.com")?.imapHost).toBe("outlook.office365.com");
    expect(commonMailConnection("equipe@provedorproprio.com.br")).toBeNull();
  });

  it("usa as portas SSL oficiais da Shard Cloud no domínio do projeto", () => {
    expect(commonMailConnection("deolhonarua@brusque.app.br")).toEqual({
      smtpHost: "mail.shardcloud.app",
      smtpPort: 465,
      smtpSecure: true,
      imapHost: "mail.shardcloud.app",
      imapPort: 993,
      imapSecure: true,
    });
  });

  it("respeita o intervalo após uma leitura concluída", () => {
    const now = new Date("2026-11-16T23:43:00Z").getTime();
    expect(shouldSkipReplySync("2026-11-16T23:30:00Z", "Leitura concluída: 0 protocolo(s)", 15, now)).toBe(true);
    expect(shouldSkipReplySync("2026-11-16T23:20:00Z", "Leitura concluída: 0 protocolo(s)", 15, now)).toBe(false);
  });

  it("não deixa uma falha na nuvem impedir a próxima leitura local", () => {
    const now = new Date("2026-11-16T23:43:00Z").getTime();
    expect(shouldSkipReplySync("2026-11-16T23:42:00Z", "Falha: ponte indisponível", 60, now)).toBe(false);
  });
});
