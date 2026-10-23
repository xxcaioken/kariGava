import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarCondicoes, CONDICOES_VAZIAS, validarCupom, cupomVigente, CUPOM_PADRAO } from '../../src/config.js';

test('R-08 validarCupom: PUT parcial, maiúsculas, limites e ligar exige código e desconto', () => {
  const ligado = validarCupom(CUPOM_PADRAO, { ativo: true, codigo: ' bemvinda ', desconto: 10 });
  assert.deepEqual(ligado, { ativo: true, codigo: 'BEMVINDA', desconto: 10, valido_ate: '' });
  assert.deepEqual(validarCupom(ligado, { ativo: false }), { ...ligado, ativo: false }, 'parcial mantém o resto');
  assert.deepEqual(validarCupom(ligado, null), CUPOM_PADRAO, 'null zera');
  assert.equal(validarCupom(ligado, { valido_ate: '2026-12-31' }).valido_ate, '2026-12-31');
  assert.equal(validarCupom(ligado, { valido_ate: null }).valido_ate, '');
  const erro = re => e => e.status === 400 && e.erro === 'cupom_invalido' && re.test(e.mensagem);
  assert.throws(() => validarCupom(ligado, { valido_ate: '31/12/2026' }), erro(/dia\/mês\/ano/));
  assert.throws(() => validarCupom(ligado, { valido_ate: '2026-02-30' }), erro(/dia\/mês\/ano/));
  assert.throws(() => validarCupom(ligado, { desconto: 100 }), erro(/1 a 99/));
  assert.throws(() => validarCupom(ligado, { desconto: '10' }), erro(/1 a 99/));
  assert.throws(() => validarCupom(ligado, { codigo: 'A'.repeat(21) }), erro(/20 letras/));
  assert.throws(() => validarCupom(ligado, { codigo: 'BEM-VINDA' }), erro(/20 letras/));
  assert.throws(() => validarCupom(CUPOM_PADRAO, { ativo: true }), erro(/código/));
  assert.throws(() => validarCupom(ligado, { ativo: true, desconto: null }), erro(/desconto/));
  assert.throws(() => validarCupom(ligado, { cor: 'x' }), erro(/./));
  assert.throws(() => validarCupom(ligado, 'BEMVINDA'), erro(/./));
});

test('R-08 cupomVigente: só ligado, com código e desconto, e dentro da validade', () => {
  const c = { ativo: true, codigo: 'BEMVINDA', desconto: 10, valido_ate: '' };
  assert.equal(cupomVigente(c, '2026-10-22'), true);
  assert.equal(cupomVigente({ ...c, ativo: false }, '2026-10-22'), false);
  assert.equal(cupomVigente({ ...c, codigo: '' }, '2026-10-22'), false);
  assert.equal(cupomVigente({ ...c, valido_ate: '2026-10-22' }, '2026-10-22'), true, 'vale até o fim do dia');
  assert.equal(cupomVigente({ ...c, valido_ate: '2026-10-21' }, '2026-10-22'), false, 'vencido ontem');
  assert.equal(cupomVigente(null, '2026-10-22'), false);
});

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
