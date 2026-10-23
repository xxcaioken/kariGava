#!/usr/bin/env bash
# Gera as versões leves das fotos iniciais do site (public/img/*.jpg): <nome>-<largura>.jpg e .webp (R-10),
# só nas larguras 480/960/1600 menores que a original, mais a própria original (nunca amplia), e grava
# public/img/variantes.json com largura/altura e as larguras que existem. Os arquivos gerados são commitados;
# este script só regenera. Precisa do ImageMagick com suporte a WebP (sudo apt install imagemagick webp).
set -euo pipefail
cd "$(dirname "$0")/.."

if command -v magick >/dev/null; then IM=magick; elif command -v convert >/dev/null; then IM=convert; else
  echo "Falta o ImageMagick. Instale com: sudo apt install imagemagick webp" >&2; exit 1
fi
if "$IM" -list format | grep -q WEBP; then WEBP=1; else WEBP=0; echo "aviso: ImageMagick sem WebP (sudo apt install webp); só JPEG" >&2; fi

# Fotos que não podem ir ao ar (conteudo.json → "proibido"): ficam sem variantes.
PROIBIDAS=" kari-chapeu-anturio kari-oculos "
JSON="{"
primeiro=1
for arquivo in public/img/*.jpg; do
  nome=$(basename "$arquivo" .jpg)
  case "$nome" in *-[0-9]*) continue ;; esac            # já é uma variante
  case "$PROIBIDAS" in *" $nome "*) continue ;; esac
  largura=$("$IM" "$arquivo" -format '%w' info:)
  altura=$("$IM" "$arquivo" -format '%h' info:)
  larguras=()
  for candidata in 480 960 1600; do [ "$candidata" -lt "$largura" ] && larguras+=("$candidata"); done
  larguras+=("$largura")
  lista=""
  for l in "${larguras[@]}"; do
    "$IM" "$arquivo" -resize "${l}x" -quality 85 -strip "public/img/$nome-$l.jpg"
    if [ "$WEBP" = 1 ]; then "$IM" "$arquivo" -resize "${l}x" -quality 80 -strip "public/img/$nome-$l.webp"; fi
    lista="$lista${lista:+,}$l"
  done
  webp=false; [ "$WEBP" = 1 ] && webp=true
  [ "$primeiro" = 1 ] || JSON="$JSON,"
  primeiro=0
  JSON="$JSON
  \"$nome\": {\"largura\": $largura, \"altura\": $altura, \"larguras\": [$lista], \"webp\": $webp}"
  echo "ok  $nome ${largura}x${altura} → $lista"
done
printf '%s\n}\n' "$JSON" > public/img/variantes.json
echo "ok  public/img/variantes.json"
