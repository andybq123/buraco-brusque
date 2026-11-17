# Deixar o mapa mais leve

## O que muda para o morador
- Mapa abre mais rápido, principalmente no celular e em internet 4G fraca.
- Menos travadas ao arrastar e dar zoom quando há muitos registros.
- Menos consumo de dados e bateria.

## O que vou fazer
1. **Carregar o motor das camadas desenhadas só quando necessário.** Hoje o mapa sempre baixa um pacote pesado (~800 KB) usado só em Ruas/Claro/Escuro, mesmo quando a pessoa está no Satélite. Passa a ser baixado apenas ao trocar para essas camadas.
2. **Agrupar pinos próximos** quando o mapa está afastado (bolinha com o número de registros); ao aproximar, aparecem os pinos normais.
3. **Pinos mais leves:** converter os pinos de buraco e poste para WebP pequeno.
4. **Atualização automática mais econômica:** pausar quando o app está em segundo plano e só redesenhar quando algo realmente mudou.
5. **Contorno de Brusque simplificado** para desenhar mais rápido, sem mudar o limite real usado para validar os registros.
6. **Imagens de satélite:** evitar baixar a versão em alta resolução em celulares mais fracos e guardar em cache por mais tempo.

## Detalhes técnicos
- `maplibre-gl` + `@maplibre/maplibre-gl-leaflet` via `import()` dinâmico dentro da criação da camada vetorial; CSS idem.
- `leaflet.markercluster` (ou agrupamento simples próprio) com ícones memoizados por status/tipo.
- Polling com `document.visibilityState` e comparação por `last_reported_at`/status.
- Polígono de exibição simplificado (Douglas-Peucker) só para a máscara; `inside_brusque()` e `isInsideBrusque` intocados.
- Medir tamanho do bundle antes/depois.
