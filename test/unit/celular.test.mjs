import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adicionarDoCelular } from '../../src/itens.js';

// review-r1 S-22: foto do celular não fica órfã no R2 se gravar no banco falhar (mesma compensação de depoimentos e pares).
function envFalso({ falharInsert = false } = {}) {
  const chamadas = { put: [], delete: [] };
  const env = {
    FOTOS: {
      put: async (chave) => { chamadas.put.push(chave); },
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

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
function form(extra = {}) {
  const f = new FormData();
  f.set('secao', 'styling');
  f.set('titulo', 'teste');
  f.set('foto', new Blob([JPEG], { type: 'image/jpeg' }), 'foto.jpg');
  f.set('480.jpg', new Blob([JPEG], { type: 'image/jpeg' }), '480.jpg');
  f.set('largura', '1200');
  f.set('altura', '1600');
  for (const [k, v] of Object.entries(extra)) f.set(k, v);
  return f;
}

test('review-r1 S-22: INSERT falha depois do put → foto e versões apagadas do R2, 500 com mensagem', async () => {
  const { env, chamadas } = envFalso({ falharInsert: true });
  await assert.rejects(() => adicionarDoCelular(env, form()), e => e.status === 500 && e.erro === 'erro_interno' && /Tente de novo/.test(e.mensagem));
  assert.ok(chamadas.put.length >= 1, 'a foto subiu antes do INSERT');
  assert.deepEqual([...chamadas.delete].sort(), [...chamadas.put].sort(), 'apagou exatamente o que subiu');
});

test('review-r1 S-22: sucesso não apaga nada', async () => {
  const { env, chamadas } = envFalso();
  const item = await adicionarDoCelular(env, form());
  assert.equal(chamadas.delete.length, 0);
  assert.match(item.foto_url, /^\/fotos\/celular\//);
});
