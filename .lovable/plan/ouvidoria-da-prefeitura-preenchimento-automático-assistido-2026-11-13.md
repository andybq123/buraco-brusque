# Ouvidoria da Prefeitura: preenchimento automático assistido

## Como funciona para você
1. No painel, cada buraco ganha o botão **"Enviar à Ouvidoria"**.
2. O botão abre o site da Ouvidoria em outra aba. Se for preciso, você passa pela Identificação (passo 1) como faz hoje.
3. No passo 2, você toca no favorito **"Preencher De Olho na Rua"**, que fica salvo uma vez só na barra de favoritos do navegador. Ele preenche sozinho:
   - **Assunto:** Buraco.
   - **Finalidade:** Solicitação.
   - **Prioridade:** Alta quando o buraco tem perigo marcado; Baixa nos outros casos.
   - **Endereço completo** e **referência** ("Buraco nº 12 – De Olho na Rua").
   - **Descrição:** "Munícipe solicita reparo em buraco na via." Em seguida vêm o tamanho, os riscos marcados, quantos moradores avisaram e desde quando, mais o link do buraco no mapa.
4. Você confere, marca **"Não sou um robô"** e clica em **Registrar**. O app nunca mexe no "Não sou um robô"; isso continua sendo feito por você.
5. De volta ao painel, você digita o **número de protocolo** no buraco.
6. No **mapa público**, ao tocar no buraco, aparece "Pedido registrado na Prefeitura · protocolo 12345 · 13/11/2026", visível para todos.

Por que um favorito? O site da Prefeitura é de outro endereço, e o navegador não deixa o nosso app escrever nele diretamente. O favorito roda dentro da própria página da Ouvidoria. Na tela de Ouvidoria do painel vai ter um passo a passo de como salvá-lo arrastando um botão. Funciona no computador, e no celular dá mais trabalho, então o recomendado é usar no computador.

Extras no painel: filtro "Ainda não enviados à Ouvidoria", contador na Visão geral e coluna de protocolo na planilha exportada.

## Detalhes técnicos
- Migração: colunas `ouvidoria_protocol text` e `ouvidoria_sent_at timestamptz` em potholes. Liberar a leitura pública (anon) dessas duas colunas. Só a equipe do painel pode alterá-las, pela política de staff que já existe.
- `buildOuvidoriaReport(pothole)` em `src/lib/potholes.ts`, com teste unitário: monta o texto da descrição e a prioridade.
- O botão do painel abre a página do 1Doc com `#deolho=<código>`. O código traz os dados já montados em base64 e codificados para URL. O favorito lê esse trecho do endereço; se não encontrar, pede o número do buraco e busca os dados em uma rota pública somente leitura `/api/public/ouvidoria/$number`, que devolve apenas dados que já são públicos.
- O favorito preenche os campos do 1Doc: selects (incluindo os que usam select2/chosen, disparando change), os inputs e o editor de texto da descrição. Os seletores exatos serão levantados inspecionando a página real durante a implementação. Ele não toca no reCAPTCHA nem no botão Registrar.
- Admin: dialog "Enviar à Ouvidoria" (abrir site, instalar favorito, campo de protocolo), filtro, KPI, coluna CSV. Público: linha do protocolo no popup do buraco e em `listPublicPotholes`.

## Limitação
Se a Prefeitura mudar o formulário, o favorito pode parar de preencher algum campo e precisará de ajuste. Mesmo assim, o texto continua disponível no painel com botão de copiar, como alternativa.
