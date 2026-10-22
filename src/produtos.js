// Produtos da LALAIÁ (R-03): fotos com o mesmo nome formam um produto; os dados (preço, prazo,
// descrição) ficam na tabela `produtos`, chaveada pelo slug do nome. `slug()` é a única chave,
// usada tanto para agrupar as fotos quanto para a tabela.
import conteudo from '../conteudo.json' with { type: 'json' };
import { ErroApi, agora } from './util.js';
import { paraItem } from './itens.js';

const MAX_PRECO = 99999;
const MAX_PRAZO = 90;
const MAX_DESCRICAO = 220;
const MAX_NOME = 80;
const DISPONIBILIDADES = new Set(['pronta', 'encomenda']);

// "Acessórios de cabeça sob medida" → "acessorios-de-cabeca-sob-medida"; "BigScrunchie (a Xuxona)" → "bigscrunchie-a-xuxona"
export function slug(titulo) {
  return String(titulo ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function textoPreco(preco) {
  return Number.isInteger(preco) && preco > 0 ? `R$ ${preco.toLocaleString('pt-BR')}` : '';
}

export function textoDisponibilidade({ disponibilidade, prazo_dias }) {
  if (disponibilidade === 'pronta') return 'Pronta entrega';
  if (disponibilidade === 'encomenda') return prazo_dias ? `Sob encomenda · até ${prazo_dias} dias úteis` : 'Sob encomenda';
  return '';
}

export async function listarProdutos(env) {
  const { results } = await env.DB.prepare('SELECT slug, titulo, preco, disponibilidade, prazo_dias, descricao FROM produtos').all();
  return results;
}

// Junta as fotos ativas da LALAIÁ (agrupadas por slug) com as linhas de `produtos` e, se o nome bater
// com uma linha de conteudo.json, com rótulo/descrição/cta de lá. Inclui produtos sem fotos (preço guardado).
export function agruparProdutos(fotosLalaia, linhasProdutos = []) {
  const fixos = new Map(conteudo.lalaia.linhas.map(l => [slug(l.titulo), l]));
  const dados = new Map(linhasProdutos.map(p => [p.slug, p]));
  const grupos = new Map();
  for (const f of fotosLalaia) {
    const s = slug(f.titulo) || `sem-nome-${f.id}`;
    if (!grupos.has(s)) grupos.set(s, { slug: s, titulo: f.titulo || '', fotos: [] });
    grupos.get(s).fotos.push(f);
  }
  for (const p of linhasProdutos) if (!grupos.has(p.slug)) grupos.set(p.slug, { slug: p.slug, titulo: p.titulo, fotos: [] });
  return [...grupos.values()].map(g => {
    const fixo = fixos.get(g.slug);
    const d = dados.get(g.slug) || {};
    return {
      slug: g.slug,
      titulo: g.titulo || d.titulo || '',
      rotulo: fixo?.rotulo || 'Produto',
      descricao: d.descricao || fixo?.texto || '',
      cta: fixo?.cta || 'Encomendar',
      preco: d.preco ?? null,
      disponibilidade: d.disponibilidade ?? null,
      prazo_dias: d.prazo_dias ?? null,
      fotos: g.fotos,
    };
  });
}

async function fotosDaLalaia(env) {
  const { results } = await env.DB.prepare("SELECT id, titulo FROM itens WHERE secao = 'lalaia' AND removido_em IS NULL ORDER BY ordem").all();
  return results;
}

async function produtoAtual(env, s) {
  const [fotos, linha] = await Promise.all([
    fotosDaLalaia(env).then(l => l.filter(f => slug(f.titulo) === s)),
    env.DB.prepare('SELECT * FROM produtos WHERE slug = ?').bind(s).first(),
  ]);
  if (!fotos.length && !linha) {
    throw new ErroApi(404, 'nao_encontrado', 'Esse produto não está no site. Coloque uma foto da LALAIÁ com esse nome primeiro.');
  }
  return { fotos, linha, titulo: fotos[0]?.titulo || linha?.titulo };
}

async function produtoCompleto(env, s) {
  const [fotos, linhas] = await Promise.all([
    env.DB.prepare("SELECT * FROM itens WHERE secao = 'lalaia' AND removido_em IS NULL ORDER BY ordem").all().then(r => r.results),
    listarProdutos(env),
  ]);
  return agruparProdutos(fotos.map(paraItem), linhas).find(p => p.slug === s);
}

function limparTexto(valor) {
  return String(valor ?? '').replace(/\s+/g, ' ').trim();
}

// PUT parcial: campo ausente mantém; null limpa. Toda recusa diz à Kari o que fazer.
export async function salvarProduto(env, s, campos) {
  const { linha, titulo } = await produtoAtual(env, s);
  const novo = {
    preco: linha?.preco ?? null,
    disponibilidade: linha?.disponibilidade ?? null,
    prazo_dias: linha?.prazo_dias ?? null,
    descricao: linha?.descricao ?? '',
  };
  if ('preco' in campos) {
    const v = campos.preco;
    if (v === null || v === '') novo.preco = null;
    else if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > MAX_PRECO) {
      throw new ErroApi(400, 'produto_invalido', 'O preço precisa ser um número inteiro, sem centavos, de 1 a 99.999. Deixe vazio para não mostrar.');
    } else novo.preco = v;
  }
  if ('disponibilidade' in campos) {
    const v = campos.disponibilidade;
    if (v === null || v === '') novo.disponibilidade = null;
    else if (!DISPONIBILIDADES.has(v)) throw new ErroApi(400, 'produto_invalido', 'Escolha "pronta entrega" ou "sob encomenda".');
    else novo.disponibilidade = v;
  }
  if ('prazo_dias' in campos) {
    const v = campos.prazo_dias;
    if (v === null || v === '') novo.prazo_dias = null;
    else if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > MAX_PRAZO) {
      throw new ErroApi(400, 'produto_invalido', `O prazo é em dias úteis, de 1 a ${MAX_PRAZO}.`);
    } else novo.prazo_dias = v;
  }
  if ('descricao' in campos) {
    novo.descricao = limparTexto(campos.descricao);
    if (novo.descricao.length > MAX_DESCRICAO) {
      throw new ErroApi(400, 'produto_invalido', `A descrição pode ter até ${MAX_DESCRICAO} letras; esta tem ${novo.descricao.length}.`);
    }
  }
  await env.DB.prepare(
    `INSERT INTO produtos (slug, titulo, preco, disponibilidade, prazo_dias, descricao, atualizado_em) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
     ON CONFLICT (slug) DO UPDATE SET titulo = ?2, preco = ?3, disponibilidade = ?4, prazo_dias = ?5, descricao = ?6, atualizado_em = ?7`
  ).bind(s, titulo, novo.preco, novo.disponibilidade, novo.prazo_dias, novo.descricao, agora()).run();
  return produtoCompleto(env, s);
}

// Renomeia todas as fotos do produto e move os dados para o slug novo num único batch: ou tudo, ou nada.
export async function renomearProduto(env, s, nome) {
  const novoTitulo = limparTexto(nome);
  if (novoTitulo.length > MAX_NOME) throw new ErroApi(400, 'produto_invalido', `O nome do produto precisa ter até ${MAX_NOME} letras.`);
  const novoSlug = slug(novoTitulo);
  if (!novoSlug) throw new ErroApi(400, 'produto_invalido', 'O nome do produto precisa ter pelo menos uma letra ou um número.');

  const { fotos, linha } = await produtoAtual(env, s);
  if (novoSlug !== s) {
    const [outraLinha, todas] = await Promise.all([
      env.DB.prepare('SELECT slug FROM produtos WHERE slug = ?').bind(novoSlug).first(),
      fotosDaLalaia(env),
    ]);
    if (outraLinha || todas.some(f => slug(f.titulo) === novoSlug)) {
      throw new ErroApi(409, 'produto_duplicado', 'Já existe um produto com esse nome. Escolha outro ou junte as fotos renomeando uma a uma.');
    }
  }

  const comandos = fotos.map(f => env.DB.prepare('UPDATE itens SET titulo = ? WHERE id = ?').bind(novoTitulo, f.id));
  if (linha) comandos.push(env.DB.prepare('UPDATE produtos SET slug = ?, titulo = ?, atualizado_em = ? WHERE slug = ?').bind(novoSlug, novoTitulo, agora(), s));
  try {
    await env.DB.batch(comandos);
  } catch (e) {
    if (String(e?.message || e).includes('UNIQUE')) throw new ErroApi(409, 'produto_duplicado', 'Já existe um produto com esse nome.');
    throw e;
  }
  return produtoCompleto(env, novoSlug);
}
