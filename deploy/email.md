# E-mail automático da Ouvidoria na VPS

## Instalação com Docker (recomendado — use esta)

Rode `bash deploy/instalar-email-docker.sh` como root. Ele pode ser repetido sem problemas: reaproveita o segredo, cria `docker-compose.override.yml` (que o Docker lê sozinho) e confere se o site enxerga a ponte. Depois de atualizar o site, rode `de-olho-email-reparar`.

## Alternativa sem Docker (systemd)

O aplicativo conversa com uma ponte local de e-mail. Ela envia por SMTP e lê respostas por IMAP; não precisa ficar exposta na internet. Depois da instalação, toda a configuração de provedor, e-mail, senha e IA é feita no painel administrativo.

## 1. Instalar a ponte

```bash
cd /opt/de-olho-na-rua/deploy/mail-bridge
npm install --omit=dev
```

## 2. Criar o segredo local

Gere um segredo e coloque o MESMO valor nas duas configurações abaixo, no arquivo `/etc/de-olho/env`:

```bash
openssl rand -hex 32
```

```ini
MAIL_BRIDGE_TOKEN=COLE_AQUI_O_SEGREDO_GERADO
MAIL_BRIDGE_URL=http://127.0.0.1:3001
APP_PUBLIC_URL=https://brusque.app.br
```

`APP_PUBLIC_URL` é usado nos links dos e-mails quando o endereço do site não puder ser identificado no registro.

O arquivo deve continuar protegido:

```bash
chmod 600 /etc/de-olho/env
```

## 3. Ativar os dois serviços

```bash
sudo cp /opt/de-olho-na-rua/deploy/de-olho-mail.service /etc/systemd/system/de-olho-mail.service
sudo systemctl daemon-reload
sudo systemctl enable --now de-olho-mail.service
sudo systemctl restart de-olho-na-rua.service
sudo systemctl status de-olho-mail.service --no-pager
```

## 4. Configurar no painel

Entre em **Painel → Ouvidoria e e-mail** e informe:

1. E-mail da Ouvidoria.
2. E-mail e senha da sua caixa.
3. Provedor e chave da IA (Gemini ou Groq).

A descoberta automática reconhece Gmail, Outlook, Yahoo e Zoho. Para domínios próprios, ela também consulta os registros MX e a configuração automática publicada pelo provedor. Se o provedor não publicar esses dados, desligue a descoberta automática e preencha servidores e portas.

No Gmail, ative a verificação em duas etapas e use uma **senha de aplicativo**, não a senha normal. O IMAP precisa estar ativado. Outros provedores também podem exigir liberação de SMTP/IMAP ou uma senha específica para aplicativos.

Use **Testar conexão** antes de divulgar o sistema. O teste verifica envio e leitura sem mandar uma solicitação à Prefeitura.
