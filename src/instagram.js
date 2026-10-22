import { ErroApi, agora, assinar, conferirAssinatura } from './util.js';

export const CONTAS = {
  kari: { usuario: '@karienegavaw' },
  lalaia: { usuario: '@lalaia.acessorios' },
};

const GRAPH = 'https://graph.instagram.com';
const CAMPOS = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp';
const POR_PAGINA = 24;

const desconectado = () => new ErroApi(409, 'instagram_desconectado', 'Essa conta do Instagram ainda não está ligada ao site. Peça para o Caio ligar.');
const fora = () => new ErroApi(502, 'instagram_fora', 'O Instagram não respondeu agora. Tente de novo em alguns minutos.');

export function validarConta(conta) {
  if (!CONTAS[conta]) throw new ErroApi(400, 'conta_invalida');
  return conta;
}

export const modoFalso = env => env.MODO_INSTAGRAM === 'falso';

export function tituloSugerido(legenda) {
  const linha = String(legenda || '').split('\n').map(l => l.trim()).find(Boolean) || '';
  const limpa = linha.replace(/#\S+/g, '').replace(/\s+/g, ' ').trim();
  if (limpa.length <= 60) return limpa;
  const corte = limpa.slice(0, 60);
  const espaco = corte.lastIndexOf(' ');
  return `${corte.slice(0, espaco > 30 ? espaco : 60).trim()}…`;
}

function paraPost(conta, m) {
  return {
    conta,
    ig_id: m.id,
    legenda: m.caption || '',
    titulo_sugerido: tituloSugerido(m.caption),
    foto_url: m.media_type === 'VIDEO' ? (m.thumbnail_url || m.media_url) : m.media_url,
    tipo: m.media_type,
    link: m.permalink,
    data: m.timestamp,
  };
}

// ---------- Modo falso (desenvolvimento): posts feitos com as fotos de public/img ----------
const FALSOS = {
  kari: [
    ['kari-stylist-toia.jpg', 'Oi gente! Eu sou a Kari!\nFotos da produção com a Toia.'],
    ['kari-look-blazer.jpg', 'Broche no blazer e meia vermelha.'],
    ['sapatos-vermelhos.jpg', 'Como desencaretar um look: broches + cor nos pés.'],
    ['oficina-turma.jpg', 'Oficina de VM e expografia na UDESC'],
    ['atelie-busto.jpg', 'Bastidores do curso de acessórios de cabeça'],
    ['modateca-curso.jpg', 'Curso: Acessórios de Cabeça, da criação à passarela'],
    ['modateca-palestra.jpg', 'Palestra Moda e Adornos de Cabeça'],
    ['kari-brasil.jpg', 'Meu Brasil brasileiro'],
  ],
  lalaia: [
    ['lalaia-scrunchie.jpg', 'Alerta Reposição! BigScrunchie bege com nossa etiquetinha.'],
    ['lalaia-laco-organza.jpg', '3 formas basiquetes de usar o nosso BigScrunchie!'],
    ['lalaia-perolas.jpg', 'Elegantão. Criado especialmente para um casamento na Escócia.'],
    ['lalaia-flor-vermelha.jpg', 'Bem Xuxona.'],
    ['lalaia-babado-vermelho.jpg', 'Peça de artista.'],
    ['lalaia-caixa.jpg', 'Aquele barulhinho bom! Eu adoro embalar os pedidos de vocês.'],
  ],
};

function postsFalsos(conta) {
  return FALSOS[conta].map(([arquivo, legenda], i) => paraPost(conta, {
    id: `falso_${conta}_${arquivo.replace('.jpg', '')}`,
    caption: legenda,
    media_type: 'IMAGE',
    media_url: `/img/${arquivo}`,
    permalink: `https://www.instagram.com/${CONTAS[conta].usuario.slice(1)}/`,
    timestamp: new Date(Date.UTC(2026, 9, 20 - i * 3 - (conta === 'lalaia' ? 1 : 0), 12)).toISOString().replace('.000Z', '+0000'),
  }));
}

// ---------- Contas ligadas ----------
export async function contasLigadas(env) {
  if (modoFalso(env)) return Object.keys(CONTAS).map(conta => ({ conta, usuario: CONTAS[conta].usuario, conectada: true }));
  const { results } = await env.DB.prepare('SELECT conta, usuario_ig FROM instagram').all();
  const ligadas = new Map(results.map(r => [r.conta, r.usuario_ig]));
  return Object.keys(CONTAS).map(conta => ({
    conta,
    usuario: ligadas.get(conta) ? `@${ligadas.get(conta)}` : CONTAS[conta].usuario,
    conectada: ligadas.has(conta),
  }));
}

async function token(env, conta) {
  const linha = await env.DB.prepare('SELECT token FROM instagram WHERE conta = ?').bind(conta).first();
  if (!linha) throw desconectado();
  return linha.token;
}

async function graph(caminho, params) {
  const url = new URL(caminho, GRAPH);
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, v);
  let r;
  try {
    r = await fetch(url, { headers: { accept: 'application/json' } });
  } catch {
    throw fora();
  }
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) {
    // Token vencido ou revogado: trata como conta desligada.
    if (corpo?.error?.code === 190) throw desconectado();
    console.error('Instagram respondeu', r.status, JSON.stringify(corpo).slice(0, 500));
    throw fora();
  }
  return corpo;
}

export async function listarPosts(env, conta, depois) {
  validarConta(conta);
  if (modoFalso(env)) return { posts: postsFalsos(conta), depois: null };
  const corpo = await graph('/me/media', { fields: CAMPOS, limit: POR_PAGINA, after: depois || null, access_token: await token(env, conta) });
  return {
    posts: (corpo.data || []).map(m => paraPost(conta, m)),
    depois: corpo.paging?.next ? corpo.paging?.cursors?.after || null : null,
  };
}

export async function buscarPost(env, conta, igId) {
  validarConta(conta);
  if (modoFalso(env)) {
    const post = postsFalsos(conta).find(p => p.ig_id === igId);
    if (!post) throw new ErroApi(404, 'nao_encontrado');
    return post;
  }
  if (!/^\d+$/.test(String(igId))) throw new ErroApi(400, 'post_invalido');
  return paraPost(conta, await graph(`/${igId}`, { fields: CAMPOS, access_token: await token(env, conta) }));
}

// Baixa a imagem do post (ou do arquivo local no modo falso).
export async function baixarImagem(env, post, request) {
  const url = new URL(post.foto_url, request.url);
  const r = url.origin === new URL(request.url).origin
    ? await env.ASSETS.fetch(new Request(url))
    : await fetch(url).catch(() => null);
  if (!r?.ok) throw fora();
  return { corpo: await r.arrayBuffer(), tipo: r.headers.get('content-type') || 'image/jpeg' };
}

// ---------- Ligar conta (OAuth do Instagram) ----------
function urlRetorno(request) {
  return new URL('/api/instagram/retorno', request.url).toString();
}

export async function urlLigar(env, request, conta) {
  validarConta(conta);
  if (!env.IG_APP_ID) throw new ErroApi(500, 'instagram_sem_app', 'O app do Instagram ainda não foi configurado no servidor.');
  const carga = `${conta}.${Date.now() + 15 * 60_000}`;
  const estado = `${carga}.${await assinar(env.SEGREDO_SESSAO, `ig:${carga}`)}`;
  const url = new URL('https://www.instagram.com/oauth/authorize');
  url.searchParams.set('client_id', env.IG_APP_ID);
  url.searchParams.set('redirect_uri', urlRetorno(request));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'instagram_business_basic');
  url.searchParams.set('state', estado);
  return url.toString();
}

export async function concluirLigacao(env, request) {
  const params = new URL(request.url).searchParams;
  const [conta, validade, assinatura] = String(params.get('state') || '').split('.');
  const valido = conta && validade && assinatura
    && Number(validade) > Date.now()
    && await conferirAssinatura(env.SEGREDO_SESSAO, `ig:${conta}.${validade}`, assinatura);
  if (!valido) throw new ErroApi(400, 'estado_invalido', 'O pedido para ligar o Instagram venceu. Tente ligar de novo.');
  validarConta(conta);
  const codigo = params.get('code');
  if (!codigo) throw new ErroApi(400, 'instagram_recusado', 'O Instagram não autorizou a ligação. Tente de novo e toque em Permitir.');

  // 1) código → token curto
  const form = new URLSearchParams({
    client_id: env.IG_APP_ID,
    client_secret: env.IG_APP_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: urlRetorno(request),
    code: codigo,
  });
  const r = await fetch('https://api.instagram.com/oauth/access_token', { method: 'POST', body: form });
  const curto = await r.json().catch(() => ({}));
  const dadosCurto = Array.isArray(curto.data) ? curto.data[0] : curto;
  if (!r.ok || !dadosCurto?.access_token) {
    console.error('troca de código falhou', r.status, JSON.stringify(curto).slice(0, 500));
    throw fora();
  }
  // 2) token curto → token longo (60 dias)
  const longo = await graph('/access_token', { grant_type: 'ig_exchange_token', client_secret: env.IG_APP_SECRET, access_token: dadosCurto.access_token });
  // 3) quem é essa conta
  const eu = await graph('/me', { fields: 'user_id,username', access_token: longo.access_token });

  await env.DB.prepare(
    `INSERT INTO instagram (conta, usuario_ig, user_id, token, renovado_em) VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT (conta) DO UPDATE SET usuario_ig = ?2, user_id = ?3, token = ?4, renovado_em = ?5`
  ).bind(conta, eu.username || null, String(eu.user_id || dadosCurto.user_id || ''), longo.access_token, agora()).run();
  return conta;
}

// Rotina semanal: tokens longos valem 60 dias e só podem ser renovados após 24 h.
export async function renovarTokens(env) {
  if (modoFalso(env)) return;
  const { results } = await env.DB.prepare('SELECT conta, token, renovado_em FROM instagram').all();
  for (const { conta, token: atual, renovado_em } of results) {
    if (Date.now() - new Date(renovado_em).getTime() < 24 * 3600_000) continue;
    try {
      const novo = await graph('/refresh_access_token', { grant_type: 'ig_refresh_token', access_token: atual });
      await env.DB.prepare('UPDATE instagram SET token = ?, renovado_em = ? WHERE conta = ?').bind(novo.access_token, agora(), conta).run();
    } catch (e) {
      console.error(`não renovou o token de ${conta}:`, e.erro || e.message);
    }
  }
}
