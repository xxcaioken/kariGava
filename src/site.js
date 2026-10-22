import conteudo from '../conteudo.json';
import { template } from './template.js';

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
    como_trabalhar: conteudo.como_trabalhar,
    sobre: { ...conteudo.sobre, fotos: porSecao.get('sobre') || [] },
    lalaia: { ...conteudo.lalaia, produtos: agruparProdutos(porSecao.get('lalaia') || []) },
    ensino_realizado: conteudo.ensino_realizado,
  };
}

// Fotos da LALAIÁ com o mesmo nome viram um produto só (na ordem da 1ª foto).
// Se o nome bater com uma linha de conteudo.json, o produto ganha a descrição dela.
function agruparProdutos(fotos) {
  const linhas = new Map(conteudo.lalaia.linhas.map(l => [l.titulo.toLowerCase(), l]));
  const produtos = new Map();
  for (const f of fotos) {
    const chave = (f.titulo || '').trim().toLowerCase() || `sem-nome-${f.id}`;
    if (!produtos.has(chave)) {
      const linha = linhas.get(chave);
      produtos.set(chave, { titulo: f.titulo, rotulo: linha?.rotulo || 'Produto', texto: linha?.texto || '', cta: linha?.cta || 'Encomendar', fotos: [] });
    }
    produtos.get(chave).fotos.push(f);
  }
  return [...produtos.values()];
}

export function renderizarSite(entrada) {
  return template(montarDados(entrada), esc);
}
