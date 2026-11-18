-- Atualização dos clientes · 18/11/2026
-- MK Detailing (grátis por 2 meses), Lorrayne, Espetinho dos Amigos com Delivery no portal, C7 pausada e logos.
-- Rode DEPOIS do schema.sql, do portal.sql e do 003_delivery.sql. Pode rodar de novo sem duplicar nada.

-- Nova etapa "Pausado" (serviço parado por enquanto, sem cobrança)
alter table clients drop constraint if exists clients_stage_check;
alter table clients add constraint clients_stage_check
  check (stage in ('contato', 'proposta', 'fechado', 'ativo', 'pausado', 'encerrado'));

-- Cortesia: até quando o cliente não paga (o sistema avisa quando estiver chegando a hora de renegociar)
alter table clients add column if not exists free_until date;

-- MK Detailing: grátis de 18/11/2026 até 18/01/2027, depois renegociar
insert into clients (name, company, stage, won_at, fee, billing, free_until, notes, portal_services)
select 'MK Detailing', 'MK Detailing', 'ativo', date '2026-11-18', 0, 'mensal', date '2027-01-18',
  'Lava jato delivery (estética automotiva). Agenda e CRM no sistema.mkdetaling.com + Instagram. Gratuito por 2 meses (18/11/2026 a 18/01/2027); depois renegociar os valores.',
  '{conteudo}'
where not exists (select 1 from clients where company ilike 'mk detail%' or name ilike 'mk detail%');

insert into projects (client_id, title, service, status, billing, start_date)
select c.id, 'Agenda, CRM e Instagram', 'Marketing digital', 'em_andamento', 'mensal', date '2026-11-18'
from clients c where c.company ilike 'mk detail%'
  and not exists (select 1 from projects p where p.client_id = c.id);

-- Lorrayne
insert into clients (name, stage, won_at, notes)
select 'Lorrayne', 'ativo', date '2026-11-18', 'Cliente nova (18/11/2026). Completar empresa, WhatsApp, valor e serviços.'
where not exists (select 1 from clients where name ilike 'lorrayne%' or company ilike 'lorrayne%');

-- Espetinho dos Amigos: liga a área de Delivery no portal
update clients set portal_services = portal_services || '{delivery}'
where company ilike 'espetinho dos amigos' and not ('delivery' = any(portal_services));

-- C7: serviço pausado por enquanto (sai das cobranças e do portal da equipe)
update clients set stage = 'pausado',
  notes = coalesce(notes || E'\n', '') || 'Serviço pausado em 18/11/2026.'
where company ilike 'barbearia c7' and stage <> 'pausado';
update projects set status = 'pausado'
where status in ('a_fazer', 'em_andamento', 'revisao')
  and client_id in (select id from clients where company ilike 'barbearia c7');

-- Logos (ficam no próprio portal; dá para trocar em Clientes → Acessos)
update clients set portal_logo = v.logo
from (values
  ('legend%', '/assets/img/clientes/legend.webp'),
  ('barbearia c7', '/assets/img/clientes/c7.webp'),
  ('espetinho dos amigos', '/assets/img/clientes/espetinho.webp'),
  ('mat%os contabilidade', '/assets/img/clientes/mathos.webp'),
  ('mk detail%', '/assets/img/clientes/mk.webp')
) as v(pattern, logo)
where clients.company ilike v.pattern and clients.portal_logo is null;

-- Conferência: deve listar os clientes com etapa, cortesia, serviços do portal e logo
select company, name, stage, free_until, portal_services, portal_logo from clients order by stage, company;
