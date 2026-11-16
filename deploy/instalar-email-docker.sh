#!/usr/bin/env bash
# De Olho na Rua - instala/repara a ponte de e-mail (Docker). Pode rodar quantas vezes quiser.
# Uso (como root):  bash instalar-email-docker.sh
# Depois de cada atualização do site, rode:  de-olho-email-reparar
set -Eeuo pipefail
umask 077
trap 'echo; echo "ERRO na linha $LINENO. Envie esta mensagem (sem senhas)."' ERR

APP_CONTAINER="${APP_CONTAINER:-buraco-app-1}"
BRIDGE_DIR=/opt/de-olho-mail
[ "$(id -u)" = 0 ] || { echo "Rode como root (sudo -i)."; exit 1; }
command -v docker >/dev/null || { echo "Docker não encontrado."; exit 1; }

label() { docker inspect "$APP_CONTAINER" --format "{{index .Config.Labels \"$1\"}}" 2>/dev/null || true; }
APP_DIR="${APP_DIR:-$(label com.docker.compose.project.working_dir)}"
PROJECT="${PROJECT:-$(label com.docker.compose.project)}"
SERVICE="${SERVICE:-$(label com.docker.compose.service)}"
APP_DIR="${APP_DIR:-/opt/buraco-brusque}"; PROJECT="${PROJECT:-buraco}"; SERVICE="${SERVICE:-app}"
[ -f "$APP_DIR/docker-compose.yml" ] || { echo "Não achei $APP_DIR/docker-compose.yml. Rode: APP_DIR=/pasta/do/site bash $0"; exit 1; }
echo "Site: $APP_DIR (projeto $PROJECT, serviço $SERVICE)"

echo "== 1/5 Programa da ponte em $BRIDGE_DIR =="
mkdir -p "$BRIDGE_DIR"
cat > "$BRIDGE_DIR/package.json" <<'EOF_PKG'
{
  "name": "de-olho-mail-bridge",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "dependencies": {
    "imapflow": "^1.0.190",
    "mailparser": "^3.7.4",
    "nodemailer": "^7.0.10"
  }
}
EOF_PKG
cat > "$BRIDGE_DIR/server.mjs" <<'EOF_SRV'
import http from "node:http";
import { timingSafeEqual, createHash } from "node:crypto";
import { resolveMx } from "node:dns/promises";
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

const HOST = process.env.MAIL_BRIDGE_HOST || "127.0.0.1";
const PORT = Number(process.env.MAIL_BRIDGE_PORT || 3001);
const TOKEN = process.env.MAIL_BRIDGE_TOKEN || "";
const MAX_BODY = 1_000_000;
if (!TOKEN) throw new Error("Defina MAIL_BRIDGE_TOKEN antes de iniciar a ponte de e-mail.");

const json = (res, status, value) => {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(value));
};
const cleanHost = (v) => String(v || "").trim().toLowerCase().replace(/\.$/, "").slice(0, 253);
const validHost = (v) => /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(cleanHost(v));
const port = (v, fallback) => Math.max(1, Math.min(65535, Number(v) || fallback));
const email = (v) => String(v || "").trim().toLowerCase();
const text = (v, max = 300) => String(v || "").slice(0, max);

async function body(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error("Pedido grande demais.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function authorized(req) {
  const given = /^Bearer ([^\s,]+)$/.exec(req.headers.authorization || "")?.[1] || "";
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(TOKEN).digest();
  return timingSafeEqual(a, b);
}

function preset(address) {
  const domain = email(address).split("@")[1] || "";
  if (["gmail.com", "googlemail.com"].includes(domain)) return ["smtp.gmail.com", 465, true, "imap.gmail.com", 993, true];
  if (["outlook.com", "hotmail.com", "live.com", "msn.com"].includes(domain)) return ["smtp-mail.outlook.com", 587, false, "outlook.office365.com", 993, true];
  if (["yahoo.com", "yahoo.com.br"].includes(domain)) return ["smtp.mail.yahoo.com", 465, true, "imap.mail.yahoo.com", 993, true];
  if (["zoho.com", "zoho.com.br"].includes(domain)) return ["smtp.zoho.com", 465, true, "imap.zoho.com", 993, true];
  return null;
}

function connection(input) {
  const smtpHost = cleanHost(input.smtpHost);
  const imapHost = cleanHost(input.imapHost);
  if (!validHost(smtpHost) || !validHost(imapHost)) throw new Error("Servidores de e-mail inválidos.");
  return {
    smtpHost,
    smtpPort: port(input.smtpPort, 465),
    smtpSecure: input.smtpSecure !== false,
    imapHost,
    imapPort: port(input.imapPort, 993),
    imapSecure: input.imapSecure !== false,
  };
}

function xmlServer(block) {
  if (!block) return null;
  const get = (tag) => block.match(new RegExp(`<${tag}>([^<]+)</${tag}>`, "i"))?.[1]?.trim();
  const socket = (get("socketType") || "").toUpperCase();
  return { host: cleanHost(get("hostname")), port: Number(get("port")), secure: socket === "SSL" || socket === "TLS" };
}

function parseAutoconfig(xml) {
  const incoming = [...xml.matchAll(/<incomingServer[^>]*type=["']imap["'][^>]*>([\s\S]*?)<\/incomingServer>/gi)][0]?.[1];
  const outgoing = xml.match(/<outgoingServer[^>]*>([\s\S]*?)<\/outgoingServer>/i)?.[1];
  const imap = xmlServer(incoming);
  const smtp = xmlServer(outgoing);
  if (!imap?.host || !smtp?.host) return null;
  return { smtpHost: smtp.host, smtpPort: port(smtp.port, 587), smtpSecure: smtp.secure, imapHost: imap.host, imapPort: port(imap.port, 993), imapSecure: imap.secure };
}

async function fetchAutoconfig(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: "follow" });
    if (!response.ok) return null;
    return parseAutoconfig((await response.text()).slice(0, 200_000));
  } catch {
    return null;
  }
}

async function discover(address) {
  const found = preset(address);
  if (found) return { ...connection({ smtpHost: found[0], smtpPort: found[1], smtpSecure: found[2], imapHost: found[3], imapPort: found[4], imapSecure: found[5] }), source: "provedor" };
  const domain = email(address).split("@")[1] || "";
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) throw new Error("Informe um e-mail válido.");
  try {
    const mx = (await resolveMx(domain)).map((x) => x.exchange.toLowerCase()).join(" ");
    if (/google|googlemail/.test(mx)) return { smtpHost: "smtp.gmail.com", smtpPort: 465, smtpSecure: true, imapHost: "imap.gmail.com", imapPort: 993, imapSecure: true, source: "MX do Google Workspace" };
    if (/outlook|protection\.microsoft/.test(mx)) return { smtpHost: "smtp.office365.com", smtpPort: 587, smtpSecure: false, imapHost: "outlook.office365.com", imapPort: 993, imapSecure: true, source: "MX do Microsoft 365" };
  } catch { /* tenta autoconfig abaixo */ }
  const urls = [
    `https://autoconfig.${domain}/mail/config-v1.1.xml?emailaddress=${encodeURIComponent(email(address))}`,
    `https://${domain}/.well-known/autoconfig/mail/config-v1.1.xml`,
    `https://autoconfig.thunderbird.net/v1.1/${domain}`,
  ];
  for (const url of urls) {
    const config = await fetchAutoconfig(url);
    if (config) return { ...config, source: "configuração automática do provedor" };
  }
  return { smtpHost: `mail.${domain}`, smtpPort: 587, smtpSecure: false, imapHost: `mail.${domain}`, imapPort: 993, imapSecure: true, source: "configuração provável; teste a conexão" };
}

function smtp(input) {
  const c = connection(input);
  return nodemailer.createTransport({
    host: c.smtpHost,
    port: c.smtpPort,
    secure: c.smtpSecure,
    requireTLS: !c.smtpSecure,
    auth: { user: email(input.email), pass: String(input.password || "") },
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 20_000,
  });
}

function imap(input) {
  const c = connection(input);
  return new ImapFlow({
    host: c.imapHost,
    port: c.imapPort,
    secure: c.imapSecure,
    auth: { user: email(input.email), pass: String(input.password || "") },
    logger: false,
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 25_000,
  });
}

async function testConnection(input) {
  const smtpClient = smtp(input);
  await smtpClient.verify();
  smtpClient.close();
  const imapClient = imap(input);
  await imapClient.connect();
  await imapClient.logout();
  return { smtp: true, imap: true };
}

async function send(input) {
  const to = email(input.to);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error("Destinatário inválido.");
  const result = await smtp(input).sendMail({
    from: { name: text(input.senderName || "De Olho na Rua", 100), address: email(input.email) },
    to,
    replyTo: email(input.email),
    subject: text(input.subject, 180),
    text: text(input.text, 40_000),
    headers: { "X-De-Olho-Token": text(input.token, 40) },
  });
  return { messageId: result.messageId || null };
}

async function readReplies(input) {
  const client = imap(input);
  await client.connect();
  try {
    await client.mailboxOpen("INBOX");
    const uids = await client.search({ seen: false }, { uid: true });
    const selected = (Array.isArray(uids) ? uids : []).slice(-30);
    const messages = [];
    if (selected.length) {
      for await (const item of client.fetch(selected, { envelope: true, source: { maxSize: 2_000_000 } }, { uid: true })) {
        if (!item.source) continue;
        const parsed = await simpleParser(item.source);
        const subject = text(parsed.subject, 300);
        const from = text(parsed.from?.text, 300);
        const expected = email(input.ouvidoriaEmail);
        if (!subject.toUpperCase().includes("DOR-") && (!expected || !from.toLowerCase().includes(expected))) continue;
        messages.push({
          uid: item.uid,
          messageId: parsed.messageId || `uid-${item.uid}`,
          from,
          subject,
          text: text(parsed.text || (typeof parsed.html === "string" ? parsed.html.replace(/<[^>]+>/g, " ") : ""), 20_000),
          date: parsed.date?.toISOString() || null,
        });
      }
    }
    return { messages };
  } finally {
    await client.logout().catch(() => {});
  }
}

async function markSeen(input) {
  const uids = Array.isArray(input.uids) ? input.uids.map(Number).filter((x) => Number.isInteger(x) && x > 0).slice(0, 50) : [];
  if (!uids.length) return { marked: 0 };
  const client = imap(input);
  await client.connect();
  try {
    await client.mailboxOpen("INBOX");
    await client.messageFlagsAdd(uids, ["\\Seen"], { uid: true });
    return { marked: uids.length };
  } finally {
    await client.logout().catch(() => {});
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (!authorized(req)) return json(res, 401, { error: "Não autorizado." });
    if (req.method !== "POST") return json(res, 405, { error: "Método inválido." });
    const input = await body(req);
    if (req.url === "/health") return json(res, 200, { ok: true });
    if (req.url === "/discover") return json(res, 200, await discover(input.email));
    if (req.url === "/test") return json(res, 200, await testConnection(input));
    if (req.url === "/send") return json(res, 200, await send(input));
    if (req.url === "/read") return json(res, 200, await readReplies(input));
    if (req.url === "/mark-seen") return json(res, 200, await markSeen(input));
    return json(res, 404, { error: "Ação não encontrada." });
  } catch (error) {
    console.error("mail bridge:", error instanceof Error ? error.message : error);
    return json(res, 500, { error: text(error instanceof Error ? error.message : "Falha no serviço de e-mail.", 400) });
  }
});
server.listen(PORT, HOST, () => console.log(`Ponte de e-mail ouvindo em ${HOST}:${PORT}`));
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => server.close(() => process.exit(0)));
EOF_SRV

echo "== 2/5 Segredo (reaproveita o existente) =="
ENV_FILE="$BRIDGE_DIR/bridge.env"
TOKEN=""
[ -f "$ENV_FILE" ] && TOKEN="$(sed -n 's/^MAIL_BRIDGE_TOKEN=//p' "$ENV_FILE" | head -1)"
[ -n "$TOKEN" ] || TOKEN="$(openssl rand -hex 32 2>/dev/null || head -c32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
cat > "$ENV_FILE" <<EOF_ENV
MAIL_BRIDGE_TOKEN=$TOKEN
MAIL_BRIDGE_URL=http://de-olho-mail:3001
EOF_ENV
chmod 600 "$ENV_FILE"

echo "== 3/5 Dependências da ponte =="
docker run --rm -v "$BRIDGE_DIR":/bridge -w /bridge node:24-bookworm-slim \
  sh -c "npm install --omit=dev --no-audit --no-fund --loglevel=error" >/dev/null
echo "ok"

echo "== 4/5 Arquivo automático do Docker (docker-compose.override.yml) =="
OVR="$APP_DIR/docker-compose.override.yml"
if [ -f "$OVR" ] && ! grep -q "de-olho-mail-gerado" "$OVR"; then
  cp "$OVR" "$OVR.bak.$(date +%s)"; echo "Existia um override seu; cópia de segurança criada (.bak)."
fi
cat > "$OVR" <<EOF_OVR
# de-olho-mail-gerado: criado por instalar-email-docker.sh. Lido automaticamente pelo docker compose.
services:
  $SERVICE:
    env_file:
      - $ENV_FILE
    depends_on:
      - de-olho-mail
  de-olho-mail:
    image: node:24-bookworm-slim
    working_dir: /bridge
    command: ["node", "server.mjs"]
    environment:
      MAIL_BRIDGE_HOST: 0.0.0.0
      MAIL_BRIDGE_PORT: "3001"
    env_file:
      - $ENV_FILE
    volumes:
      - $BRIDGE_DIR:/bridge:ro
    restart: unless-stopped
EOF_OVR
chmod 644 "$OVR"

# remove a instalação antiga separada, se existir
for c in $(docker ps -aq --filter "label=com.docker.compose.project=dor-email"); do docker rm -f "$c" >/dev/null; done

echo "== 5/5 Subindo ponte e reiniciando o site (alguns segundos fora do ar) =="
cd "$APP_DIR"
docker compose -p "$PROJECT" -f docker-compose.yml -f docker-compose.override.yml up -d --force-recreate de-olho-mail "$SERVICE"

# comando de reparo para usar após atualizações
cp "$0" /usr/local/sbin/de-olho-email-instalar 2>/dev/null || true
cat > /usr/local/bin/de-olho-email-reparar <<EOF_REP
#!/usr/bin/env bash
exec bash /usr/local/sbin/de-olho-email-instalar
EOF_REP
chmod 755 /usr/local/bin/de-olho-email-reparar /usr/local/sbin/de-olho-email-instalar 2>/dev/null || true

echo; echo "== Verificação =="
ok=1
for i in $(seq 1 20); do
  if docker exec "$APP_CONTAINER" sh -c '[ -n "$MAIL_BRIDGE_TOKEN" ]' 2>/dev/null; then break; fi; sleep 1
done
docker exec "$APP_CONTAINER" sh -c '[ -n "$MAIL_BRIDGE_TOKEN" ] && echo "Site: chave OK -> $MAIL_BRIDGE_URL"' || { echo "Site: SEM chave"; ok=0; }
sleep 2
if docker exec "$APP_CONTAINER" node -e '
fetch(process.env.MAIL_BRIDGE_URL+"/health",{method:"POST",headers:{authorization:"Bearer "+process.env.MAIL_BRIDGE_TOKEN},body:"{}"})
.then(r=>{if(!r.ok)throw r.status;console.log("Ponte: respondendo OK")}).catch(e=>{console.log("Ponte: sem resposta",e);process.exit(1)})'; then :; else ok=0; docker logs --tail 20 "${PROJECT}-de-olho-mail-1" 2>&1 || true; fi
echo
if [ $ok = 1 ]; then
  echo "TUDO PRONTO. No painel: Ouvidoria e e-mail > Testar conexão."
else
  echo "Algo falhou acima. Envie estas mensagens."
fi
echo "Após atualizar o site no futuro, rode:  de-olho-email-reparar"
