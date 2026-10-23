-- Serviços sem repetição (ajustes da Kari, 23/10/2026): a edição do guarda-roupa passa a fazer parte da
-- Consultoria de estilo e a Oficina de Look entra em Cursos, oficinas e palestras. Nada é apagado: fotos,
-- depoimentos e pares mudam de serviço; as fotos movidas vão para depois das que já estavam lá.

UPDATE itens SET secao = 'consultoria', ordem = ordem + 1000 WHERE secao = 'edicao';
UPDATE itens SET secao = 'ensino', ordem = ordem + 1000 WHERE secao = 'oficina-look';

UPDATE depoimentos SET servico = 'consultoria' WHERE servico = 'edicao';
UPDATE depoimentos SET servico = 'ensino' WHERE servico = 'oficina-look';

UPDATE antes_depois SET servico = 'consultoria' WHERE servico = 'edicao';
UPDATE antes_depois SET servico = 'ensino' WHERE servico = 'oficina-look';

-- Texto e preço editados: o serviço que absorve fica com o seu, se tiver; senão herda o do extinto.
UPDATE OR IGNORE textos SET servico = 'consultoria' WHERE servico = 'edicao';
UPDATE OR IGNORE textos SET servico = 'ensino' WHERE servico = 'oficina-look';
DELETE FROM textos WHERE servico IN ('edicao', 'oficina-look');
