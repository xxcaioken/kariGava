// Perguntas frequentes (R-06): a Kari edita, publica e ordena no painel; o site só mostra as publicadas,
// agrupadas na ordem dos grupos abaixo. Some sem pergunta publicada.
import { ErroApi, agora, novoId } from './util.js';
import { ordenacao } from './ordenacao.js';

const MAX_PERGUNTA = 140;
const MAX_RESPOSTA = 600;
export const GRUPOS_FAQ = { voce: 'Para você', lojas: 'Para lojas e escolas', lalaia: 'LALAIÁ' };

export function paraFaq(l) {
  return { id: l.id, ordem: l.ordem, grupo: l.grupo, pergunta: l.pergunta, resposta: l.resposta, publicada: l.publicada === 1 || l.publicada === true, revisada: l.revisada === 1 || l.revisada === true };
}

const ordem = ordenacao('faq', paraFaq);
export const listarFaq = ordem.listar;
export const removerFaq = ordem.remover;
export const restaurarFaq = ordem.restaurar;
export const moverFaq = ordem.mover;

const limpar = v => String(v ?? '').replace(/\s+/g, ' ').trim();

function validarTexto(valor, max, nome) {
  const texto = limpar(valor);
  if (!texto) throw new ErroApi(400, 'faq_invalida', `Escreva a ${nome}.`);
  if (texto.length > max) throw new ErroApi(400, 'faq_invalida', `A ${nome} pode ter até ${max} letras; esta tem ${texto.length}.`);
  return texto;
}

// Puro: PUT parcial (ausente mantém). Devolve os campos limpos ou lança o 400 com a mensagem para a Kari.
export function validarFaq(atual, campos) {
  if (!campos || typeof campos !== 'object' || Array.isArray(campos)) throw new ErroApi(400, 'faq_invalida', 'Mande a pergunta como campos de texto.');
  const novo = { pergunta: atual.pergunta, resposta: atual.resposta, grupo: atual.grupo, publicada: Boolean(atual.publicada) };
  for (const [campo, valor] of Object.entries(campos)) {
    if (campo === 'pergunta') novo.pergunta = validarTexto(valor, MAX_PERGUNTA, 'pergunta');
    else if (campo === 'resposta') novo.resposta = validarTexto(valor, MAX_RESPOSTA, 'resposta');
    else if (campo === 'grupo') {
      if (!GRUPOS_FAQ[valor]) throw new ErroApi(400, 'faq_invalida', `Escolha o grupo da pergunta: ${Object.values(GRUPOS_FAQ).join(', ')}.`);
      novo.grupo = valor;
    } else if (campo === 'publicada') {
      if (typeof valor !== 'boolean') throw new ErroApi(400, 'faq_invalida', 'A pergunta só pode estar publicada ou não.');
      novo.publicada = valor;
    } else throw new ErroApi(400, 'faq_invalida', `Não existe o campo "${campo}" na pergunta.`);
  }
  return novo;
}

// Só publicadas, na ordem dos grupos do site; grupo sem pergunta publicada some.
export function agruparFaq(lista) {
  return Object.entries(GRUPOS_FAQ)
    .map(([id, titulo]) => ({ id, titulo, perguntas: lista.filter(f => f.publicada && f.grupo === id) }))
    .filter(g => g.perguntas.length);
}

// Pergunta nova da Kari nasce despublicada (ela liga quando quiser) e já revisada (foi ela que escreveu).
export async function criarFaq(env, campos) {
  const d = validarFaq({ pergunta: '', resposta: '', grupo: 'voce', publicada: false }, { pergunta: campos?.pergunta, resposta: campos?.resposta, grupo: campos?.grupo ?? 'voce', ...('publicada' in (campos || {}) ? { publicada: campos.publicada } : {}) });
  const linha = { id: novoId('faq'), ordem: await ordem.proximaOrdem(env), ...d, revisada: true, criado_em: agora() };
  await env.DB.prepare('INSERT INTO faq (id, ordem, grupo, pergunta, resposta, publicada, revisada, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(linha.id, linha.ordem, linha.grupo, linha.pergunta, linha.resposta, linha.publicada ? 1 : 0, 1, linha.criado_em).run();
  return paraFaq(linha);
}

// PUT parcial. Mexer no texto (pergunta ou resposta) marca como revisada; só publicar não.
export async function salvarFaq(env, id, campos) {
  const l = await ordem.buscar(env, id);
  const novo = validarFaq(paraFaq(l), campos);
  const revisada = l.revisada === 1 || 'pergunta' in campos || 'resposta' in campos;
  await env.DB.prepare('UPDATE faq SET grupo = ?, pergunta = ?, resposta = ?, publicada = ?, revisada = ? WHERE id = ?')
    .bind(novo.grupo, novo.pergunta, novo.resposta, novo.publicada ? 1 : 0, revisada ? 1 : 0, id).run();
  return paraFaq({ ...l, ...novo, revisada });
}
