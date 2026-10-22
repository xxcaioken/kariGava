# Site da Kari Gava

Site da Kariene Gava (stylist e visual merchandiser, Florianópolis) e da LALAIÁ Acessórios, com um painel onde a Kari coloca fotos do Instagram ou do celular e edita os textos dos serviços.

- **Site**: `src/template.js` (variante D1 "Leque", ver `design/variantes/d1-leque.html`) + `public/site.css`, gerado a cada visita a partir do banco.
- **Painel**: `public/painel/` (HTML + JS puro), fala com a API descrita em `docs/API.md`.
- **Servidor**: Cloudflare Worker (`src/`), D1 (fotos e textos), R2 (imagens), cron semanal que renova o acesso ao Instagram.
- **Conteúdo fixo**: `conteudo.json` (textos marcados com `"rascunho": true` precisam da revisão da Kari).
- **Publicar**: `docs/PUBLICAR.md`.
- **Explorações de design**: `design/` (variantes A a G, evoluções D1 a D3, protótipos do painel).
