-- As 8 perguntas iniciais da FAQ (R-06), redigidas por nós. Ids fixos faq_01..faq_08.
-- Nascem publicadas só as que se apoiam no que a Kari já disse publicamente; as outras ficam como rascunho
-- para ela revisar e ligar no painel (docs/PENDENCIAS.md). A migration 0008 traz este mesmo conteúdo;
-- o reset local (scripts/resetar-local.sh) reaplica este arquivo.
INSERT INTO faq (id, ordem, grupo, pergunta, resposta, publicada, revisada, criado_em) VALUES
  ('faq_01', 0, 'voce', 'Preciso comprar roupa nova?', 'Não. A consultoria e a edição começam pelo que você já tem no armário: a ideia é combinar melhor, tirar o que não serve mais e, só se fizer falta, montar uma lista de compras certeira.', 1, 0, '2026-10-22T00:00:00.000Z'),
  ('faq_02', 1, 'voce', 'Como é a Oficina de Look?', 'Um encontro em grupo (amigas, empresa ou evento) para aprender a montar looks com as peças que vocês já têm. Tem conversa sobre estilo e prática com roupa de verdade, e cada pessoa sai com ideias para usar no dia a dia.', 1, 0, '2026-10-22T00:00:00.000Z'),
  ('faq_03', 2, 'voce', 'Atende online?', 'Sim: a consultoria de estilo pode ser por videochamada, com o material enviado depois. A edição de guarda-roupa é presencial, porque precisa do armário na frente.', 0, 0, '2026-10-22T00:00:00.000Z'),
  ('faq_04', 3, 'voce', 'Quanto tempo leva a edição de guarda-roupa?', 'Em geral um encontro de 3 a 4 horas, dependendo do tamanho do armário. Combinamos a data pelo WhatsApp.', 0, 0, '2026-10-22T00:00:00.000Z'),
  ('faq_05', 4, 'lojas', 'Atende lojas fora de Florianópolis?', 'Sim. Para lojas de outras cidades, a consultoria de vitrine e visual merchandising pode começar online e, se fizer sentido, ter uma visita presencial combinada à parte.', 0, 0, '2026-10-22T00:00:00.000Z'),
  ('faq_06', 5, 'lalaia', 'Como funciona a encomenda na LALAIÁ?', 'Você me chama no WhatsApp dizendo a peça e a cor, eu confirmo prazo e valor com o frete e, depois do pagamento, a peça é feita à mão e enviada. Tudo sob encomenda.', 1, 0, '2026-10-22T00:00:00.000Z'),
  ('faq_07', 6, 'lalaia', 'Enviam para todo o Brasil?', 'Sim, enviamos para todo o Brasil pelos Correios. O frete é combinado na hora da encomenda, pelo WhatsApp.', 1, 0, '2026-10-22T00:00:00.000Z'),
  ('faq_08', 7, 'lalaia', 'Posso trocar uma peça sob encomenda?', 'Peça feita sob medida para você não tem troca por arrependimento. Se chegar com algum defeito, eu arrumo ou refaço sem custo.', 0, 0, '2026-10-22T00:00:00.000Z');
