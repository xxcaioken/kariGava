# Operação do site da Kari

Procedimentos para quando algo precisa ser feito à mão. Todos os comandos rodam na raiz do repositório, com o `wrangler` logado na conta da Cloudflare (`npx wrangler login`).

## Versões leves de fotos antigas (backfill)

Fotos que entraram no site antes das versões leves (R-10) continuam com `<img>` simples: funcionam, só pesam mais no celular. Para gerar as versões de uma foto já publicada, sem mexer no site:

1. Descubra o `id` do item em `GET /api/painel/estado` (ou pelo painel: a parte do site mostra "N fotos sem versão leve").
2. Abra a parte do site no painel e espere a linha "Otimizando fotos… N de M": o painel baixa cada foto do Instagram sem versões, gera as versões no navegador e envia. Isso cobre o caso comum.
3. Se precisar fazer por fora do painel, gere as versões com o ImageMagick e envie pela API, com a sessão do painel (`kari_sessao`):

```bash
convert foto.jpg -resize 480x -quality 85 -strip 480.jpg
convert foto.jpg -resize 960x -quality 85 -strip 960.jpg
convert foto.jpg -resize 1600x -quality 85 -strip 1600.jpg
convert foto.jpg -resize 480x -quality 80 -strip 480.webp   # idem 960 e 1600
curl -X POST "$BASE/api/painel/itens/<id>/variantes" -H "origin: $BASE" -b "kari_sessao=..." \
  -F largura=1600 -F altura=1200 -F 480.jpg=@480.jpg -F 960.jpg=@960.jpg -F 1600.jpg=@1600.jpg \
  -F 480.webp=@480.webp -F 960.webp=@960.webp -F 1600.webp=@1600.webp
```

Só mande as larguras menores que a foto original, mais a própria original (foto de 1080 px: `480.jpg`, `960.jpg`, `1080.jpg`). A resposta diz o que subiu em `item.variantes`.

## Regenerar uma versão que já existe

As versões ficam em `/fotos/<chave>-<largura>.<ext>` com `cache-control: public, max-age=31536000, immutable`. Repetir o `POST .../variantes` sobrescreve o objeto no R2, mas quem já viu a foto (e a CDN da Cloudflare) continua com a versão antiga até o cache expirar. Depois de regenerar, limpe o cache no painel da Cloudflare: *Caching → Configuration → Purge Cache → Custom purge* com as URLs das versões (ou *Purge Everything*, que é inofensivo neste site).

## Fotos iniciais do repositório

As fotos de `public/img/` têm as versões geradas por `scripts/gerar-variantes.sh` (ImageMagick) e listadas em `public/img/variantes.json`; os arquivos gerados são commitados. Ao trocar ou acrescentar uma foto em `public/img/`, rode o script e commite o resultado. A prévia do link (`public/og.jpg`) é gerada por `scripts/gerar-og.sh`.
