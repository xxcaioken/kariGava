import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jsonLd, sitemap, robots, metaBase, baseDoSite, telefoneE164 } from '../../src/seo.js';
import { montarDados } from '../../src/site.js';

const BASE = 'https://karigava.com.br';
const NUMERO = '5548998459412';

test('R-09 baseDoSite: SITE_URL da config vence; sem ela, o origin do request; sem barra no fim', () => {
  assert.equal(baseDoSite({ SITE_URL: 'https://karigava.com.br/' }, new Request('https://site-kari.karigava.workers.dev/x')), 'https://karigava.com.br');
  assert.equal(baseDoSite({}, new Request('https://site-kari.karigava.workers.dev/x')), 'https://site-kari.karigava.workers.dev');
  assert.equal(baseDoSite({ SITE_URL: '  ' }, new Request('http://127.0.0.1:8787/')), 'http://127.0.0.1:8787');
  assert.equal(telefoneE164(NUMERO), '+5548998459412');
});

test('R-09 metaBase: canonical e og:url absolutos, og:image 1200×630 absoluta, twitter:card', () => {
  const html = metaBase({ base: BASE, caminho: '/quiz', titulo: 'Quiz', descricao: 'Desc "x"' });
  assert.ok(html.includes(`<link rel="canonical" href="${BASE}/quiz">`));
  assert.ok(html.includes(`<meta property="og:url" content="${BASE}/quiz">`));
  assert.ok(html.includes(`<meta property="og:image" content="${BASE}/og.jpg">`));
  assert.ok(html.includes('<meta property="og:image:width" content="1200">') && html.includes('<meta property="og:image:height" content="630">'));
  assert.ok(html.includes('<meta name="twitter:card" content="summary_large_image">'));
  assert.ok(html.includes('content="Desc &quot;x&quot;"'), 'descrição escapada');
});

test('R-09 jsonLd: ProfessionalService + Person + Product com offers quando há preço; escapa </script> e U+2028', () => {
  const itens = [
    { id: 'a', secao: 'lalaia', ordem: 0, titulo: '</script><b>Xuxona</b>\u2028', foto_url: '/fotos/a.jpg' },
    { id: 'b', secao: 'lalaia', ordem: 1, titulo: 'Laço', foto_url: '/img/laco.jpg' },
  ];
  const produtos = [{ slug: 'script-b-xuxona-b', titulo: '</script><b>Xuxona</b>', preco: 65, disponibilidade: 'encomenda', prazo_dias: 7, descricao: 'Gigante' }];
  const d = montarDados({ itens, produtos, textos: { consultoria: { preco: 380 } }, whatsappNumero: NUMERO });
  const tag = jsonLd(d, { base: BASE, whatsappNumero: NUMERO });
  assert.ok(tag.startsWith('<script type="application/ld+json">') && tag.endsWith('</script>'));
  const corpo = tag.slice('<script type="application/ld+json">'.length, -'</script>'.length);
  assert.ok(!corpo.includes('</script') && !corpo.includes('<') && !corpo.includes('\u2028'), 'nada que feche a tag ou quebre o JSON');
  const dados = JSON.parse(corpo);
  const tipos = dados['@graph'].map(n => n['@type']);
  assert.ok(tipos.includes('ProfessionalService') && tipos.includes('Person'));
  const negocio = dados['@graph'].find(n => n['@type'] === 'ProfessionalService');
  assert.equal(negocio.telephone, '+5548998459412');
  assert.equal(negocio.address.addressLocality, 'Florianópolis');
  assert.ok(!negocio.address.streetAddress, 'endereço oculto');
  assert.equal(negocio.url, `${BASE}/`);
  assert.ok(negocio.sameAs.length === 2 && negocio.priceRange.includes('380'));
  const prods = dados['@graph'].filter(n => n['@type'] === 'Product');
  assert.equal(prods.length, 2);
  const xux = prods.find(p => p.name.includes('Xuxona'));
  assert.equal(xux.name, '</script><b>Xuxona</b> ', 'nome preservado (o U+2028 volta no parse)');
  assert.equal(xux.offers.price, 65);
  assert.equal(xux.offers.priceCurrency, 'BRL');
  assert.equal(xux.offers.availability, 'https://schema.org/PreOrder');
  assert.equal(xux.image[0], `${BASE}/fotos/a.jpg`);
  assert.ok(!prods.find(p => p.name === 'Laço').offers, 'sem preço, sem offers');
});

test('R-09 sitemap e robots', () => {
  const xml = sitemap(BASE);
  assert.deepEqual([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]), [`${BASE}/`, `${BASE}/lalaia`, `${BASE}/quiz`, `${BASE}/privacidade`]);
  const txt = robots(BASE);
  assert.ok(txt.includes(`Sitemap: ${BASE}/sitemap.xml`) && txt.includes('Disallow: /painel/') && txt.includes('Disallow: /api/'));
});
