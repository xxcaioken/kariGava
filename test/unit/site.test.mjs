import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkWa, renderizarSite } from '../../src/site.js';
import conteudo from '../../conteudo.json' with { type: 'json' };

const NUMERO = '5548998459412';

test('R-01 linkWa: número só com dígitos e mensagem codificada, acentos preservados', () => {
  const url = linkWa(NUMERO, 'Oi Kari, vi o site e quero saber sobre Edição de guarda-roupa');
  assert.ok(url.startsWith(`https://wa.me/${NUMERO}?text=`));
  const texto = decodeURIComponent(new URL(url).searchParams.get('text'));
  assert.equal(texto, 'Oi Kari, vi o site e quero saber sobre Edição de guarda-roupa');
});

test('R-01 linkWa: aceita o número com máscara (+55 (48) 99845-9412)', () => {
  assert.ok(linkWa('+55 (48) 99845-9412', 'oi').startsWith(`https://wa.me/${NUMERO}?text=`));
});

test('R-01 linkWa: var vazia ou curta cai no número de conteudo.json e avisa uma vez', () => {
  const avisos = [];
  const original = console.warn;
  console.warn = (...a) => avisos.push(a.join(' '));
  try {
    assert.ok(linkWa('', 'oi').startsWith(`https://wa.me/${conteudo.marca.whatsapp_numero}?text=`));
    assert.ok(linkWa('123', 'oi').startsWith(`https://wa.me/${conteudo.marca.whatsapp_numero}?text=`));
    assert.ok(!linkWa(undefined, 'oi').includes('wa.me/?text='), 'nunca gera wa.me/?text=');
  } finally {
    console.warn = original;
  }
  assert.equal(avisos.length, 1, 'avisa só na primeira vez');
  assert.match(avisos[0], /WHATSAPP_NUMERO/);
});

test('R-01 renderizarSite: todo botão de WhatsApp usa o número com mensagem por contexto', () => {
  const html = renderizarSite({ itens: [], textos: {}, whatsappNumero: NUMERO });
  assert.ok(!html.includes('wa.me/message'), 'sem o link curto antigo');
  const links = [...html.matchAll(/href="(https:\/\/wa\.me\/[^"]+)"/g)].map(m => m[1].replaceAll('&amp;', '&'));
  assert.ok(links.length >= 8, `há ${links.length} links de WhatsApp`);
  assert.ok(links.every(l => l.startsWith(`https://wa.me/${NUMERO}?text=`)), 'todos com o número e ?text=');
  const textos = links.map(l => decodeURIComponent(new URL(l).searchParams.get('text')));
  assert.ok(textos.includes('Oi Kari, vi o site e quero saber sobre Edição de guarda-roupa'));
  assert.ok(textos.includes('Oi Kari, vi o site e quero conversar'), 'botão geral do hero/rodapé');
  assert.ok(textos.some(t => t.startsWith('Oi Kari, quero encomendar ')), 'botão da LALAIÁ');
});
