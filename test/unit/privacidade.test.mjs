import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderizarPrivacidade } from '../../src/privacidade.js';
import { naoEncontrada } from '../../src/paginas.js';

const TITULOS = ['Quem cuida dos seus dados', 'O que o site coleta', 'O painel', 'Seus direitos'];

test('R-13 privacidade: com EMAIL_CONTATO o canal é mailto; sem ele, o WhatsApp e nenhum mailto', () => {
  const com = renderizarPrivacidade({ emailContato: 'x@y.br', whatsappNumero: '5548998459412' });
  assert.ok(com.includes('mailto:x@y.br'));
  for (const t of TITULOS) assert.ok(com.includes(`>${t}<`), t);
  assert.ok(com.includes('href="/"'), 'marca leva para /');
  assert.ok(!com.includes('fonts.googleapis'));
  const sem = renderizarPrivacidade({ emailContato: '', whatsappNumero: '5548998459412' });
  assert.ok(!sem.includes('mailto:'));
  assert.ok(sem.includes('https://wa.me/5548998459412?text='), 'cita o WhatsApp como canal');
  assert.match(sem, /Versão desta página: \d{2}\/\d{2}\/\d{4}/);
});

test('R-13 página 404: título, links para / e WhatsApp, noindex', () => {
  const html = naoEncontrada({ whatsappNumero: '5548998459412' });
  assert.ok(html.includes('Essa página não existe'));
  assert.ok(html.includes('<meta name="robots" content="noindex">'));
  assert.ok(html.includes('href="/"') && html.includes('https://wa.me/5548998459412?text='));
});
