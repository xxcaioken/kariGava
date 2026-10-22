// Cabeçalhos de segurança anexados a TODA resposta do Worker (site, painel, API, fotos, assets, erros).
// A CSP é a de docs/spec R-12: só o próprio site, mais as miniaturas do Instagram e o beacon do Cloudflare Web Analytics.
const CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob: https://*.cdninstagram.com https://*.fbcdn.net",
  "script-src 'self' https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' https://cloudflareinsights.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

// Com CSP_MODO=relatorio em .dev.vars, o navegador só avisa no console em vez de bloquear (só para depurar; produção não define a var).
export function cabecalhosDeSeguranca(env = {}) {
  const nomeCsp = env.CSP_MODO === 'relatorio' ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
  return {
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'X-Frame-Options': 'DENY',
    [nomeCsp]: CSP,
  };
}

// Copia a resposta (as do ASSETS e de Response.redirect têm cabeçalhos imutáveis) e anexa os cabeçalhos.
export function comCabecalhos(resposta, env) {
  const r = new Response(resposta.body, resposta);
  for (const [nome, valor] of Object.entries(cabecalhosDeSeguranca(env))) r.headers.set(nome, valor);
  return r;
}
