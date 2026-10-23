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

// ---------- Cupom de primeira encomenda (R-08) ----------
export const CUPOM_PADRAO = Object.freeze({ ativo: false, codigo: '', desconto: null, valido_ate: '' });
const MSG_DATA = 'Use uma data no formato dia/mês/ano.';

export async function lerCupom(env) {
  const c = await lerConfig(env, 'cupom', {});
  return {
    ativo: c?.ativo === true,
    codigo: typeof c?.codigo === 'string' ? c.codigo : '',
    desconto: Number.isInteger(c?.desconto) ? c.desconto : null,
    valido_ate: typeof c?.valido_ate === 'string' ? c.valido_ate : '',
  };
}

// "AAAA-MM-DD" que existe no calendário (2026-02-30 não).
function dataValida(texto) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const d = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === texto;
}

// Data de hoje em Florianópolis, no formato de `valido_ate`, para comparar como texto.
export function hojeNoBrasil(agoraMs = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(agoraMs));
}

// Ligado, com código e desconto, e sem data vencida (a data vale até o fim do dia).
export function cupomVigente(cupom, hoje = hojeNoBrasil()) {
  return Boolean(cupom && cupom.ativo && cupom.codigo && Number.isInteger(cupom.desconto) && (!cupom.valido_ate || cupom.valido_ate >= hoje));
}

// PUT parcial: ausente mantém, null no cupom inteiro zera. Puro, para testar sem banco.
export function validarCupom(atual, campos) {
  if (campos === null) return { ...CUPOM_PADRAO };
  if (!campos || typeof campos !== 'object' || Array.isArray(campos)) throw new ErroApi(400, 'cupom_invalido', 'Mande o cupom com ativo, codigo, desconto e valido_ate.');
  const novo = { ...CUPOM_PADRAO, ...atual };
  for (const [campo, valor] of Object.entries(campos)) {
    const vazio = valor === null || valor === undefined || valor === '';
    if (campo === 'ativo') {
      if (typeof valor !== 'boolean') throw new ErroApi(400, 'cupom_invalido', 'O cupom só pode estar ligado ou desligado.');
      novo.ativo = valor;
    } else if (campo === 'codigo') {
      if (vazio) { novo.codigo = ''; continue; }
      const codigo = typeof valor === 'string' ? valor.trim().toUpperCase() : '';
      if (!/^[A-Z0-9]{1,20}$/.test(codigo)) throw new ErroApi(400, 'cupom_invalido', 'O código tem até 20 letras ou números, sem espaços nem acentos.');
      novo.codigo = codigo;
    } else if (campo === 'desconto') {
      if (vazio) { novo.desconto = null; continue; }
      if (!Number.isInteger(valor) || valor < 1 || valor > 99) throw new ErroApi(400, 'cupom_invalido', 'O desconto vai de 1 a 99%.');
      novo.desconto = valor;
    } else if (campo === 'valido_ate') {
      if (vazio) { novo.valido_ate = ''; continue; }
      if (typeof valor !== 'string' || !dataValida(valor)) throw new ErroApi(400, 'cupom_invalido', MSG_DATA);
      novo.valido_ate = valor;
    } else {
      throw new ErroApi(400, 'cupom_invalido', `Não existe o campo "${campo}" no cupom. Os campos são: ativo, codigo, desconto e valido_ate.`);
    }
  }
  if (novo.ativo && !novo.codigo) throw new ErroApi(400, 'cupom_invalido', 'Para ligar o cupom, preencha o código.');
  if (novo.ativo && !novo.desconto) throw new ErroApi(400, 'cupom_invalido', 'Para ligar o cupom, preencha o desconto.');
  return novo;
}

// PUT /api/painel/lalaia/condicoes: condições, gbp_url e cupom no mesmo corpo, gravados num só batch.
export async function salvarCondicoes(env, campos) {
  if (!campos || typeof campos !== 'object' || Array.isArray(campos)) throw new ErroApi(400, 'condicao_invalida', 'Mande as condições como campos de texto.');
  const { cupom: camposCupom, ...resto } = campos;
  const [atual, cupomAtual] = await Promise.all([lerCondicoes(env), lerCupom(env)]);
  const condicoes = validarCondicoes(atual, resto);
  const cupom = 'cupom' in campos ? validarCupom(cupomAtual, camposCupom) : cupomAtual;
  const { gbp_url, ...textos } = condicoes;
  await env.DB.batch([gravarConfig(env, 'condicoes', textos), gravarConfig(env, 'gbp_url', gbp_url), gravarConfig(env, 'cupom', cupom)]);
  return { condicoes, cupom };
}
