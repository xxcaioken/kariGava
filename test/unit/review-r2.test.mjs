// Correções da 2ª rodada de code review da PR #3 (ajustes da Kari).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderizarSite } from '../../src/site.js';
import { renderizarLalaia } from '../../src/lalaia.js';
import { dadosDaPagina } from '../../src/dados.js';
import conteudo from '../../conteudo.json' with { type: 'json' };

const NUMERO = '5548998459412';
const itens = [{ id: 'l0', secao: 'lalaia', ordem: 0, titulo: 'Xuxona', foto_url: '/img/lalaia-scrunchie.jpg', origem: 'inicial' }];
const produtos = [{ slug: 'xuxona', preco: 65, disponibilidade: 'encomenda' }];
const grafo = html => JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];

test('review-r2 S-14: produtos e preços só no JSON-LD da /lalaia, onde aparecem', () => {
  const home = grafo(renderizarSite({ itens, produtos, whatsappNumero: NUMERO }));
  assert.ok(!home.some(n => n['@type'] === 'Product'), 'home sem Product (não mostra preço nem descrição)');
  assert.ok(home.some(n => n['@type'] === 'ProfessionalService') && home.some(n => n['@type'] === 'Person'), 'home com o negócio e a Kari');
  assert.ok(grafo(renderizarLalaia({ itens, produtos, whatsappNumero: NUMERO })).some(n => n['@type'] === 'Product' && n.offers?.price === 65), '/lalaia com o produto e o preço');
});

test('review-r2 S-15: links antigos #cupom e #como-encomendar caem no bloco da LALAIÁ da home', () => {
  const home = renderizarSite({ itens, produtos, whatsappNumero: NUMERO });
  const bloco = home.slice(home.indexOf('<section class="secao" id="lalaia"'), home.indexOf('id="cursos"'));
  for (const id of ['cupom', 'como-encomendar']) assert.ok(bloco.includes(`<span class="ancora" id="${id}"></span>`), `#${id} dentro do bloco da LALAIÁ`);
  assert.ok(bloco.includes('href="/lalaia"'), 'o bloco leva à /lalaia');
});

test('review-r2 S-16: cada página lê só o que mostra (home sem cupom; /lalaia só as fotos da LALAIÁ)', async () => {
  const consultas = [];
  const db = {
    prepare(sql) {
      const q = { sql, args: [], bind: (...a) => { q.args = a; return q; }, all: async () => ({ results: [] }), first: async () => null, run: async () => ({}) };
      consultas.push(q);
      return q;
    },
  };
  await dadosDaPagina({ DB: db }, '/');
  assert.ok(!consultas.some(q => q.args.includes('cupom')), 'home não lê o cupom');
  assert.ok(consultas.some(q => q.args.includes('gbp_url')), 'home lê as condições (link das avaliações no Google)');
  consultas.length = 0;
  await dadosDaPagina({ DB: db }, '/lalaia');
  const fotos = consultas.filter(q => /FROM itens/.test(q.sql));
  assert.ok(fotos.length && fotos.every(q => /WHERE secao = \?/.test(q.sql) && q.args[0] === 'lalaia'), '/lalaia lê só as fotos da seção lalaia');
  assert.ok(consultas.some(q => q.args.includes('cupom')), '/lalaia lê o cupom');
});

test('review-r2 S-17: título e rodapé da /lalaia vêm do conteudo.json; worker sem import morto', () => {
  const fonte = readFileSync(new URL('../../src/lalaia.js', import.meta.url), 'utf8');
  assert.ok(!/feitos à mão/i.test(fonte), 'nenhum "feitos à mão" cravado no template');
  const html = renderizarLalaia({ itens, produtos, whatsappNumero: NUMERO });
  const [primeiro] = conteudo.lalaia.detalhes;
  assert.ok(html.includes(`<title>${conteudo.lalaia.nome} · ${primeiro}</title>`), 'título com o nome e o 1º detalhe do conteudo.json');
  const worker = readFileSync(new URL('../../src/worker.js', import.meta.url), 'utf8');
  assert.ok(!/\btolerante\b/.test(worker), 'worker.js sem tolerante (mora em dados.js)');
  assert.ok(!worker.includes('Blocos novos da home nunca derrubam'), 'sem o comentário solto sobre exigirOrigem');
});
