// Teste de ponta a ponta contra `npm run dev` (wrangler local, MODO_INSTAGRAM=falso, DEV_LOGIN=1).
// Uso: BASE=http://127.0.0.1:8787 LOG=/caminho/do/log/do/wrangler npm run test:e2e
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const LOG = process.env.LOG;
const EMAIL = 'kari@exemplo.com';
let cookie = '';

async function chamar(caminho, { metodo = 'GET', corpo, origem = BASE, semCookie = false, form } = {}) {
  const headers = {};
  if (origem) headers.origin = origem;
  if (cookie && !semCookie) headers.cookie = cookie;
  let body;
  if (form) body = form;
  else if (corpo !== undefined) { headers['content-type'] = 'application/json'; body = JSON.stringify(corpo); }
  const r = await fetch(BASE + caminho, { method: metodo, headers, body, redirect: 'manual' });
  const tipo = r.headers.get('content-type') || '';
  const dados = tipo.includes('json') ? await r.json() : await r.text();
  return { status: r.status, dados, r };
}

function ultimoCodigo(email) {
  const linhas = readFileSync(LOG, 'utf8').split('\n').filter(l => l.includes(`código para ${email}:`));
  return linhas.at(-1)?.match(/(\d{6})\s*$/)?.[1];
}

test('site público abre com o conteúdo inicial', async () => {
  const { status, dados } = await chamar('/');
  assert.equal(status, 200);
  assert.match(dados, /Moda para guarda-roupas autênticos/);
  assert.match(dados, /\/img\/kari-look-blazer\.jpg/);
});

test('painel exige login', async () => {
  const { status, dados } = await chamar('/api/painel/estado', { semCookie: true });
  assert.equal(status, 401);
  assert.equal(dados.erro, 'sem_sessao');
});

test('mudança sem a origem do site é recusada', async () => {
  const { status, dados } = await chamar('/api/login/codigo', { metodo: 'POST', corpo: { email: EMAIL }, origem: 'https://malicioso.example' });
  assert.equal(status, 403);
  assert.equal(dados.erro, 'origem_invalida');
});

test('e-mail fora da lista recebe ok mas nenhum código', async () => {
  const { status, dados } = await chamar('/api/login/codigo', { metodo: 'POST', corpo: { email: 'estranho@exemplo.com' } });
  assert.equal(status, 200);
  assert.equal(dados.ok, true);
  assert.equal(ultimoCodigo('estranho@exemplo.com'), undefined);
});

test('login com código: errado, depois certo', async () => {
  assert.equal((await chamar('/api/login/codigo', { metodo: 'POST', corpo: { email: EMAIL } })).status, 200);
  await new Promise(r => setTimeout(r, 300));
  const codigo = ultimoCodigo(EMAIL);
  assert.match(codigo, /^\d{6}$/);
  const errado = codigo === '000000' ? '111111' : '000000';
  const r1 = await chamar('/api/login/entrar', { metodo: 'POST', corpo: { email: EMAIL, codigo: errado } });
  assert.equal(r1.status, 400);
  assert.equal(r1.dados.erro, 'codigo_invalido');
  const r2 = await chamar('/api/login/entrar', { metodo: 'POST', corpo: { email: EMAIL.toUpperCase(), codigo } });
  assert.equal(r2.status, 200);
  const setCookie = r2.r.headers.get('set-cookie');
  assert.match(setCookie, /kari_sessao=.+HttpOnly/);
  cookie = setCookie.split(';')[0];
  // Código usado não vale de novo.
  const r3 = await chamar('/api/login/entrar', { metodo: 'POST', corpo: { email: EMAIL, codigo } });
  assert.equal(r3.status, 400);
});

test('estado traz seções, fotos iniciais e contas', async () => {
  const { status, dados } = await chamar('/api/painel/estado');
  assert.equal(status, 200);
  assert.equal(dados.usuario.email, EMAIL);
  assert.equal(dados.secoes.length, 8);
  assert.equal(dados.itens.filter(i => i.secao === 'lalaia').length, 5);
  assert.ok(dados.instagram.contas.every(c => c.conectada));
  assert.equal(dados.textos.consultoria.titulo, 'Consultoria de estilo');
});

let novos = [];
test('traz posts do Instagram para a LALAIÁ sem duplicar', async () => {
  const lista = await chamar('/api/painel/instagram?conta=lalaia');
  assert.equal(lista.status, 200);
  const [a, b] = lista.dados.posts;
  assert.deepEqual(a.no_site, []);
  const r = await chamar('/api/painel/itens', { metodo: 'POST', corpo: { secao: 'lalaia', instagram: [{ conta: 'lalaia', ig_id: a.ig_id }, { conta: 'lalaia', ig_id: b.ig_id }] } });
  assert.equal(r.status, 201);
  novos = r.dados.itens;
  assert.equal(novos.length, 2);
  assert.deepEqual(novos.map(i => i.ordem), [5, 6]);
  assert.equal(novos[0].titulo, a.titulo_sugerido);
  const de_novo = await chamar('/api/painel/itens', { metodo: 'POST', corpo: { secao: 'lalaia', instagram: [{ conta: 'lalaia', ig_id: a.ig_id }] } });
  assert.equal(de_novo.dados.itens.length, 0);
  const marcada = await chamar('/api/painel/instagram?conta=lalaia');
  assert.deepEqual(marcada.dados.posts[0].no_site, ['lalaia']);
});

test('fotos da LALAIÁ com o mesmo nome viram um produto só', async () => {
  const renomear = await chamar(`/api/painel/itens/${novos[1].id}`, { metodo: 'PATCH', corpo: { titulo: 'Vai de presente' } });
  assert.equal(renomear.status, 200);
  const site = (await chamar('/')).dados;
  const lalaia = site.slice(site.indexOf('id="lalaia"'), site.indexOf('id="cursos"'));
  const produto = lalaia.slice(lalaia.lastIndexOf('<li class="produto">', lalaia.indexOf('<h3>Vai de presente</h3>')), lalaia.indexOf('<h3>Vai de presente</h3>'));
  assert.equal((produto.match(/<img /g) || []).length, 2);
  assert.equal((lalaia.match(/<h3>Vai de presente<\/h3>/g) || []).length, 1);
});

test('foto guardada abre e aparece no site', async () => {
  const f = await fetch(BASE + novos[0].foto_url);
  assert.equal(f.status, 200);
  assert.equal(f.headers.get('content-type'), 'image/jpeg');
  assert.match(f.headers.get('cache-control'), /immutable/);
  const { dados } = await chamar('/');
  assert.ok(dados.includes(novos[0].foto_url));
});

test('novidades junta as duas contas, 8 no máximo', async () => {
  const { dados } = await chamar('/api/painel/instagram/novidades');
  assert.equal(dados.posts.length, 8);
  assert.deepEqual([...new Set(dados.posts.map(p => p.conta))].sort(), ['kari', 'lalaia']);
});

test('mover, tirar e desfazer mantêm a ordem', async () => {
  const ultimo = novos[1];
  const m = await chamar(`/api/painel/itens/${ultimo.id}/mover`, { metodo: 'POST', corpo: { direcao: 'cima' } });
  assert.equal(m.status, 200);
  const ids = m.dados.itens.map(i => i.id);
  assert.equal(ids.indexOf(ultimo.id), 5);
  assert.deepEqual(m.dados.itens.map(i => i.ordem), [0, 1, 2, 3, 4, 5, 6]);

  const tirado = await chamar(`/api/painel/itens/${ids[2]}`, { metodo: 'DELETE' });
  assert.equal(tirado.status, 200);
  let est = await chamar('/api/painel/estado');
  assert.equal(est.dados.itens.filter(i => i.secao === 'lalaia').length, 6);
  await chamar(`/api/painel/itens/${ids[2]}/restaurar`, { metodo: 'POST' });
  est = await chamar('/api/painel/estado');
  assert.deepEqual(est.dados.itens.filter(i => i.secao === 'lalaia').map(i => i.id), ids);
});

test('renomear foto', async () => {
  const r = await chamar(`/api/painel/itens/${novos[0].id}`, { metodo: 'PATCH', corpo: { titulo: '  Xuxona   bege ' } });
  assert.equal(r.status, 200);
  assert.equal(r.dados.item.titulo, 'Xuxona bege');
  const longo = await chamar(`/api/painel/itens/${novos[0].id}`, { metodo: 'PATCH', corpo: { titulo: 'x'.repeat(81) } });
  assert.equal(longo.status, 400);
});

test('textos editados vão para o site e são escapados', async () => {
  const r = await chamar('/api/painel/textos/consultoria', { metodo: 'PUT', corpo: { resumo: 'Estilo <script>alert(1)</script> com você', para_quem: 'Para todas.' } });
  assert.equal(r.status, 200);
  const { dados } = await chamar('/');
  assert.ok(dados.includes('Estilo &lt;script&gt;alert(1)&lt;/script&gt; com você'));
  assert.ok(!dados.includes('<script>alert(1)'));
  const vazio = await chamar('/api/painel/textos/consultoria', { metodo: 'PUT', corpo: { resumo: '   ', para_quem: '' } });
  assert.equal(vazio.status, 400);
  assert.equal(vazio.dados.erro, 'texto_invalido');
  const longo = await chamar('/api/painel/textos/consultoria', { metodo: 'PUT', corpo: { resumo: 'a'.repeat(221), para_quem: '' } });
  assert.equal(longo.status, 400);
});

test('foto do celular: aceita jpg e recusa o que não é foto', async () => {
  const jpg = readFileSync(new URL('../../public/img/lalaia-caixa.jpg', import.meta.url));
  const form = new FormData();
  form.set('secao', 'edicao');
  form.set('titulo', 'Armário da cliente');
  form.set('foto', new Blob([jpg], { type: 'image/jpeg' }), 'foto.jpg');
  const ok = await chamar('/api/painel/itens', { metodo: 'POST', form });
  assert.equal(ok.status, 201);
  assert.equal(ok.dados.itens[0].origem, 'celular');
  assert.equal((await fetch(BASE + ok.dados.itens[0].foto_url)).status, 200);
  // 2ª foto do serviço aparece como miniatura no cartão dele.
  const site = (await chamar('/')).dados;
  const cartao = site.slice(site.indexOf('id="edicao"'), site.indexOf('id="oficina-look"'));
  assert.match(cartao, /class="servico-mais"/);
  assert.ok(cartao.includes(ok.dados.itens[0].foto_url));

  const ruim = new FormData();
  ruim.set('secao', 'edicao');
  ruim.set('foto', new Blob(['não sou foto'], { type: 'image/jpeg' }), 'falsa.jpg');
  const r = await chamar('/api/painel/itens', { metodo: 'POST', form: ruim });
  assert.equal(r.status, 400);
  assert.equal(r.dados.erro, 'foto_invalida');
});

test('seção inválida e item inexistente', async () => {
  const s = await chamar('/api/painel/itens', { metodo: 'POST', corpo: { secao: 'nada', instagram: [{ conta: 'kari', ig_id: 'x' }] } });
  assert.equal(s.status, 400);
  assert.equal(s.dados.erro, 'secao_invalida');
  const n = await chamar('/api/painel/itens/it_naoexiste', { metodo: 'DELETE' });
  assert.equal(n.status, 404);
});

test('cookie adulterado não entra', async () => {
  const [nome, valor] = cookie.split('=');
  const [carga, assinatura] = valor.split('.');
  const outra = Buffer.from(JSON.stringify({ e: 'caio@exemplo.com', x: 9999999999 })).toString('base64url');
  const r = await fetch(BASE + '/api/painel/estado', { headers: { cookie: `${nome}=${outra}.${assinatura}` } });
  assert.equal(r.status, 401);
  assert.ok(carga);
});

test('código bloqueia depois de 5 tentativas erradas', async () => {
  const email = 'caio@exemplo.com';
  await chamar('/api/login/codigo', { metodo: 'POST', corpo: { email } });
  await new Promise(r => setTimeout(r, 300));
  const codigo = ultimoCodigo(email);
  const errado = codigo === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) await chamar('/api/login/entrar', { metodo: 'POST', corpo: { email, codigo: errado } });
  const r = await chamar('/api/login/entrar', { metodo: 'POST', corpo: { email, codigo } });
  assert.equal(r.status, 400);
  assert.equal(r.dados.erro, 'codigo_expirado');
});

test('sair encerra a sessão', async () => {
  const r = await chamar('/api/login/sair', { metodo: 'POST', corpo: {} });
  assert.match(r.r.headers.get('set-cookie'), /Max-Age=0/);
  cookie = '';
  assert.equal((await chamar('/api/painel/estado')).status, 401);
});

// ---------- R-02 · Serviço mostra "A partir de R$ X" quando a Kari preencher o preço ----------
const cartaoDoServico = (html, id, proximo) => html.slice(html.indexOf(`id="${id}"`), html.indexOf(`id="${proximo}"`));

test('R-02 preço do serviço: PUT parcial, "A partir de", "Valor sob consulta" e validação', async () => {
  // Precisa de sessão: entra de novo (o teste anterior saiu).
  await chamar('/api/login/codigo', { metodo: 'POST', corpo: { email: EMAIL } });
  await new Promise(r => setTimeout(r, 300));
  const entrou = await chamar('/api/login/entrar', { metodo: 'POST', corpo: { email: EMAIL, codigo: ultimoCodigo(EMAIL) } });
  assert.equal(entrou.status, 200);
  cookie = entrou.r.headers.get('set-cookie').split(';')[0];

  const antes = (await chamar('/api/painel/estado')).dados.textos.consultoria;
  const r = await chamar('/api/painel/textos/consultoria', { metodo: 'PUT', corpo: { preco: 380 } });
  assert.equal(r.status, 200);
  assert.equal(r.dados.textos.preco, 380);
  assert.equal(r.dados.textos.resumo, antes.resumo, 'PUT parcial mantém o resumo');

  let html = (await chamar('/')).dados;
  let cartao = cartaoDoServico(html, 'consultoria', 'edicao');
  assert.ok(cartao.includes('A partir de'), 'rótulo');
  assert.ok(cartao.includes('R$ 380'), 'valor');
  const escapado = antes.resumo.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  assert.ok(cartao.includes(escapado), 'resumo anterior continua (escapado no HTML)');
  assert.ok(!cartaoDoServico(html, 'vm', 'ensino').includes('A partir de'));
  assert.ok(cartaoDoServico(html, 'vm', 'ensino').includes('Valor sob consulta'), 'grupo lojas sem preço');
  assert.ok(cartaoDoServico(html, 'ensino', 'como-trabalhar').includes('Valor sob consulta'), 'grupo ensino sem preço');
  assert.ok(!cartaoDoServico(html, 'edicao', 'oficina-look').includes('sob consulta'), 'grupo "para você" sem preço não mostra nada');

  // Só o resumo muda; o preço fica.
  const soResumo = await chamar('/api/painel/textos/consultoria', { metodo: 'PUT', corpo: { resumo: 'Resumo novo da consultoria.' } });
  assert.equal(soResumo.status, 200);
  assert.equal(soResumo.dados.textos.preco, 380);
  assert.equal(soResumo.dados.textos.resumo, 'Resumo novo da consultoria.');

  for (const preco of [-5, 0, 380.5, '380', 100000]) {
    const ruim = await chamar('/api/painel/textos/consultoria', { metodo: 'PUT', corpo: { preco } });
    assert.equal(ruim.status, 400, `preco ${JSON.stringify(preco)}`);
    assert.equal(ruim.dados.erro, 'texto_invalido');
    assert.match(ruim.dados.mensagem, /inteiro|centavos/);
  }

  const limpa = await chamar('/api/painel/textos/consultoria', { metodo: 'PUT', corpo: { preco: null } });
  assert.equal(limpa.status, 200);
  assert.equal(limpa.dados.textos.preco, null);
  html = (await chamar('/')).dados;
  cartao = cartaoDoServico(html, 'consultoria', 'edicao');
  assert.ok(!cartao.includes('A partir de'));
  assert.ok(!cartao.includes('sob consulta'));

  const estado = (await chamar('/api/painel/estado')).dados;
  assert.equal(estado.textos.consultoria.preco, null);
  assert.equal(estado.textos.consultoria.resumo, 'Resumo novo da consultoria.');
});

// ---------- R-03 · Peça da LALAIÁ mostra preço, prazo e disponibilidade ----------
// Recorta o <li class="produto"> cujo <h3> é o título dado (null se o produto não está na home).
function produtoNoHtml(html, titulo) {
  const lalaia = html.slice(html.indexOf('id="lalaia"'), html.indexOf('id="cursos"'));
  const h3 = lalaia.indexOf(`<h3>${titulo}</h3>`);
  if (h3 < 0) return null;
  const ini = lalaia.lastIndexOf('<li class="produto">', h3);
  const fim = lalaia.indexOf('</li>', h3);
  return lalaia.slice(ini, fim);
}

test('R-03 produtos da LALAIÁ: preço, disponibilidade, prazo, descrição e renomear', async () => {
  const slug = 'bigscrunchie-a-xuxona';
  let estado = (await chamar('/api/painel/estado')).dados;
  const produto = estado.lalaia.produtos.find(p => p.slug === slug);
  assert.ok(produto, 'estado devolve lalaia.produtos agrupados por slug');
  assert.equal(produto.titulo, 'BigScrunchie (a Xuxona)');
  assert.equal(produto.fotos.length, 2);
  assert.equal(produto.preco, null);

  const r = await chamar(`/api/painel/lalaia/produtos/${slug}`, { metodo: 'PUT', corpo: { preco: 65, disponibilidade: 'encomenda', prazo_dias: 7, descricao: 'Scrunchie gigante de organza, com a etiquetinha.' } });
  assert.equal(r.status, 200, JSON.stringify(r.dados));
  assert.equal(r.dados.produto.preco, 65);
  let card = produtoNoHtml((await chamar('/')).dados, 'BigScrunchie (a Xuxona)');
  assert.ok(card, 'produto na home');
  assert.ok(card.includes('R$ 65'), 'preço');
  assert.ok(card.includes('Sob encomenda · até 7 dias úteis'), 'disponibilidade com prazo');
  assert.ok(card.includes('Scrunchie gigante de organza, com a etiquetinha.'), 'descrição editada');

  // PUT parcial: só a disponibilidade muda, o preço fica.
  assert.equal((await chamar(`/api/painel/lalaia/produtos/${slug}`, { metodo: 'PUT', corpo: { disponibilidade: 'pronta' } })).status, 200);
  card = produtoNoHtml((await chamar('/')).dados, 'BigScrunchie (a Xuxona)');
  assert.ok(card.includes('Pronta entrega') && card.includes('R$ 65') && !card.includes('Sob encomenda'));

  // Sob encomenda sem prazo: só "Sob encomenda", sem " · ".
  assert.equal((await chamar(`/api/painel/lalaia/produtos/${slug}`, { metodo: 'PUT', corpo: { disponibilidade: 'encomenda', prazo_dias: null } })).status, 200);
  card = produtoNoHtml((await chamar('/')).dados, 'BigScrunchie (a Xuxona)');
  assert.ok(card.includes('Sob encomenda') && !card.includes('Sob encomenda ·'), 'sem prazo não tem " · "');

  // Preço vazio → produto sem preço e sem "sob consulta" (spec R-03).
  assert.equal((await chamar(`/api/painel/lalaia/produtos/${slug}`, { metodo: 'PUT', corpo: { preco: null } })).status, 200);
  card = produtoNoHtml((await chamar('/')).dados, 'BigScrunchie (a Xuxona)');
  assert.ok(!card.includes('R$') && !/sob consulta/i.test(card), 'sem preço: nada');
  assert.equal((await chamar(`/api/painel/lalaia/produtos/${slug}`, { metodo: 'PUT', corpo: { preco: 65 } })).status, 200);

  // Validações com mensagem para a Kari.
  for (const corpo of [{ preco: -1 }, { preco: '65' }, { preco: 100000 }, { disponibilidade: 'talvez' }, { prazo_dias: 0 }, { prazo_dias: 91 }, { prazo_dias: 7.5 }, { descricao: 'a'.repeat(221) }]) {
    const ruim = await chamar(`/api/painel/lalaia/produtos/${slug}`, { metodo: 'PUT', corpo });
    assert.equal(ruim.status, 400, JSON.stringify(corpo));
    assert.equal(ruim.dados.erro, 'produto_invalido');
    assert.ok(ruim.dados.mensagem?.length > 10, 'mensagem em PT-BR');
  }
  const inexistente = await chamar('/api/painel/lalaia/produtos/nao-existe', { metodo: 'PUT', corpo: { preco: 10 } });
  assert.equal(inexistente.status, 404);

  // Renomear: nome que vira slug vazio → 400; nome de outro produto → 409; nome novo move as fotos e os dados num batch.
  const vazio = await chamar(`/api/painel/lalaia/produtos/${slug}/renomear`, { metodo: 'POST', corpo: { nome: '!!!' } });
  assert.equal(vazio.status, 400);
  assert.equal(vazio.dados.erro, 'produto_invalido');
  const duplicado = await chamar(`/api/painel/lalaia/produtos/${slug}/renomear`, { metodo: 'POST', corpo: { nome: 'VAI DE PRESENTE' } });
  assert.equal(duplicado.status, 409);
  assert.equal(duplicado.dados.erro, 'produto_duplicado');
  assert.match(duplicado.dados.mensagem, /Já existe/);
  const antesRen = (await chamar('/api/painel/estado')).dados.lalaia.produtos.find(p => p.slug === slug);
  assert.equal(antesRen.preco, 65, 'o 409 não mexeu em nada');

  const ren = await chamar(`/api/painel/lalaia/produtos/${slug}/renomear`, { metodo: 'POST', corpo: { nome: 'Xuxona' } });
  assert.equal(ren.status, 200, JSON.stringify(ren.dados));
  assert.equal(ren.dados.produto.slug, 'xuxona');
  assert.equal(ren.dados.produto.fotos.length, 2);
  estado = (await chamar('/api/painel/estado')).dados;
  assert.ok(!estado.lalaia.produtos.some(p => p.slug === slug), 'slug antigo sumiu');
  const xuxona = estado.lalaia.produtos.find(p => p.slug === 'xuxona');
  assert.equal(xuxona.preco, 65, 'dados vieram junto');
  assert.ok(estado.itens.filter(i => i.secao === 'lalaia' && i.titulo === 'Xuxona').length === 2, 'as 2 fotos renomeadas');
  card = produtoNoHtml((await chamar('/')).dados, 'Xuxona');
  assert.ok(card && card.includes('R$ 65'));

  // "Laço" e "Laco" têm o mesmo slug: um cartão só; e a linha de produto sobrevive sem fotos.
  const cabeca = estado.lalaia.produtos.find(p => p.slug === 'acessorios-de-cabeca-sob-medida');
  assert.equal(cabeca.fotos.length, 2);
  assert.equal((await chamar(`/api/painel/itens/${cabeca.fotos[0].id}`, { metodo: 'PATCH', corpo: { titulo: 'Laço' } })).status, 200);
  assert.equal((await chamar(`/api/painel/itens/${cabeca.fotos[1].id}`, { metodo: 'PATCH', corpo: { titulo: 'Laco' } })).status, 200);
  let html = (await chamar('/')).dados;
  assert.equal((html.match(/<h3>La[çc]o<\/h3>/g) || []).length, 1, 'um cartão só para Laço/Laco');
  assert.equal(produtoNoHtml(html, 'Laço').match(/<img /g).length, 2);
  assert.equal((await chamar('/api/painel/lalaia/produtos/laco', { metodo: 'PUT', corpo: { preco: 10 } })).status, 200);
  for (const f of cabeca.fotos) assert.equal((await chamar(`/api/painel/itens/${f.id}`, { metodo: 'DELETE' })).status, 200);
  estado = (await chamar('/api/painel/estado')).dados;
  const laco = estado.lalaia.produtos.find(p => p.slug === 'laco');
  assert.ok(laco && laco.preco === 10 && laco.fotos.length === 0, 'produto sem fotos continua no estado com o preço');
  assert.equal(produtoNoHtml((await chamar('/')).dados, 'Laço'), null, 'mas não aparece no site');
  for (const f of cabeca.fotos) assert.equal((await chamar(`/api/painel/itens/${f.id}/restaurar`, { metodo: 'POST' })).status, 200);
});

// ---------- R-01 · Cada botão de WhatsApp abre a conversa já com a mensagem certa ----------
// O número vem da config (wrangler.jsonc é JSONC: tira os comentários antes do JSON.parse), nunca cravado aqui.
function numeroWhatsAppDaConfig() {
  const jsonc = readFileSync(new URL('../../wrangler.jsonc', import.meta.url), 'utf8');
  const json = jsonc.replace(/^\s*\/\/.*$/gm, '').replace(/,(\s*[}\]])/g, '$1');
  const numero = JSON.parse(json).vars?.WHATSAPP_NUMERO;
  assert.match(numero || '', /^\d{10,15}$/, 'vars.WHATSAPP_NUMERO só com dígitos em wrangler.jsonc');
  return numero;
}
const decodificarTexto = href => decodeURIComponent(new URL(href.replaceAll('&amp;', '&')).searchParams.get('text') || '');

test('R-01 botões de WhatsApp: número da config e mensagem por contexto', async () => {
  const numero = numeroWhatsAppDaConfig();
  const { status, dados: html } = await chamar('/');
  assert.equal(status, 200);
  assert.ok(!html.includes('wa.me/message'), 'o link curto wa.me/message saiu');
  const links = [...html.matchAll(/href="(https:\/\/wa\.me\/[^"]+)"/g)].map(m => m[1]);
  assert.ok(links.length >= 8, `há ${links.length} links de WhatsApp`);
  for (const l of links) assert.ok(l.startsWith(`https://wa.me/${numero}?text=`), l);

  const cartao = html.slice(html.indexOf('id="edicao"'), html.indexOf('id="oficina-look"'));
  const botao = cartao.match(/<a class="btn" href="([^"]+)"/)[1];
  assert.equal(decodificarTexto(botao), 'Oi Kari, vi o site e quero saber sobre Edição de guarda-roupa');

  const lalaia = html.slice(html.indexOf('id="lalaia"'), html.indexOf('id="cursos"'));
  const produto = lalaia.slice(lalaia.indexOf('<li class="produto">'));
  const titulo = produto.match(/<h3>([^<]+)<\/h3>/)[1];
  const linkProduto = produto.match(/href="(https:\/\/wa\.me\/[^"]+)"/)[1];
  assert.equal(decodificarTexto(linkProduto), `Oi Kari, quero encomendar ${titulo}`);
});

// ---------- R-12 · Cabeçalhos de segurança em todas as respostas ----------
const CABECALHOS_SEGURANCA = {
  'strict-transport-security': 'max-age=63072000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'x-frame-options': 'DENY',
  'content-security-policy': "default-src 'self'; img-src 'self' data: blob: https://*.cdninstagram.com https://*.fbcdn.net; script-src 'self' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https://cloudflareinsights.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
};

test('R-12 cabeçalhos de segurança: toda resposta do Worker traz os 6 cabeçalhos', async () => {
  const rotas = [
    ['/', 200], ['/painel/', 200], ['/painel/painel.js', 200], ['/site.css', 200],
    ['/api/painel/estado', 401], ['/fotos/nao-existe.jpg', 404], ['/nao-existe.css', 404],
  ];
  for (const [rota, statusEsperado] of rotas) {
    const r = await fetch(BASE + rota, { redirect: 'manual' });
    assert.equal(r.status, statusEsperado, rota);
    for (const [nome, valor] of Object.entries(CABECALHOS_SEGURANCA)) {
      assert.equal(r.headers.get(nome), valor, `${rota} → ${nome}`);
    }
  }
  const home = await chamar('/');
  assert.ok(!home.dados.includes('<style'), 'sem <style> inline');
  assert.ok(!home.dados.includes('onclick='), 'sem onclick=');
});

// ---------- R-10 · O site carrega rápido no celular ----------
test('R-10 fontes locais: site e painel sem Google Fonts, WOFF2 servidas pelo site', async () => {
  const home = await chamar('/');
  assert.equal(home.status, 200);
  assert.doesNotMatch(home.dados, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.equal((home.dados.match(/rel="preload" as="font"/g) || []).length, 2, 'duas WOFF2 acima da dobra com preload');
  assert.match(home.dados, /href="\/fontes\.css"/);

  const painel = await chamar('/painel/');
  assert.equal(painel.status, 200);
  assert.doesNotMatch(painel.dados, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.match(painel.dados, /href="\/fontes\.css"/);

  const css = await chamar('/fontes.css');
  assert.equal(css.status, 200);
  assert.match(css.dados, /font-display:\s*swap/);
  for (const familia of ['Familjen Grotesk', 'Fragment Mono', 'Onest']) assert.ok(css.dados.includes(`font-family: "${familia}"`), familia);

  for (const arquivo of ['familjen-grotesk-latin.woff2', 'familjen-grotesk-italic-latin.woff2', 'fragment-mono-latin.woff2', 'onest-latin.woff2']) {
    const f = await fetch(`${BASE}/fontes/${arquivo}`);
    assert.equal(f.status, 200, arquivo);
    assert.match(f.headers.get('content-type') || '', /font\/woff2/, arquivo);
    assert.ok(Number(f.headers.get('content-length') || (await f.arrayBuffer()).byteLength) > 1000, `${arquivo} não está vazia`);
  }

  assert.ok(existsSync(new URL('../../docs/DESIGN.md', import.meta.url)), 'docs/DESIGN.md documenta os tokens');
});

// ---------- S-05 · Como encomendar e condições da LALAIÁ (R-03) ----------
const blocoComoEncomendar = html => {
  const ini = html.indexOf('id="como-encomendar"');
  return ini < 0 ? null : html.slice(ini, html.indexOf('id="cursos"'));
};
const rodape = html => html.slice(html.indexOf('<footer'), html.indexOf('</footer>'));

test('R-03 condições e como encomendar', async () => {
  let html = (await chamar('/')).dados;
  const posLalaia = html.indexOf('id="lalaia"'), posBloco = html.indexOf('id="como-encomendar"'), posCursos = html.indexOf('id="cursos"');
  assert.ok(posBloco > 0, 'home tem id="como-encomendar"');
  assert.ok(posLalaia < posBloco && posBloco < posCursos, 'bloco fica depois da LALAIÁ e antes dos cursos');
  let bloco = blocoComoEncomendar(html);
  for (const passo of ['WhatsApp', 'prazo e valor', 'Pix', 'Correios']) assert.ok(bloco.includes(passo), `passo fixo: ${passo}`);
  assert.ok(!bloco.includes('class="condicoes'), 'sem condições, só os 3 passos');
  assert.ok(!rodape(html).includes('Avaliações no Google'), 'sem gbp_url não há link no rodapé');

  const estado = (await chamar('/api/painel/estado')).dados;
  assert.deepEqual(estado.lalaia.condicoes, { pagamento: '', frete: '', prazo_padrao: '', troca: '', gbp_url: '' }, 'estado devolve lalaia.condicoes vazias');

  const condicoes = { pagamento: 'Pix à vista ou cartão em até 3x', frete: 'Correios para todo o Brasil; <b>retirada</b> em Floripa', prazo_padrao: 'Até 10 dias úteis depois do pagamento', troca: 'Peça artesanal feita para você: encomenda não tem troca, só ajuste' };
  const r = await chamar('/api/painel/lalaia/condicoes', { metodo: 'PUT', corpo: condicoes });
  assert.equal(r.status, 200, JSON.stringify(r.dados));
  assert.equal(r.dados.condicoes.frete, condicoes.frete);
  bloco = blocoComoEncomendar((await chamar('/')).dados);
  assert.ok(bloco.includes('class="condicoes'), 'condições aparecem');
  assert.ok(bloco.includes('Pix à vista ou cartão em até 3x') && bloco.includes('Até 10 dias úteis depois do pagamento') && bloco.includes('encomenda não tem troca, só ajuste'));
  assert.ok(bloco.includes('&lt;b&gt;retirada&lt;/b&gt;') && !bloco.includes('<b>retirada</b>'), 'texto escapado');

  // PUT parcial: null limpa um campo, os outros ficam.
  const parcial = await chamar('/api/painel/lalaia/condicoes', { metodo: 'PUT', corpo: { frete: null } });
  assert.equal(parcial.status, 200);
  assert.equal(parcial.dados.condicoes.frete, '');
  assert.equal(parcial.dados.condicoes.pagamento, condicoes.pagamento);
  bloco = blocoComoEncomendar((await chamar('/')).dados);
  assert.ok(!bloco.includes('retirada') && bloco.includes('Pix à vista'));

  // 221 letras → 400 com a mensagem dizendo o campo e o tamanho.
  const grande = await chamar('/api/painel/lalaia/condicoes', { metodo: 'PUT', corpo: { troca: 'a'.repeat(221) } });
  assert.equal(grande.status, 400);
  assert.equal(grande.dados.erro, 'condicao_invalida');
  assert.match(grande.dados.mensagem, /220 letras.*221/);
  assert.equal((await chamar('/api/painel/lalaia/condicoes', { metodo: 'PUT', corpo: { pagamento: 5 } })).status, 400, 'número não é texto');

  // gbp_url (uc6a): só https:// válida, até 300 letras; no rodapé vira "Avaliações no Google".
  for (const gbp_url of ['http://g.page/r/abc', 'javascript:alert(1)', 'g.page/r/abc', `https://g.page/${'a'.repeat(300)}`]) {
    const ruim = await chamar('/api/painel/lalaia/condicoes', { metodo: 'PUT', corpo: { gbp_url } });
    assert.equal(ruim.status, 400, gbp_url);
    assert.equal(ruim.dados.erro, 'condicao_invalida');
    assert.match(ruim.dados.mensagem, /https:\/\//);
  }
  const url = 'https://g.page/r/AbC123/review?x=1&y=2';
  assert.equal((await chamar('/api/painel/lalaia/condicoes', { metodo: 'PUT', corpo: { gbp_url: url } })).status, 200);
  let pe = rodape((await chamar('/')).dados);
  assert.ok(pe.includes('Avaliações no Google'), 'link no rodapé');
  assert.ok(pe.includes('href="https://g.page/r/AbC123/review?x=1&amp;y=2"'), 'href escapado');
  assert.equal((await chamar('/api/painel/lalaia/condicoes', { metodo: 'PUT', corpo: { gbp_url: '' } })).status, 200);
  pe = rodape((await chamar('/')).dados);
  assert.ok(!pe.includes('Avaliações no Google'), 'vazio tira o link');

  // Tudo vazio → bloco volta a mostrar só os passos.
  assert.equal((await chamar('/api/painel/lalaia/condicoes', { metodo: 'PUT', corpo: { pagamento: null, prazo_padrao: null, troca: null } })).status, 200);
  html = (await chamar('/')).dados;
  bloco = blocoComoEncomendar(html);
  assert.ok(!bloco.includes('class="condicoes') && bloco.includes('Correios'));
  assert.deepEqual((await chamar('/api/painel/estado')).dados.lalaia.condicoes, { pagamento: '', frete: '', prazo_padrao: '', troca: '', gbp_url: '' });
});
