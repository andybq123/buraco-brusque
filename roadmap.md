# Preparação do envio automático à Ouvidoria

- [x] Guardar com segurança as configurações de e-mail e IA e o andamento de cada envio.
- [x] Permitir conferir o endereço e incluir o número antes de registrar o problema.
- [x] Enviar e-mails com endereço, coordenadas, Google Maps e código de acompanhamento.
- [x] Criar o serviço de e-mail para a VPS, com descoberta automática de provedores comuns.
- [x] Ler respostas, identificar o protocolo com Gemini ou Groq e anexá-lo ao registro certo.
- [x] Mostrar no painel e no mapa o estado de envio e o protocolo.
- [x] Testar as regras, o painel e o fluxo público sem bloquear o morador quando o e-mail falhar.
- [x] Separar Iluminação pública em uma área própria do painel.
- [x] Configurar Shard Cloud (SMTP 465 e IMAP 993) e tornar a descoberta compatível com seus registros MX.
- [x] Validar a chave de IA, listar modelos do provedor e permitir testar o modelo escolhido.
- [x] Corrigir e dar visibilidade à leitura de respostas, inclusive mensagens já abertas na caixa.
- [x] Integrar ponte e agendamento local ao instalador, preservando configurações em reinstalações e atualizações.
- [ ] Validar envio, chave de IA e leitura reais na VPS — depende das credenciais e da caixa configuradas pelo usuário.

- [x] Remover o envio por favoritos, mantendo encaminhamento por e-mail e edição do protocolo.
- [x] Anexar as fotos dos registros aos e-mails da Ouvidoria.
- [x] Incluir registros antigos não enviados na fila, sem duplicar encaminhamentos.
