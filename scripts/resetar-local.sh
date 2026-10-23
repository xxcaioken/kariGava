#!/usr/bin/env bash
# Volta o banco local (wrangler dev) para o estado inicial: só as fotos de conteudo.json.
set -euo pipefail
cd "$(dirname "$0")/.."
# Garante as tabelas antes de limpar (idempotente): `git pull && npm run test:e2e` nunca morre com "no such table".
npx wrangler d1 migrations apply site-kari --local >/dev/null
npx wrangler d1 execute site-kari --local --command "DELETE FROM itens; DELETE FROM textos; DELETE FROM produtos; DELETE FROM config; DELETE FROM depoimentos; DELETE FROM antes_depois; DELETE FROM faq; DELETE FROM codigos_login;" >/dev/null
npx wrangler d1 execute site-kari --local --file migrations/0002_fotos_iniciais.sql >/dev/null
# A 0002 reinsere fotos em "edicao" e "oficina-look"; a 0010 (só UPDATEs, pode repetir) as move de novo para os
# serviços que os absorveram, como aconteceu no banco remoto, onde a 0002 rodou antes da 0010.
npx wrangler d1 execute site-kari --local --file migrations/0010_servicos_unidos.sql >/dev/null
npx wrangler d1 execute site-kari --local --file scripts/faq-inicial.sql >/dev/null
echo "banco local zerado"
