// Antes e depois (R-05): pares de fotos de vitrines, looks e armários. Um par só vai ao ar com as duas fotos
// e com a autorização da cliente marcada pela Kari.
import conteudo from '../conteudo.json' with { type: 'json' };
import { ErroApi, agora, novoId } from './util.js';
import { urlFoto } from './itens.js';
import { ordenacao } from './ordenacao.js';
import { consentimentoDado } from './depoimentos.js';

const MAX_LEGENDA = 120;
const MAX_LADO = 10000;
export const SERVICOS_PAR = ['vm', 'styling', 'edicao'];
const NOMES_SERVICO = new Map(conteudo.servicos.map(s => [s.id, s.titulo]));

export function paraPar(l) {
  return {
    id: l.id, ordem: l.ordem, legenda: l.legenda || '', servico: l.servico,
    antes_url: urlFoto(l.antes_chave), depois_url: urlFoto(l.depois_chave),
    largura_antes: l.largura_antes, altura_antes: l.altura_antes, largura_depois: l.largura_depois, altura_depois: l.altura_depois,
    consentimento_em: l.consentimento_em,
  };
}

const ordem = ordenacao('antes_depois', paraPar);
export const listarPares = ordem.listar;
export const removerPar = ordem.remover;
export const restaurarPar = ordem.restaurar;
export const moverPar = ordem.mover;

const limpar = v => String(v ?? '').replace(/\s+/g, ' ').trim();

function validarLegenda(valor) {
  const legenda = limpar(valor);
  if (legenda.length > MAX_LEGENDA) throw new ErroApi(400, 'texto_invalido', `A legenda pode ter até ${MAX_LEGENDA} letras; esta tem ${legenda.length}.`);
  return legenda;
}

function validarServico(valor) {
  const s = limpar(valor);
  if (!SERVICOS_PAR.includes(s)) {
    throw new ErroApi(400, 'texto_invalido', `Escolha o serviço do par: ${SERVICOS_PAR.map(id => NOMES_SERVICO.get(id)).join(', ')}.`);
  }
  return s;
}

function validarLado(valor, nome) {
  const n = typeof valor === 'string' ? Number(valor) : valor;
  if (!Number.isInteger(n) || n < 1 || n > MAX_LADO) throw new ErroApi(400, 'foto_invalida', `Não deu para ler o tamanho da foto de ${nome}. Escolha a foto de novo.`);
  return n;
}

function validarFoto(foto, nome) {
  if (!foto) throw new ErroApi(400, 'foto_invalida', `Falta a foto de ${nome}. O par precisa das duas fotos.`);
  return { bytes: foto.bytes, tipo: foto.tipo, largura: validarLado(foto.largura, nome), altura: validarLado(foto.altura, nome) };
}

// Puro: devolve os campos limpos ou lança o 400 com a mensagem para a Kari.
// `antes`/`depois` = { bytes, tipo, largura, altura } já lidos do multipart.
export function validarPar({ legenda, servico, consentimento, antes, depois } = {}) {
  const dados = { legenda: validarLegenda(legenda), servico: validarServico(servico), antes: validarFoto(antes, 'Antes'), depois: validarFoto(depois, 'Depois') };
  if (!consentimentoDado(consentimento)) throw new ErroApi(400, 'foto_invalida', 'Marque que a cliente autorizou antes de publicar as fotos.');
  return dados;
}

const extensao = tipo => tipo.split('/')[1].replace('jpeg', 'jpg');

// Ordem: validar as duas → 2 put no R2 (chaves derivadas do id do par) → INSERT. Falha em qualquer passo apaga
// o que já subiu, no catch. O id nasce aqui: repetir o POST cria outro par.
export async function criarPar(env, entrada) {
  const d = validarPar(entrada);
  const id = novoId('ad');
  const chaves = { antes: `ad/${id}-antes.${extensao(d.antes.tipo)}`, depois: `ad/${id}-depois.${extensao(d.depois.tipo)}` };
  const subidas = [];
  try {
    for (const lado of ['antes', 'depois']) {
      await env.FOTOS.put(chaves[lado], d[lado].bytes, { httpMetadata: { contentType: d[lado].tipo } });
      subidas.push(chaves[lado]);
    }
    const linha = {
      id, ordem: await ordem.proximaOrdem(env), legenda: d.legenda, servico: d.servico,
      antes_chave: chaves.antes, depois_chave: chaves.depois,
      largura_antes: d.antes.largura, altura_antes: d.antes.altura, largura_depois: d.depois.largura, altura_depois: d.depois.altura,
      consentimento_em: agora(), criado_em: agora(),
    };
    await env.DB.prepare(
      `INSERT INTO antes_depois (id, ordem, legenda, servico, antes_chave, depois_chave, largura_antes, altura_antes, largura_depois, altura_depois, consentimento_em, criado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(linha.id, linha.ordem, linha.legenda, linha.servico, linha.antes_chave, linha.depois_chave, linha.largura_antes, linha.altura_antes, linha.largura_depois, linha.altura_depois, linha.consentimento_em, linha.criado_em).run();
    return paraPar(linha);
  } catch (e) {
    console.error('criar par antes/depois falhou; apagando o que subiu', subidas, e?.stack || e);
    for (const chave of subidas) await env.FOTOS.delete(chave).catch(err => console.error('não deu para apagar a foto órfã', chave, err));
    throw new ErroApi(500, 'erro_interno', 'Não deu para salvar o par. Tente de novo.');
  }
}

// PATCH parcial: legenda e serviço; as fotos não mudam (tire o par e cadastre de novo).
export async function editarPar(env, id, campos) {
  const l = await ordem.buscar(env, id);
  const novo = { legenda: l.legenda || '', servico: l.servico };
  if ('legenda' in campos) novo.legenda = validarLegenda(campos.legenda);
  if ('servico' in campos) novo.servico = validarServico(campos.servico);
  await env.DB.prepare('UPDATE antes_depois SET legenda = ?, servico = ? WHERE id = ?').bind(novo.legenda, novo.servico, id).run();
  return paraPar({ ...l, ...novo });
}
