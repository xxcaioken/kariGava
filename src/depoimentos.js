// Depoimentos de clientes (R-04): a Kari cadastra no painel; o site só mostra a seção quando existe algum.
import conteudo from '../conteudo.json' with { type: 'json' };
import { ErroApi, agora, novoId } from './util.js';
import { urlFoto } from './itens.js';
import { ordenacao } from './ordenacao.js';

const MAX_TEXTO = 400;
const MAX_NOME = 80;
const MAX_DE_ONDE = 80;
const MAX_LADO = 10000;
const SERVICOS = new Set(conteudo.servicos.map(s => s.id));

export function paraDepoimento(l) {
  return {
    id: l.id, ordem: l.ordem, nome: l.nome, de_onde: l.de_onde || '', texto: l.texto, servico: l.servico || '',
    foto_url: l.foto_chave ? urlFoto(l.foto_chave) : null,
    largura: l.largura ?? null, altura: l.altura ?? null,
    consentimento_em: l.consentimento_em || null,
  };
}

const ordem = ordenacao('depoimentos', paraDepoimento);
export const listarDepoimentos = ordem.listar;
export const removerDepoimento = ordem.remover;
export const restaurarDepoimento = ordem.restaurar;
export const moverDepoimento = ordem.mover;

const limpar = v => String(v ?? '').replace(/\s+/g, ' ').trim();

function validarTexto(valor, max, nome, { obrigatorio = false } = {}) {
  const texto = limpar(valor);
  if (obrigatorio && !texto) throw new ErroApi(400, 'texto_invalido', `Escreva ${nome}.`);
  if (texto.length > max) throw new ErroApi(400, 'texto_invalido', `${nome[0].toUpperCase()}${nome.slice(1)} pode ter até ${max} letras; este tem ${texto.length}.`);
  return texto;
}

function validarServico(valor) {
  const s = limpar(valor);
  if (s && !SERVICOS.has(s)) throw new ErroApi(400, 'texto_invalido', 'Escolha um dos serviços do site ou deixe sem serviço.');
  return s;
}

function validarLado(valor, nome) {
  const n = typeof valor === 'string' ? Number(valor) : valor;
  if (!Number.isInteger(n) || n < 1 || n > MAX_LADO) throw new ErroApi(400, 'foto_invalida', `Não deu para ler o tamanho da foto (${nome}). Escolha a foto de novo.`);
  return n;
}

export function consentimentoDado(valor) {
  return valor === true || valor === 'true' || valor === '1' || valor === 'sim' || valor === 'on';
}

// Puro: devolve os campos limpos ou lança o 400 com a mensagem para a Kari.
// `foto` = { bytes, tipo, largura, altura } já lida do multipart, ou nada.
export function validarDepoimento({ nome, de_onde, texto, servico, consentimento, foto } = {}) {
  const dados = {
    nome: validarTexto(nome, MAX_NOME, 'o nome da cliente', { obrigatorio: true }),
    de_onde: validarTexto(de_onde, MAX_DE_ONDE, 'o "de onde"'),
    texto: validarTexto(texto, MAX_TEXTO, 'o depoimento', { obrigatorio: true }),
    servico: validarServico(servico),
    consentimento: consentimentoDado(consentimento),
    foto: null,
  };
  if (foto) {
    if (!dados.consentimento) throw new ErroApi(400, 'texto_invalido', 'Marque que a cliente autorizou antes de publicar a foto.');
    dados.foto = { bytes: foto.bytes, tipo: foto.tipo, largura: validarLado(foto.largura, 'largura'), altura: validarLado(foto.altura, 'altura') };
  }
  return dados;
}

// Ordem: validar tudo → put no R2 (chave derivada do id) → INSERT. Se o INSERT falhar, o objeto é apagado
// no catch (no finally apagaria no sucesso). O id nasce aqui, então repetir o POST cria outro depoimento.
export async function criarDepoimento(env, entrada) {
  const d = validarDepoimento(entrada);
  const id = novoId('dep');
  const chave = d.foto ? `dep/${id}.${d.foto.tipo.split('/')[1].replace('jpeg', 'jpg')}` : null;
  const linha = {
    id, ordem: await ordem.proximaOrdem(env), nome: d.nome, de_onde: d.de_onde, texto: d.texto, servico: d.servico,
    foto_chave: chave, largura: d.foto?.largura ?? null, altura: d.foto?.altura ?? null,
    consentimento_em: d.consentimento ? agora() : null, criado_em: agora(),
  };
  if (chave) await env.FOTOS.put(chave, d.foto.bytes, { httpMetadata: { contentType: d.foto.tipo } });
  try {
    await env.DB.prepare(
      'INSERT INTO depoimentos (id, ordem, nome, de_onde, texto, servico, foto_chave, largura, altura, consentimento_em, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(linha.id, linha.ordem, linha.nome, linha.de_onde, linha.texto, linha.servico, linha.foto_chave, linha.largura, linha.altura, linha.consentimento_em, linha.criado_em).run();
  } catch (e) {
    console.error('INSERT em depoimentos falhou; apagando a foto do R2', e?.stack || e);
    if (chave) await env.FOTOS.delete(chave).catch(err => console.error('não deu para apagar a foto órfã', chave, err));
    throw new ErroApi(500, 'erro_interno', 'Não deu para salvar o depoimento. Tente de novo.');
  }
  return paraDepoimento(linha);
}

// PATCH parcial: nome, de_onde, texto e servico; a foto não muda (tire e cadastre de novo).
export async function editarDepoimento(env, id, campos) {
  const l = await ordem.buscar(env, id);
  const novo = { nome: l.nome, de_onde: l.de_onde || '', texto: l.texto, servico: l.servico || '' };
  if ('nome' in campos) novo.nome = validarTexto(campos.nome, MAX_NOME, 'o nome da cliente', { obrigatorio: true });
  if ('de_onde' in campos) novo.de_onde = validarTexto(campos.de_onde, MAX_DE_ONDE, 'o "de onde"');
  if ('texto' in campos) novo.texto = validarTexto(campos.texto, MAX_TEXTO, 'o depoimento', { obrigatorio: true });
  if ('servico' in campos) novo.servico = validarServico(campos.servico);
  await env.DB.prepare('UPDATE depoimentos SET nome = ?, de_onde = ?, texto = ?, servico = ? WHERE id = ?')
    .bind(novo.nome, novo.de_onde, novo.texto, novo.servico, id).run();
  return paraDepoimento({ ...l, ...novo });
}
