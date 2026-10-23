#!/usr/bin/env bash
# Baixa as fontes do site (Familjen Grotesk, Fragment Mono) e do painel (Onest) em WOFF2,
# só o subconjunto latin (cobre todo o português), e a TTF da Familjen Grotesk usada pelo
# scripts/gerar-og.sh. Os arquivos gerados são commitados; este script só regenera.
# Licenças: as três famílias são SIL Open Font License 1.1 (OFL), ver public/fontes.css.
set -euo pipefail
cd "$(dirname "$0")/.."

for ferramenta in curl grep sed; do
  command -v "$ferramenta" >/dev/null || { echo "Falta '$ferramenta'. Instale com: sudo apt install $ferramenta" >&2; exit 1; }
done

DESTINO=public/fontes
TTF_DESTINO=scripts/fontes
mkdir -p "$DESTINO" "$TTF_DESTINO"

# Navegador moderno na UA: a API do Google Fonts só devolve WOFF2 (e fontes variáveis) assim.
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
baixar() { curl -fsSL --max-time 60 -A "$UA" "$1" -o "$2" || { echo "Não deu para baixar $1" >&2; exit 1; }; }

# família (como na API) | nome do arquivo | faixa de peso/estilo
# Pedir uma faixa (400..700) devolve a fonte variável: um arquivo por estilo.
declare -a FONTES=(
  "Familjen+Grotesk:wght@400..700|familjen-grotesk-latin"
  "Familjen+Grotesk:ital,wght@1,400..700|familjen-grotesk-italic-latin"
  "Fragment+Mono|fragment-mono-latin"
  "Onest:wght@400..800|onest-latin"
)

CSS_TMP=$(mktemp)
trap 'rm -f "$CSS_TMP"' EXIT
for entrada in "${FONTES[@]}"; do
  familia="${entrada%%|*}"; arquivo="${entrada##*|}"
  baixar "https://fonts.googleapis.com/css2?family=${familia}&display=swap" "$CSS_TMP"
  # Dentro do bloco "/* latin */" (não latin-ext) fica a URL do WOFF2 que queremos.
  url=$(grep -A 6 '/\* latin \*/' "$CSS_TMP" | grep -o 'url([^)]*)' | head -n 1 | sed 's/^url(//; s/)$//')
  [ -n "$url" ] || { echo "A API do Google Fonts não devolveu o subconjunto latin de ${familia}" >&2; exit 1; }
  baixar "$url" "$DESTINO/$arquivo.woff2"
  echo "ok  $DESTINO/$arquivo.woff2 ($(wc -c < "$DESTINO/$arquivo.woff2") bytes)"
done

# TTF para o ImageMagick (scripts/gerar-og.sh): o repositório oficial só publica a fonte variável.
baixar "https://github.com/google/fonts/raw/main/ofl/familjengrotesk/FamiljenGrotesk%5Bwght%5D.ttf" "$TTF_DESTINO/FamiljenGrotesk-variavel.ttf"
echo "ok  $TTF_DESTINO/FamiljenGrotesk-variavel.ttf ($(wc -c < "$TTF_DESTINO/FamiljenGrotesk-variavel.ttf") bytes)"

echo "Fontes atualizadas. Lembre de commitar public/fontes/ e scripts/fontes/."
