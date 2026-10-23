# Operação do site da Kari

Procedimentos para quando algo precisa ser feito à mão. Todos os comandos rodam na raiz do repositório, com o `wrangler` logado na conta da Cloudflare (`npx wrangler login`). Nunca cole segredos em chat, issue ou commit.

## 1. Backup do banco (D1)

Uma vez por semana, ou antes de qualquer mudança grande:

```bash
npx wrangler d1 export site-kari --remote --output "backup/site-kari-$(date +%F).sql"
```

Guarde o arquivo fora do repositório (a pasta `backup/` está no `.gitignore`). As fotos ficam no R2 e não entram neste backup; elas não mudam sozinhas, então basta exportar o banco.

## 2. Restaurar o banco

Num banco novo ou depois de um erro:

```bash
npx wrangler d1 execute site-kari --remote --file backup/site-kari-2026-10-22.sql
```

O arquivo exportado já traz `CREATE TABLE` e os dados. Se o banco ainda tiver as tabelas, apague antes (`DROP TABLE itens; ...`) ou restaure num banco novo e troque o `database_id` em `wrangler.jsonc`. Depois, `npm run deploy`.

## 3. Mudar o banco antes de publicar (migrate antes do deploy)

Toda mudança de banco é uma migration nova em `migrations/` (nunca edite as antigas). `npm run deploy` já aplica as migrations remotas antes de publicar o Worker:

```bash
npm run deploy    # = wrangler d1 migrations apply site-kari --remote && wrangler deploy
```

Se o deploy falhar no meio, rode de novo: aplicar migration já aplicada não faz nada.

## 4. Religar o Instagram

O token de cada conta vale 60 dias e a rotina de segunda-feira renova. Se o painel mostrar "Essa conta ainda não está ligada ao site" ou "O Instagram não respondeu":

1. Confira os segredos: `npx wrangler secret list` deve mostrar `IG_APP_ID` e `IG_APP_SECRET`.
2. No painel, abra uma parte do site → "+ Trazer do Instagram" → escolha a conta → "Ligar". A conta precisa ser profissional e estar como *Instagram Tester* no app da Meta (`docs/PUBLICAR.md`, seção 3).
3. Para forçar a renovação sem esperar segunda-feira:

```bash
npx wrangler deploy && curl -s "https://<domínio>/__scheduled?cron=0+9+*+*+1" -o /dev/null -w "%{http_code}\n"
```

(O endpoint `__scheduled` existe só no `wrangler dev`; em produção, use *Workers → site-kari → Triggers → Cron Triggers → Run now* no painel da Cloudflare.)

## 5. Ver os logs

Ao vivo, enquanto reproduz o problema:

```bash
npx wrangler tail site-kari --format pretty
```

Para guardar logs e procurar depois, ative uma vez *Workers → site-kari → Settings → Observability → Workers Logs → Enable*; a partir daí os logs ficam na aba *Logs* por 3 dias (plano Free). Toda falha do servidor sai como `console.error` com a pilha.

## 6. Trocar o segredo da sessão

Derruba todas as sessões do painel (a Kari entra de novo com código por e-mail). Use se um celular for perdido ou o segredo vazar:

```bash
openssl rand -base64 32 | npx wrangler secret put SEGREDO_SESSAO
```

O segredo novo vale na hora, sem deploy.

## 7. O painel não entra

Na ordem:

1. **Não chega código por e-mail:** o e-mail precisa estar em `vars.EMAILS_PERMITIDOS` (exatamente igual) e o domínio precisa ter Email Routing com o destino confirmado (`docs/PUBLICAR.md`, seção 1). A API responde `ok` mesmo para e-mail fora da lista, de propósito.
2. **"Esse código venceu"**: vale 10 minutos e 5 tentativas; peça outro.
3. **Entra e cai na tela de e-mail de novo:** o cookie `kari_sessao` não está sendo gravado. Confira que o site está em `https://` (o cookie é `Secure`) e que o celular não bloqueia cookies no app instalado. No iPhone, o painel adicionado à tela inicial tem cookies próprios: entre de novo uma vez.
4. **Erro "Algo deu errado do nosso lado":** abra a aba *Rede* do navegador, clique na chamada que falhou (`/api/painel/...`), copie o cabeçalho `cf-ray` da resposta e procure por ele em *Workers Logs* ou no `wrangler tail`. A linha `console.error` ao lado diz o motivo.

## 8. Site sem estilo ou sem fotos

Quase sempre é a política de segurança (CSP) bloqueando algo novo. Abra o console do navegador e procure `Refused to load…` ou `Refused to connect…`: a linha diz a URL bloqueada e a diretiva. Acrescente a origem em `src/seguranca.js` (lista `CSP`), rode `npm test` e publique. Para investigar sem bloquear, defina `CSP_MODO=relatorio` em `.dev.vars` (só local): o navegador avisa em vez de bloquear.

## 9. Cliente pediu para tirar a foto ou o depoimento

Pelo painel, na hora: "Depoimentos" ou "Antes e depois" → "Tirar do site". A foto some do site no mesmo instante; o objeto fica no R2 por pouco tempo (dá para desfazer) e depois pode ser apagado de vez com:

```bash
npx wrangler r2 object delete site-kari-fotos/dep/<id>.jpg
```

Responda à cliente confirmando a retirada; a página `/privacidade` promete isso.

## 10. Pedir avaliação no Google

Com o Google Business Profile criado (ação da Kari; `docs/PENDENCIAS.md`), copie o link "Peça avaliações" do perfil e cole no painel em LALAIÁ → Como encomendar → "Link das suas avaliações no Google": o rodapé do site ganha "Avaliações no Google". Mande o mesmo link para a cliente no WhatsApp depois da entrega.

## 11. Versões leves de fotos antigas (backfill)

Fotos que entraram no site antes das versões leves continuam com `<img>` simples: funcionam, só pesam mais no celular. Para gerar as versões de uma foto já publicada, sem mexer no site:

1. Descubra o `id` do item em `GET /api/painel/estado` (ou pelo painel: a parte do site mostra "N fotos sem versão leve").
2. Abra a parte do site no painel e espere a linha "Otimizando fotos… N de M": o painel baixa cada foto do Instagram sem versões, gera as versões no navegador e envia. Isso cobre o caso comum.
3. Se precisar fazer por fora do painel, gere as versões com o ImageMagick e envie pela API, com a sessão do painel (`kari_sessao`):

```bash
convert foto.jpg -resize 480x -quality 85 -strip 480.jpg
convert foto.jpg -resize 960x -quality 85 -strip 960.jpg
convert foto.jpg -resize 1600x -quality 85 -strip 1600.jpg
convert foto.jpg -resize 480x -quality 80 -strip 480.webp   # idem 960 e 1600
curl -X POST "$BASE/api/painel/itens/<id>/variantes" -H "origin: $BASE" -b "kari_sessao=..." \
  -F largura=1600 -F altura=1200 -F 480.jpg=@480.jpg -F 960.jpg=@960.jpg -F 1600.jpg=@1600.jpg \
  -F 480.webp=@480.webp -F 960.webp=@960.webp -F 1600.webp=@1600.webp
```

Só mande as larguras menores que a foto original, mais a própria original (foto de 1080 px: `480.jpg`, `960.jpg`, `1080.jpg`). A resposta diz o que subiu em `item.variantes`.

## 12. Regenerar uma versão que já existe

As versões ficam em `/fotos/<chave>-<largura>.<ext>` com `cache-control: public, max-age=31536000, immutable`. Repetir o `POST .../variantes` sobrescreve o objeto no R2, mas quem já viu a foto (e a CDN da Cloudflare) continua com a versão antiga até o cache expirar. Depois de regenerar, limpe o cache no painel da Cloudflare: *Caching → Configuration → Purge Cache → Custom purge* com as URLs das versões (ou *Purge Everything*, que é inofensivo neste site).

## 13. Painel na tela inicial do celular

O painel tem `public/painel/manifest.webmanifest` e ícones (`scripts/gerar-icones.sh`): no Android, o Chrome oferece "Adicionar à tela inicial"; no iPhone, Safari → Compartilhar → "Adicionar à Tela de Início". O painel instalado no iPhone tem cookies próprios, separados do Safari, então a Kari entra de novo uma vez (código por e-mail) na primeira abertura. Sem sessão, o painel instalado abre direto na tela de e-mail. Não há service worker: sem internet, o painel mostra "Não deu para abrir o painel" e o botão de tentar de novo.

## 14. Variáveis locais (`.dev.vars`)

O `npm run dev` lê `.dev.vars` só ao subir. Mudou uma variável (por exemplo `ANALYTICS_TOKEN` ou `EMAIL_CONTATO`), pare e rode `npm run dev` de novo.

## 15. Fotos iniciais do repositório

As fotos de `public/img/` têm as versões geradas por `scripts/gerar-variantes.sh` (ImageMagick) e listadas em `public/img/variantes.json`; os arquivos gerados são commitados. Ao trocar ou acrescentar uma foto em `public/img/`, rode o script e commite o resultado. A prévia do link (`public/og.jpg`) é gerada por `scripts/gerar-og.sh` e os ícones do painel por `scripts/gerar-icones.sh`.

## 16. Trocar a cor da estação

O site tem uma cor de destaque só, e ela muda com a estação (pedido da Kari). Para trocar:

1. Em `conteudo.json`, mude `marca.cor_destaque` (hex de 6 dígitos, ex.: `"#017F38"`).
2. Rode `npm test`: o teste "R-02 a cor de destaque vem só do conteudo.json" reprova cor clara demais para texto branco (contraste abaixo de 4,5:1). Se reprovar, escolha um tom mais escuro da mesma cor. Se uma cor assim for publicada mesmo assim, o site não fica ilegível: usa a tinta (`#141218`) no lugar e avisa no log (`src/marca.js`).
3. Publique (`npm run deploy`). Botões, marca, favicon, faixa do rodapé e detalhes mudam juntos; a prévia do link e os ícones do painel não usam a cor e não precisam ser refeitos.
