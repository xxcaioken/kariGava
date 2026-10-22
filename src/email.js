import { EmailMessage } from 'cloudflare:email';

function base64Utf8(texto) {
  let s = '';
  for (const b of new TextEncoder().encode(texto)) s += String.fromCharCode(b);
  return btoa(s);
}

export function montarEmailCodigo({ de, para, codigo, data = new Date() }) {
  const dominio = de.split('@')[1] || 'site';
  const corpo = [
    `Seu código para entrar no painel do site: ${codigo}`,
    '',
    'Ele vale por 10 minutos.',
    'Se não foi você que pediu, pode ignorar este e-mail.',
  ].join('\r\n');
  return [
    `From: Site da Kari <${de}>`,
    `To: <${para}>`,
    `Subject: =?UTF-8?B?${base64Utf8(`Seu código: ${codigo}`)}?=`,
    `Date: ${data.toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${dominio}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Utf8(corpo).replace(/.{76}/g, '$&\r\n'),
  ].join('\r\n');
}

export async function enviarCodigo(env, para, codigo) {
  if (!env.REMETENTE) throw new Error('REMETENTE não configurado');
  const bruto = montarEmailCodigo({ de: env.REMETENTE, para, codigo });
  await env.EMAIL.send(new EmailMessage(env.REMETENTE, para, bruto));
}
