# O que falta no site da Kari

Atualizado em 22/10/2026.

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
  - rodar `npx wrangler deploy`.
- [ ] **Contas do Instagram:** @karienegavaw e @lalaia.acessorios como contas profissionais (Criador ou Empresa).
- [ ] **App na Meta:** criar o app e colocar as duas contas como Instagram Tester. O redirect é `https://<domínio>/api/instagram/retorno`. Depois:
  - gravar os segredos `IG_APP_ID` e `IG_APP_SECRET`;
  - ligar cada conta pelo painel.

  Passo a passo em `docs/PUBLICAR.md`, seção 3.

## Conteúdo para a Kari revisar

- [ ] Textos marcados com `"rascunho": true` em `conteudo.json`: resumo, "para quem" e "como funciona" de cada serviço, e o 3º passo de "Como trabalhar comigo". Foram redigidos a partir do Instagram dela.
- [ ] Os passos de "Como funciona" de Cursos, oficinas e palestras (escritos por nós).
- [ ] Nomes dos produtos da LALAIÁ: "BigScrunchie (a Xuxona)", "Acessórios de cabeça sob medida", "Vai de presente".
- [ ] Nomes das cores da cartela: Roxo Autêntico, Vermelho Armário, Mostarda Oficina, Pink Produção, Verde Vitrine, Grafite Aula.
- [ ] Mais fotos de produto da LALAIÁ. Hoje são só as 5 que estavam públicas no Instagram; com o painel ligado, ela mesma traz.
- [ ] Depoimentos de clientes, se ela quiser. Não inventamos nenhum.

## Observações técnicas

- Painel: num teste, depois de "Adicionar 2 fotos", a janela do Instagram ficou aberta por cima. Não se repetiu em 3 tentativas com registro de cada abertura e fechamento. Vale observar quando o painel estiver em uso.
- Leque do topo: alguns nomes de cor ficam parcialmente escondidos atrás da amostra vizinha (no desktop). Os nomes completos aparecem nos botões e na grade de serviços.
- `migrations/0002_fotos_iniciais.sql` foi regenerada antes do 1º deploy. Daqui para frente, mudança de banco vira migration nova (`0003_...`), nunca edição das antigas.
- Fotos proibidas: `kari-chapeu-anturio` (não é a Kari) e fotos de clientes menores de idade.
