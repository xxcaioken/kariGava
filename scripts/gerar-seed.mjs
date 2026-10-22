// Gera migrations/0002_fotos_iniciais.sql a partir de conteudo.json,
// para o site já nascer com as fotos escolhidas no Instagram.
import { readFileSync, writeFileSync } from 'node:fs';

const raiz = new URL('..', import.meta.url);
const c = JSON.parse(readFileSync(new URL('conteudo.json', raiz), 'utf8'));
const agora = '2026-10-22T00:00:00.000Z';
const linhas = [];
const sql = s => `'${String(s).replaceAll("'", "''")}'`;

function item(secao, ordem, foto, titulo) {
  const chave = foto.replace(/^\/?/, '');
  linhas.push(`INSERT INTO itens (id, secao, ordem, titulo, foto_chave, origem, criado_em) VALUES (${sql(`ini_${secao}_${ordem}`)}, ${sql(secao)}, ${ordem}, ${sql(titulo)}, ${sql(chave)}, 'inicial', ${sql(agora)});`);
}

for (const s of c.servicos) item(s.id, 0, s.foto, s.titulo);
item('sobre', 0, c.sobre.foto, 'Kari');

// Fotos com o mesmo título viram um produto só no site.
let ordem = 0;
for (const linha of c.lalaia.linhas) {
  for (const foto of linha.fotos) item('lalaia', ordem++, foto, linha.titulo);
}

writeFileSync(new URL('migrations/0002_fotos_iniciais.sql', raiz), `-- Gerado por scripts/gerar-seed.mjs. Não editar à mão.\n${linhas.join('\n')}\n`);
console.log(`${linhas.length} fotos iniciais`);
