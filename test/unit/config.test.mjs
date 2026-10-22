import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarCondicoes, CONDICOES_VAZIAS } from '../../src/config.js';

test('R-03 validarCondicoes: PUT parcial, limites e gbp_url', () => {
  const atual = { ...CONDICOES_VAZIAS, pagamento: 'Pix' };
  assert.deepEqual(validarCondicoes(atual, { frete: '  Correios  ' }), { ...atual, frete: 'Correios' }, 'ausente mantém, espaços limpos');
  assert.deepEqual(validarCondicoes(atual, { pagamento: null }), CONDICOES_VAZIAS, 'null limpa');
  assert.throws(() => validarCondicoes(atual, { troca: 'a'.repeat(221) }), e => e.status === 400 && e.erro === 'condicao_invalida' && /troca.*220 letras.*221/i.test(e.mensagem));
  assert.throws(() => validarCondicoes(atual, { prazo_padrao: 7 }), e => e.erro === 'condicao_invalida');
  assert.throws(() => validarCondicoes(atual, { cor: 'x' }), e => e.erro === 'condicao_invalida', 'campo desconhecido');
  assert.throws(() => validarCondicoes(atual, { gbp_url: 'http://g.page/x' }), e => e.erro === 'condicao_invalida' && /https:\/\//.test(e.mensagem));
  assert.throws(() => validarCondicoes(atual, { gbp_url: 'https://' }), e => e.erro === 'condicao_invalida');
  assert.equal(validarCondicoes(atual, { gbp_url: ' https://g.page/r/x/review ' }).gbp_url, 'https://g.page/r/x/review');
  assert.equal(validarCondicoes(atual, { gbp_url: null }).gbp_url, '');
});
