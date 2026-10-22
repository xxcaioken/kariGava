#!/usr/bin/env bash
# Volta o banco local (wrangler dev) para o estado inicial: só as fotos de conteudo.json.
set -euo pipefail
cd "$(dirname "$0")/.."
npx wrangler d1 execute site-kari --local --command "DELETE FROM itens; DELETE FROM textos; DELETE FROM codigos_login;" >/dev/null
npx wrangler d1 execute site-kari --local --file migrations/0002_fotos_iniciais.sql >/dev/null
echo "banco local zerado"
