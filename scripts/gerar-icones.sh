#!/usr/bin/env bash
# Gera os ícones do painel para a tela inicial do celular (R-14): o leque de 6 listras da cartela sobre fundo
# branco, como o favicon, em 192, 512 (manifest) e 180 (apple-touch-icon). Os PNG são commitados; este script só regenera.
set -euo pipefail
export LC_ALL=C   # awk com ponto decimal (em pt_BR sairia "24,0" e o ImageMagick recusa a primitiva)
cd "$(dirname "$0")/.."
if command -v magick >/dev/null; then IM=magick; elif command -v convert >/dev/null; then IM=convert; else
  echo "Falta o ImageMagick. Instale com: sudo apt install imagemagick" >&2; exit 1
fi

CORES=("#8D51FF" "#C52118" "#FEBC5C" "#E5196E" "#017F38" "#2A2730")

gerar() {
  local lado=$1 saida=$2
  # Mesma geometria do favicon (32×32): listras de 3.4 de largura a cada 4.4, altura 20, a partir de y=6; sem canto
  # arredondado no fundo (o celular já recorta o ícone), com margem para "maskable".
  local escala; escala=$(awk -v l="$lado" 'BEGIN { printf "%.4f", l / 32 }')
  local args=()
  local i=0
  for cor in "${CORES[@]}"; do
    local x0 x1 y0 y1
    x0=$(awk -v e="$escala" -v i="$i" 'BEGIN { printf "%.1f", (4 + i * 4.4) * e }')
    x1=$(awk -v e="$escala" -v i="$i" 'BEGIN { printf "%.1f", (4 + i * 4.4 + 3.4) * e }')
    y0=$(awk -v e="$escala" 'BEGIN { printf "%.1f", 6 * e }')
    y1=$(awk -v e="$escala" 'BEGIN { printf "%.1f", 26 * e }')
    args+=(-fill "$cor" -draw "rectangle $x0,$y0 $x1,$y1")
    i=$((i + 1))
  done
  "$IM" -size "${lado}x${lado}" xc:white "${args[@]}" -strip "$saida"
  echo "ok  $saida ($("$IM" "$saida" -format '%wx%h' info:))"
}

gerar 192 public/painel/icone-192.png
gerar 512 public/painel/icone-512.png
gerar 180 public/painel/icone-180.png
