import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderizarSite } from '../../src/site.js';

const NUMERO = '5548998459412';
const foto = (secao, ordem, arquivo) => ({ id: `${secao}_${ordem}`, secao, ordem, titulo: secao, foto_url: `/img/${arquivo}`, origem: 'inicial' });

function leque(html) {
  const ini = html.indexOf('<div class="leque"');
  return html.slice(ini, html.indexOf('<span class="pino"', ini));
}

test('R-03 o leque mostra a primeira foto de cada serviço, sem texto de cor', () => {
  const itens = [
    foto('consultoria', 0, 'kari-chapeu-anturio.jpg'), // proibida: o leque pula para a próxima foto do serviço
    foto('consultoria', 1, 'kari-look-blazer.jpg'),
    foto('styling', 0, 'lalaia-babado-vermelho.jpg'),
    foto('vm', 0, 'atelie-busto.jpg'),
    // ensino sem foto: fica fora do leque
  ];
  const html = renderizarSite({ itens, textos: {}, whatsappNumero: NUMERO });
  const l = leque(html);
  const laminas = [...l.matchAll(/<a class="lamina[^"]*" href="#([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
  assert.deepEqual(laminas.map(m => m[1]), ['consultoria', 'styling', 'vm'], 'uma lâmina por serviço com foto, na ordem dos serviços');
  for (const [, id, corpo] of laminas) {
    assert.match(corpo, /<img [^>]*src="\/img\/[^"]+"/, `lâmina ${id} com foto`);
    assert.ok(!/fetchpriority/.test(corpo), `lâmina ${id} sem prioridade (só a foto do centro tem)`);
  }
  assert.ok(laminas[0][2].includes('kari-look-blazer') && !l.includes('kari-chapeu-anturio') && !l.includes('kari-oculos'), 'nunca as fotos proibidas');
  assert.ok(!/class="amostra/.test(l), 'sem as amostras de cor');
  assert.equal((html.match(/fetchpriority="high"/g) || []).length, 1, 'só a foto do centro com fetchpriority');
  assert.ok(l.includes('class="leque-foto"') && l.includes('kari-stylist-toia'), 'a foto da Kari continua no centro');
  const legenda = html.slice(html.indexOf('<ul class="legenda"'), html.indexOf('</ul>', html.indexOf('<ul class="legenda"')));
  assert.equal((legenda.match(/<li>/g) || []).length, 4, 'a lista do celular traz os 4 serviços');
  assert.ok(!legenda.includes('<i'), 'sem quadradinho de cor');

  const css = readFileSync(new URL('../../public/site.css', import.meta.url), 'utf8');
  const movimento = css.slice(css.indexOf('@media (prefers-reduced-motion: no-preference)'));
  const bloco = movimento.slice(0, movimento.indexOf('\n}\n'));
  assert.match(bloco, /\.lamina\s*\{[^}]*animation/, 'lâminas só animam com prefers-reduced-motion: no-preference');
  assert.ok(!/^\.lamina[^{]*\{[^}]*animation/m.test(css.replace(bloco, '')), 'nenhuma animação de lâmina fora desse bloco');
});
