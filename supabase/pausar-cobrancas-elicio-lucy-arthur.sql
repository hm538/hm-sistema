-- 18/11/2026 · Cobranças: Elício e Lucy sem cobrança automática; Arthur pausado.
-- Supabase → SQL Editor → New query → colar → Run. O resultado no fim mostra como cada um ficou.

-- Elício e Lucy: sem cobrança automática (pagamento "avulso"). Quando pagarem, use "Recebi" no cartão do cliente.
update clients set billing = 'avulso', pay_day = null
where name ilike any (array['%el_cio%', '%lucy%']) or company ilike any (array['%el_cio%', '%lucy%']);

-- Apaga as cobranças automáticas deles que ainda não venceram e não foram pagas (as atrasadas ficam, para conferir)
delete from transactions t using clients c
where t.client_id = c.id and t.type = 'entrada' and not t.paid and t.due_date >= current_date
  and (c.name ilike any (array['%el_cio%', '%lucy%']) or c.company ilike any (array['%el_cio%', '%lucy%']));

-- Arthur: serviço pausado. Sai das cobranças até voltar (inclusive a desta semana, que não foi recebida).
update clients set stage = 'pausado',
  notes = coalesce(notes || E'\n', '') || 'Serviço pausado pelo cliente em ' || to_char(current_date, 'DD/MM/YYYY') || '. Cobranças suspensas até voltar.'
where (name ilike any (array['%arthur%', '%artur%']) or company ilike any (array['%arthur%', '%artur%'])) and stage <> 'pausado';

delete from transactions t using clients c
where t.client_id = c.id and t.type = 'entrada' and not t.paid
  and t.due_date >= date_trunc('week', current_date)::date      -- desde a segunda-feira desta semana
  and (c.name ilike any (array['%arthur%', '%artur%']) or c.company ilike any (array['%arthur%', '%artur%']));

update projects set status = 'pausado'
where status in ('a_fazer', 'em_andamento', 'revisao')
  and client_id in (select id from clients where name ilike any (array['%arthur%', '%artur%']) or company ilike any (array['%arthur%', '%artur%']));

-- Conferência: deve aparecer Elício e Lucy como "avulso" e Arthur como "pausado".
-- Se alguém não aparecer, o nome no cadastro está diferente: me mande o print.
select coalesce(c.company, c.name) as cliente, c.name, c.stage, c.billing,
  (select count(*) from transactions t where t.client_id = c.id and t.type = 'entrada' and not t.paid) as cobrancas_em_aberto
from clients c
where c.name ilike any (array['%el_cio%', '%lucy%', '%arthur%', '%artur%'])
   or c.company ilike any (array['%el_cio%', '%lucy%', '%arthur%', '%artur%']);
