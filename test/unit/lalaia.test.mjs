import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderizarLalaia } from '../../src/lalaia.js';
import { renderizarSite } from '../../src/site.js';
import { sitemap } from '../../src/seo.js';
import { naoEncontrada } from '../../src/paginas.js';
import { readFileSync } from 'node:fs';

const NUMERO = '5548998459412';
const BASE = 'https://exemplo.com.br';
const foto = (ordem, titulo, arquivo) => ({ id: `ini_lalaia_${ordem}`, secao: 'lalaia', ordem, titulo, foto_url: `/img/${arquivo}`, origem: 'inicial' });
const itens = [
  foto(0, 'BigScrunchie (a Xuxona)', 'lalaia-scrunchie.jpg'),
  foto(1, 'Acessórios de cabeça sob medida', 'lalaia-perolas.jpg'),
  foto(2, 'Vai de presente', 'lalaia-caixa.jpg'),
];

test('R-04 /lalaia abre com os produtos e tem prévia própria', () => {
  const html = renderizarLalaia({ itens, textos: {}, whatsappNumero: NUMERO, base: BASE });
  assert.match(html, /<title>[^<]*LALAIÁ[^<]*<\/title>/, 'título da LALAIÁ');
  assert.match(html, /<meta property="og:title" content="[^"]*LALAIÁ[^"]*">/, 'og:title da LALAIÁ');
  assert.ok(html.includes(`<meta property="og:image" content="${BASE}/og-lalaia.jpg">`), 'prévia própria');
  assert.ok(html.includes(`<link rel="canonical" href="${BASE}/lalaia">`), 'canonical');
  assert.equal((html.match(/<h1[ >]/g) || []).length, 1, 'um h1');

  // Os produtos vêm antes de qualquer outro bloco do conteúdo: depois do <h1>, o primeiro <h2>/<section> é o dos produtos.
  const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
  const primeiroProduto = main.indexOf('<li class="produto">');
  assert.ok(primeiroProduto > 0, 'tem produto');
  for (const marca of ['id="cupom"', 'id="como-encomendar"', 'class="secao']) {
    const pos = main.indexOf(marca);
    assert.ok(pos < 0 || primeiroProduto < pos, `produto antes de ${marca}`);
  }
  assert.equal((main.match(/<li class="produto">/g) || []).length, 3, 'os 3 produtos com foto');
  for (const t of ['BigScrunchie (a Xuxona)', 'Acessórios de cabeça sob medida', 'Vai de presente']) assert.ok(main.includes(`<h3>${t}</h3>`), t);
  assert.ok(main.includes('id="como-encomendar"'), 'como encomendar na página');
  assert.ok(/href="\/"/.test(html), 'link para o site da Kari');
  const barra = html.slice(html.indexOf('class="barra-wa"'));
  assert.ok(decodeURIComponent(barra.match(/href="https:\/\/wa\.me\/[^"?]+\?text=([^"]+)"/)[1]).startsWith('Oi Kari, quero encomendar'), 'barra fixa de encomenda');
});

test('R-04 a home leva à /lalaia e não repete a loja inteira', () => {
  const home = renderizarSite({ itens, textos: {}, whatsappNumero: NUMERO });
  const nav = home.slice(home.indexOf('<nav class="nav"'), home.indexOf('</nav>'));
  assert.ok(nav.includes('href="/lalaia"'), 'menu LALAIÁ → /lalaia');
  const bloco = home.slice(home.indexOf('id="lalaia"'), home.indexOf('id="cursos"'));
  assert.ok(bloco.includes('href="/lalaia"'), 'bloco curto com link para /lalaia');
  assert.ok(!home.includes('id="como-encomendar"') && !home.includes('<li class="produto">'), 'sem a loja inteira na home');
  assert.ok(sitemap(BASE).includes(`<loc>${BASE}/lalaia</loc>`), 'sitemap com /lalaia');
});

test('pré-QA C33: nome longo sem espaços quebra dentro do cartão; descrição e 404 coerentes com a /lalaia', () => {
  const css = readFileSync(new URL('../../public/site.css', import.meta.url), 'utf8');
  assert.match(css, /^h1, h2, h3 \{[^}]*overflow-wrap: anywhere/m, 'títulos quebram palavra longa');
  const html = renderizarLalaia({ itens, textos: {}, whatsappNumero: NUMERO });
  const descricao = html.match(/<meta name="description" content="([^"]+)">/)[1].toLowerCase();
  for (const termo of ['feitos à mão', 'sob encomenda']) assert.ok(descricao.split(termo).length <= 2, `"${termo}" uma vez só na descrição: ${descricao}`);
  const erro = naoEncontrada({ whatsappNumero: NUMERO });
  assert.ok(!erro.includes('cabe numa página só') && erro.includes('href="/lalaia"'), '404 sem "uma página só" e com caminho para a /lalaia');
});
