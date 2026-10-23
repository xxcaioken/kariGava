// Correções da 1ª rodada de code review da PR #3 (ajustes da Kari).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { corDestaque } from '../../src/marca.js';
import { renderizarLalaia } from '../../src/lalaia.js';
import { dadosDaPagina } from '../../src/dados.js';
import conteudo from '../../conteudo.json' with { type: 'json' };

const ler = caminho => readFileSync(new URL(`../../${caminho}`, import.meta.url), 'utf8');

test('review-r1 S-08: "Ver no site" depois de salvar produto, renomear ou condições abre a /lalaia', () => {
  const painel = ler('public/painel/painel.js');
  for (const toast of ["'Produto salvo'", '`Produto renomeado para "${limpo}"`', "'Condições salvas'"]) {
    const linha = painel.split('\n').find(l => l.includes(`mostrarToast(${toast}`));
    assert.ok(linha, `toast ${toast}`);
    assert.match(linha, /verSite: '\/lalaia'/, `toast ${toast} leva à /lalaia`);
  }
  assert.match(painel, /typeof verSite === 'string' \? verSite :/, 'mostrarToast aceita o caminho');
});

test('review-r1 S-09: cor de destaque clara demais para texto branco cai na tinta', () => {
  assert.equal(corDestaque('#C52118'), '#C52118', 'vermelho (5,8:1) passa');
  assert.equal(corDestaque('#FEBC5C'), '#141218', 'mostarda (1,8:1) cai na tinta');
  assert.equal(corDestaque('vermelho'), '#141218', 'formato inválido cai na tinta');
  assert.equal(corDestaque(), conteudo.marca.cor_destaque, 'sem argumento usa o conteudo.json');
});

test('review-r1 S-10: /lalaia só consulta o que mostra e o JSON-LD tem o nó do vendedor', async () => {
  const consultas = [];
  const db = {
    prepare(sql) {
      consultas.push(sql);
      const q = { bind: () => q, all: async () => ({ results: [] }), first: async () => null, run: async () => ({}) };
      return q;
    },
  };
  await dadosDaPagina({ DB: db }, '/lalaia');
  const tabelas = consultas.join('\n');
  for (const t of ['depoimentos', 'antes_depois', 'faq', 'FROM textos']) assert.ok(!tabelas.includes(t), `/lalaia não consulta ${t}`);
  consultas.length = 0;
  await dadosDaPagina({ DB: db }, '/');
  for (const t of ['depoimentos', 'antes_depois', 'faq', 'FROM textos']) assert.ok(consultas.join('\n').includes(t), `a home consulta ${t}`);

  const base = 'https://exemplo.com.br';
  const html = renderizarLalaia({ itens: [{ id: 'l0', secao: 'lalaia', ordem: 0, titulo: 'Xuxona', foto_url: '/img/lalaia-scrunchie.jpg', origem: 'inicial' }], produtos: [{ slug: 'xuxona', preco: 65, disponibilidade: 'encomenda' }], whatsappNumero: '5548998459412', base });
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const ids = new Set(ld['@graph'].map(n => n['@id']).filter(Boolean));
  const vendedores = ld['@graph'].flatMap(n => (n.offers?.seller ? [n.offers.seller['@id']] : []));
  assert.ok(vendedores.length, 'há oferta com vendedor');
  for (const v of vendedores) assert.ok(ids.has(v), `o vendedor ${v} existe na página`);
});

test('review-r1 S-11: textos escritos por nós ficam no conteudo.json como rascunho; sem CSS morto', () => {
  const l = conteudo.lalaia;
  assert.equal(l.como_encomendar_intro?.rascunho, true, 'frase de "Como encomendar" em conteudo.json, como rascunho');
  assert.equal(l.quem_faz?.rascunho, true, '"Quem faz" em conteudo.json, como rascunho');
  assert.equal(conteudo.hero.rascunho, true, 'subtítulo do hero marcado como rascunho');
  const fonte = ler('src/lalaia.js');
  assert.ok(!fonte.includes('Tudo pelo WhatsApp') && !fonte.includes('é a marca de acessórios'), 'nenhum texto nosso cravado no template');
  const html = renderizarLalaia({ itens: [], whatsappNumero: '5548998459412' });
  assert.ok(html.includes(l.como_encomendar_intro.texto) && html.includes(l.quem_faz.texto), 'a página mostra os textos do conteudo.json');
  assert.ok(!/\.detalhes\b/.test(ler('public/site.css')), 'sem as regras .detalhes, que nada usa');
  const pend = ler('docs/PENDENCIAS.md');
  assert.ok(pend.includes('Subtítulo do topo') || pend.includes('subtítulo do topo'), 'PENDENCIAS lista o subtítulo do hero');
});
