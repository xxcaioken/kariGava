# Site da Kari Gava

Site público + painel de edição da Kariene Gava (stylist e visual merchandiser, Florianópolis) e da LALAIÁ Acessórios. Cloudflare Worker (`src/`), D1, R2, painel em `public/painel/` (JS puro). Contrato da API em `docs/API.md`; publicação em `docs/PUBLICAR.md`; o que falta em `docs/PENDENCIAS.md`.

Regras do projeto:
- Tudo em PT-BR com acentuação correta; a Kari (não técnica, celular) é a usuária do painel: linguagem do lado dela, sem jargão.
- Nada inventado vai ao ar como fato: depoimentos, preços e prazos só pelo painel; textos redigidos por agente ficam marcados como rascunho em `conteudo.json` e listados em `docs/PENDENCIAS.md`.
- Não usar `img/kari-chapeu-anturio` (não é a Kari) nem fotos de clientes menores de idade.
- Testes: `npm test` (unitários) e `npm run test:e2e` (ponta a ponta, com `npm run dev` no ar; zera o banco local).
- Commits e PRs só no branch de trabalho; merge em `main` é decisão do Caio.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. Route only to skills in the session's available-skills list; answer directly for quick questions or small scoped edits.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
