# Ouvidoria da Prefeitura: envio assistido para cada buraco

## O que não dá para fazer
Não vou criar um robô que preenche o site da Ouvidoria e passa pelo "Não sou um robô" sozinho. Essa caixa existe justamente para barrar envios automáticos. Contorná-la desrespeita as regras do site e pode bloquear o seu acesso ou o do app. Além disso, centenas de pedidos idênticos chegando sozinhos tendem a ser tratados como spam pela Prefeitura.

## O que proponho: envio assistido no painel (cerca de 20 segundos por buraco)
Cada buraco no painel ganha o botão **"Enviar à Ouvidoria"**. Ao tocar nele:
1. Abre uma janela com tudo pronto para colar:
   - **Endereço:** o endereço do buraco, ou as coordenadas quando não houver endereço.
   - **Assunto:** Buraco. **Finalidade:** Solicitação. **Prioridade:** Alta quando houver perigo; Baixa nos demais casos.
   - **Relato** montado sozinho, por exemplo: "Munícipe solicita reparo em buraco na via. Tamanho: grande. Riscos: perigo para motos/bicicletas, com água/alagado. Informado por 4 moradores desde 02/11/2026. Localização no mapa: (link do buraco nº 12)."
   - Botões de copiar ao lado de cada campo.
2. O botão "Abrir Ouvidoria" abre o site da Prefeitura em outra aba. A pessoa cola os campos, marca "Não sou um robô" e clica em Registrar.
3. A pessoa volta ao painel e informa o **número de protocolo** que a Prefeitura gerou. O buraco passa a mostrar "Enviado à Ouvidoria · protocolo 12345 · 13/11".

Extras:
- Filtro "Ainda não enviados à Ouvidoria" e um contador na Visão geral.
- O protocolo entra na planilha exportada.
- Opcional: mostrar no mapa público "Pedido registrado na Prefeitura (protocolo …)". Isso dá transparência sem dizer que o app é da Prefeitura.

## Detalhes técnicos
- Migração: colunas `ouvidoria_protocol text` e `ouvidoria_sent_at timestamptz` em potholes. Só a equipe do painel poderá alterá-las, como já acontece hoje. A leitura pública dessas colunas só será liberada se o item opcional for aprovado.
- A função `buildOuvidoriaReport(pothole)` em `src/lib/potholes.ts` monta o relato a partir do tamanho, dos perigos, da quantidade de avisos e da data. Ela terá um teste unitário.
- No admin: a janela "Enviar à Ouvidoria", o campo de protocolo, o filtro, a coluna na exportação e o indicador na Visão geral.
