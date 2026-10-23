import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderizarQuiz, resultadoDoQuiz } from '../../src/quiz.js';
import { ORDEM_SERVICOS } from '../../src/site.js';
import conteudo from '../../conteudo.json' with { type: 'json' };

const NUMERO = '5548998459412';

test('R-07 conteudo.json: 8 perguntas, 4 resultados, todo resultado aponta para um serviço do site (sem link /# morto)', () => {
  const q = conteudo.quiz;
  assert.equal(q.perguntas.length, 8);
  assert.equal(q.resultados.length, 4);
  const ids = new Set(q.resultados.map(r => r.id));
  for (const r of q.resultados) {
    assert.ok(ORDEM_SERVICOS.includes(r.servico), `resultado ${r.id} aponta para o serviço ${r.servico}`);
    assert.ok(r.nome && r.texto, `resultado ${r.id} tem nome e texto`);
  }
  for (const p of q.perguntas) {
    assert.ok(p.pergunta && p.opcoes.length >= 2, 'pergunta com opções');
    for (const o of p.opcoes) assert.ok(ids.has(o.resultado), `opção "${o.texto}" aponta para o resultado ${o.resultado}`);
  }
  assert.equal(q.rascunho, true, 'quiz marcado como rascunho (redigido por nós)');
});

test('R-07 resultadoDoQuiz: o mais escolhido vence; empate fica com o primeiro na ordem dos resultados', () => {
  const ids = conteudo.quiz.resultados.map(r => r.id);
  assert.equal(resultadoDoQuiz([ids[1], ids[1], ids[0]]).id, ids[1]);
  assert.equal(resultadoDoQuiz([ids[2], ids[0]]).id, ids[0], 'empate: ordem dos resultados');
  assert.equal(resultadoDoQuiz([]).id, ids[0]);
  assert.equal(resultadoDoQuiz(['nao-existe', ids[3]]).id, ids[3], 'ignora id desconhecido');
});

test('R-07 renderizarQuiz: 8 perguntas no <noscript>, dados em JSON com os links de WhatsApp por resultado, sem Google Fonts', () => {
  const html = renderizarQuiz({ whatsappNumero: NUMERO });
  assert.ok(!html.includes('fonts.googleapis'));
  assert.ok(html.includes('<noscript>'));
  for (const p of conteudo.quiz.perguntas) assert.ok(html.includes(p.pergunta.replace(/&/g, '&amp;')), p.pergunta);
  const json = html.match(/<script type="application\/json" id="quiz-dados">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(json, 'bloco de dados');
  const dados = JSON.parse(json);
  assert.equal(dados.perguntas.length, 8);
  for (const r of dados.resultados) {
    assert.ok(r.wa.startsWith(`https://wa.me/${NUMERO}?text=`), r.wa);
    const texto = decodeURIComponent(new URL(r.wa).searchParams.get('text'));
    assert.equal(texto, `Oi Kari, fiz o quiz do site e deu ${r.nome}`);
    assert.equal(r.link, `/#${r.servico}`);
  }
  assert.ok(!json.includes('</script'), 'JSON não fecha a tag script');
  assert.ok(html.includes('<script src="/quiz.js" defer></script>'), 'script externo (CSP self)');
});
