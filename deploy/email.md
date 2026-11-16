# E-mail automático da Ouvidoria na VPS

## Instalação com Docker (recomendado — use esta)

Rode `bash deploy/instalar-email-docker.sh` como root. Ele pode ser repetido sem problemas: reaproveita os segredos e a configuração da caixa, usa o código mais recente de `deploy/mail-bridge`, cria `docker-compose.override.yml` e confere se o site enxerga a ponte.

O instalador também cria um agendamento local a cada 5 minutos. O intervalo escolhido no painel continua sendo respeitado pelo aplicativo. Se uma atualização remover a ligação entre o site e a ponte, o próprio agendamento executa o reparo automaticamente. O comando manual `de-olho-email-reparar` continua disponível.

A Shard Cloud é reconhecida automaticamente pelo domínio do projeto e pelos registros MX. A configuração fica visível no painel: SMTP `mail.shardcloud.app:465` e IMAP `mail.shardcloud.app:993`, ambos com SSL direto.

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

A descoberta automática reconhece Shard Cloud, Gmail, Outlook, Yahoo e Zoho. Para domínios próprios, ela também consulta os registros MX e a configuração automática publicada pelo provedor. Se o provedor não publicar esses dados, desligue a descoberta automática e preencha servidores e portas.

No Gmail, ative a verificação em duas etapas e use uma **senha de aplicativo**, não a senha normal. O IMAP precisa estar ativado. Outros provedores também podem exigir liberação de SMTP/IMAP ou uma senha específica para aplicativos.

Use **Testar e-mail** antes de divulgar o sistema. O teste verifica SMTP e IMAP sem mandar uma solicitação à Prefeitura. Na área de IA, **Validar chave e buscar modelos** consulta o catálogo real do provedor; depois escolha um modelo e use **Testar modelo selecionado**. O histórico **Diagnóstico das respostas** mostra protocolos anexados, mensagens ignoradas e erros de leitura.
