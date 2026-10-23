import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarDepoimento, validarDepoimento } from '../../src/depoimentos.js';

// env falso: R2 que anota put/delete e D1 que pode falhar no INSERT.
function envFalso({ falharInsert = false } = {}) {
  const chamadas = { put: [], delete: [], sql: [] };
  const env = {
    FOTOS: {
      put: async (chave) => { chamadas.put.push(chave); },
      delete: async (chave) => { chamadas.delete.push(chave); },
    },
    DB: {
      // statement com ou sem bind(), como o D1 real
      prepare: (sql) => {
        const stmt = {
          bind: () => stmt,
          run: async () => { chamadas.sql.push(sql); if (falharInsert && /^INSERT/i.test(sql)) throw new Error('D1_ERROR: database is locked'); return {}; },
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
const foto = { bytes: JPEG, tipo: 'image/jpeg', largura: 480, altura: 360 };

test('R-04 criarDepoimento: INSERT falha depois do put → objeto do R2 apagado, 500 com mensagem, nada órfão', async () => {
  const { env, chamadas } = envFalso({ falharInsert: true });
  await assert.rejects(
    () => criarDepoimento(env, { nome: 'Paula', texto: 'Amei.', consentimento: true, foto }),
    e => e.status === 500 && e.erro === 'erro_interno' && /Tente de novo/.test(e.mensagem),
  );
  assert.equal(chamadas.put.length, 1, 'subiu a foto antes do INSERT');
  assert.deepEqual(chamadas.delete, chamadas.put, 'apagou exatamente o que subiu');
});

test('R-04 criarDepoimento: sucesso com foto não apaga nada e usa a chave dep/<id>', async () => {
  const { env, chamadas } = envFalso();
  const d = await criarDepoimento(env, { nome: 'Paula', texto: 'Amei.', consentimento: true, foto });
  assert.equal(chamadas.put.length, 1);
  assert.equal(chamadas.delete.length, 0);
  assert.equal(chamadas.put[0], `dep/${d.id}.jpg`);
  assert.equal(d.foto_url, `/fotos/dep/${d.id}.jpg`);
  assert.equal(d.largura, 480);
  assert.ok(d.consentimento_em);
});

test('R-04 validarDepoimento: foto exige consentimento; sem foto o consentimento é opcional', () => {
  assert.throws(() => validarDepoimento({ nome: 'Paula', texto: 'Amei.', foto }), e => e.erro === 'texto_invalido' && /autorizou/.test(e.mensagem));
  assert.equal(validarDepoimento({ nome: 'Paula', texto: 'Amei.' }).consentimento, false);
  assert.throws(() => validarDepoimento({ nome: 'Paula', texto: 'a'.repeat(401) }), e => /400 letras; este tem 401/.test(e.mensagem));
  assert.throws(() => validarDepoimento({ nome: 'Paula', texto: 'Oi', servico: 'xyz' }), e => e.erro === 'texto_invalido');
  assert.throws(() => validarDepoimento({ nome: 'Paula', texto: 'Oi', consentimento: true, foto: { ...foto, largura: 10001 } }), e => e.erro === 'foto_invalida');
});
