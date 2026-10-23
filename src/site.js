import conteudo from '../conteudo.json' with { type: 'json' };
import { template } from './template.js';
import { agruparProdutos, textoPreco, textoDisponibilidade } from './produtos.js';
import { CONDICOES_VAZIAS, ROTULOS_CONDICOES, cupomVigente } from './config.js';
import { agruparFaq } from './faq.js';
import { variantesDaFotoInicial } from './variantes.js';
import { beaconAnalytics } from './analytics.js';

// Fotos iniciais (public/img) ganham as variantes de variantes.json; as do R2 já trazem as suas do banco.
function comVariantes(foto) {
  const v = variantesDaFotoInicial(foto.foto_url);
  return v ? { ...foto, variantes: { larguras: v.larguras, webp: v.webp }, largura: v.largura, altura: v.altura } : foto;
}

// Nomes curtos de cada serviço: `curto` vai no leque, `legenda` na lista do celular.
const NOMES_CURTOS = {
  consultoria: { curto: 'Consultoria', legenda: 'Consultoria de estilo' },
  styling: { curto: 'Styling', legenda: 'Styling e produção' },
  vm: { curto: 'Vitrines', legenda: 'Vitrines e VM' },
  ensino: { curto: 'Cursos', legenda: 'Cursos e palestras' },
};
export const ORDEM_SERVICOS = ['consultoria', 'styling', 'vm', 'ensino'];
// Serviços que viraram parte de outro (migration 0010): o endereço antigo (#id) continua levando ao cartão que os absorveu.
export const ANCORAS_ANTIGAS = { consultoria: ['edicao'], ensino: ['oficina-look'] };

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
export function montarDados({ itens = [], textos = {}, produtos: linhasProdutos = [], condicoes, cupom, depoimentos = [], antesDepois = [], faq = [], whatsappNumero, base = '', analyticsToken = '' } = {}) {
  const porSecao = new Map();
  for (const it of itens.map(comVariantes)) porSecao.set(it.secao, [...(porSecao.get(it.secao) || []), it]);
  const grupos = new Map(conteudo.grupos_servicos.map(g => [g.id, g.titulo]));
  const wa = mensagem => linkWa(whatsappNumero, mensagem);
  // Cupom (R-08): só vigente vai para o site; ligado, os botões da LALAIÁ já chegam com o código na mensagem.
  const cupomSite = cupomVigente(cupom) ? { codigo: cupom.codigo, desconto: cupom.desconto } : null;
  const waLalaia = mensagem => wa(cupomSite ? `${mensagem} · cupom ${cupomSite.codigo}` : mensagem);

  const servicos = ORDEM_SERVICOS.map(id => conteudo.servicos.find(s => s.id === id)).filter(Boolean).map(s => ({
    ...s,
    ...NOMES_CURTOS[s.id],
    resumo: textos[s.id]?.resumo ?? s.resumo,
    para_quem: textos[s.id]?.para_quem ?? s.para_quem,
    preco: textoDoPreco(textos[s.id]?.preco, s.grupo),
    grupo_nome: grupos.get(s.grupo),
    fotos: porSecao.get(s.id) || [],
    ancoras: ANCORAS_ANTIGAS[s.id] || [],
    wa: wa(MENSAGENS_WA.servico(s.titulo)),
  }));

  // Só produtos com foto vão para o site; os dados de um produto sem fotos ficam guardados (ENG-20).
  const produtos = agruparProdutos(porSecao.get('lalaia') || [], linhasProdutos)
    .filter(p => p.fotos.length)
    .map(p => ({ ...p, preco_texto: textoPreco(p.preco), disponibilidade_texto: textoDisponibilidade(p), wa: waLalaia(MENSAGENS_WA.produto(p.titulo)) }));

  // Depoimentos (R-04) e antes e depois (R-05): o serviço vira o nome dele.
  const nomeDoServico = id => servicos.find(s => s.id === id)?.titulo || '';
  const listaDepoimentos = depoimentos.map(d => ({ ...d, servico_nome: nomeDoServico(d.servico), inicial: [...(d.nome || '?')][0].toUpperCase() }));
  const pares = antesDepois.map(p => ({ ...p, servico_nome: nomeDoServico(p.servico) }));

  // Condições de "Como encomendar" (R-03): só as preenchidas vão para o site, na ordem dos rótulos.
  const cond = { ...CONDICOES_VAZIAS, ...(condicoes || {}) };
  const listaCondicoes = Object.entries(ROTULOS_CONDICOES).filter(([campo]) => cond[campo]).map(([campo, rotulo]) => ({ rotulo, texto: cond[campo] }));

  return {
    base: String(base || '').replace(/\/+$/, ''),
    analytics: beaconAnalytics(analyticsToken),
    marca: { ...conteudo.marca, gbp_url: cond.gbp_url },
    whatsapp: { geral: wa(MENSAGENS_WA.geral), numero: whatsappNumero },
    hero: { ...conteudo.hero, foto_item: comVariantes({ foto_url: `/${conteudo.hero.foto}`, titulo: conteudo.marca.nome }) },
    servicos,
    grupos: conteudo.grupos_servicos,
    como_trabalhar: conteudo.como_trabalhar,
    depoimentos: listaDepoimentos,
    antes_depois: pares,
    faq: agruparFaq(faq),
    sobre: { ...conteudo.sobre, fotos: porSecao.get('sobre') || [] },
    lalaia: { ...conteudo.lalaia, produtos, condicoes: listaCondicoes, cupom: cupomSite, wa: waLalaia(MENSAGENS_WA.lalaia) },
    ensino_realizado: conteudo.ensino_realizado,
  };
}

export function renderizarSite(entrada) {
  return template(montarDados(entrada), esc);
}
