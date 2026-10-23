#!/usr/bin/env bash
# Gera as imagens de teste (commitadas) usadas pelo e2e de R-10: uma paisagem de 1600 px, um retrato de 1200 px,
# as variantes 480/960/1600 em JPEG e WebP e um PNG com nome de WebP (para o 400). Precisa do ImageMagick.
set -euo pipefail
cd "$(dirname "$0")"
if command -v magick >/dev/null; then IM=magick; elif command -v convert >/dev/null; then IM=convert; else
  echo "Falta o ImageMagick. Instale com: sudo apt install imagemagick" >&2; exit 1
fi
"$IM" -size 1600x1200 gradient:"#8D51FF-#FEBC5C" -quality 80 -strip paisagem-1600.jpg
"$IM" -size 1200x1600 gradient:"#E5196E-#017F38" -quality 80 -strip retrato-1200.jpg
for w in 480 960 1600; do
  "$IM" paisagem-1600.jpg -resize "${w}x" -quality 80 -strip "variante-$w.jpg"
  "$IM" paisagem-1600.jpg -resize "${w}x" -quality 75 -strip "variante-$w.webp"
done
"$IM" -size 480x360 xc:"#C52118" nao-e-webp.png
ls -l *.jpg *.webp *.png | awk '{ print $5, $9 }'
