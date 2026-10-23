import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { renderizarSite } from '../../src/site.js';

const NUMERO = '5548998459412';
const ATUAIS = ['consultoria', 'styling', 'vm', 'ensino'];
const EXTINTOS = ['edicao', 'oficina-look'];

// Fatia do HTML do cartão do serviço `id` até o próximo cartão (ou o fim da grade).
function cartao(html, id) {
  const inicio = html.indexOf(`<li class="servico" id="${id}"`);
  assert.ok(inicio >= 0, `cartão ${id}`);
  const fim = html.indexOf('<li class="servico"', inicio + 1);
  return html.slice(inicio, fim < 0 ? html.indexOf('</ul>', inicio) : fim);
}

test('R-01 a home lista 4 serviços e mantém as âncoras antigas', () => {
  const html = renderizarSite({ itens: [], textos: {}, whatsappNumero: NUMERO });
  const cartoes = [...html.matchAll(/<li class="servico" id="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(cartoes, ATUAIS);
  for (const titulo of ['Edição de guarda-roupa', 'Oficina de Look']) assert.ok(!html.includes(`<h3>${titulo}</h3>`), `sem cartão "${titulo}"`);
  assert.ok(cartao(html, 'consultoria').includes('id="edicao"'), '#edicao leva à consultoria');
  assert.ok(cartao(html, 'ensino').includes('id="oficina-look"'), '#oficina-look leva aos cursos');
  assert.ok(!html.includes('class="filtro"'), 'sem filtro por grupo');
});

test('R-01 migration 0010 move tudo dos serviços extintos sem perder registro', () => {
  const db = new DatabaseSync(':memory:');
  const pasta = new URL('../../migrations/', import.meta.url);
  const arquivos = readdirSync(pasta).filter(f => f.endsWith('.sql')).sort();
  assert.ok(arquivos.includes('0010_servicos_unidos.sql'), 'migration 0010 existe');
  for (const f of arquivos.filter(f => f < '0010')) db.exec(readFileSync(new URL(f, pasta), 'utf8'));

  const t = '2026-10-23T00:00:00.000Z';
  db.exec(`
    INSERT INTO itens (id, secao, ordem, titulo, foto_chave, origem, criado_em) VALUES ('c1', 'consultoria', 1, 'x', 'k1', 'celular', '${t}');
    INSERT INTO itens (id, secao, ordem, titulo, foto_chave, origem, criado_em, removido_em) VALUES ('e9', 'edicao', 5, 'x', 'k2', 'celular', '${t}', '${t}');
    INSERT INTO depoimentos (id, ordem, nome, texto, servico, criado_em) VALUES ('d1', 0, 'Ana', 'oi', 'edicao', '${t}'), ('d2', 1, 'Bia', 'oi', 'oficina-look', '${t}'), ('d3', 2, 'Cris', 'oi', '', '${t}');
    INSERT INTO antes_depois (id, ordem, servico, antes_chave, depois_chave, largura_antes, altura_antes, largura_depois, altura_depois, consentimento_em, criado_em)
      VALUES ('p1', 0, 'edicao', 'a', 'b', 1, 1, 1, 1, '${t}', '${t}');
    INSERT INTO textos (servico, resumo, para_quem, atualizado_em, preco) VALUES ('edicao', 'r', 'p', '${t}', 300), ('oficina-look', 'r', 'p', '${t}', 150), ('ensino', 'r', 'p', '${t}', 900);
  `);
  const contar = tabela => db.prepare(`SELECT COUNT(*) AS n FROM ${tabela}`).get().n;
  const antes = Object.fromEntries(['itens', 'depoimentos', 'antes_depois'].map(t => [t, contar(t)]));

  db.exec(readFileSync(new URL('0010_servicos_unidos.sql', pasta), 'utf8'));

  for (const [tabela, n] of Object.entries(antes)) assert.equal(contar(tabela), n, `${tabela}: nenhum registro perdido`);
  const lista = EXTINTOS.map(s => `'${s}'`).join(',');
  assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM itens WHERE secao IN (${lista})`).get().n, 0);
  assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM depoimentos WHERE servico IN (${lista})`).get().n, 0);
  assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM antes_depois WHERE servico IN (${lista})`).get().n, 0);
  assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM textos WHERE servico IN (${lista})`).get().n, 0);

  // Fotos iniciais: sapatos vão para a consultoria e a turma da oficina para os cursos, depois das fotos que já estavam lá.
  const consultoria = db.prepare("SELECT id FROM itens WHERE secao = 'consultoria' AND removido_em IS NULL ORDER BY ordem").all().map(r => r.id);
  assert.deepEqual(consultoria, ['ini_consultoria_0', 'c1', 'ini_edicao_0']);
  const ensino = db.prepare("SELECT id FROM itens WHERE secao = 'ensino' AND removido_em IS NULL ORDER BY ordem").all().map(r => r.id);
  assert.deepEqual(ensino, ['ini_ensino_0', 'ini_oficina-look_0']);
  assert.equal(db.prepare("SELECT secao FROM itens WHERE id = 'e9'").get().secao, 'consultoria', 'foto tirada do site também muda (o desfazer continua funcionando)');

  assert.deepEqual(db.prepare("SELECT servico FROM depoimentos ORDER BY id").all().map(r => r.servico), ['consultoria', 'ensino', '']);
  assert.equal(db.prepare("SELECT servico FROM antes_depois WHERE id = 'p1'").get().servico, 'consultoria');
  // textos (review-r1 S-07): o texto e o preço de um serviço extinto descreviam outro serviço e não passam para o
  // que o absorveu (senão cobririam o texto unido novo); o que o serviço que absorve já tinha fica como estava.
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM textos WHERE servico = 'consultoria'").get().n, 0, 'consultoria segue com o texto unido do conteudo.json');
  assert.equal(db.prepare("SELECT preco FROM textos WHERE servico = 'ensino'").get().preco, 900);
});
