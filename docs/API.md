# API do painel da Kari

Servidor: um Cloudflare Worker (assets estáticos + D1 + R2 + cron). Tudo em JSON, UTF-8.
Erros sempre no formato `{ "erro": "<codigo>", "mensagem": "<frase em PT-BR para mostrar na tela>" }`.
O painel deve mostrar `mensagem` como está (já vem escrita para a Kari).

## Seções do site

| id | nome no painel | tipo |
|---|---|---|
| `lalaia` | LALAIÁ (produtos) | lalaia |
| `consultoria` | Consultoria de estilo | servico |
| `edicao` | Edição de guarda-roupa | servico |
| `styling` | Styling e produção de moda | servico |
| `vm` | Vitrines e visual merchandising | servico |
| `oficina-look` | Oficina de Look | servico |
| `ensino` | Cursos, oficinas e palestras | servico |
| `sobre` | Sobre mim | sobre |

Só seções `tipo: servico` têm textos editáveis (`resumo`, `para_quem`).
A primeira foto (ordem 0) de cada serviço é a foto principal dele no site.

## Login (código por e-mail)

Sessão por cookie `kari_sessao` (HttpOnly, Secure, SameSite=Lax, 60 dias). Só e-mails da lista `EMAILS_PERMITIDOS`.

- `POST /api/login/codigo` `{ "email": "..." }` → `200 { "ok": true }`
  - Responde `ok` mesmo para e-mail fora da lista (não revela quem pode entrar), mas só envia código para a lista.
  - `429 { erro: "muitas_tentativas", mensagem }` se pedir mais de 5 códigos em 15 min para o mesmo e-mail.
- `POST /api/login/entrar` `{ "email": "...", "codigo": "123456" }` → `200 { "ok": true, "email": "..." }` + cookie
  - `400 { erro: "codigo_invalido", mensagem: "Esse código não confere. Confira no seu e-mail e digite de novo." }`
  - `400 { erro: "codigo_expirado", mensagem: "Esse código venceu. Peça um código novo." }` (validade 10 min, 5 tentativas)
- `POST /api/login/sair` → `200 { "ok": true }` (apaga o cookie)

Todas as rotas `/api/painel/*` exigem sessão: sem ela → `401 { erro: "sem_sessao" }` (o painel volta para a tela de e-mail).
Rotas que mudam algo (POST/PUT/PATCH/DELETE) exigem `Content-Type: application/json` (ou multipart no envio de foto) e cabeçalho `Origin` igual ao do site; senão `403 { erro: "origem_invalida" }`.

## Estado

`GET /api/painel/estado` →
```json
{
  "usuario": { "email": "kari@..." },
  "secoes": [ { "id": "lalaia", "nome": "LALAIÁ (produtos)", "tipo": "lalaia", "cor": "#FEBC5C" } ],
  "itens": [ { "id": "it_abc", "secao": "lalaia", "ordem": 0, "titulo": "BigScrunchie", "foto_url": "/fotos/ab12.jpg", "origem": "instagram", "ig_conta": "lalaia", "ig_id": "1789..." } ],
  "textos": { "consultoria": { "titulo": "Consultoria de estilo", "resumo": "...", "para_quem": "..." } },
  "instagram": { "contas": [ { "conta": "kari", "usuario": "@karienegavaw", "conectada": true }, { "conta": "lalaia", "usuario": "@lalaia.acessorios", "conectada": false } ] },
  "site_url": "/"
}
```
`itens` vêm ordenados por `secao`, depois `ordem`. `origem` é `instagram`, `celular` ou `inicial`.

## Instagram

- `GET /api/painel/instagram?conta=kari&depois=<cursor>` →
  `{ "posts": [ { "conta": "kari", "ig_id": "...", "legenda": "...", "titulo_sugerido": "1ª linha da legenda, até 60 caracteres", "foto_url": "https://... (miniatura do Instagram)", "tipo": "IMAGE|VIDEO|CAROUSEL_ALBUM", "link": "https://instagram.com/p/...", "data": "2026-10-17T12:00:00+0000", "no_site": ["lalaia"] } ], "depois": "cursor ou null" }`
  - 24 posts por página. Para vídeo, `foto_url` é a capa. `no_site` lista as seções onde esse post já está (vazio = em nenhuma).
  - `409 { erro: "instagram_desconectado", mensagem: "Essa conta do Instagram ainda não está ligada ao site. Peça para o Caio ligar." }`
  - `502 { erro: "instagram_fora", mensagem: "O Instagram não respondeu agora. Tente de novo em alguns minutos." }`
- `GET /api/painel/instagram/novidades` → `{ "posts": [...] }` os 8 posts mais recentes das contas ligadas, misturados por data (mesmo formato).
- Ligar conta (feito uma vez pelo Caio): `GET /api/painel/instagram/ligar?conta=kari` → redireciona para o Instagram → volta em `/api/instagram/retorno` → redireciona para `/painel/?instagram=ligado`.

## Itens (fotos no site)

- `POST /api/painel/itens` (JSON) `{ "secao": "lalaia", "titulo": "opcional (só vale quando é 1 post)", "instagram": [ { "conta": "lalaia", "ig_id": "..." } ] }`
  → `201 { "itens": [ ...criados ] }` — aceita 1 ou vários posts; baixa a imagem do Instagram e guarda no site (R2). Novos itens entram no FIM da seção, na ordem enviada. Sem título, usa o `titulo_sugerido` do post.
  - Post que já está nessa seção é ignorado (não duplica).
- `POST /api/painel/itens` (multipart/form-data) campos `secao`, `titulo` (opcional), `foto` (jpg/png/webp até 15 MB) → `201 { "itens": [ item ] }`
  - `400 { erro: "foto_invalida", mensagem: "Esse arquivo não é uma foto. Escolha uma foto da galeria." }`
  - `413 { erro: "foto_grande", mensagem: "Essa foto é grande demais. Escolha outra ou tire um print dela." }`
- `PATCH /api/painel/itens/:id` `{ "titulo": "..." }` → `{ "item": {...} }`
- `DELETE /api/painel/itens/:id` → `{ "item": {...} }` (sai do site; pode desfazer)
- `POST /api/painel/itens/:id/restaurar` → `{ "item": {...} }` (volta para a posição em que estava)
- `POST /api/painel/itens/:id/mover` `{ "direcao": "cima" | "baixo" }` → `{ "itens": [ ...itens da seção na nova ordem ] }`
- Qualquer `secao` desconhecida → `400 { erro: "secao_invalida" }`; item inexistente → `404 { erro: "nao_encontrado" }`.

## Textos dos serviços

- `PUT /api/painel/textos/:servicoId` `{ "resumo": "...", "para_quem": "...", "preco": 380 }` → `{ "textos": { "titulo": "...", "resumo": "...", "para_quem": "...", "preco": 380 } }`
  - **PUT parcial com semeadura:** campo ausente mantém o valor atual (se o serviço nunca foi editado, o de `conteudo.json`); `"preco": null` limpa. Assim o painel pode mandar só o que mostra, e um PUT `{"preco": 380}` não apaga o resumo.
  - Limites: resumo 1 a 220 caracteres, para_quem 0 a 220. Fora disso: `400 { erro: "texto_invalido", mensagem: "O resumo precisa ter até 220 letras." }`
  - `preco`: inteiro em reais de 1 a 99.999 (sem centavos) ou `null`. Fora disso: `400 { erro: "texto_invalido", mensagem: "O preço precisa ser um número inteiro, sem centavos. Deixe vazio para não mostrar." }`. No site vira "A partir de R$ 380"; sem preço, serviços dos grupos `lojas`/`ensino` mostram "Valor sob consulta" e os do grupo `voce` não mostram nada.
  - Exemplo: `curl -X PUT "$BASE/api/painel/textos/consultoria" -H 'content-type: application/json' -H "origin: $BASE" -b "kari_sessao=..." -d '{"preco":380}'`

## Produtos da LALAIÁ

Fotos da seção `lalaia` com o mesmo nome formam um produto; a chave é o **slug** do nome (minúsculo, sem acento, `[^a-z0-9]+` → `-`, sem hífen nas pontas: "BigScrunchie (a Xuxona)" → `bigscrunchie-a-xuxona`). O estado traz `lalaia.produtos`: `[ { "slug", "titulo", "rotulo", "descricao", "cta", "preco", "disponibilidade", "prazo_dias", "fotos": [item...] } ]`, incluindo produtos cujas fotos saíram do site (os dados ficam guardados; o site só mostra produtos com foto).

- `PUT /api/painel/lalaia/produtos/:slug` `{ "preco": 65, "disponibilidade": "encomenda", "prazo_dias": 7, "descricao": "..." }` → `{ "produto": {...} }`
  - PUT parcial: campo ausente mantém, `null` limpa. `preco` inteiro em reais de 1 a 99.999; `disponibilidade` `"pronta"` | `"encomenda"` | `null`; `prazo_dias` inteiro de 1 a 90 (dias úteis); `descricao` até 220 letras.
  - Fora disso: `400 { erro: "produto_invalido", mensagem }` (ex.: "O prazo é em dias úteis, de 1 a 90."). Slug sem fotos nem dados: `404 { erro: "nao_encontrado", mensagem }`.
  - No site: "R$ 65", "Pronta entrega" ou "Sob encomenda · até 7 dias úteis" (sem prazo: só "Sob encomenda"); sem preço, nada (não há "sob consulta" em produto).
  - Exemplo: `curl -X PUT "$BASE/api/painel/lalaia/produtos/bigscrunchie-a-xuxona" -H 'content-type: application/json' -H "origin: $BASE" -b "kari_sessao=..." -d '{"preco":65,"disponibilidade":"encomenda","prazo_dias":7}'`
- `POST /api/painel/lalaia/produtos/:slug/renomear` `{ "nome": "Xuxona" }` → `{ "produto": {...} }` com o slug novo
  - Renomeia todas as fotos do produto e move os dados num só `batch` (ou tudo, ou nada). Nome que vira slug vazio → `400 produto_invalido`; nome de outro produto → `409 { erro: "produto_duplicado", mensagem: "Já existe um produto com esse nome..." }` sem mexer em nada.
  - Renomear **uma foto** pelo `PATCH /itens/:id` continua valendo: ela sai do produto (vira produto novo, sem dados) e o produto original fica com o restante e com os dados. O painel avisa isso.

## Como encomendar: condições da LALAIÁ

O site fecha o bloco da LALAIÁ com "Como encomendar" (`id="como-encomendar"`): 3 passos fixos de `conteudo.json` (`lalaia.como_encomendar`) e, abaixo, as condições que a Kari preencheu. Condição vazia não aparece; todas vazias → só os passos. Ficam na tabela `config` (chave/valor em JSON): chave `condicoes` com os 4 textos e chave `gbp_url` com o link das avaliações no Google. O estado traz tudo junto em `lalaia.condicoes`: `{ "pagamento", "frete", "prazo_padrao", "troca", "gbp_url" }` (strings, vazias quando não preenchidas).

- `PUT /api/painel/lalaia/condicoes` `{ "pagamento": "Pix à vista ou cartão em até 3x", "frete": "...", "prazo_padrao": "...", "troca": "...", "gbp_url": "https://g.page/r/.../review" }` → `{ "condicoes": {...} }`
  - PUT parcial: campo ausente mantém, `null` (ou `""`) limpa. Cada texto tem até 220 letras (espaços repetidos viram um só). Fora disso: `400 { erro: "condicao_invalida", mensagem: "O campo trocas pode ter até 220 letras; este tem 221." }`. Campo desconhecido → `400 condicao_invalida`.
  - `gbp_url`: URL `https://` válida, até 300 letras, ou vazia. Senão: `400 { erro: "condicao_invalida", mensagem: "Cole o link do seu perfil no Google (começa com https://)." }`. Preenchida, o rodapé do site ganha o link "Avaliações no Google" ao lado dos Instagrams.
  - No site, os rótulos são Pagamento, Frete, Prazo e Trocas, nessa ordem; o texto é escapado.
  - Exemplo: `curl -X PUT "$BASE/api/painel/lalaia/condicoes" -H 'content-type: application/json' -H "origin: $BASE" -b "kari_sessao=..." -d '{"pagamento":"Pix à vista ou cartão em até 3x","frete":null}'`
  - A resposta traz também o cupom: `{ "condicoes": {...}, "cupom": {...} }`.

## Cupom de primeira encomenda

Vai no mesmo `PUT /api/painel/lalaia/condicoes`, no campo `cupom` (chave `cupom` da tabela `config`). O estado traz `lalaia.cupom`: `{ "ativo": false, "codigo": "", "desconto": null, "valido_ate": "" }` por padrão.

- `PUT /api/painel/lalaia/condicoes` `{ "cupom": { "ativo": true, "codigo": "bemvinda", "desconto": 10, "valido_ate": "2026-12-31" } }` → `{ "condicoes": {...}, "cupom": { "ativo": true, "codigo": "BEMVINDA", "desconto": 10, "valido_ate": "2026-12-31" } }`
  - PUT parcial dentro de `cupom`: campo ausente mantém, `null` limpa; `"cupom": null` zera o cupom inteiro. `codigo` vira maiúsculas e precisa casar `^[A-Z0-9]{1,20}$`; `desconto` inteiro de 1 a 99; `valido_ate` data `AAAA-MM-DD` real ou vazia (sem data, vale até desligar). Ligar exige código e desconto.
  - Fora disso: `400 { erro: "cupom_invalido", mensagem }` ("O desconto vai de 1 a 99%.", "O código tem até 20 letras ou números, sem espaços nem acentos.", "Use uma data no formato dia/mês/ano.", "Para ligar o cupom, preencha o código."). Nada é gravado num 400.
  - No site, com o cupom **vigente** (ligado, com código e desconto, e `valido_ate` vazia ou ainda não passada no horário de Brasília): a linha "Primeira encomenda? Diga o código BEMVINDA no WhatsApp e ganhe 10%." aparece na LALAIÁ, entre os produtos e "Como encomendar", e os botões de WhatsApp da LALAIÁ (produtos e o botão do bloco) ganham o sufixo ` · cupom BEMVINDA` na mensagem. Desligado ou vencido: nada muda no site. Os botões dos serviços nunca levam o cupom.
  - O painel mostra "Cupom · ligado / desligado / vencido em dd/mm" no cartão da LALAIÁ em "Partes do site".

## Depoimentos

Seção "O que dizem" do site, entre "Como trabalhar comigo" e "Sobre"; só existe no HTML quando há depoimento ativo. O estado traz `depoimentos`: `[ { "id": "dep_...", "ordem": 0, "nome", "de_onde", "texto", "servico", "foto_url": "/fotos/dep/dep_....jpg" | null, "largura", "altura", "consentimento_em": "2026-10-22T..." | null } ]`, ordenados.

- `POST /api/painel/depoimentos` (JSON) `{ "nome": "Mariana", "de_onde": "Florianópolis", "texto": "...", "servico": "consultoria", "consentimento": true }` → `201 { "depoimento": {...} }`
- `POST /api/painel/depoimentos` (multipart/form-data) campos `nome`, `de_onde`, `texto`, `servico`, `consentimento` (`true`), `foto` (jpg/png/webp até 15 MB; corpo todo até 24 MB), `largura` e `altura` (tamanho da foto enviada, inteiros de 1 a 10000; viram `width`/`height` no site) → `201 { "depoimento": {...} }`
  - Limites: nome 1 a 80, de_onde 0 a 80, texto 1 a 400 letras, `servico` um id de `conteudo.servicos` ou vazio. Fora disso: `400 { erro: "texto_invalido", mensagem: "O depoimento pode ter até 400 letras; este tem 401." }`.
  - **Com foto, `consentimento` é obrigatório** (a Kari marca que a cliente autorizou usar a foto e o depoimento): sem ele → `400 { erro: "texto_invalido", mensagem: "Marque que a cliente autorizou antes de publicar a foto." }`. Sem foto o campo é opcional; marcado, fica em `consentimento_em`.
  - Foto que não é imagem, HEIC ou sem `largura`/`altura` válidas → `400 foto_invalida`; grande demais → `413 foto_grande`.
  - Ordem no servidor: valida tudo → guarda a foto no R2 (`dep/<id>.jpg`) → grava no banco. Se gravar falhar, a foto é apagada e a resposta é `500 { erro: "erro_interno", mensagem: "Não deu para salvar o depoimento. Tente de novo." }`. O id nasce no servidor: repetir o POST cria outro depoimento (o painel desabilita o botão durante o envio).
- `PATCH /api/painel/depoimentos/:id` `{ "nome", "de_onde", "texto", "servico" }` (parcial) → `{ "depoimento": {...} }`. A foto não muda por aqui: para trocar, tire e cadastre de novo.
- `DELETE /api/painel/depoimentos/:id` → `{ "depoimento": {...} }` (sai do site; pode desfazer)
- `POST /api/painel/depoimentos/:id/restaurar` → `{ "depoimento": {...} }` (volta para a posição em que estava)
- `POST /api/painel/depoimentos/:id/mover` `{ "direcao": "cima" | "baixo" }` → `{ "depoimentos": [ ...na nova ordem ] }`
- Inexistente → `404 { erro: "nao_encontrado" }`.

## Antes e depois

Bloco "Antes e depois" dentro da área de serviços do site, logo após a grade; só existe no HTML quando há par ativo. O estado traz `antes_depois`: `[ { "id": "ad_...", "ordem", "legenda", "servico": "vm" | "styling" | "edicao", "antes_url", "depois_url", "largura_antes", "altura_antes", "largura_depois", "altura_depois", "consentimento_em" } ]`.

- `POST /api/painel/antes-depois` (só multipart/form-data) campos `antes` e `depois` (as duas fotos, jpg/png/webp até 15 MB cada; corpo todo até 24 MB), `largura_antes`, `altura_antes`, `largura_depois`, `altura_depois` (inteiros de 1 a 10000; viram `width`/`height` no site), `legenda` (até 120 letras, opcional), `servico` (`vm`, `styling` ou `edicao`) e `consentimento` (`true`, obrigatório) → `201 { "par": {...} }`
  - Falta uma foto → `400 { erro: "foto_invalida", mensagem: "Falta a foto de Antes. O par precisa das duas fotos." }` (ou "de Depois"). Sem `consentimento` → `400 { erro: "foto_invalida", mensagem: "Marque que a cliente autorizou antes de publicar as fotos." }`. Legenda longa ou serviço fora dos três → `400 texto_invalido`. Tamanho inválido → `400 foto_invalida`; grande demais → `413 foto_grande`.
  - Não existe par pela metade: o servidor valida as duas fotos, sobe as duas no R2 (`ad/<id>-antes.jpg`, `ad/<id>-depois.jpg`) e grava; falha em qualquer passo apaga o que subiu e responde `500 { erro: "erro_interno", mensagem: "Não deu para salvar o par. Tente de novo." }`. O id nasce no servidor: repetir o POST cria outro par.
- `PATCH /api/painel/antes-depois/:id` `{ "legenda", "servico" }` (parcial) → `{ "par": {...} }`. As fotos não mudam: para trocar, tire o par e cadastre de novo.
- `DELETE /api/painel/antes-depois/:id` → `{ "par": {...} }` (sai do site; pode desfazer) · `POST .../:id/restaurar` → `{ "par": {...} }` · `POST .../:id/mover` `{ "direcao": "cima" | "baixo" }` → `{ "antes_depois": [...] }`
- Inexistente → `404 { erro: "nao_encontrado" }`.

## Site público

- `GET /` → página gerada com o conteúdo atual (cache curto, limpo a cada mudança no painel).
- `GET /fotos/:chave` → imagem guardada (cache longo, imutável).
- `GET /painel/` → painel (HTML estático; ele mesmo decide se mostra o login ou o conteúdo chamando `/api/painel/estado`).

## Rotina agendada (cron, 1x por semana)

Renova os tokens do Instagram (válidos 60 dias; renováveis após 24 h).

## Desenvolvimento local

`npm run dev` sobe tudo com D1/R2 locais. Com `DEV_LOGIN=1` em `.dev.vars`, o código de login aparece no terminal em vez de ir por e-mail. Sem `IG_APP_ID`, o Instagram usa posts falsos (`MODO_INSTAGRAM=falso`) feitos com as fotos de `public/img/`.
