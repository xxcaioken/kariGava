import conteudo from '../conteudo.json';
import { template } from './template.js';

// Nome de cor estilo cartela Pantone para cada serviço.
const AMOSTRAS = {
  consultoria: { kg: 'KG 01', nome: 'Roxo Autêntico', cor: '#8D51FF', texto: '#FFFFFF' },
  edicao: { kg: 'KG 02', nome: 'Vermelho Armário', cor: '#C52118', texto: '#FFFFFF' },
  'oficina-look': { kg: 'KG 03', nome: 'Mostarda Oficina', cor: '#FEBC5C', texto: '#141218' },
  styling: { kg: 'KG 04', nome: 'Pink Produção', cor: '#E5196E', texto: '#FFFFFF' },
  vm: { kg: 'KG 05', nome: 'Verde Vitrine', cor: '#017F38', texto: '#FFFFFF' },
  ensino: { kg: 'KG 06', nome: 'Grafite Aula', cor: '#2A2730', texto: '#FFFFFF' },
};
const ORDEM_SERVICOS = ['consultoria', 'edicao', 'oficina-look', 'styling', 'vm', 'ensino'];

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ESCAPES[c]);

// Junta o conteúdo fixo (conteudo.json) com o que a Kari muda no painel (fotos e textos).
export function montarDados({ itens, textos, whatsapp }) {
  const porSecao = new Map();
  for (const it of itens) porSecao.set(it.secao, [...(porSecao.get(it.secao) || []), it]);
  const grupos = new Map(conteudo.grupos_servicos.map(g => [g.id, g.titulo]));

  const servicos = ORDEM_SERVICOS.map(id => conteudo.servicos.find(s => s.id === id)).filter(Boolean).map(s => ({
    ...s,
    ...AMOSTRAS[s.id],
    resumo: textos[s.id]?.resumo ?? s.resumo,
    para_quem: textos[s.id]?.para_quem ?? s.para_quem,
    grupo_nome: grupos.get(s.grupo),
    fotos: porSecao.get(s.id) || [],
  }));

  return {
    marca: conteudo.marca,
    whatsapp: whatsapp || conteudo.marca.whatsapp,
    hero: conteudo.hero,
    servicos,
    grupos: conteudo.grupos_servicos,
    sobre: { ...conteudo.sobre, fotos: porSecao.get('sobre') || [] },
    lalaia: { ...conteudo.lalaia, fotos: porSecao.get('lalaia') || [] },
    ensino_realizado: conteudo.ensino_realizado,
  };
}

export function renderizarSite(entrada) {
  return template(montarDados(entrada), esc);
}
