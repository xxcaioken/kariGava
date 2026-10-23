import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderizarSite } from '../../src/site.js';
import { renderizarQuiz } from '../../src/quiz.js';
import { renderizarPrivacidade } from '../../src/privacidade.js';
import { naoEncontrada } from '../../src/paginas.js';
import { favicon } from '../../src/marca.js';
import conteudo from '../../conteudo.json' with { type: 'json' };

const NUMERO = '5548998459412';
const paginas = () => ({
  '/': renderizarSite({ itens: [], textos: {}, whatsappNumero: NUMERO }),
  '/quiz': renderizarQuiz({ whatsappNumero: NUMERO }),
  '/privacidade': renderizarPrivacidade({ whatsappNumero: NUMERO }),
  404: naoEncontrada({ whatsappNumero: NUMERO }),
});

// Luminância relativa (WCAG) de um hex #RRGGBB.
function luminancia(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
// Saturação (HSL) de um hex de 3 ou 6 dígitos: neutros ficam abaixo de 0,15.
function saturacao(hex) {
  const h = hex.length === 4 ? `#${[...hex.slice(1)].map(c => c + c).join('')}` : hex;
  const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  return max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
}

test('R-02 nenhuma página tem nome de cor, código KG ou texto da cartela', () => {
  const proibidos = ['Roxo Autêntico', 'Vermelho Armário', 'Mostarda Oficina', 'Pink Produção', 'Verde Vitrine', 'Grafite Aula', 'KG 0', 'Cada serviço tem a sua cor', 'Cartela de serviços'];
  for (const [caminho, html] of Object.entries(paginas())) {
    for (const p of proibidos) assert.ok(!html.includes(p), `${caminho} sem "${p}"`);
    assert.ok(!/style="[^"]*--cor/.test(html), `${caminho} sem cor por elemento (--cor)`);
    assert.ok(!/var\(--(roxo|mostarda|pink|verde|vermelho|grafite)/.test(html), `${caminho} sem a cartela antiga`);
  }
  const home = paginas()['/'];
  const botoes = [...home.matchAll(/<li class="servico" id="[^"]+"[\s\S]*?<a class="([^"]+)" href="https:\/\/wa\.me/g)].map(m => m[1]);
  assert.equal(botoes.length, 4, '4 botões de serviço');
  assert.equal(new Set(botoes).size, 1, 'todos os botões de serviço iguais');
});

test('R-02 a cor de destaque vem só do conteudo.json', () => {
  const cor = conteudo.marca.cor_destaque;
  assert.match(cor, /^#[0-9A-Fa-f]{6}$/, 'marca.cor_destaque é um hex de 6 dígitos');
  for (const [caminho, html] of Object.entries(paginas())) {
    assert.ok(html.includes(`<html lang="pt-BR" style="--destaque:${cor}">`), `${caminho} recebe --destaque do conteudo.json`);
  }
  const css = readFileSync(new URL('../../public/site.css', import.meta.url), 'utf8');
  assert.ok(!/--(roxo|mostarda|pink|verde|vermelho|grafite)\b/.test(css), 'site.css sem a cartela antiga');
  for (const hex of css.match(/#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b/g) || []) assert.ok(saturacao(hex) < 0.15, `site.css só com neutros; ${hex} é cor`);
  assert.ok(css.includes('var(--destaque)'), 'site.css usa a cor de destaque');
  const contraste = (1.05) / (luminancia(cor) + 0.05);
  assert.ok(contraste >= 4.5, `texto branco sobre ${cor}: ${contraste.toFixed(2)}:1`);
  assert.ok(favicon().includes(`fill="${cor}"`), 'favicon na cor de destaque');
});
