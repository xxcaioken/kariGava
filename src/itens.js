import conteudo from '../conteudo.json' with { type: 'json' };
import { ErroApi, agora, novoId } from './util.js';
import { buscarPost, baixarImagem } from './instagram.js';

const CORES = { lalaia: '#FEBC5C', sobre: '#141218' };
const COR_SERVICO = { consultoria: '#8D51FF', edicao: '#C52118', 'oficina-look': '#FEBC5C', styling: '#E5196E', vm: '#017F38', ensino: '#2A2730' };

export const SECOES = [
  { id: 'lalaia', nome: 'LALAIÁ (produtos)', tipo: 'lalaia', cor: CORES.lalaia },
  ...conteudo.servicos.map(s => ({ id: s.id, nome: s.titulo, tipo: 'servico', cor: COR_SERVICO[s.id] || '#141218' })),
  { id: 'sobre', nome: 'Sobre mim', tipo: 'sobre', cor: CORES.sobre },
];

const MAX_FOTO = 15 * 1024 * 1024;
const MAX_TITULO = 80;
const MAX_TEXTO = 220;

export function validarSecao(id) {
  const secao = SECOES.find(s => s.id === id);
  if (!secao) throw new ErroApi(400, 'secao_invalida');
  return secao;
}

export function urlFoto(chave) {
  return chave.startsWith('img/') ? `/${chave}` : `/fotos/${chave}`;
}

function paraItem(l) {
  return {
    id: l.id, secao: l.secao, ordem: l.ordem, titulo: l.titulo,
    foto_url: urlFoto(l.foto_chave), origem: l.origem, ig_conta: l.ig_conta, ig_id: l.ig_id,
  };
}

function limparTitulo(t) {
  const s = String(t ?? '').replace(/\s+/g, ' ').trim();
  if (s.length > MAX_TITULO) throw new ErroApi(400, 'titulo_invalido', `O nome da foto precisa ter até ${MAX_TITULO} letras.`);
  return s;
}

export async function listarItens(env) {
  const { results } = await env.DB.prepare('SELECT * FROM itens WHERE removido_em IS NULL ORDER BY secao, ordem').all();
  return results.map(paraItem);
}

async function itensDaSecao(env, secao) {
  const { results } = await env.DB.prepare('SELECT * FROM itens WHERE secao = ? AND removido_em IS NULL ORDER BY ordem').bind(secao).all();
  return results.map(paraItem);
}

async function proximaOrdem(env, secao) {
  const l = await env.DB.prepare('SELECT COALESCE(MAX(ordem), -1) + 1 AS n FROM itens WHERE secao = ? AND removido_em IS NULL').bind(secao).first();
  return l.n;
}

async function buscarItem(env, id) {
  const l = await env.DB.prepare('SELECT * FROM itens WHERE id = ?').bind(id).first();
  if (!l) throw new ErroApi(404, 'nao_encontrado');
  return l;
}

async function inserir(env, dados) {
  const linha = { id: novoId('it'), criado_em: agora(), ig_conta: null, ig_id: null, ...dados };
  await env.DB.prepare(
    'INSERT INTO itens (id, secao, ordem, titulo, foto_chave, origem, ig_conta, ig_id, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(linha.id, linha.secao, linha.ordem, linha.titulo, linha.foto_chave, linha.origem, linha.ig_conta, linha.ig_id, linha.criado_em).run();
  return paraItem(linha);
}

// Post do Instagram → foto guardada no R2 (a URL do Instagram vence em poucos dias).
export async function adicionarDoInstagram(env, request, { secao, titulo, instagram }) {
  validarSecao(secao);
  if (!Array.isArray(instagram) || instagram.length === 0 || instagram.length > 24) throw new ErroApi(400, 'pedido_invalido');
  const tituloUnico = instagram.length === 1 && titulo != null ? limparTitulo(titulo) : null;

  const criados = [];
  let ordem = await proximaOrdem(env, secao);
  for (const { conta, ig_id } of instagram) {
    const ja = await env.DB.prepare('SELECT 1 FROM itens WHERE secao = ? AND ig_conta = ? AND ig_id = ? AND removido_em IS NULL')
      .bind(secao, conta, String(ig_id)).first();
    if (ja) continue;
    const post = await buscarPost(env, conta, String(ig_id));
    const imagem = await baixarImagem(env, post, request);
    const chave = `ig/${conta}/${post.ig_id}.jpg`;
    await env.FOTOS.put(chave, imagem.corpo, { httpMetadata: { contentType: imagem.tipo } });
    criados.push(await inserir(env, {
      secao, ordem: ordem++, titulo: tituloUnico || post.titulo_sugerido,
      foto_chave: chave, origem: 'instagram', ig_conta: conta, ig_id: post.ig_id,
    }));
  }
  return criados;
}

function tipoDaImagem(bytes) {
  const b = new Uint8Array(bytes.slice(0, 12));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') return 'image/webp';
  if (String.fromCharCode(...b.slice(4, 12)).startsWith('ftyphei') || String.fromCharCode(...b.slice(4, 12)).startsWith('ftypmif')) return 'image/heic';
  return null;
}

export async function adicionarDoCelular(env, form) {
  const secao = String(form.get('secao') || '');
  validarSecao(secao);
  const titulo = limparTitulo(form.get('titulo'));
  const foto = form.get('foto');
  if (!foto || typeof foto === 'string') throw new ErroApi(400, 'foto_invalida', 'Esse arquivo não é uma foto. Escolha uma foto da galeria.');
  if (foto.size > MAX_FOTO) throw new ErroApi(413, 'foto_grande', 'Essa foto é grande demais. Escolha outra ou tire um print dela.');
  const bytes = await foto.arrayBuffer();
  const tipo = tipoDaImagem(bytes);
  if (tipo === 'image/heic') {
    throw new ErroApi(400, 'foto_invalida', 'Essa foto está num formato que o site não mostra. No iPhone, tire um print dela e envie o print.');
  }
  if (!tipo) throw new ErroApi(400, 'foto_invalida', 'Esse arquivo não é uma foto. Escolha uma foto da galeria.');
  const id = novoId('it');
  const chave = `celular/${id}.${tipo.split('/')[1].replace('jpeg', 'jpg')}`;
  await env.FOTOS.put(chave, bytes, { httpMetadata: { contentType: tipo } });
  return inserir(env, { id, secao, ordem: await proximaOrdem(env, secao), titulo, foto_chave: chave, origem: 'celular' });
}

export async function renomear(env, id, titulo) {
  const l = await buscarItem(env, id);
  const novo = limparTitulo(titulo);
  await env.DB.prepare('UPDATE itens SET titulo = ? WHERE id = ?').bind(novo, id).run();
  return paraItem({ ...l, titulo: novo });
}

export async function remover(env, id) {
  const l = await buscarItem(env, id);
  if (!l.removido_em) await env.DB.prepare('UPDATE itens SET removido_em = ? WHERE id = ?').bind(agora(), id).run();
  return paraItem(l);
}

export async function restaurar(env, id) {
  const l = await buscarItem(env, id);
  if (l.removido_em) {
    // Abre espaço na posição antiga e volta para ela.
    await env.DB.batch([
      env.DB.prepare('UPDATE itens SET ordem = ordem + 1 WHERE secao = ? AND ordem >= ? AND removido_em IS NULL').bind(l.secao, l.ordem),
      env.DB.prepare('UPDATE itens SET removido_em = NULL WHERE id = ?').bind(id),
    ]);
  }
  return paraItem({ ...l, removido_em: null });
}

export async function mover(env, id, direcao) {
  if (direcao !== 'cima' && direcao !== 'baixo') throw new ErroApi(400, 'direcao_invalida');
  const l = await buscarItem(env, id);
  if (l.removido_em) throw new ErroApi(404, 'nao_encontrado');
  const lista = await itensDaSecao(env, l.secao);
  const i = lista.findIndex(x => x.id === id);
  const j = direcao === 'cima' ? i - 1 : i + 1;
  if (j >= 0 && j < lista.length) {
    // Renumera a seção inteira (0..n-1) já com a troca, o que também fecha buracos.
    [lista[i], lista[j]] = [lista[j], lista[i]];
    await env.DB.batch(lista.map((x, n) => env.DB.prepare('UPDATE itens SET ordem = ? WHERE id = ?').bind(n, x.id)));
  }
  return itensDaSecao(env, l.secao);
}

// ---------- Textos dos serviços ----------
export async function lerTextos(env) {
  const { results } = await env.DB.prepare('SELECT servico, resumo, para_quem FROM textos').all();
  const editados = new Map(results.map(r => [r.servico, r]));
  return Object.fromEntries(conteudo.servicos.map(s => [s.id, {
    titulo: s.titulo,
    resumo: editados.get(s.id)?.resumo ?? s.resumo,
    para_quem: editados.get(s.id)?.para_quem ?? s.para_quem,
  }]));
}

export async function salvarTextos(env, servico, { resumo, para_quem }) {
  const s = conteudo.servicos.find(x => x.id === servico);
  if (!s) throw new ErroApi(404, 'nao_encontrado');
  const r = String(resumo ?? '').replace(/\s+/g, ' ').trim();
  const p = String(para_quem ?? '').replace(/\s+/g, ' ').trim();
  if (!r) throw new ErroApi(400, 'texto_invalido', 'Escreva um resumo do serviço.');
  if (r.length > MAX_TEXTO) throw new ErroApi(400, 'texto_invalido', `O resumo precisa ter até ${MAX_TEXTO} letras.`);
  if (p.length > MAX_TEXTO) throw new ErroApi(400, 'texto_invalido', `O "para quem" precisa ter até ${MAX_TEXTO} letras.`);
  await env.DB.prepare(
    `INSERT INTO textos (servico, resumo, para_quem, atualizado_em) VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT (servico) DO UPDATE SET resumo = ?2, para_quem = ?3, atualizado_em = ?4`
  ).bind(servico, r, p, agora()).run();
  return { titulo: s.titulo, resumo: r, para_quem: p };
}

// Em quais seções cada post já está (para o selo "No site").
export async function secoesPorPost(env) {
  const { results } = await env.DB.prepare('SELECT ig_conta, ig_id, secao FROM itens WHERE removido_em IS NULL AND ig_id IS NOT NULL').all();
  const mapa = new Map();
  for (const r of results) {
    const k = `${r.ig_conta}:${r.ig_id}`;
    mapa.set(k, [...(mapa.get(k) || []), r.secao]);
  }
  return mapa;
}
