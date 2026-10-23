#!/usr/bin/env bash
# Gera os ícones do painel para a tela inicial do celular (R-14): o leque de três lâminas da marca, em tinta, sobre
# fundo branco, em 192, 512 (manifest) e 180 (apple-touch-icon). Em tinta e não na cor de destaque, para o ícone
# não precisar ser refeito a cada troca de cor da estação. Os PNG são commitados; este script só regenera.
set -euo pipefail
cd "$(dirname "$0")/.."
if command -v magick >/dev/null; then IM=magick; elif command -v convert >/dev/null; then IM=convert; else
  echo "Falta o ImageMagick. Instale com: sudo apt install imagemagick" >&2; exit 1
fi

# Mesma geometria do /favicon.svg (src/marca.js: lâminas 5×21, raio 1.5, giradas -24°/0°/24° em torno do pino
# (16, 26) num quadro de 32), reduzida a 70% no centro para sobrar margem "maskable" e sem canto arredondado no
# fundo (o celular já recorta o ícone). Desenho com as primitivas do ImageMagick: o SVG interno dele não respeita
# o viewBox. IM6 só aceita "roundRectangle" com R maiúsculo.
export LC_ALL=C   # awk com ponto decimal (em pt_BR sairia "24,0" e o ImageMagick recusa a primitiva)
gerar() {
  local lado=$1 saida=$2
  local e px py w h r
  e=$(awk -v l="$lado" 'BEGIN { printf "%.4f", l / 32 * 0.7 }')
  px=$(awk -v l="$lado" 'BEGIN { printf "%.2f", (4.8 + 0.7 * 16) * l / 32 }')
  py=$(awk -v l="$lado" 'BEGIN { printf "%.2f", (4.2 + 0.7 * 26) * l / 32 }')
  w=$(awk -v e="$e" 'BEGIN { printf "%.2f", 2.5 * e }')
  h=$(awk -v e="$e" 'BEGIN { printf "%.2f", 21 * e }')
  r=$(awk -v e="$e" 'BEGIN { printf "%.2f", 1.5 * e }')
  local args=()
  for giro in -24 0 24; do
    args+=(-draw "translate $px,$py rotate $giro roundRectangle -$w,-$h $w,0 $r,$r")
  done
  "$IM" -size "${lado}x${lado}" xc:white -fill "#141218" "${args[@]}" -strip "$saida"
  echo "ok  $saida ($("$IM" "$saida" -format '%wx%h' info:))"
}

gerar 192 public/painel/icone-192.png
gerar 512 public/painel/icone-512.png
gerar 180 public/painel/icone-180.png
