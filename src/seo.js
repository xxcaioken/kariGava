// Prévia do link, sitemap, robots e dados estruturados (R-09).
// A base absoluta vem da var SITE_URL (domínio final) ou, sem ela, do origin do request (workers.dev).
import conteudo from '../conteudo.json' with { type: 'json' };
import { esc } from './site.js';

export function baseDoSite(env = {}, request) {
  const configurada = String(env.SITE_URL || '').trim().replace(/\/+$/, '');
  if (configurada) return configurada;
  return new URL(request.url).origin;
}

export const telefoneE164 = numero => `+${String(numero ?? '').replace(/\D/g, '')}`;

// <head> comum: canonical e og:url absolutos, og.jpg 1200×630, Twitter card. Cada página passa o próprio título/descrição.
export function metaBase({ base, caminho, titulo, descricao, imagem = '/og.jpg', imagemAlt = `${conteudo.marca.nome}, ${conteudo.marca.profissao}`, tipo = 'website' }) {
  const url = `${base}${caminho}`;
  const img = `${base}${imagem}`;
  return [
    `<link rel="canonical" href="${esc(url)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:type" content="${esc(tipo)}">`,
    `<meta property="og:locale" content="pt_BR">`,
    `<meta property="og:site_name" content="${esc(conteudo.marca.assinatura)}">`,
    `<meta property="og:title" content="${esc(titulo)}">`,
    `<meta property="og:description" content="${esc(descricao)}">`,
    `<meta property="og:image" content="${esc(img)}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${esc(imagemAlt)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(titulo)}">`,
    `<meta name="twitter:description" content="${esc(descricao)}">`,
    `<meta name="twitter:image" content="${esc(img)}">`,
  ].join('\n');
}

// JSON dentro de <script>: "<", ">", "&", U+2028 e U+2029 viram \uXXXX, então nada fecha a tag nem quebra o parse.
function jsonSeguro(valor) {
  return JSON.stringify(valor).replace(/[<>&\u2028\u2029]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

const absoluta = (base, caminho) => (/^https?:\/\//.test(caminho) ? caminho : `${base}${caminho.startsWith('/') ? '' : '/'}${caminho}`);

// ProfessionalService + Person + os produtos da LALAIÁ. `d` é o de montarDados.
export function jsonLd(d, { base, whatsappNumero }) {
  const redes = Object.values(conteudo.marca.instagram);
  const precos = d.servicos.map(s => s.preco?.valor).filter(Boolean).map(v => Number(v.replace(/\D/g, ''))).filter(n => n > 0);
  const negocio = {
    '@type': 'ProfessionalService',
    '@id': `${base}/#negocio`,
    name: conteudo.marca.assinatura,
    alternateName: conteudo.marca.nome,
    description: conteudo.hero.subtitulo,
    url: `${base}/`,
    image: `${base}/og.jpg`,
    telephone: telefoneE164(whatsappNumero || conteudo.marca.whatsapp_numero),
    address: { '@type': 'PostalAddress', addressLocality: 'Florianópolis', addressRegion: 'SC', addressCountry: 'BR' },
    areaServed: 'Florianópolis, SC',
    sameAs: redes,
    founder: { '@id': `${base}/#kari` },
    ...(precos.length ? { priceRange: `a partir de R$ ${Math.min(...precos).toLocaleString('pt-BR')}` } : {}),
  };
  const pessoa = {
    '@type': 'Person',
    '@id': `${base}/#kari`,
    name: conteudo.marca.nome,
    jobTitle: conteudo.marca.profissao.replace(' · ', ' e '),
    url: `${base}/`,
    sameAs: redes,
    worksFor: { '@id': `${base}/#negocio` },
  };
  return `<script type="application/ld+json">${jsonSeguro({ '@context': 'https://schema.org', '@graph': [negocio, pessoa, ...produtosLd(d, base)] })}</script>`;
}

// Um Product por produto da LALAIÁ (offers quando há preço); a página de cada um é a /lalaia.
function produtosLd(d, base) {
  return d.lalaia.produtos.map(p => ({
    '@type': 'Product',
    name: p.titulo,
    ...(p.descricao ? { description: p.descricao } : {}),
    image: p.fotos.map(f => absoluta(base, f.foto_url)),
    brand: { '@type': 'Brand', name: conteudo.lalaia.nome },
    url: `${base}/lalaia`,
    ...(Number.isInteger(p.preco) && p.preco > 0 ? {
      offers: {
        '@type': 'Offer',
        price: p.preco,
        priceCurrency: 'BRL',
        availability: p.disponibilidade === 'pronta' ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder',
        url: `${base}/lalaia`,
        seller: { '@id': `${base}/#negocio` },
      },
    } : {}),
  }));
}

// /lalaia: só os produtos; o vendedor é o mesmo negócio da home (@id).
export function jsonLdLalaia(d, { base }) {
  return `<script type="application/ld+json">${jsonSeguro({ '@context': 'https://schema.org', '@graph': produtosLd(d, base) })}</script>`;
}

export function sitemap(base) {
  const paginas = ['/', '/lalaia', '/quiz', '/privacidade'];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paginas.map(p => `  <url><loc>${esc(base)}${esc(p)}</loc></url>`).join('\n')}
</urlset>
`;
}

export function robots(base) {
  return `User-agent: *
Allow: /
Disallow: /painel/
Disallow: /api/

Sitemap: ${base}/sitemap.xml
`;
}
