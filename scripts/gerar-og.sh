#!/usr/bin/env bash
# Gera public/og.jpg (1200×630): a prévia do link no WhatsApp, Instagram e Google (R-09).
# Composição: fundo branco (sem faixa de cor: a cor de destaque muda por estação e a prévia não precisa ser refeita), a foto do hero (640×640) colada com
# 630 px de altura à direita sem ampliar, e à esquerda "Kari Gava" + profissão + cidade na Familjen Grotesk.
# O arquivo gerado é commitado; este script só regenera (precisa do ImageMagick e da TTF de scripts/baixar-fontes.sh).
set -euo pipefail
cd "$(dirname "$0")/.."

if command -v magick >/dev/null; then IM=magick; elif command -v convert >/dev/null; then IM=convert; else
  echo "Falta o ImageMagick. Instale com: sudo apt install imagemagick" >&2; exit 1
fi
FONTE=scripts/fontes/FamiljenGrotesk-variavel.ttf
FOTO=public/img/kari-stylist-toia.jpg
SAIDA=public/og.jpg
[ -f "$FONTE" ] || { echo "Falta $FONTE. Rode scripts/baixar-fontes.sh primeiro." >&2; exit 1; }
[ -f "$FOTO" ] || { echo "Falta a foto do hero $FOTO." >&2; exit 1; }

"$IM" -size 1200x630 xc:white \
  \( "$FOTO" -resize x630 \) -gravity NorthEast -geometry +0+0 -composite \
  -gravity NorthWest -font "$FONTE" -fill "#141218" \
  -pointsize 92 -annotate +60+200 "Kari Gava" \
  -pointsize 34 -fill "#4B4752" -annotate +62+330 "Stylist · Visual Merchandiser" \
  -pointsize 34 -annotate +62+380 "Florianópolis, SC" \
  -pointsize 24 -fill "#141218" -annotate +62+540 "Consultoria de estilo · Vitrines · LALAIÁ Acessórios" \
  -quality 86 -strip "$SAIDA"

echo "ok  $SAIDA ($(wc -c < "$SAIDA") bytes, $("$IM" "$SAIDA" -format '%wx%h' info:))"
