-- Dados de cada produto da LALAIÁ. A identidade do produto é o slug do nome das fotos
-- (fotos com o mesmo nome = um produto); a linha sobrevive sem fotos para o preço não se perder no desfazer.
CREATE TABLE produtos (
  slug            TEXT PRIMARY KEY,     -- nome normalizado: minúsculo, sem acento, [^a-z0-9]+ → '-'
  titulo          TEXT NOT NULL,        -- nome como a Kari escreveu (o das fotos)
  preco           INTEGER,              -- reais inteiros; NULL = sem preço no site
  disponibilidade TEXT,                 -- 'pronta' | 'encomenda' | NULL
  prazo_dias      INTEGER,              -- dias úteis, só faz sentido com 'encomenda'
  descricao       TEXT NOT NULL DEFAULT '',
  atualizado_em   TEXT NOT NULL
);
