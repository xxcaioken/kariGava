// Teste de ponta a ponta contra `npm run dev` (wrangler local, MODO_INSTAGRAM=falso, DEV_LOGIN=1).
// Uso: BASE=http://127.0.0.1:8787 LOG=/caminho/do/log/do/wrangler npm run test:e2e
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
