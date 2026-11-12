# Detalhes do buraco (tamanho e perigos)

## O que o morador verá
Na tela "Informar buraco", acima da foto, dois blocos opcionais, cada um com um toque:

- **Tamanho:** Pequeno / Médio / Grande (botões com desenho de buraco em 3 tamanhos; tocar de novo desmarca).
- **Perigos** (pode marcar vários):
  - Risco para motos/bicicletas
  - Fundo / pode estourar pneu
  - Difícil de ver à noite
  - Com água / alagado

Nada é obrigatório: dá para enviar direto como hoje.

## No mapa público
- Buraco com algum perigo marcado ganha destaque: marcador com borda vermelha e um pequeno "!" .
- O balão do buraco mostra o tamanho e os perigos informados.

## No painel do responsável
- Lista mostra etiquetas de tamanho e perigos.
- Novo filtro "Só perigosos" e ordenação colocando os perigosos primeiro.

## Quando vários avisos caem no mesmo buraco (20 m)
- Tamanho: fica o maior já informado.
- Perigos: soma de todos os marcados.

## Detalhes técnicos
- Migração: colunas `size text null` (check pequeno/medio/grande) e `hazards text[] default '{}'` (check em lista permitida) em `potholes`.
- `report_pothole` ganha `_size` e `_hazards` opcionais; ao agrupar usa o maior tamanho e une os perigos (validação no SQL).
- `listPublicPotholes` passa a retornar `size, hazards`; tipos em `src/lib/potholes.ts` com constantes/rótulos compartilhados.
- `ReportSheet`: chips de tamanho e perigo; `PotholeMap`: variante de ícone de destaque; `admin.tsx`: etiquetas + filtro.
- Teste em `src/test/potholes.test.ts` para regra de "maior tamanho" e união de perigos (helper em `potholes.ts`).
