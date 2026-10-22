import conteudo from '../conteudo.json' with { type: 'json' };
import { template } from './template.js';
import { agruparProdutos, textoPreco, textoDisponibilidade } from './produtos.js';
import { CONDICOES_VAZIAS, ROTULOS_CONDICOES } from './config.js';

// Nome de cor estilo cartela Pantone para cada serviço.
// `var` é o nome da cor em public/site.css; `curto` vai no leque, `legenda` nos botões do celular.
const AMOSTRAS = {
  consultoria: { kg: 'KG 01', nome: 'Roxo Autêntico', cor: '#8D51FF', var: 'roxo', escuro: false, curto: 'Consultoria', legenda: 'Consultoria de estilo' },
  edicao: { kg: 'KG 02', nome: 'Vermelho Armário', cor: '#C52118', var: 'vermelho', escuro: false, curto: 'Edição', legenda: 'Edição de guarda-roupa' },
  'oficina-look': { kg: 'KG 03', nome: 'Mostarda Oficina', cor: '#FEBC5C', var: 'mostarda', escuro: true, curto: 'Oficina de Look', legenda: 'Oficina de Look' },
  styling: { kg: 'KG 04', nome: 'Pink Produção', cor: '#E5196E', var: 'pink', escuro: false, curto: 'Styling', legenda: 'Styling e produção' },
  vm: { kg: 'KG 05', nome: 'Verde Vitrine', cor: '#017F38', var: 'verde', escuro: false, curto: 'Vitrines', legenda: 'Vitrines e VM' },
  ensino: { kg: 'KG 06', nome: 'Grafite Aula', cor: '#2A2730', var: 'grafite', escuro: false, curto: 'Cursos', legenda: 'Cursos e palestras' },
};
const ORDEM_SERVICOS = ['consultoria', 'edicao', 'oficina-look', 'styling', 'vm', 'ensino'];

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ESCAPES[c]);

// ---------- WhatsApp ----------
// Mensagens por intenção (R-01): a cliente chega na conversa já dizendo o que quer.
export const MENSAGENS_WA = {
  geral: 'Oi Kari, vi o site e quero conversar',
  servico: titulo => `Oi Kari, vi o site e quero saber sobre ${titulo}`,
  produto: titulo => `Oi Kari, quero encomendar ${titulo}`,
  lalaia: 'Oi Kari, quero encomendar uma peça da LALAIÁ',
};

let avisouNumero = false;
// Aceita o número com máscara ("+55 (48) 99845-9412"); vazio ou curto cai no número de conteudo.json,
// avisando uma vez no log. Nunca gera "wa.me/?text=".
export function linkWa(numero, mensagem) {
  let digitos = String(numero ?? '').replace(/\D/g, '');
  if (digitos.length < 10) {
    if (!avisouNumero) { console.warn('WHATSAPP_NUMERO ausente ou inválido; usando marca.whatsapp_numero de conteudo.json'); avisouNumero = true; }
    digitos = String(conteudo.marca.whatsapp_numero).replace(/\D/g, '');
  }
  return `https://wa.me/${digitos}?text=${encodeURIComponent(mensagem)}`;
}

// R-02: com preço, "A partir de R$ 380"; sem preço, lojas/escolas mostram "Valor sob consulta" e "Para você" não mostra nada.
const GRUPOS_SOB_CONSULTA = new Set(['lojas', 'ensino']);
export function textoDoPreco(preco, grupo) {
  if (Number.isInteger(preco) && preco > 0) return { rotulo: 'A partir de', valor: `R$ ${preco.toLocaleString('pt-BR')}` };
  if (GRUPOS_SOB_CONSULTA.has(grupo)) return { rotulo: 'Valor sob consulta', valor: '' };
  return null;
}

// Junta o conteúdo fixo (conteudo.json) com o que a Kari muda no painel (fotos e textos).
export function montarDados({ itens = [], textos = {}, produtos: linhasProdutos = [], condicoes, whatsappNumero } = {}) {
  const porSecao = new Map();
  for (const it of itens) porSecao.set(it.secao, [...(porSecao.get(it.secao) || []), it]);
  const grupos = new Map(conteudo.grupos_servicos.map(g => [g.id, g.titulo]));
  const wa = mensagem => linkWa(whatsappNumero, mensagem);

  const servicos = ORDEM_SERVICOS.map(id => conteudo.servicos.find(s => s.id === id)).filter(Boolean).map(s => ({
    ...s,
    ...AMOSTRAS[s.id],
    resumo: textos[s.id]?.resumo ?? s.resumo,
    para_quem: textos[s.id]?.para_quem ?? s.para_quem,
    preco: textoDoPreco(textos[s.id]?.preco, s.grupo),
    grupo_nome: grupos.get(s.grupo),
    fotos: porSecao.get(s.id) || [],
    wa: wa(MENSAGENS_WA.servico(s.titulo)),
  }));

  // Só produtos com foto vão para o site; os dados de um produto sem fotos ficam guardados (ENG-20).
  const produtos = agruparProdutos(porSecao.get('lalaia') || [], linhasProdutos)
    .filter(p => p.fotos.length)
    .map(p => ({ ...p, preco_texto: textoPreco(p.preco), disponibilidade_texto: textoDisponibilidade(p), wa: wa(MENSAGENS_WA.produto(p.titulo)) }));

  // Condições de "Como encomendar" (R-03): só as preenchidas vão para o site, na ordem dos rótulos.
  const cond = { ...CONDICOES_VAZIAS, ...(condicoes || {}) };
  const listaCondicoes = Object.entries(ROTULOS_CONDICOES).filter(([campo]) => cond[campo]).map(([campo, rotulo]) => ({ rotulo, texto: cond[campo] }));

  return {
    marca: { ...conteudo.marca, gbp_url: cond.gbp_url },
    whatsapp: { geral: wa(MENSAGENS_WA.geral) },
    hero: conteudo.hero,
    servicos,
    grupos: conteudo.grupos_servicos,
    como_trabalhar: conteudo.como_trabalhar,
    sobre: { ...conteudo.sobre, fotos: porSecao.get('sobre') || [] },
    lalaia: { ...conteudo.lalaia, produtos, condicoes: listaCondicoes, wa: wa(MENSAGENS_WA.lalaia) },
    ensino_realizado: conteudo.ensino_realizado,
  };
}

export function renderizarSite(entrada) {
  return template(montarDados(entrada), esc);
}
