import conteudo from '../conteudo.json' with { type: 'json' };
import { ErroApi, agora, novoId } from './util.js';
import { buscarPost, baixarImagem } from './instagram.js';
import { nomeDaVariante, chaveDaVariante } from './variantes.js';

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

function lerVariantes(texto) {
  if (!texto) return null;
  try {
    const v = typeof texto === 'string' ? JSON.parse(texto) : texto;
    const larguras = Array.isArray(v?.larguras) ? v.larguras.filter(Number.isInteger) : [];
    return larguras.length ? { larguras, webp: v.webp === true } : null;
  } catch { return null; }
}

export function paraItem(l) {
  return {
    id: l.id, secao: l.secao, ordem: l.ordem, titulo: l.titulo,
    foto_url: urlFoto(l.foto_chave), origem: l.origem, ig_conta: l.ig_conta, ig_id: l.ig_id,
    variantes: lerVariantes(l.variantes), largura: l.largura ?? null, altura: l.altura ?? null,
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

// Lê e confere uma foto de um multipart (celular): tipo pelos bytes, tamanho máximo, HEIC recusado com explicação.
// Devolve { bytes, tipo } ou lança 400 foto_invalida / 413 foto_grande. Com `obrigatoria: false`, campo vazio devolve null.
export async function lerFotoDoForm(form, campo = 'foto', { obrigatoria = true } = {}) {
  const foto = form.get(campo);
  if (!foto || typeof foto === 'string' || foto.size === 0) {
    if (!obrigatoria) return null;
    throw new ErroApi(400, 'foto_invalida', 'Esse arquivo não é uma foto. Escolha uma foto da galeria.');
  }
  if (foto.size > MAX_FOTO) throw new ErroApi(413, 'foto_grande', 'Essa foto é grande demais. Escolha outra ou tire um print dela.');
  const bytes = await foto.arrayBuffer();
  const tipo = tipoDaImagem(bytes);
  if (tipo === 'image/heic') {
    throw new ErroApi(400, 'foto_invalida', 'Essa foto está num formato que o site não mostra. No iPhone, tire um print dela e envie o print.');
  }
  if (!tipo) throw new ErroApi(400, 'foto_invalida', 'Esse arquivo não é uma foto. Escolha uma foto da galeria.');
  return { bytes, tipo };
}

// ---------- Versões leves (R-10) ----------
const TIPO_DA_EXT = { jpg: 'image/jpeg', webp: 'image/webp' };
const MAX_LADO = 10000;

// Campos "<largura>.<jpg|webp>" do multipart, já conferidos pelos bytes (um PNG chamado 480.webp é recusado).
export async function lerVariantesDoForm(form) {
  const lista = [];
  for (const [nome, valor] of form.entries()) {
    const v = nomeDaVariante(nome);
    if (!v || typeof valor === 'string' || valor.size === 0) continue;
    if (valor.size > MAX_FOTO) throw new ErroApi(413, 'foto_grande', `A versão ${nome} é grande demais.`);
    const bytes = await valor.arrayBuffer();
    if (tipoDaImagem(bytes) !== TIPO_DA_EXT[v.ext]) {
      throw new ErroApi(400, 'foto_invalida', `A versão ${nome} não é um ${v.ext.toUpperCase()} de verdade. Escolha a foto de novo.`);
    }
    lista.push({ ...v, bytes, tipo: TIPO_DA_EXT[v.ext] });
  }
  return lista;
}

// largura/altura opcionais (tamanho da original, pós-orientação): inteiros de 1 a 10000.
export function lerLados(form) {
  const ler = nome => {
    const texto = form.get(nome);
    if (texto === null || texto === undefined || texto === '') return null;
    const n = Number(texto);
    if (!Number.isInteger(n) || n < 1 || n > MAX_LADO) throw new ErroApi(400, 'foto_invalida', `Não deu para ler o tamanho da foto (${nome}). Escolha a foto de novo.`);
    return n;
  };
  const largura = ler('largura');
  const altura = ler('altura');
  if ((largura === null) !== (altura === null)) throw new ErroApi(400, 'foto_invalida', 'Mande largura e altura juntas.');
  return { largura, altura };
}

// Sobe cada versão no R2 (chave determinística: repetir sobrescreve) e grava só as que subiram.
async function aplicarVariantes(env, linha, lista, { largura, altura }) {
  const subiu = { jpg: new Set(), webp: new Set() };
  for (const v of lista) {
    const chave = chaveDaVariante(linha.foto_chave, v.largura, v.ext);
    try {
      await env.FOTOS.put(chave, v.bytes, { httpMetadata: { contentType: v.tipo } });
      subiu[v.ext].add(v.largura);
    } catch (e) {
      console.error('não deu para subir a versão', chave, e?.stack || e);
    }
  }
  const atual = lerVariantes(linha.variantes) || { larguras: [], webp: false };
  const larguras = [...new Set([...atual.larguras, ...subiu.jpg])].sort((a, b) => a - b);
  const comWebp = new Set([...(atual.webp ? atual.larguras : []), ...subiu.webp]);
  const variantes = larguras.length ? { larguras, webp: larguras.every(w => comWebp.has(w)) } : null;
  await env.DB.prepare('UPDATE itens SET variantes = ?, largura = COALESCE(?, largura), altura = COALESCE(?, altura) WHERE id = ?')
    .bind(variantes ? JSON.stringify(variantes) : null, largura, altura, linha.id).run();
  return paraItem({ ...linha, variantes, largura: largura ?? linha.largura, altura: altura ?? linha.altura });
}

// POST /api/painel/itens/:id/variantes (backfill e pós-Instagram pelo painel).
export async function salvarVariantes(env, id, form) {
  const l = await buscarItem(env, id);
  if (l.removido_em) throw new ErroApi(404, 'nao_encontrado');
  const lista = await lerVariantesDoForm(form);
  const lados = lerLados(form);
  if (!lista.length) throw new ErroApi(400, 'foto_invalida', 'Mande pelo menos uma versão da foto (480.jpg, 960.jpg, 1600.jpg ou .webp).');
  return aplicarVariantes(env, l, lista, lados);
}

export async function adicionarDoCelular(env, form) {
  const secao = String(form.get('secao') || '');
  validarSecao(secao);
  const titulo = limparTitulo(form.get('titulo'));
  const { bytes, tipo } = await lerFotoDoForm(form);
  // Valida as versões leves antes de guardar qualquer coisa: ou entra tudo, ou nada.
  const lista = await lerVariantesDoForm(form);
  const lados = lerLados(form);
  const id = novoId('it');
  const chave = `celular/${id}.${tipo.split('/')[1].replace('jpeg', 'jpg')}`;
  await env.FOTOS.put(chave, bytes, { httpMetadata: { contentType: tipo } });
  // Se gravar no banco falhar, a foto não fica órfã (e pública) no R2: mesma compensação de depoimentos e pares (review-r1 S-22).
  let item;
  try {
    item = await inserir(env, { id, secao, ordem: await proximaOrdem(env, secao), titulo, foto_chave: chave, origem: 'celular' });
  } catch (e) {
    console.error('INSERT da foto do celular falhou; apagando do R2', chave, e?.stack || e);
    await env.FOTOS.delete(chave).catch(err => console.error('não deu para apagar a foto órfã', chave, err));
    throw new ErroApi(500, 'erro_interno', 'Não deu para colocar a foto no site. Tente de novo.');
  }
  if (!lista.length && lados.largura === null) return item;
  return aplicarVariantes(env, { ...item, foto_chave: chave, variantes: null }, lista, lados);
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
const MAX_PRECO = 99999; // spec R-02: 0 < preço < 100.000, em reais inteiros

export async function lerTextos(env) {
  const { results } = await env.DB.prepare('SELECT servico, resumo, para_quem, preco FROM textos').all();
  const editados = new Map(results.map(r => [r.servico, r]));
  return Object.fromEntries(conteudo.servicos.map(s => [s.id, {
    titulo: s.titulo,
    resumo: editados.get(s.id)?.resumo ?? s.resumo,
    para_quem: editados.get(s.id)?.para_quem ?? s.para_quem,
    preco: editados.get(s.id)?.preco ?? null,
  }]));
}

function limparTexto(valor) {
  return String(valor ?? '').replace(/\s+/g, ' ').trim();
}

// null ou vazio limpa; senão tem de ser inteiro em reais entre 1 e 99.999.
function validarPreco(valor) {
  if (valor === null || valor === '' || valor === undefined) return null;
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < 1 || valor > MAX_PRECO) {
    throw new ErroApi(400, 'texto_invalido', 'O preço precisa ser um número inteiro, sem centavos. Deixe vazio para não mostrar.');
  }
  return valor;
}

// PUT parcial: campo ausente mantém o valor atual (ou o de conteudo.json, se o serviço nunca foi editado); null limpa.
export async function salvarTextos(env, servico, campos) {
  const s = conteudo.servicos.find(x => x.id === servico);
  if (!s) throw new ErroApi(404, 'nao_encontrado');
  const atual = await env.DB.prepare('SELECT resumo, para_quem, preco FROM textos WHERE servico = ?').bind(servico).first();
  const novo = { resumo: atual?.resumo ?? s.resumo, para_quem: atual?.para_quem ?? s.para_quem, preco: atual?.preco ?? null };

  if ('resumo' in campos) {
    novo.resumo = limparTexto(campos.resumo);
    if (!novo.resumo) throw new ErroApi(400, 'texto_invalido', 'Escreva um resumo do serviço.');
    if (novo.resumo.length > MAX_TEXTO) throw new ErroApi(400, 'texto_invalido', `O resumo precisa ter até ${MAX_TEXTO} letras.`);
  }
  if ('para_quem' in campos) {
    novo.para_quem = limparTexto(campos.para_quem);
    if (novo.para_quem.length > MAX_TEXTO) throw new ErroApi(400, 'texto_invalido', `O "para quem" precisa ter até ${MAX_TEXTO} letras.`);
  }
  if ('preco' in campos) novo.preco = validarPreco(campos.preco);

  await env.DB.prepare(
    `INSERT INTO textos (servico, resumo, para_quem, preco, atualizado_em) VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT (servico) DO UPDATE SET resumo = ?2, para_quem = ?3, preco = ?4, atualizado_em = ?5`
  ).bind(servico, novo.resumo, novo.para_quem, novo.preco, agora()).run();
  return { titulo: s.titulo, ...novo };
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
