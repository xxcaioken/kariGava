import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarFaq, agruparFaq, GRUPOS_FAQ } from '../../src/faq.js';

test('R-06 validarFaq: limites com o tamanho atual, grupo, publicada booleana, PUT parcial', () => {
  const atual = { pergunta: 'Atende online?', resposta: 'Sim.', grupo: 'voce', publicada: false };
  assert.deepEqual(validarFaq(atual, { publicada: true }), { ...atual, publicada: true });
  assert.equal(validarFaq(atual, { pergunta: '  Atende   online? ' }).pergunta, 'Atende online?');
  const erro = re => e => e.status === 400 && e.erro === 'faq_invalida' && re.test(e.mensagem);
  assert.throws(() => validarFaq(atual, { pergunta: 'a'.repeat(141) }), erro(/140 letras; esta tem 141/));
  assert.throws(() => validarFaq(atual, { resposta: 'a'.repeat(601) }), erro(/600 letras; esta tem 601/));
  assert.throws(() => validarFaq(atual, { pergunta: '' }), erro(/pergunta/i));
  assert.throws(() => validarFaq(atual, { resposta: '' }), erro(/resposta/i));
  assert.throws(() => validarFaq(atual, { grupo: 'x' }), erro(/grupo/i));
  assert.throws(() => validarFaq(atual, { publicada: 'sim' }), erro(/./));
  assert.throws(() => validarFaq(atual, { cor: 'x' }), erro(/./));
});

test('R-06 agruparFaq: só publicadas, na ordem dos grupos do site, grupos vazios somem', () => {
  const lista = [
    { id: 'a', grupo: 'lalaia', pergunta: 'L1', resposta: 'r', publicada: true },
    { id: 'b', grupo: 'voce', pergunta: 'V1', resposta: 'r', publicada: false },
    { id: 'c', grupo: 'voce', pergunta: 'V2', resposta: 'r', publicada: true },
    { id: 'd', grupo: 'lojas', pergunta: 'J1', resposta: 'r', publicada: false },
  ];
  const grupos = agruparFaq(lista);
  assert.deepEqual(grupos.map(g => g.titulo), ['Para você', 'LALAIÁ']);
  assert.deepEqual(grupos.map(g => g.perguntas.map(p => p.pergunta)), [['V2'], ['L1']]);
  assert.deepEqual(agruparFaq([]), []);
  assert.deepEqual(Object.keys(GRUPOS_FAQ), ['voce', 'lojas', 'lalaia']);
});
