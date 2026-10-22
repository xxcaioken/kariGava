// Tirar do site (com desfazer) e mudar a ordem, para as tabelas que têm `ordem` e `removido_em`
// e uma lista só (depoimentos, antes_depois). As fotos (itens) têm a própria versão, por seção.
import { ErroApi, agora } from './util.js';

const TABELAS = new Set(['depoimentos', 'antes_depois']);

export function ordenacao(tabela, paraSaida) {
  if (!TABELAS.has(tabela)) throw new Error(`tabela sem ordenação: ${tabela}`);

  async function buscar(env, id) {
    const l = await env.DB.prepare(`SELECT * FROM ${tabela} WHERE id = ?`).bind(id).first();
    if (!l) throw new ErroApi(404, 'nao_encontrado');
    return l;
  }

  async function listar(env) {
    const { results } = await env.DB.prepare(`SELECT * FROM ${tabela} WHERE removido_em IS NULL ORDER BY ordem`).all();
    return results.map(paraSaida);
  }

  async function proximaOrdem(env) {
    const l = await env.DB.prepare(`SELECT COALESCE(MAX(ordem), -1) + 1 AS n FROM ${tabela} WHERE removido_em IS NULL`).first();
    return l.n;
  }

  async function remover(env, id) {
    const l = await buscar(env, id);
    if (!l.removido_em) await env.DB.prepare(`UPDATE ${tabela} SET removido_em = ? WHERE id = ?`).bind(agora(), id).run();
    return paraSaida(l);
  }

  // Abre espaço na posição antiga e volta para ela.
  async function restaurar(env, id) {
    const l = await buscar(env, id);
    if (l.removido_em) {
      await env.DB.batch([
        env.DB.prepare(`UPDATE ${tabela} SET ordem = ordem + 1 WHERE ordem >= ? AND removido_em IS NULL`).bind(l.ordem),
        env.DB.prepare(`UPDATE ${tabela} SET removido_em = NULL WHERE id = ?`).bind(id),
      ]);
    }
    return paraSaida({ ...l, removido_em: null });
  }

  // Renumera a lista inteira (0..n-1) já com a troca, o que também fecha buracos.
  async function mover(env, id, direcao) {
    if (direcao !== 'cima' && direcao !== 'baixo') throw new ErroApi(400, 'direcao_invalida');
    const l = await buscar(env, id);
    if (l.removido_em) throw new ErroApi(404, 'nao_encontrado');
    const lista = await listar(env);
    const i = lista.findIndex(x => x.id === id);
    const j = direcao === 'cima' ? i - 1 : i + 1;
    if (j >= 0 && j < lista.length) {
      [lista[i], lista[j]] = [lista[j], lista[i]];
      await env.DB.batch(lista.map((x, n) => env.DB.prepare(`UPDATE ${tabela} SET ordem = ? WHERE id = ?`).bind(n, x.id)));
    }
    return listar(env);
  }

  return { buscar, listar, proximaOrdem, remover, restaurar, mover };
}
