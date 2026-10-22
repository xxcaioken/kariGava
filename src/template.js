// Template provisório: será trocado pela evolução da variante D escolhida.
export function template(d, esc) {
  const img = (f, alt = '') => f ? `<img src="${esc(f.foto_url)}" alt="${esc(alt || f.titulo)}" loading="lazy">` : '';
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(d.marca.assinatura)} · Styling & VM</title>
<style>body{font:17px/1.5 system-ui;margin:0 auto;max-width:960px;padding:16px}img{max-width:220px;display:block}.servico{border-left:12px solid var(--c);padding:8px 16px;margin:24px 0}.fotos{display:flex;gap:8px;flex-wrap:wrap}</style>
</head><body>
<h1>${esc(d.hero.titulo)}</h1><p>${esc(d.hero.subtitulo)}</p>
<a href="${esc(d.whatsapp)}">Chamar no WhatsApp</a>
${d.servicos.map(s => `<section class="servico" id="${esc(s.id)}" style="--c:${s.cor}">
  <p>${esc(s.kg)} · ${esc(s.nome)} · ${esc(s.grupo_nome)}</p><h2>${esc(s.titulo)}</h2>
  ${img(s.fotos[0], s.titulo)}<p>${esc(s.resumo)}</p><p><b>Para quem:</b> ${esc(s.para_quem)}</p>
  <a href="${esc(d.whatsapp)}">${esc(s.cta)}</a></section>`).join('')}
<section id="sobre"><h2>Sobre</h2>${img(d.sobre.fotos[0], 'Kari')}<p>${esc(d.sobre.texto)}</p></section>
<section id="lalaia"><h2>${esc(d.lalaia.nome)}</h2><p>${esc(d.lalaia.tagline)}</p>
  <div class="fotos">${d.lalaia.fotos.map(f => `<figure>${img(f)}<figcaption>${esc(f.titulo)}</figcaption></figure>`).join('')}</div></section>
</body></html>`;
}
