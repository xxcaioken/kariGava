# O que falta no site da Kari

Atualizado em 23/10/2026.

## Situação atual

- **No ar (endereço provisório):** https://site-kari.karigava.workers.dev
- **Conta Cloudflare:** cwkormives@gmail.com
- **Já criado na conta:**
  - Worker `site-kari`;
  - banco D1 `site-kari` (região ENAM), com as tabelas e as 12 fotos iniciais;
  - armazenamento R2 `site-kari-fotos`;
  - subdomínio `karigava.workers.dev`;
  - segredo `SEGREDO_SESSAO`;
  - rotina semanal (segunda, 9h UTC) que renova o acesso ao Instagram.
- **Funciona:** o site público inteiro.
- **Ainda não funciona:** o painel (`/painel/`). Ninguém consegue entrar, porque o código de login sai por e-mail e o envio depende do domínio.

## Para o painel funcionar (infraestrutura)

- [ ] **Domínio:**
  - registrar no registro.br (ex.: `karigava.com.br`);
  - na Cloudflare: *Domains → Add a domain → Free*;
  - no registro.br, trocar os servidores DNS pelos 2 que a Cloudflare mostrar.
- [ ] **Email Routing:**
  - no domínio, abrir *Email → Email Routing → Enable*;
  - em *Destination addresses*, adicionar o e-mail da Kari e o do Caio;
  - cada um precisa confirmar pelo link que recebe.
- [ ] **`wrangler.jsonc`:**
  - preencher `EMAILS_PERMITIDOS` (e-mail da Kari e do Caio) e `REMETENTE` (ex.: `painel@karigava.com.br`);
  - adicionar `"routes": [{ "pattern": "<domínio>", "custom_domain": true }]`;
  - rodar `npm run deploy` (aplica as migrations no banco remoto e publica o Worker).
- [ ] **Contas do Instagram:** @karienegavaw e @lalaia.acessorios como contas profissionais (Criador ou Empresa).
- [ ] **App na Meta:** criar o app e colocar as duas contas como Instagram Tester. O redirect é `https://<domínio>/api/instagram/retorno`. Depois:
  - gravar os segredos `IG_APP_ID` e `IG_APP_SECRET`;
  - ligar cada conta pelo painel.

  Passo a passo em `docs/PUBLICAR.md`, seção 3.

## Conteúdo para a Kari revisar

- [ ] Textos marcados com `"rascunho": true` em `conteudo.json`: resumo, "para quem" e "como funciona" de cada serviço, e o 3º passo de "Como trabalhar comigo". Foram redigidos a partir do Instagram dela.
- [ ] Os passos de "Como funciona" de Cursos, oficinas e palestras (escritos por nós).
- [ ] **Serviços unidos a pedido dela (23/10/2026):** a Edição de guarda-roupa virou parte da Consultoria de estilo e a Oficina de Look entrou em Cursos, oficinas e palestras. O resumo, o "para quem" e os passos desses dois serviços foram reescritos por nós juntando os textos antigos; o resultado "Armário cheio" do quiz agora leva à Consultoria. Ela confere se é assim que descreve o trabalho.
- [ ] Os 3 passos de "Como encomendar" da LALAIÁ (`lalaia.como_encomendar`, escritos por nós): confirmar que o pagamento é por Pix e o envio pelos Correios. As condições (pagamento, frete, prazo, trocas) a Kari preenche no painel, em LALAIÁ → Como encomendar.
- [ ] Nomes dos produtos da LALAIÁ: "BigScrunchie (a Xuxona)", "Acessórios de cabeça sob medida", "Vai de presente".
- [ ] **Textos da página `/lalaia` escritos por nós** (em `conteudo.json`, marcados como rascunho): `lalaia.como_encomendar_intro` ("Tudo pelo WhatsApp, peça por peça.") e `lalaia.quem_faz` ("A LALAIÁ é a marca de acessórios da Kari, stylist e visual merchandiser em Florianópolis, SC."); a prévia do link (`og-lalaia.jpg`) usa o scrunchie e as pérolas. Ela confere.
- [ ] **Subtítulo do topo** (`hero.subtitulo`, rascunho): "Consultoria de estilo, styling, vitrines e cursos com Kariene Gava, em Florianópolis." Reescrito por nós quando a edição de guarda-roupa virou parte da consultoria (23/10/2026).
- [ ] **Cor da estação** (dona: Kari): o site usa uma cor só, hoje o vermelho `#C52118` (provisório, escolhido pelo Caio em 23/10/2026). Quando ela escolher a cor, o Caio troca em `conteudo.json` (`docs/OPERACAO.md`, procedimento 16). Os nomes de cor por serviço ("Vermelho Armário" etc.) saíram do site a pedido dela.
- [ ] Mais fotos de produto da LALAIÁ. Hoje são só as 5 que estavam públicas no Instagram; com o painel ligado, ela mesma traz.
- [ ] Depoimentos de clientes, se ela quiser. Não inventamos nenhum.
- [ ] **Quiz "Qual é o seu momento de estilo?"** (`/quiz`; dona: Kari; até 30/11/2026). As 8 perguntas, as opções e os 4 resultados estão em `conteudo.json` (`quiz`, marcado como rascunho) e foram escritos por nós. Ela revisa o tom e o Caio troca o texto no arquivo.
- [ ] **Perguntas frequentes** (dona: Kari; até 30/11/2026). As 8 foram escritas por nós e aparecem no painel em "Perguntas frequentes" com a marca "Rascunho: revisar" até ela editar cada uma. Publicadas desde já, por se apoiarem no que ela já disse publicamente: "Preciso comprar roupa nova?", "Como é a Oficina de Look?", "Como funciona a encomenda na LALAIÁ?", "Enviam para todo o Brasil?". Despublicadas, por dependerem de política só dela (revisar e ligar no painel): "Atende online?", "Quanto tempo leva a edição de guarda-roupa?", "Atende lojas fora de Florianópolis?", "Posso trocar uma peça sob encomenda?".

## Conteúdo real para preencher (pelo painel, sem código)

- [ ] **Preços** (dona: Kari; até 30/11/2026): "a partir de" em cada serviço (painel → parte do site → Preço) e preço/prazo de cada produto da LALAIÁ (painel → LALAIÁ → Produtos). Sem preço, o site mostra "Valor sob consulta" nos serviços para lojas e escolas e nada nos demais.
- [ ] **3 depoimentos** (dona: Kari; até 30/11/2026): pedir a clientes recentes; com foto só com a autorização marcada no painel.
- [ ] **2 pares de antes e depois** (dona: Kari; até 30/11/2026): vitrine, look ou armário, com a autorização da cliente.
- [ ] **Condições da LALAIÁ** (dona: Kari): pagamento, frete, prazo e trocas em LALAIÁ → Como encomendar; e o cupom de primeira encomenda, se quiser.

## Fora do código (ações da Kari e do Caio)

- [ ] **Link da bio do @lalaia.acessorios** (dona: Kari; depois do domínio): trocar pelo endereço `https://<domínio>/lalaia`, a página que abre direto nas peças (pedido dela em 23/10/2026). Enquanto não há domínio, serve `https://site-kari.karigava.workers.dev/lalaia`.

- [ ] **Google Business Profile** (dona: Kari; até 15/12/2026): criar o perfil "Kari Gava · Stylist e Visual Merchandiser" em Florianópolis com o WhatsApp e o Instagram, pedir as primeiras avaliações e colar o link "Peça avaliações" no painel (LALAIÁ → Como encomendar → link do Google). É o que mais pesa para aparecer em "stylist Florianópolis".
- [ ] **Google Search Console** (dono: Caio; depois do domínio): verificar o domínio pelo DNS da Cloudflare, enviar `https://<domínio>/sitemap.xml` e definir `vars.SITE_URL` no `wrangler.jsonc` antes de enviar.
- [ ] **Catálogo do WhatsApp Business** (perguntar à Kari): se ela já usa o catálogo, os produtos da LALAIÁ podem apontar para lá em vez de só abrir a conversa. Decisão dela; nada no código depende disso.
- [ ] **Backup semanal do banco** (dono: Caio): `docs/OPERACAO.md`, procedimento 1. Manual por enquanto.

## Segurança (auditoria estática de 23/10/2026, decisão do Caio)

- [ ] **Limite de 5 tentativas do código de login não é atômico** (médio; achado do code review de 23/10, em `src/auth.js`, que esta entrega não alterou). O servidor lê `tentativas`, confere o código e só depois soma 1; muitas tentativas disparadas ao mesmo tempo passam todas pela leitura antes de qualquer soma, e o limite deixa de valer. Correção sugerida: somar e conferir no mesmo comando (`UPDATE codigos_login SET tentativas = tentativas + 1 WHERE email = ? AND tentativas < 5 RETURNING codigo_hash, expira_em`) e só então comparar o código.
- [ ] **"Sair" do painel não invalida a sessão no servidor** (médio). O cookie `kari_sessao` é assinado e vale 60 dias; "Sair" só o apaga no navegador, então um cookie copiado antes (celular perdido, computador de terceiros) continua valendo até o segredo ser trocado (`docs/OPERACAO.md`, procedimento 6). Correção sugerida: guardar por e-mail um carimbo "sessões válidas a partir de" que o "Sair" atualiza e a checagem de sessão respeita; ou reduzir a sessão para 7 dias. É mudança de comportamento (hoje a API promete 60 dias): entra numa próxima rodada com spec.
- Sem outros achados sustentados no escopo lido (login, sessão, OAuth do Instagram, upload de fotos, escape de HTML/JSON-LD, cabeçalhos). Não rodados por falta de orçamento/perfis: varredura do histórico git, lockfile e scanners (Gitleaks, OSV, Semgrep, Trivy).

## Correções técnicas abertas (3ª rodada de code review, 23/10/2026, decisão do Caio)

Achados confirmados no código e deixados para uma próxima rodada (o processo encerra a revisão na 3ª rodada):

- [ ] **Produto da LALAIÁ sem nome fica preso** (`src/produtos.js`). Uma foto que vira produto sem nome ganha o endereço interno `sem-nome-<id>`, que a rota do painel não aceita: salvar ou renomear esse produto dá "não encontrado". No site, o cartão sai sem título e o WhatsApp vai com "quero encomendar " em branco. Correção sugerida: gerar o endereço só com letras minúsculas, números e hífen e esconder do site produto sem nome.
- [ ] **A página de privacidade promete apagar o que sai do site** (`src/privacidade.js`), mas nada apaga: foto, depoimento ou produto tirado do site fica guardado. Ajustar o texto ("fica guardado e pode ser restaurado; para apagar de vez, peça à Kari") ou criar a limpeza automática.
- [ ] **Toque duplo no quiz pode pular uma pergunta** (`public/quiz.js`, `trocar`). A troca de tela roda duas vezes (fim da transição e o tempo de segurança). Correção sugerida: uma trava que deixa só a primeira chamada passar.
- [ ] **Foto do celular pode duplicar** (`src/itens.js`, `adicionarDoCelular`). Se gravar as versões leves falhar depois da foto já estar no site, o painel recebe erro e, ao repetir, a foto entra de novo. Correção sugerida: tratar a falha das versões como aviso, sem erro, já que a foto original está salva.
- [ ] **Memória no celular ao gerar versões leves** (`public/painel/painel.js`, `gerarVariantes`). Quando o tempo de 20 s estoura ou a conversão falha, a imagem decodificada não é liberada. Também: a foto é decodificada duas vezes e a versão de 1600 px é enviada duas vezes no envio pelo celular.
- [ ] **Sessão expirada no meio da otimização** (`public/painel/painel.js`, `rodarFila`). Depois do primeiro "sessão expirada", a fila continua com as próximas fotos e volta à tela de e-mail a cada uma. Correção sugerida: parar a fila no primeiro 401.
- [ ] **Número do WhatsApp no Google** (`src/seo.js`). Se `WHATSAPP_NUMERO` estiver configurado errado, os botões usam o número de `conteudo.json`, mas os dados para o Google publicam o valor errado. Só acontece com configuração inválida.
- [ ] **Foto proibida só fica fora do leque** (review da PR #3, 23/10/2026): `kari-chapeu-anturio` e `kari-oculos` são filtradas na abertura, mas se alguém as puser num serviço ou em "Sobre" elas aparecem no cartão. Hoje nenhuma está no banco. Correção sugerida: recusar essas fotos ao adicionar (painel) em vez de filtrar na hora de mostrar.
- [ ] **Foto órfã ao importar do Instagram** (`src/itens.js`, `adicionarDoInstagram`; já existia antes desta entrega). Se gravar no banco falhar, a foto fica no armazenamento sem uso. Mesma correção já feita no envio pelo celular.

## Ideias adiadas de propósito (não entram sem nova decisão)

Levantadas na revisão de produto e design e deixadas de fora desta entrega, cada uma com o motivo:

- **Prova numérica no hero** (anos de profissão, formação, número de clientes): sem os números reais da Kari não vai ao ar ("nada inventado"). Quando ela passar os números, é texto em `conteudo.json`.
- **"Para quem não é" por serviço:** conteúdo dela; um campo no painel seria escopo novo.
- **"@ do Instagram" no depoimento:** o campo "de onde" já comporta um @; campo dedicado só se ela pedir.
- **Hero por "dor" (4 perguntas antes dos serviços):** o quiz cumpre esse papel; mudar o hero é decisão de design dela.
- **Backup automático do D1:** fica manual (procedimento 1 do OPERACAO.md) até existir rotina na conta.
- **Rota `/wa/<contexto>` com contagem de cliques:** mediria quantos cliques cada botão de WhatsApp gera, mas é requisito novo (R-16) e exige guardar contagem no banco; entra numa próxima rodada se a Kari quiser esse número.
- **Preço com centavos ou "a partir de / fixo" (`preco_tipo`):** hoje o preço é inteiro em reais e sempre "a partir de"; mudar o modelo só com pedido dela.
- **Botão "Gerar versões leves" no painel:** o backfill de fotos antigas é manual (OPERACAO.md, procedimento 11); o botão é conveniência para depois.
- **CSP sem `'unsafe-inline'` no `style-src`:** o template usa `style="--cor:…"` nos cartões; trocar por `data-cor` + CSS é um refactor sem ganho visível agora.
- **Variantes de imagem "mínimas" (só 480/960):** mantidas as 3 larguras do R-10; a regra "nunca ampliar" já evita arquivo inútil.
- **Cache da home** (`max-age=60`): o site responde em menos de 200 ms sem cache; revisitar se o tráfego crescer.
- **Logs estruturados persistidos:** `console.error` + Workers Logs bastam para um site de uma pessoa.

## Observações técnicas

- Painel: num teste, depois de "Adicionar 2 fotos", a janela do Instagram ficou aberta por cima. Não se repetiu em 3 tentativas com registro de cada abertura e fechamento. Vale observar quando o painel estiver em uso.
- Leque do topo: alguns nomes de cor ficam parcialmente escondidos atrás da amostra vizinha (no desktop). Os nomes completos aparecem nos botões e na grade de serviços.
- `migrations/0002_fotos_iniciais.sql` foi regenerada antes do 1º deploy. Daqui para frente, mudança de banco vira migration nova (`0003_...`), nunca edição das antigas.
- Fotos proibidas: `kari-chapeu-anturio` (não é a Kari) e fotos de clientes menores de idade.
