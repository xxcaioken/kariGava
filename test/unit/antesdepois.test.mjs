import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarPar, validarPar } from '../../src/antesdepois.js';

// env falso: R2 que anota put/delete e pode falhar no 2º put; D1 que pode falhar no INSERT.
function envFalso({ falharInsert = false, falharSegundoPut = false } = {}) {
  const chamadas = { put: [], delete: [] };
  const env = {
    FOTOS: {
      put: async (chave) => { if (falharSegundoPut && chamadas.put.length === 1) throw new Error('R2 indisponível'); chamadas.put.push(chave); },
      delete: async (chave) => { chamadas.delete.push(chave); },
    },
    DB: {
      prepare: (sql) => {
        const stmt = {
          bind: () => stmt,
          run: async () => { if (falharInsert && /^INSERT/i.test(sql)) throw new Error('D1_ERROR: database is locked'); return {}; },
          first: async () => ({ n: 0 }),
          all: async () => ({ results: [] }),
        };
        return stmt;
      },
    },
  };
  return { env, chamadas };
}

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]).buffer;
const foto = { bytes: JPEG, tipo: 'image/jpeg', largura: 1200, altura: 1600 };
const entrada = { legenda: 'Vitrine', servico: 'vm', consentimento: true, antes: foto, depois: foto };
const erro500 = e => e.status === 500 && e.erro === 'erro_interno' && /Tente de novo/.test(e.mensagem);

test('R-05 criarPar: INSERT falha depois dos 2 put → os 2 objetos apagados, 500 com mensagem', async () => {
  const { env, chamadas } = envFalso({ falharInsert: true });
  await assert.rejects(() => criarPar(env, entrada), erro500);
  assert.equal(chamadas.put.length, 2);
  assert.deepEqual([...chamadas.delete].sort(), [...chamadas.put].sort(), 'apagou exatamente o que subiu');
});

test('R-05 criarPar: 2º put falha → o 1º objeto é apagado, 500, nada órfão', async () => {
  const { env, chamadas } = envFalso({ falharSegundoPut: true });
  await assert.rejects(() => criarPar(env, entrada), erro500);
  assert.equal(chamadas.put.length, 1);
  assert.deepEqual(chamadas.delete, chamadas.put);
});

test('R-05 criarPar: sucesso usa ad/<id>-antes.jpg e ad/<id>-depois.jpg e não apaga nada', async () => {
  const { env, chamadas } = envFalso();
  const p = await criarPar(env, entrada);
  assert.deepEqual(chamadas.put, [`ad/${p.id}-antes.jpg`, `ad/${p.id}-depois.jpg`]);
  assert.equal(chamadas.delete.length, 0);
  assert.equal(p.antes_url, `/fotos/ad/${p.id}-antes.jpg`);
  assert.ok(p.consentimento_em);
});

test('R-05 validarPar: fotos obrigatórias com mensagem de qual falta, consentimento, serviço e legenda', () => {
  const erro = (codigo, re) => e => e.erro === codigo && re.test(e.mensagem);
  assert.throws(() => validarPar({ ...entrada, depois: null }), erro('foto_invalida', /Falta a foto de Depois/));
  assert.throws(() => validarPar({ ...entrada, antes: null }), erro('foto_invalida', /Falta a foto de Antes/));
  assert.throws(() => validarPar({ ...entrada, consentimento: false }), erro('foto_invalida', /autorizou/));
  assert.throws(() => validarPar({ ...entrada, servico: 'ensino' }), erro('texto_invalido', /./));
  assert.throws(() => validarPar({ ...entrada, legenda: 'a'.repeat(121) }), erro('texto_invalido', /120 letras; esta tem 121/));
  assert.throws(() => validarPar({ ...entrada, antes: { ...foto, altura: 0 } }), erro('foto_invalida', /./));
  assert.equal(validarPar({ ...entrada, legenda: '  Vitrine   nova ' }).legenda, 'Vitrine nova');
});
