# Como colocar o site da Kari no ar

Tudo roda na Cloudflare, no plano grátis (uso comercial permitido). O único custo é o domínio (~R$ 40/ano no registro.br).
Crie as contas no e-mail da Kari (ou num e-mail da família), não no e-mail do trabalho.

## 1. Domínio e Cloudflare (uma vez)

1. Registre o domínio no registro.br (ex.: `karigava.com.br`).
2. Crie a conta em dash.cloudflare.com → **Add a domain** → plano **Free**.
3. No registro.br, troque os servidores DNS pelos dois que a Cloudflare mostrar. Leva de minutos a algumas horas.
4. **R2**: no painel da Cloudflare, ative o R2 (pede um cartão mesmo no plano grátis; até 10 GB não cobra).
5. **Email Routing** (para o código de login chegar): em *Email → Email Routing*, ative no domínio e adicione como **destination addresses** o e-mail da Kari e o seu. Cada um recebe um e-mail para confirmar. O Worker só consegue mandar código para endereços confirmados aqui.

## 2. Banco, fotos e segredos

```bash
npm install
npx wrangler login
npx wrangler d1 create site-kari          # copie o database_id para wrangler.jsonc
npx wrangler r2 bucket create site-kari-fotos
npx wrangler secret put SEGREDO_SESSAO    # cole o resultado de: openssl rand -base64 32
```

No `wrangler.jsonc`, preencha:

- `database_id` (do comando acima);
- `vars.EMAILS_PERMITIDOS`: `"email.da.kari@...,seu.email@..."` (só esses entram no painel);
- `vars.REMETENTE`: um endereço do domínio, ex.: `"painel@karigava.com.br"`;
- `vars.WHATSAPP_NUMERO`: o número da Kari só com dígitos, com DDI e DDD (`"5548998459412"`); cada botão do site abre a conversa já com a mensagem do serviço ou produto;
- `vars.EMAIL_CONTATO`: o e-mail que a página `/privacidade` indica para pedidos sobre dados (ex.: `"kari@karigava.com.br"`); enquanto vazio, a página aponta o WhatsApp;
- a rota do domínio, adicionando no topo do arquivo:

```jsonc
"routes": [{ "pattern": "karigava.com.br", "custom_domain": true }],
```

Depois:

```bash
npm run banco:remoto    # cria as tabelas e as fotos iniciais
npx wrangler deploy
```

O site já abre em `https://karigava.com.br` e o painel em `https://karigava.com.br/painel/`.

## 3. Instagram (uma vez por conta)

As contas `@karienegavaw` e `@lalaia.acessorios` precisam ser **profissionais** (Criador ou Empresa).
No app do Instagram: *Configurações → Tipo de conta e ferramentas → Mudar para conta profissional*. É grátis e não muda nada para os seguidores.

1. Em developers.facebook.com → **Criar app** → tipo **Empresa (Business)**.
2. Adicione o produto **Instagram** → **API setup with Instagram login**.
3. Em **Funções do app → Funções**, adicione as duas contas como **Instagram Tester**. Em cada conta, aceite o convite no app do Instagram: *Configurações → Apps e sites → Convites de teste*.
   Com as contas como testers, o app funciona em modo de desenvolvimento, sem revisão da Meta (acesso padrão, só para contas que vocês administram).
4. Em **Business login settings → OAuth redirect URIs**, coloque `https://karigava.com.br/api/instagram/retorno`.
5. Copie o **Instagram App ID** e o **Instagram App Secret**:

```bash
npx wrangler secret put IG_APP_ID
npx wrangler secret put IG_APP_SECRET
```

6. Ligue cada conta: entre no painel e, no mesmo navegador, abra
   - `https://karigava.com.br/api/painel/instagram/ligar?conta=kari` estando logado no Instagram como `@karienegavaw`;
   - `https://karigava.com.br/api/painel/instagram/ligar?conta=lalaia` estando logado como `@lalaia.acessorios` (troque de conta no instagram.com antes).
   Cada uma volta para o painel com "Instagram ligado!".

O acesso ao Instagram vale 60 dias e o servidor renova sozinho toda segunda-feira. Se uma conta ficar 60 dias sem renovar (por exemplo, se a senha mudar), o painel avisa "Peça para o Caio ligar" e basta repetir o passo 6.

## 4. Para a Kari

- Endereço do painel: `https://karigava.com.br/painel/` (vale salvar na tela inicial do celular).
- Entrar: e-mail → código de 6 números que chega no e-mail.
- **Novidades do Instagram**: tocar na foto → escolher onde aparece → **Publicar no site**.
- **Partes do site**: trocar a ordem (↑ ↓), tirar fotos, trazer várias do Instagram, mandar foto do celular e editar os textos dos serviços.
- Tudo tem **Desfazer** logo depois.
- LALAIÁ: fotos com o **mesmo nome** viram um produto só no site.

## Desenvolvimento local

```bash
cp .dev.vars.exemplo .dev.vars
npm run banco:local
npm run dev                # http://127.0.0.1:8787 e /painel/
npm test                   # unitários
npm run test:e2e           # ponta a ponta (com o dev rodando; LOG=<arquivo do log do wrangler>)
```

Localmente, o código de login aparece no terminal e o Instagram usa posts de mentira feitos com as fotos de `public/img/`.
