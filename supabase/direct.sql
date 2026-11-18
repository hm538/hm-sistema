-- HM Sistema · Direct (automação de comentários e Direct do Instagram dos clientes).
-- Rodar no Supabase → SQL Editor → New query → Run. Pode rodar de novo sem perder dados.
-- Depende de: clients e is_team() (schema.sql).
--
-- Privacidade: não guardamos nome, @ nem texto de quem comenta ou manda mensagem.
-- ig_contacts guarda só um código embaralhado (hash) do remetente, para saber se é o 1º Direct.
-- ig_events guarda só qual regra disparou, onde e quando; apagamos depois de 180 dias.

create table if not exists ig_accounts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,
  ig_id text not null unique,          -- ID da conta profissional (aparece no painel da Meta)
  username text,                       -- @ sem o arroba
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists ig_rules (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ig_accounts(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('comment', 'dm', 'story_mention', 'welcome')),
  keywords text[] not null default '{}',   -- vazio em story_mention e welcome
  dm text not null check (length(dm) between 1 and 1000),
  public_replies text[] not null default '{}', -- só para comentários; sorteia uma
  active boolean not null default true,
  priority int not null default 100,       -- menor = verificada primeiro
  created_at timestamptz not null default now()
);
create index if not exists ig_rules_account on ig_rules (account_id);

create table if not exists ig_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ig_accounts(id) on delete cascade,
  rule_id uuid references ig_rules(id) on delete set null,
  kind text not null,                      -- comment, dm, story_mention, welcome
  media_id text,                           -- post/reel do comentário
  media_url text,                          -- link do post (para o relatório)
  status text not null check (status in ('enviado', 'falhou')),
  error text,
  created_at timestamptz not null default now()
);
create index if not exists ig_events_account_time on ig_events (account_id, created_at desc);
alter table ig_events add column if not exists media_url text;

create table if not exists ig_contacts (
  account_id uuid not null references ig_accounts(id) on delete cascade,
  contact_hash text not null,
  first_seen timestamptz not null default now(),
  primary key (account_id, contact_hash)
);

-- Chave do servidor hm-direct: guardamos só o hash (SHA-256), nunca a chave.
create table if not exists direct_settings (
  id int primary key default 1 check (id = 1),
  key_hash text not null
);
alter table direct_settings enable row level security; -- sem política: ninguém lê pela API

-- Equipe HM vê e edita tudo pelo sistema
do $$
declare t text;
begin
  foreach t in array array['ig_accounts', 'ig_rules', 'ig_events', 'ig_contacts'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "equipe HM" on %I', t);
    execute format('create policy "equipe HM" on %I for all to authenticated using (is_team()) with check (is_team())', t);
  end loop;
end $$;

-- ---------- Funções que o servidor hm-direct chama (com a chave dele) ----------
create or replace function direct_ok(p_key text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from direct_settings
    where key_hash = encode(sha256(convert_to(coalesce(p_key, ''), 'UTF8')), 'hex'))
$$;

-- Regras ativas da conta (por ID do Instagram)
create or replace function direct_rules(p_key text, p_ig text) returns json
language plpgsql stable security definer set search_path = public as $$
declare acc ig_accounts;
begin
  if not direct_ok(p_key) then raise exception 'chave inválida'; end if;
  select * into acc from ig_accounts where ig_id = p_ig and active;
  if acc.id is null then return null; end if;
  return json_build_object('account_id', acc.id, 'rules', coalesce((
    select json_agg(json_build_object('id', r.id, 'kind', r.kind, 'keywords', r.keywords,
      'dm', r.dm, 'public_replies', r.public_replies) order by r.priority, r.created_at)
    from ig_rules r where r.account_id = acc.id and r.active), '[]'::json));
end $$;

-- Marca o remetente; devolve true se é a primeira vez que ele fala com a conta
create or replace function direct_seen(p_key text, p_account uuid, p_hash text) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  if not direct_ok(p_key) then raise exception 'chave inválida'; end if;
  if p_hash !~ '^[0-9a-f]{64}$' then raise exception 'hash inválido'; end if;
  insert into ig_contacts (account_id, contact_hash) values (p_account, p_hash) on conflict do nothing;
  get diagnostics n = row_count;
  return n = 1;
end $$;

-- Registra o que foi enviado (e limpa o que passou de 180 dias)
drop function if exists direct_log(text, uuid, uuid, text, text, text, text);
create or replace function direct_log(p_key text, p_account uuid, p_rule uuid, p_kind text,
  p_media text, p_status text, p_error text default null, p_url text default null) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not direct_ok(p_key) then raise exception 'chave inválida'; end if;
  insert into ig_events (account_id, rule_id, kind, media_id, media_url, status, error)
  values (p_account, p_rule, left(p_kind, 20), left(p_media, 64),
    case when p_url ~ '^https://(www\.)?instagram\.com/' then left(p_url, 200) end, p_status, left(p_error, 300));
  delete from ig_events where account_id = p_account and created_at < now() - interval '180 days';
end $$;

revoke all on function direct_ok(text) from public, anon, authenticated;
revoke all on function direct_rules(text, text) from public;
revoke all on function direct_seen(text, uuid, text) from public;
revoke all on function direct_log(text, uuid, uuid, text, text, text, text, text) from public;
grant execute on function direct_rules(text, text) to anon;
grant execute on function direct_seen(text, uuid, text) to anon;
grant execute on function direct_log(text, uuid, uuid, text, text, text, text, text) to anon;

-- Resumo dos últimos 30 dias para a aba Direct (respeita o RLS de quem consulta)
create or replace view ig_stats with (security_invoker = true) as
select account_id, rule_id, kind, media_id, max(media_url) as media_url, status,
  count(*)::int as n, max(created_at) as last_at
from ig_events where created_at > now() - interval '30 days'
group by account_id, rule_id, kind, media_id, status;
revoke all on ig_stats from anon;
