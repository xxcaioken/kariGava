import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tituloSugerido } from '../../src/instagram.js';

test('título sugerido usa a 1ª linha da legenda, sem hashtags', () => {
  assert.equal(tituloSugerido('\n  Bem Xuxona.\n\nDescobrindo novos jeitos #xuxona'), 'Bem Xuxona.');
  assert.equal(tituloSugerido('Como desencaretar um look #broche #styling'), 'Como desencaretar um look');
  assert.equal(tituloSugerido(''), '');
  assert.equal(tituloSugerido(undefined), '');
});

test('título sugerido corta legendas longas numa palavra', () => {
  const t = tituloSugerido('Oficina de VM e expografia na UDESC para as turmas da 2ª e 6ª fase da MODA, curso em que me formei');
  assert.ok(t.length <= 61, t);
  assert.ok(t.endsWith('…'));
  assert.ok(!t.includes('  '));
});
