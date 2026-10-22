import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cabecalhosDeSeguranca, comCabecalhos } from '../../src/seguranca.js';

const ESPERADOS = ['strict-transport-security', 'x-content-type-options', 'referrer-policy', 'permissions-policy', 'x-frame-options', 'content-security-policy'];

test('R-12 resposta de erro 500 sai com os 6 cabeçalhos e mantém status e corpo', async () => {
  const original = new Response(JSON.stringify({ erro: 'erro_interno' }), { status: 500, headers: { 'content-type': 'application/json; charset=utf-8' } });
  const r = comCabecalhos(original, {});
  assert.equal(r.status, 500);
  assert.equal((await r.json()).erro, 'erro_interno');
  assert.equal(r.headers.get('content-type'), 'application/json; charset=utf-8');
  for (const nome of ESPERADOS) assert.ok(r.headers.get(nome), nome);
  assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
});

test('R-12 resposta de foto do R2 mantém cache e etag e ganha os cabeçalhos', () => {
  const foto = new Response('bytes', { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=31536000, immutable', etag: '"abc"' } });
  const r = comCabecalhos(foto, {});
  assert.equal(r.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  assert.equal(r.headers.get('etag'), '"abc"');
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
});

test('R-12 redirecionamento (Response.redirect, cabeçalhos imutáveis) também sai com os cabeçalhos', () => {
  const r = comCabecalhos(Response.redirect('https://exemplo.com/painel/?instagram=ligado', 303), {});
  assert.equal(r.status, 303);
  assert.equal(r.headers.get('location'), 'https://exemplo.com/painel/?instagram=ligado');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
});

test('R-12 CSP_MODO=relatorio (só em dev) troca para Content-Security-Policy-Report-Only', () => {
  const normal = cabecalhosDeSeguranca({});
  assert.ok(normal['Content-Security-Policy']);
  assert.equal(normal['Content-Security-Policy-Report-Only'], undefined);
  const relatorio = cabecalhosDeSeguranca({ CSP_MODO: 'relatorio' });
  assert.equal(relatorio['Content-Security-Policy'], undefined);
  assert.match(relatorio['Content-Security-Policy-Report-Only'], /frame-ancestors 'none'/);
});
