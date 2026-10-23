import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { largurasDasVariantes, chaveDaVariante, nomeDaVariante, variantesDaFotoInicial } from '../../src/variantes.js';
import { renderizarSite } from '../../src/site.js';

test('R-10 largurasDasVariantes: só 480/960/1600 abaixo da largura original, mais a própria (nunca ampliar)', () => {
  assert.deepEqual(largurasDasVariantes(3000), [480, 960, 1600]);
  assert.deepEqual(largurasDasVariantes(1600), [480, 960, 1600]);
  assert.deepEqual(largurasDasVariantes(1080), [480, 960, 1080]);
  assert.deepEqual(largurasDasVariantes(640), [480, 640]);
  assert.deepEqual(largurasDasVariantes(360), [360]);
  assert.deepEqual(largurasDasVariantes(0), []);
});

test('R-10 chaveDaVariante e nomeDaVariante: chave sem extensão + -<largura>.<ext>; nome do campo aceito', () => {
  assert.equal(chaveDaVariante('ig/kari/123.jpg', 480, 'jpg'), 'ig/kari/123-480.jpg');
  assert.equal(chaveDaVariante('celular/it_abc.png', 960, 'webp'), 'celular/it_abc-960.webp');
  assert.deepEqual(nomeDaVariante('480.jpg'), { largura: 480, ext: 'jpg' });
  assert.deepEqual(nomeDaVariante('1600.webp'), { largura: 1600, ext: 'webp' });
  assert.equal(nomeDaVariante('foto'), null);
  assert.equal(nomeDaVariante('480.png'), null);
  assert.equal(nomeDaVariante('0.jpg'), null);
});

test('R-10 fotos iniciais: variantes.json gerado pelo script bate com os arquivos de public/img', () => {
  const mapa = JSON.parse(readFileSync(new URL('../../public/img/variantes.json', import.meta.url), 'utf8'));
  assert.ok(mapa['kari-look-blazer'], 'consultoria (360×640) está no mapa');
  assert.deepEqual(mapa['kari-look-blazer'].larguras, [360], 'nunca amplia: só 360w');
  assert.equal(mapa['kari-look-blazer'].largura, 360);
  assert.equal(mapa['kari-look-blazer'].altura, 640);
  assert.deepEqual(mapa['kari-stylist-toia'].larguras, [480, 640], 'hero 640 px: 480 e 640');
  assert.ok(!mapa['kari-chapeu-anturio'] && !mapa['kari-oculos'], 'fotos proibidas ficam fora');
  for (const [nome, v] of Object.entries(mapa)) {
    for (const w of v.larguras) {
      assert.ok(existsSync(new URL(`../../public/img/${nome}-${w}.jpg`, import.meta.url)), `${nome}-${w}.jpg`);
      if (v.webp) assert.ok(existsSync(new URL(`../../public/img/${nome}-${w}.webp`, import.meta.url)), `${nome}-${w}.webp`);
    }
  }
  const v = variantesDaFotoInicial('/img/kari-look-blazer.jpg');
  assert.deepEqual(v.larguras, [360]);
  assert.equal(variantesDaFotoInicial('/fotos/celular/x.jpg'), null);
});

test('R-10 renderizarSite: hero com fetchpriority e sem lazy; foto inicial em <picture> com webp e 360w; item sem variantes em <img> simples', () => {
  const itens = [
    { id: 'ini_consultoria_0', secao: 'consultoria', ordem: 0, titulo: 'Consultoria de estilo', foto_url: '/img/kari-look-blazer.jpg', origem: 'inicial' },
    { id: 'it_x', secao: 'lalaia', ordem: 0, titulo: 'Xuxona', foto_url: '/fotos/ig/lalaia/1.jpg', origem: 'instagram', variantes: null },
    { id: 'it_y', secao: 'lalaia', ordem: 1, titulo: 'Laço', foto_url: '/fotos/celular/it_y.jpg', origem: 'celular', variantes: { larguras: [480, 960, 1600], webp: true }, largura: 1600, altura: 1200 },
  ];
  const html = renderizarSite({ itens, whatsappNumero: '5548998459412' });
  const hero = html.match(/<img [^>]*kari-stylist-toia[^>]*>/)[0];
  assert.ok(hero.includes('fetchpriority="high"') && !hero.includes('loading="lazy"'), hero);
  const consultoria = html.slice(html.indexOf('id="consultoria"'), html.indexOf('id="styling"'));
  assert.match(consultoria, /<picture>\s*<source type="image\/webp" srcset="\/img\/kari-look-blazer-360\.webp 360w" sizes="[^"]+">\s*<img [^>]*srcset="\/img\/kari-look-blazer-360\.jpg 360w"/);
  assert.ok(consultoria.includes('width="360"') && consultoria.includes('height="640"') && consultoria.includes('loading="lazy"'));
  const lalaia = html.slice(html.indexOf('id="lalaia"'), html.indexOf('id="cursos"'));
  assert.ok(lalaia.includes('<img src="/fotos/ig/lalaia/1.jpg"') && !lalaia.includes('ig/lalaia/1-480'), 'sem variantes: <img> simples');
  assert.ok(lalaia.includes('srcset="/fotos/celular/it_y-480.jpg 480w, /fotos/celular/it_y-960.jpg 960w, /fotos/celular/it_y-1600.jpg 1600w"'), 'srcset com as 3 larguras');
  assert.ok(lalaia.includes('srcset="/fotos/celular/it_y-480.webp 480w, /fotos/celular/it_y-960.webp 960w, /fotos/celular/it_y-1600.webp 1600w"'), 'webp');
  for (const pic of html.match(/<picture>[\s\S]*?<\/picture>/g)) assert.ok(/sizes="/.test(pic), 'todo <picture> tem sizes');
  for (const img of html.match(/<img [^>]*>/g)) assert.ok(img.includes('fetchpriority="high"') || img.includes('loading="lazy"'), `lazy em toda foto não-hero: ${img}`);
});
