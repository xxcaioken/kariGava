// O que cada página pública que vem do banco precisa ler (home e /lalaia). Cada página consulta só o que mostra:
// a /lalaia (link da bio, no-cache) não paga pelas leituras de textos, depoimentos, antes e depois e FAQ da home.
// `itens` é fatal (sem fotos não há página); os blocos são tolerantes: falha vira vazio + log, e a seção some.
import { listarItens, lerTextos } from './itens.js';
import { listarProdutos } from './produtos.js';
import { lerCondicoes, lerCupom } from './config.js';
import { listarDepoimentos } from './depoimentos.js';
import { listarPares } from './antesdepois.js';
import { listarFaq } from './faq.js';

export const tolerante = (promessa, padrao) => promessa.catch(e => { console.error(e?.stack || e); return padrao; });

const DA_LOJA = env => ({
  itens: listarItens(env),
  produtos: tolerante(listarProdutos(env), []),
  condicoes: tolerante(lerCondicoes(env), null),
  cupom: tolerante(lerCupom(env), null),
});

const LEITURAS = {
  '/': env => ({
    ...DA_LOJA(env),
    textos: lerTextos(env),
    depoimentos: tolerante(listarDepoimentos(env), []),
    antesDepois: tolerante(listarPares(env), []),
    faq: tolerante(listarFaq(env), []),
  }),
  '/lalaia': DA_LOJA,
};

export async function dadosDaPagina(env, caminho) {
  const promessas = LEITURAS[caminho](env);
  const chaves = Object.keys(promessas);
  const valores = await Promise.all(Object.values(promessas));
  return Object.fromEntries(chaves.map((k, i) => [k, valores[i]]));
}
