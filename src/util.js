export class ErroApi extends Error {
  constructor(status, erro, mensagem) {
    super(mensagem || erro);
    this.status = status;
    this.erro = erro;
    this.mensagem = mensagem;
  }
}

export function json(dados, status = 200, cabecalhos = {}) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...cabecalhos },
  });
}

export function respostaDeErro(e) {
  const corpo = { erro: e.erro };
  if (e.mensagem) corpo.mensagem = e.mensagem;
  return json(corpo, e.status);
}

export const agora = () => new Date().toISOString();

export function novoId(prefixo) {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return `${prefixo}_${b64url(bytes)}`;
}

export function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function deB64url(texto) {
  const s = atob(texto.replaceAll('-', '+').replaceAll('_', '/'));
  return Uint8Array.from(s, c => c.charCodeAt(0));
}

const codificador = new TextEncoder();

async function chaveHmac(segredo) {
  if (!segredo) throw new Error('SEGREDO_SESSAO não configurado');
  return crypto.subtle.importKey('raw', codificador.encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function assinar(segredo, texto) {
  const chave = await chaveHmac(segredo);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', chave, codificador.encode(texto))));
}

export async function conferirAssinatura(segredo, texto, assinatura) {
  const chave = await chaveHmac(segredo);
  let bytes;
  try { bytes = deB64url(assinatura); } catch { return false; }
  // verify() compara em tempo constante.
  return crypto.subtle.verify('HMAC', chave, bytes, codificador.encode(texto));
}

export async function lerJson(request) {
  try {
    return await request.json();
  } catch {
    throw new ErroApi(400, 'json_invalido');
  }
}

export function emailsPermitidos(env) {
  return String(env.EMAILS_PERMITIDOS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
}
