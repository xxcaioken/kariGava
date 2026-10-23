-- Perguntas frequentes (R-06): editadas no painel, com interruptor de publicação.
-- revisada = 1 quando a Kari editou o texto (as iniciais nascem como rascunho).
CREATE TABLE faq (
  id          TEXT PRIMARY KEY,
  ordem       INTEGER NOT NULL,
  grupo       TEXT NOT NULL,              -- voce | lojas | lalaia
  pergunta    TEXT NOT NULL,              -- até 140 letras
  resposta    TEXT NOT NULL,              -- até 600 letras
  publicada   INTEGER NOT NULL DEFAULT 0,
  revisada    INTEGER NOT NULL DEFAULT 0,
  criado_em   TEXT NOT NULL,
  removido_em TEXT
);
CREATE INDEX faq_ordem ON faq (ordem) WHERE removido_em IS NULL;

-- Conteúdo inicial: o mesmo de scripts/faq-inicial.sql (fonte única; mantenha os dois iguais).
INSERT INTO faq (id, ordem, grupo, pergunta, resposta, publicada, revisada, criado_em) VALUES
  ('faq_01', 0, 'voce', 'Preciso comprar roupa nova?', 'Não. A consultoria e a edição começam pelo que você já tem no armário: a ideia é combinar melhor, tirar o que não serve mais e, só se fizer falta, montar uma lista de compras certeira.', 1, 0, '2026-10-22T00:00:00.000Z'),
  ('faq_02', 1, 'voce', 'Como é a Oficina de Look?', 'Um encontro em grupo (amigas, empresa ou evento) para aprender a montar looks com as peças que vocês já têm. Tem conversa sobre estilo e prática com roupa de verdade, e cada pessoa sai com ideias para usar no dia a dia.', 1, 0, '2026-10-22T00:00:00.000Z'),
  ('faq_03', 2, 'voce', 'Atende online?', 'Sim: a consultoria de estilo pode ser por videochamada, com o material enviado depois. A edição de guarda-roupa é presencial, porque precisa do armário na frente.', 0, 0, '2026-10-22T00:00:00.000Z'),
  ('faq_04', 3, 'voce', 'Quanto tempo leva a edição de guarda-roupa?', 'Em geral um encontro de 3 a 4 horas, dependendo do tamanho do armário. Combinamos a data pelo WhatsApp.', 0, 0, '2026-10-22T00:00:00.000Z'),
  ('faq_05', 4, 'lojas', 'Atende lojas fora de Florianópolis?', 'Sim. Para lojas de outras cidades, a consultoria de vitrine e visual merchandising pode começar online e, se fizer sentido, ter uma visita presencial combinada à parte.', 0, 0, '2026-10-22T00:00:00.000Z'),
  ('faq_06', 5, 'lalaia', 'Como funciona a encomenda na LALAIÁ?', 'Você me chama no WhatsApp dizendo a peça e a cor, eu confirmo prazo e valor com o frete e, depois do pagamento, a peça é feita à mão e enviada. Tudo sob encomenda.', 1, 0, '2026-10-22T00:00:00.000Z'),
  ('faq_07', 6, 'lalaia', 'Enviam para todo o Brasil?', 'Sim, enviamos para todo o Brasil pelos Correios. O frete é combinado na hora da encomenda, pelo WhatsApp.', 1, 0, '2026-10-22T00:00:00.000Z'),
  ('faq_08', 7, 'lalaia', 'Posso trocar uma peça sob encomenda?', 'Peça feita sob medida para você não tem troca por arrependimento. Se chegar com algum defeito, eu arrumo ou refaço sem custo.', 0, 0, '2026-10-22T00:00:00.000Z');
