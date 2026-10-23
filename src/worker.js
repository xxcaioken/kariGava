import { ErroApi, json, respostaDeErro, lerJson } from './util.js';
import { pedirCodigo, entrar, cookieSair, exigirSessao } from './auth.js';
import { SECOES, listarItens, lerTextos, salvarTextos, adicionarDoInstagram, adicionarDoCelular, renomear, remover, restaurar, mover, secoesPorPost, lerFotoDoForm, salvarVariantes } from './itens.js';
import { listarDepoimentos, criarDepoimento, editarDepoimento, removerDepoimento, restaurarDepoimento, moverDepoimento } from './depoimentos.js';
import { listarPares, criarPar, editarPar, removerPar, restaurarPar, moverPar } from './antesdepois.js';
import { listarFaq, criarFaq, salvarFaq, removerFaq, restaurarFaq, moverFaq } from './faq.js';
import { contasLigadas, listarPosts, urlLigar, concluirLigacao, renovarTokens, CONTAS } from './instagram.js';
import { renderizarSite } from './site.js';
import { renderizarLalaia } from './lalaia.js';
import { corDestaque, favicon } from './marca.js';
import { renderizarQuiz } from './quiz.js';
import { renderizarPrivacidade } from './privacidade.js';
import { naoEncontrada } from './paginas.js';
import { baseDoSite, sitemap, robots } from './seo.js';
import { comCabecalhos } from './seguranca.js';
import { listarProdutos, agruparProdutos, salvarProduto, renomearProduto } from './produtos.js';
import { lerCondicoes, salvarCondicoes, lerCupom } from './config.js';
import { dadosDaPagina } from './dados.js';

function exigirOrigem(request) {
  const origem = request.headers.get('origin');
  if (origem !== new URL(request.url).origin) throw new ErroApi(403, 'origem_invalida');
}

function exigirJson(request) {
  if (!(request.headers.get('content-type') || '').includes('application/json')) throw new ErroApi(415, 'precisa_json');
}

// Multipart com foto(s): recusa antes de ler o corpo quando passa do teto (ENG-03).
const MAX_CORPO_MULTIPART = 24 * 1024 * 1024;
async function lerMultipart(request) {
  if (Number(request.headers.get('content-length') || 0) > MAX_CORPO_MULTIPART) {
    throw new ErroApi(413, 'foto_grande', 'As fotos são grandes demais. Escolha outras ou tire um print delas.');
  }
  try { return await request.formData(); } catch { throw new ErroApi(400, 'foto_invalida', 'Esse arquivo não é uma foto. Escolha uma foto da galeria.'); }
}
const ehMultipart = request => (request.headers.get('content-type') || '').includes('multipart/form-data');

async function marcarNoSite(env, posts) {
  const mapa = await secoesPorPost(env);
  return posts.map(p => ({ ...p, no_site: mapa.get(`${p.conta}:${p.ig_id}`) || [] }));
}

async function api(request, env, url) {
  const { pathname } = url;
  const metodo = request.method;
  const muda = metodo !== 'GET' && metodo !== 'HEAD';
  if (muda) exigirOrigem(request);

  // ---------- Login ----------
  if (pathname === '/api/login/codigo' && metodo === 'POST') {
    exigirJson(request);
    const { email } = await lerJson(request);
    await pedirCodigo(env, email);
    return json({ ok: true });
  }
  if (pathname === '/api/login/entrar' && metodo === 'POST') {
    exigirJson(request);
    const { email, codigo } = await lerJson(request);
    const r = await entrar(env, email, codigo);
    return json({ ok: true, email: r.email }, 200, { 'set-cookie': r.cookie });
  }
  if (pathname === '/api/login/sair' && metodo === 'POST') {
    return json({ ok: true }, 200, { 'set-cookie': cookieSair() });
  }

  // ---------- Volta do Instagram (precisa estar logado) ----------
  if (pathname === '/api/instagram/retorno' && metodo === 'GET') {
    await exigirSessao(env, request);
    try {
      await concluirLigacao(env, request);
      return Response.redirect(new URL('/painel/?instagram=ligado', url).toString(), 303);
    } catch (e) {
      const motivo = encodeURIComponent(e.mensagem || 'Não deu para ligar o Instagram. Tente de novo.');
      return Response.redirect(new URL(`/painel/?instagram=erro&motivo=${motivo}`, url).toString(), 303);
    }
  }

  if (!pathname.startsWith('/api/painel/')) throw new ErroApi(404, 'nao_encontrado');
  const email = await exigirSessao(env, request);
  const rota = pathname.slice('/api/painel'.length);

  if (rota === '/estado' && metodo === 'GET') {
    const [itens, textos, contas, produtos, condicoes, cupom, depoimentos, antes_depois, faq] = await Promise.all([
      listarItens(env), lerTextos(env), contasLigadas(env), listarProdutos(env), lerCondicoes(env), lerCupom(env), listarDepoimentos(env), listarPares(env), listarFaq(env),
    ]);
    const lalaia = { produtos: agruparProdutos(itens.filter(i => i.secao === 'lalaia'), produtos), condicoes, cupom };
    return json({ usuario: { email }, cor_destaque: corDestaque(), secoes: SECOES, itens, textos, lalaia, depoimentos, antes_depois, faq, instagram: { contas }, site_url: '/' });
  }

  // ---------- Perguntas frequentes ----------
  if (rota === '/faq' && metodo === 'POST') { exigirJson(request); return json({ faq: await criarFaq(env, await lerJson(request)) }, 201); }
  const fq = rota.match(/^\/faq\/(faq_[\w-]+)(\/restaurar|\/mover)?$/);
  if (fq) {
    const [, id, acao] = fq;
    if (!acao && metodo === 'PUT') { exigirJson(request); return json({ faq: await salvarFaq(env, id, await lerJson(request)) }); }
    if (!acao && metodo === 'DELETE') return json({ faq: await removerFaq(env, id) });
    if (acao === '/restaurar' && metodo === 'POST') return json({ faq: await restaurarFaq(env, id) });
    if (acao === '/mover' && metodo === 'POST') { exigirJson(request); return json({ faq: await moverFaq(env, id, (await lerJson(request)).direcao) }); }
  }

  // ---------- Antes e depois ----------
  if (rota === '/antes-depois' && metodo === 'POST') {
    const form = await lerMultipart(request);
    const fotoDoForm = async lado => {
      const f = await lerFotoDoForm(form, lado, { obrigatoria: false });
      return f && { ...f, largura: form.get(`largura_${lado}`), altura: form.get(`altura_${lado}`) };
    };
    const [antes, depois] = await Promise.all([fotoDoForm('antes'), fotoDoForm('depois')]);
    return json({ par: await criarPar(env, { legenda: form.get('legenda'), servico: form.get('servico'), consentimento: form.get('consentimento'), antes, depois }) }, 201);
  }
  const ad = rota.match(/^\/antes-depois\/(ad_[\w-]+)(\/restaurar|\/mover)?$/);
  if (ad) {
    const [, id, acao] = ad;
    if (!acao && metodo === 'PATCH') { exigirJson(request); return json({ par: await editarPar(env, id, await lerJson(request)) }); }
    if (!acao && metodo === 'DELETE') return json({ par: await removerPar(env, id) });
    if (acao === '/restaurar' && metodo === 'POST') return json({ par: await restaurarPar(env, id) });
    if (acao === '/mover' && metodo === 'POST') { exigirJson(request); return json({ antes_depois: await moverPar(env, id, (await lerJson(request)).direcao) }); }
  }

  // ---------- Depoimentos ----------
  if (rota === '/depoimentos' && metodo === 'POST') {
    if (ehMultipart(request)) {
      const form = await lerMultipart(request);
      const foto = await lerFotoDoForm(form, 'foto', { obrigatoria: false });
      const campos = Object.fromEntries(['nome', 'de_onde', 'texto', 'servico', 'consentimento'].map(c => [c, form.get(c)]));
      return json({ depoimento: await criarDepoimento(env, { ...campos, foto: foto && { ...foto, largura: form.get('largura'), altura: form.get('altura') } }) }, 201);
    }
    exigirJson(request);
    return json({ depoimento: await criarDepoimento(env, await lerJson(request)) }, 201);
  }
  const dp = rota.match(/^\/depoimentos\/(dep_[\w-]+)(\/restaurar|\/mover)?$/);
  if (dp) {
    const [, id, acao] = dp;
    if (!acao && metodo === 'PATCH') { exigirJson(request); return json({ depoimento: await editarDepoimento(env, id, await lerJson(request)) }); }
    if (!acao && metodo === 'DELETE') return json({ depoimento: await removerDepoimento(env, id) });
    if (acao === '/restaurar' && metodo === 'POST') return json({ depoimento: await restaurarDepoimento(env, id) });
    if (acao === '/mover' && metodo === 'POST') { exigirJson(request); return json({ depoimentos: await moverDepoimento(env, id, (await lerJson(request)).direcao) }); }
  }

  // ---------- Como encomendar: condições da LALAIÁ ----------
  if (rota === '/lalaia/condicoes' && metodo === 'PUT') {
    exigirJson(request);
    return json(await salvarCondicoes(env, await lerJson(request)));
  }

  // ---------- Produtos da LALAIÁ ----------
  const pr = rota.match(/^\/lalaia\/produtos\/([a-z0-9-]+)(\/renomear)?$/);
  if (pr) {
    const [, s, acao] = pr;
    if (!acao && metodo === 'PUT') { exigirJson(request); return json({ produto: await salvarProduto(env, s, await lerJson(request)) }); }
    if (acao && metodo === 'POST') { exigirJson(request); return json({ produto: await renomearProduto(env, s, (await lerJson(request)).nome) }); }
  }

  if (rota === '/instagram' && metodo === 'GET') {
    const r = await listarPosts(env, url.searchParams.get('conta'), url.searchParams.get('depois'));
    return json({ posts: await marcarNoSite(env, r.posts), depois: r.depois });
  }

  if (rota === '/instagram/novidades' && metodo === 'GET') {
    const contas = (await contasLigadas(env)).filter(c => c.conectada);
    const listas = await Promise.all(contas.map(c => listarPosts(env, c.conta).then(r => r.posts).catch(() => [])));
    const posts = listas.flat().sort((a, b) => String(b.data).localeCompare(String(a.data))).slice(0, 8);
    return json({ posts: await marcarNoSite(env, posts) });
  }

  if (rota === '/instagram/ligar' && metodo === 'GET') {
    const conta = url.searchParams.get('conta');
    if (!CONTAS[conta]) throw new ErroApi(400, 'conta_invalida');
    return Response.redirect(await urlLigar(env, request, conta), 302);
  }

  if (rota === '/itens' && metodo === 'POST') {
    const tipo = request.headers.get('content-type') || '';
    if (tipo.includes('multipart/form-data')) {
      return json({ itens: [await adicionarDoCelular(env, await lerMultipart(request))] }, 201);
    }
    exigirJson(request);
    return json({ itens: await adicionarDoInstagram(env, request, await lerJson(request)) }, 201);
  }

  const m = rota.match(/^\/itens\/(it_[\w-]+|ini_[\w-]+)(\/restaurar|\/mover|\/variantes)?$/);
  if (m) {
    const [, id, acao] = m;
    if (acao === '/variantes' && metodo === 'POST') return json({ item: await salvarVariantes(env, id, await lerMultipart(request)) });
    if (!acao && metodo === 'PATCH') { exigirJson(request); return json({ item: await renomear(env, id, (await lerJson(request)).titulo) }); }
    if (!acao && metodo === 'DELETE') return json({ item: await remover(env, id) });
    if (acao === '/restaurar' && metodo === 'POST') return json({ item: await restaurar(env, id) });
    if (acao === '/mover' && metodo === 'POST') { exigirJson(request); return json({ itens: await mover(env, id, (await lerJson(request)).direcao) }); }
  }

  const t = rota.match(/^\/textos\/([\w-]+)$/);
  if (t && metodo === 'PUT') {
    exigirJson(request);
    return json({ textos: await salvarTextos(env, t[1], await lerJson(request)) });
  }

  throw new ErroApi(404, 'nao_encontrado');
}

// no-store: um 404 guardado em cache impediria o "desfazer" de trazer a foto de volta (review-r2 S-25).
const naoEncontrada404 = () => new Response('Foto não encontrada', { status: 404, headers: { 'cache-control': 'no-store' } });

// Fotos de clientes (depoimentos `dep/` e antes e depois `ad/`) só saem enquanto o registro está no site:
// tirar do site tira a foto na hora, como /privacidade promete (review-r1 S-19). Por isso não têm cache imutável.
// Pares e depoimentos não têm versões leves: a chave pedida é a própria chave gravada.
async function fotoDeClienteNoSite(env, chave) {
  const sql = chave.startsWith('dep/')
    ? 'SELECT 1 FROM depoimentos WHERE foto_chave = ?1 AND removido_em IS NULL'
    : 'SELECT 1 FROM antes_depois WHERE (antes_chave = ?1 OR depois_chave = ?1) AND removido_em IS NULL';
  return Boolean(await env.DB.prepare(sql).bind(chave).first());
}

async function foto(env, chave, request) {
  const deCliente = chave.startsWith('dep/') || chave.startsWith('ad/');
  // Banco e R2 em paralelo: a checagem não soma latência à foto (review-r2 S-25).
  const [noSite, obj] = await Promise.all([deCliente ? fotoDeClienteNoSite(env, chave) : true, env.FOTOS.get(chave)]);
  if (!noSite || !obj) return naoEncontrada404();
  const cabecalhos = {
    'content-type': obj.httpMetadata?.contentType || 'image/jpeg',
    'cache-control': deCliente ? 'public, no-cache' : 'public, max-age=31536000, immutable',
    etag: obj.httpEtag,
  };
  // Revalidação de foto de cliente (no-cache): mesma foto → 304 sem corpo, em vez de baixar tudo de novo.
  if (request.headers.get('if-none-match') === obj.httpEtag) return new Response(null, { status: 304, headers: cabecalhos });
  return new Response(obj.body, { headers: cabecalhos });
}

function chaveDaFoto(caminho) {
  try { return decodeURIComponent(caminho); } catch { return null; } // %E0%A4%A e afins: 404, não 500 (S-21)
}

// Toda rota passa por aqui; os assets estáticos (run_worker_first) caem no ASSETS.
async function tratar(request, env, url) {
  if (url.pathname.startsWith('/api/')) return api(request, env, url);
  if (url.pathname.startsWith('/fotos/') && request.method === 'GET') {
    const chave = chaveDaFoto(url.pathname.slice('/fotos/'.length));
    return chave ? foto(env, chave, request) : naoEncontrada404();
  }
  // Home e /lalaia: dados do banco (cada página lê só o que mostra, src/dados.js), sem cache: o que a Kari muda no painel aparece na hora.
  const PAGINAS_DO_BANCO = { '/': renderizarSite, '/lalaia': renderizarLalaia };
  if (PAGINAS_DO_BANCO[url.pathname] && (request.method === 'GET' || request.method === 'HEAD')) {
    const dados = await dadosDaPagina(env, url.pathname);
    const renderizar = PAGINAS_DO_BANCO[url.pathname];
    return new Response(renderizar({ ...dados, whatsappNumero: env.WHATSAPP_NUMERO, base: baseDoSite(env, request), analyticsToken: env.ANALYTICS_TOKEN }), {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' },
    });
  }
  const leitura = request.method === 'GET' || request.method === 'HEAD';
  const base = baseDoSite(env, request);
  const texto = (corpo, tipo) => new Response(corpo, { headers: { 'content-type': tipo, 'cache-control': 'public, max-age=300' } });
  const pagina = html => texto(html, 'text/html; charset=utf-8');
  const analyticsToken = env.ANALYTICS_TOKEN;
  if (url.pathname === '/quiz' && leitura) return pagina(renderizarQuiz({ whatsappNumero: env.WHATSAPP_NUMERO, base, analyticsToken }));
  if (url.pathname === '/privacidade' && leitura) return pagina(renderizarPrivacidade({ emailContato: env.EMAIL_CONTATO, whatsappNumero: env.WHATSAPP_NUMERO, base, analyticsToken }));
  if (url.pathname === '/sitemap.xml' && leitura) return texto(sitemap(base), 'application/xml; charset=utf-8');
  if (url.pathname === '/robots.txt' && leitura) return texto(robots(base), 'text/plain; charset=utf-8');
  if (url.pathname === '/favicon.svg' && leitura) return texto(favicon(), 'image/svg+xml');
  const asset = await env.ASSETS.fetch(request);
  // Endereço que não existe: página 404 do site (noindex) em vez do 404 vazio dos assets.
  if (asset.status === 404 && leitura) {
    return new Response(naoEncontrada({ whatsappNumero: env.WHATSAPP_NUMERO, base }), { status: 404, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' } });
  }
  return asset;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let resposta;
    try {
      resposta = await tratar(request, env, url);
    } catch (e) {
      if (e instanceof ErroApi) resposta = respostaDeErro(e);
      else {
        console.error(e?.stack || e);
        resposta = json({ erro: 'erro_interno', mensagem: 'Algo deu errado do nosso lado. Tente de novo em instantes.' }, 500);
      }
    }
    // Único ponto de saída: sucesso, erro tratado, 500, foto e asset saem com os mesmos cabeçalhos.
    return comCabecalhos(resposta, env);
  },

  async scheduled(_evento, env, ctx) {
    ctx.waitUntil(renovarTokens(env));
  },
};
