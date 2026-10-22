import { ErroApi, json, respostaDeErro, lerJson } from './util.js';
import { pedirCodigo, entrar, cookieSair, exigirSessao } from './auth.js';
import { SECOES, listarItens, lerTextos, salvarTextos, adicionarDoInstagram, adicionarDoCelular, renomear, remover, restaurar, mover, secoesPorPost } from './itens.js';
import { contasLigadas, listarPosts, urlLigar, concluirLigacao, renovarTokens, CONTAS } from './instagram.js';
import { renderizarSite } from './site.js';
import { comCabecalhos } from './seguranca.js';

function exigirOrigem(request) {
  const origem = request.headers.get('origin');
  if (origem !== new URL(request.url).origin) throw new ErroApi(403, 'origem_invalida');
}

function exigirJson(request) {
  if (!(request.headers.get('content-type') || '').includes('application/json')) throw new ErroApi(415, 'precisa_json');
}

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
    const [itens, textos, contas] = await Promise.all([listarItens(env), lerTextos(env), contasLigadas(env)]);
    return json({ usuario: { email }, secoes: SECOES, itens, textos, instagram: { contas }, site_url: '/' });
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
      let form;
      try { form = await request.formData(); } catch { throw new ErroApi(400, 'foto_invalida', 'Esse arquivo não é uma foto. Escolha uma foto da galeria.'); }
      return json({ itens: [await adicionarDoCelular(env, form)] }, 201);
    }
    exigirJson(request);
    return json({ itens: await adicionarDoInstagram(env, request, await lerJson(request)) }, 201);
  }

  const m = rota.match(/^\/itens\/(it_[\w-]+|ini_[\w-]+)(\/restaurar|\/mover)?$/);
  if (m) {
    const [, id, acao] = m;
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

async function foto(env, chave) {
  const obj = await env.FOTOS.get(chave);
  if (!obj) return new Response('Foto não encontrada', { status: 404 });
  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType || 'image/jpeg',
      'cache-control': 'public, max-age=31536000, immutable',
      etag: obj.httpEtag,
    },
  });
}

// Toda rota passa por aqui; os assets estáticos (run_worker_first) caem no ASSETS.
async function tratar(request, env, url) {
  if (url.pathname.startsWith('/api/')) return api(request, env, url);
  if (url.pathname.startsWith('/fotos/') && request.method === 'GET') return foto(env, decodeURIComponent(url.pathname.slice('/fotos/'.length)));
  if (url.pathname === '/' && (request.method === 'GET' || request.method === 'HEAD')) {
    const [itens, textos] = await Promise.all([listarItens(env), lerTextos(env)]);
    return new Response(renderizarSite({ itens, textos, whatsappNumero: env.WHATSAPP_NUMERO }), {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' },
    });
  }
  return env.ASSETS.fetch(request);
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
