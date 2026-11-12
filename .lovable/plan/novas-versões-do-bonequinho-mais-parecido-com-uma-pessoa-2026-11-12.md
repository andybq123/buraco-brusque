# Novas versões do bonequinho (mais parecido com uma pessoa)

## O que vou fazer
1. Gerar 4 versões do bonequinho com aparência de pessoa (corpo inteiro, de pé, fundo transparente), todas com a camisa listrada nas cores do Brusque (vermelho, amarelo e verde), sem o escudo oficial:
   - **Torcedor simples:** homem jovem, camisa, bermuda e tênis, sorrindo e acenando.
   - **Moradora:** mulher com camisa do time, calça jeans, apontando para baixo (como quem mostra o buraco).
   - **Trabalhador de obra:** capacete amarelo e colete refletivo por cima da camisa.
   - **Estilo desenho animado:** pessoa com cabeça um pouco maior, traço simples, fácil de ver em tamanho pequeno no mapa.
2. Mostrar as 4 opções para você escolher.
3. Trocar o bonequinho atual pela opção escolhida, mantendo o mesmo jeito de arrastar com o dedo e o balanço "molengo".

## Detalhes técnicos
- Imagens PNG transparentes em `src/assets/`, convertidas para webp leve (~64x94 px de exibição, 2x para telas retina).
- Substituir o import em `PotholeMap.tsx`; animações CSS existentes continuam.
