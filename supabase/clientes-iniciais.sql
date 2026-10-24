-- Cadastro inicial dos clientes atuais da HM e de um trabalho para cada um.
-- Como usar: Supabase → SQL Editor → New query → cole este arquivo → Run.
-- Pode rodar mais de uma vez: só cadastra quem ainda não existe (compara pelo nome da empresa).
-- Todos são clientes fixos com pagamento semanal. O valor e o dia do pagamento ficam em branco:
-- completem em Clientes → abrir o cliente, e depois usem Financeiro → "Gerar cobranças do mês".
-- Os clientes antigos não contam como "clientes novos" nas metas; a Matos conta, porque fechou agora.

insert into clients (name, company, instagram, stage, won_at, notes, billing)
select v.name, v.company, v.instagram, v.stage, v.won_at::date, v.notes, 'semanal'
from (values
  ('Tiago Henrique', 'Legend', 'uselegendoficial', 'ativo', null,
   'Bolsas personalizadas. Marketing, sistemas e estratégia de crescimento. A HM fez o cartão digital do CEO (thiago.uselegend.com).'),
  ('Barbearia C7', 'Barbearia C7', 'c7barbearia', 'ativo', null,
   'Barbearia tradicional. Marketing, sistemas e estratégia de crescimento.'),
  ('Chefe André Luiz', 'Espetinho dos Amigos', null, 'ativo', null,
   'Espetinho e jantinha no Setor Sudoeste, Goiânia. Delivery pelo iFood: https://www.ifood.com.br/delivery/goiania-go/espetinho-e-jantinha-dos-amigos-setor-sudoeste/33e48e64-fd5b-4406-a7d9-128bb3286845'),
  ('Matos Contabilidade', 'Matos Contabilidade', null, 'fechado', current_date::text,
   'Projeto fechado, ainda vai começar.')
) as v(name, company, instagram, stage, won_at, notes)
where not exists (select 1 from clients c where lower(c.company) = lower(v.company));

insert into projects (client_id, title, service, status, billing)
select c.id, v.title, v.service, v.status, v.billing
from (values
  ('Legend', 'Marketing, sistemas e crescimento', 'Marketing digital', 'em_andamento', 'semanal'),
  ('Barbearia C7', 'Marketing, sistemas e crescimento', 'Marketing digital', 'em_andamento', 'semanal'),
  ('Espetinho dos Amigos', 'Delivery no iFood', 'Delivery', 'em_andamento', 'semanal'),
  ('Matos Contabilidade', 'Projeto inicial', 'Outro', 'a_fazer', 'semanal')
) as v(company, title, service, status, billing)
join clients c on lower(c.company) = lower(v.company)
where not exists (select 1 from projects p where p.client_id = c.id);

-- Se este arquivo já tinha sido rodado antes (com "mensal"), passa esses clientes para semanal.
update clients set billing = 'semanal'
where billing is null and lower(company) in ('legend', 'barbearia c7', 'espetinho dos amigos', 'matos contabilidade');
update projects set billing = 'semanal'
where billing in ('mensal', 'fechado') and price is null
  and client_id in (select id from clients where lower(company) in ('legend', 'barbearia c7', 'espetinho dos amigos', 'matos contabilidade'));
