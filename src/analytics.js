// Contador de visitas sem cookies (R-11): o beacon do Cloudflare Web Analytics entra no site público
// (home, /quiz, /privacidade) só quando ANALYTICS_TOKEN está definido; o painel nunca é medido.
// A CSP (src/seguranca.js) já libera static.cloudflareinsights.com e cloudflareinsights.com.

// Token do painel da Cloudflare: letras, números e hífen. Qualquer outra coisa é ignorada (nada de aspas no atributo).
const FORMATO_TOKEN = /^[A-Za-z0-9-]{1,64}$/;

export function beaconAnalytics(token) {
  const t = String(token ?? '').trim();
  if (!FORMATO_TOKEN.test(t)) return '';
  return `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${t}"}'></script>`;
}
