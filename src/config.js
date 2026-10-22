// Configurações do site que a Kari edita no painel (tabela `config`, chave/valor em JSON).
// Hoje: as condições de "Como encomendar" da LALAIÁ (R-03) e o link das avaliações no Google (gbp_url).
import { ErroApi, agora } from './util.js';

const MAX_TEXTO = 220;
const MAX_URL = 300;
// nome que aparece na mensagem de erro para a Kari
const CAMPOS_TEXTO = { pagamento: 'pagamento', frete: 'frete', prazo_padrao: 'prazo padrão', troca: 'trocas' };
// rótulo no site, na ordem em que as condições aparecem
export const ROTULOS_CONDICOES = { pagamento: 'Pagamento', frete: 'Frete', prazo_padrao: 'Prazo', troca: 'Trocas' };
export const CONDICOES_VAZIAS = Object.freeze({ pagamento: '', frete: '', prazo_padrao: '', troca: '', gbp_url: '' });
const MSG_GBP = 'Cole o link do seu perfil no Google (começa com https://).';

export async function lerConfig(env, chave, padrao = null) {
  const linha = await env.DB.prepare('SELECT valor FROM config WHERE chave = ?').bind(chave).first();
  if (!linha) return padrao;
  try { return JSON.parse(linha.valor); } catch { return padrao; }
}

function gravarConfig(env, chave, valor) {
  return env.DB.prepare(
    'INSERT INTO config (chave, valor, atualizado_em) VALUES (?1, ?2, ?3) ON CONFLICT (chave) DO UPDATE SET valor = ?2, atualizado_em = ?3'
  ).bind(chave, JSON.stringify(valor), agora());
}

export async function lerCondicoes(env) {
  const [textos, gbp] = await Promise.all([lerConfig(env, 'condicoes', {}), lerConfig(env, 'gbp_url', '')]);
  const c = { ...CONDICOES_VAZIAS };
  for (const campo of Object.keys(CAMPOS_TEXTO)) if (typeof textos?.[campo] === 'string') c[campo] = textos[campo];
  if (typeof gbp === 'string') c.gbp_url = gbp;
  return c;
}

function validarGbp(valor) {
  if (valor === null || valor === undefined) return '';
  if (typeof valor !== 'string') throw new ErroApi(400, 'condicao_invalida', MSG_GBP);
  const texto = valor.trim();
  if (!texto) return '';
  if (texto.length > MAX_URL) throw new ErroApi(400, 'condicao_invalida', `${MSG_GBP} Ele pode ter até ${MAX_URL} letras; este tem ${texto.length}.`);
  let url;
  try { url = new URL(texto); } catch { throw new ErroApi(400, 'condicao_invalida', MSG_GBP); }
  if (url.protocol !== 'https:' || !url.hostname.includes('.')) throw new ErroApi(400, 'condicao_invalida', MSG_GBP);
  return texto;
}

// PUT parcial: campo ausente mantém, null limpa. Puro, para testar sem banco.
export function validarCondicoes(atual, campos) {
  if (!campos || typeof campos !== 'object' || Array.isArray(campos)) throw new ErroApi(400, 'condicao_invalida', 'Mande as condições como campos de texto.');
  const novo = { ...CONDICOES_VAZIAS, ...atual };
  for (const [campo, valor] of Object.entries(campos)) {
    if (campo === 'gbp_url') { novo.gbp_url = validarGbp(valor); continue; }
    const nome = CAMPOS_TEXTO[campo];
    if (!nome) throw new ErroApi(400, 'condicao_invalida', `Não existe a condição "${campo}". As condições são: pagamento, frete, prazo_padrao, troca e gbp_url.`);
    if (valor === null || valor === undefined) { novo[campo] = ''; continue; }
    if (typeof valor !== 'string') throw new ErroApi(400, 'condicao_invalida', `O campo ${nome} precisa ser um texto.`);
    const texto = valor.replace(/\s+/g, ' ').trim();
    if (texto.length > MAX_TEXTO) throw new ErroApi(400, 'condicao_invalida', `O campo ${nome} pode ter até ${MAX_TEXTO} letras; este tem ${texto.length}.`);
    novo[campo] = texto;
  }
  return novo;
}

export async function salvarCondicoes(env, campos) {
  const novo = validarCondicoes(await lerCondicoes(env), campos);
  const { gbp_url, ...textos } = novo;
  await env.DB.batch([gravarConfig(env, 'condicoes', textos), gravarConfig(env, 'gbp_url', gbp_url)]);
  return novo;
}
