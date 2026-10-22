import { ErroApi, agora, assinar, conferirAssinatura, b64url, deB64url, emailsPermitidos } from './util.js';
import { enviarCodigo } from './email.js';

export const COOKIE = 'kari_sessao';
const SESSAO_SEGUNDOS = 60 * 24 * 60 * 60;
const CODIGO_MINUTOS = 10;
const MAX_TENTATIVAS = 5;
const JANELA_MINUTOS = 15;
const MAX_PEDIDOS = 5;

const minutosDepois = (iso, min) => new Date(new Date(iso).getTime() + min * 60_000).toISOString();

export function normalizarEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function gerarCodigo() {
  // Amostragem por rejeição para não favorecer nenhum número.
  const limite = Math.floor(0x1_0000_0000 / 1_000_000) * 1_000_000;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf); while (buf[0] >= limite);
  return String(buf[0] % 1_000_000).padStart(6, '0');
}

export async function pedirCodigo(env, emailBruto) {
  const email = normalizarEmail(emailBruto);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new ErroApi(400, 'email_invalido', 'Esse e-mail parece incompleto. Confira se tem @ e o final, como .com');
  }
  // Para e-mails fora da lista, responde igual, sem enviar nada.
  if (!emailsPermitidos(env).includes(email)) return;

  const t = agora();
  const linha = await env.DB.prepare('SELECT janela_inicio, pedidos FROM codigos_login WHERE email = ?').bind(email).first();
  let janela = t;
  let pedidos = 1;
  if (linha && minutosDepois(linha.janela_inicio, JANELA_MINUTOS) > t) {
    if (linha.pedidos >= MAX_PEDIDOS) {
      throw new ErroApi(429, 'muitas_tentativas', 'Você pediu muitos códigos seguidos. Espere 15 minutos e peça de novo.');
    }
    janela = linha.janela_inicio;
    pedidos = linha.pedidos + 1;
  }

  const codigo = gerarCodigo();
  const hash = await assinar(env.SEGREDO_SESSAO, `${email}:${codigo}`);
  await env.DB.prepare(
    `INSERT INTO codigos_login (email, codigo_hash, expira_em, tentativas, janela_inicio, pedidos)
     VALUES (?1, ?2, ?3, 0, ?4, ?5)
     ON CONFLICT (email) DO UPDATE SET codigo_hash = ?2, expira_em = ?3, tentativas = 0, janela_inicio = ?4, pedidos = ?5`
  ).bind(email, hash, minutosDepois(t, CODIGO_MINUTOS), janela, pedidos).run();

  if (env.DEV_LOGIN === '1') {
    console.log(`[DEV_LOGIN] código para ${email}: ${codigo}`);
    return;
  }
  await enviarCodigo(env, email, codigo);
}

export async function entrar(env, emailBruto, codigoBruto) {
  const email = normalizarEmail(emailBruto);
  const codigo = String(codigoBruto || '').replace(/\D/g, '');
  const invalido = new ErroApi(400, 'codigo_invalido', 'Esse código não confere. Confira no seu e-mail e digite de novo.');
  const expirado = new ErroApi(400, 'codigo_expirado', 'Esse código venceu. Peça um código novo.');

  const linha = await env.DB.prepare('SELECT codigo_hash, expira_em, tentativas FROM codigos_login WHERE email = ?').bind(email).first();
  if (!linha) throw invalido;
  if (linha.expira_em <= agora() || linha.tentativas >= MAX_TENTATIVAS) throw expirado;

  const certo = codigo.length === 6 && await conferirAssinatura(env.SEGREDO_SESSAO, `${email}:${codigo}`, linha.codigo_hash);
  if (!certo) {
    await env.DB.prepare('UPDATE codigos_login SET tentativas = tentativas + 1 WHERE email = ?').bind(email).run();
    throw invalido;
  }
  await env.DB.prepare('DELETE FROM codigos_login WHERE email = ?').bind(email).run();
  return { email, cookie: await criarCookieSessao(env, email) };
}

export async function criarCookieSessao(env, email) {
  const carga = b64url(new TextEncoder().encode(JSON.stringify({ e: email, x: Math.floor(Date.now() / 1000) + SESSAO_SEGUNDOS })));
  const token = `${carga}.${await assinar(env.SEGREDO_SESSAO, carga)}`;
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSAO_SEGUNDOS}`;
}

export const cookieSair = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

function lerCookie(request, nome) {
  const cab = request.headers.get('cookie') || '';
  for (const parte of cab.split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nome) return v.join('=');
  }
  return null;
}

// Devolve o e-mail da sessão ou null.
export async function sessao(env, request) {
  const token = lerCookie(request, COOKIE);
  if (!token) return null;
  const [carga, assinatura] = token.split('.');
  if (!carga || !assinatura || !(await conferirAssinatura(env.SEGREDO_SESSAO, carga, assinatura))) return null;
  let dados;
  try { dados = JSON.parse(new TextDecoder().decode(deB64url(carga))); } catch { return null; }
  if (!dados?.e || !dados?.x || dados.x < Date.now() / 1000) return null;
  // Tirar alguém da lista derruba a sessão na hora.
  if (!emailsPermitidos(env).includes(dados.e)) return null;
  return dados.e;
}

export async function exigirSessao(env, request) {
  const email = await sessao(env, request);
  if (!email) throw new ErroApi(401, 'sem_sessao');
  return email;
}
