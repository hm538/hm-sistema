-- HM Sistema · estrutura do banco
-- Como usar: Supabase → SQL Editor → New query → cole este arquivo inteiro → Run.
-- Pode rodar de novo sem perder dados (só cria o que ainda não existe).

create extension if not exists pgcrypto;

-- Clientes (CRM)
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  phone text,
  email text,
  instagram text,
  stage text not null default 'contato'
    check (stage in ('contato', 'proposta', 'fechado', 'ativo', 'encerrado')),
  notes text,
  created_at timestamptz not null default now()
);

-- Trabalhos / projetos
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,
  title text not null,
  service text,
  owner text,
  status text not null default 'a_fazer'
    check (status in ('a_fazer', 'em_andamento', 'revisao', 'concluido', 'pausado')),
  start_date date,
  due_date date,
  hours_estimated numeric(8, 2),
  price numeric(12, 2),
  billing text not null default 'fechado' check (billing in ('fechado', 'mensal')),
  notes text,
  created_at timestamptz not null default now()
);

-- Horas trabalhadas em cada projeto
create table if not exists time_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  person text,
  date date not null default current_date,
  minutes integer not null check (minutes > 0),
  note text,
  created_at timestamptz not null default now()
);

-- Entradas e saídas
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('entrada', 'saida')),
  description text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  category text,
  client_id uuid references clients(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  due_date date not null,
  paid boolean not null default false,
  paid_date date,
  series_id uuid,            -- mesmo valor para todas as parcelas de uma mensalidade
  created_at timestamptz not null default now()
);

-- Agenda
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null default 'reuniao' check (kind in ('reuniao', 'gravacao', 'entrega', 'outro')),
  start_at timestamptz not null,
  end_at timestamptz,
  client_id uuid references clients(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  person text,
  location text,
  notes text,
  created_at timestamptz not null default now()
);

-- Metas do mês (uma linha por mês, "AAAA-MM")
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  month text not null unique,
  revenue numeric(12, 2),        -- faturamento: entradas recebidas
  profit numeric(12, 2),         -- lucro: entradas recebidas - saídas pagas
  new_clients integer,           -- clientes novos fechados
  delivered integer,             -- trabalhos entregues
  created_at timestamptz not null default now()
);

-- Datas usadas pelas metas (seguro rodar de novo)
alter table clients add column if not exists won_at date;        -- quando virou Fechado/Ativo
alter table projects add column if not exists completed_at date; -- quando foi concluído

-- Valor e frequência de pagamento de cada cliente; cobrança semanal/quinzenal nos trabalhos
alter table clients add column if not exists fee numeric(12, 2);
alter table clients add column if not exists billing text;
alter table clients add column if not exists pay_day smallint;   -- 1 = segunda … 7 = domingo

-- Como foi pago e anotação de cada lançamento
alter table transactions add column if not exists method text;
alter table transactions add column if not exists notes text;
alter table projects drop constraint if exists projects_billing_check;
alter table projects add constraint projects_billing_check check (billing in ('fechado', 'semanal', 'quinzenal', 'mensal'));

-- Contas fixas (aluguel, água, luz…): geram as saídas de cada mês
create table if not exists bills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  amount numeric(12, 2) not null default 0,   -- valor (ou estimativa, se variável)
  freq text not null default 'mensal' check (freq in ('mensal', 'semanal')),
  due_day smallint not null default 10,       -- dia do mês (mensal) ou dia da semana 1-7 (semanal)
  variable boolean not null default false,    -- valor muda todo mês (água, luz)
  active boolean not null default true,
  method text,                                -- forma de pagamento de costume
  notes text,
  created_at timestamptz not null default now()
);
alter table transactions add column if not exists bill_id uuid references bills(id) on delete set null;

-- Calendário de postagens
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  date date not null,
  time text,                       -- "18:30"
  channel text,                    -- Instagram, TikTok…
  format text,                     -- Reels, Carrossel…
  title text not null,             -- tema do post
  caption text,                    -- legenda
  status text not null default 'ideia'
    check (status in ('ideia', 'producao', 'aprovacao', 'agendado', 'publicado')),
  owner text,                      -- responsável
  link text,                       -- arquivo (Drive, Canva…)
  published_url text,              -- link do post publicado
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists posts_date_idx on posts(date);

create index if not exists projects_client_idx on projects(client_id);
create index if not exists time_entries_project_idx on time_entries(project_id);
create index if not exists transactions_due_idx on transactions(due_date);
create index if not exists events_start_idx on events(start_at);

-- Prospecção: empresas que podem virar clientes (coletadas no Instagram/Google Maps ou cadastradas à mão).
-- Só dados públicos de empresa. Quem pede para não receber mensagem fica como 'nao_contatar' e nunca é importado de novo.
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  name text,                       -- pessoa de contato, se pública
  niche text not null default 'outro'
    check (niche in ('industria', 'servicos', 'liberais', 'alimentacao', 'varejo', 'outro')),
  instagram text,                  -- sem @
  phone text,                      -- telefone/WhatsApp comercial público
  site text,
  bio_link text check (bio_link in ('site', 'linktree', 'whatsapp', 'nenhum', 'outro')),
  city text default 'Goiânia',
  address text,
  maps_url text,
  source text not null default 'manual' check (source in ('instagram', 'maps', 'indicacao', 'manual')),
  seed text,                       -- de onde veio (perfil-semente ou busca no Maps)
  followers int,
  last_post date,
  posts_30d int,
  has_site boolean,
  runs_ads boolean,
  manual_ops boolean,              -- agenda/pedidos feitos na mão pelo WhatsApp ou direct
  rating numeric(2,1),
  reviews int,
  offers text[],                   -- ofertas que fazem sentido, da melhor para a pior
  offer text check (offer in ('marketing', 'trafego', 'pitch', 'site', 'sistema')),
  score int check (score between 0 and 100),
  hook text,                       -- frase curta usada na mensagem ("o último post foi há 40 dias")
  diagnosis text,
  message text,
  status text not null default 'novo'
    check (status in ('novo', 'abordado', 'respondeu', 'reuniao', 'fechou', 'sem_interesse', 'nao_contatar')),
  channel text check (channel in ('whatsapp', 'instagram')),
  contacted_at timestamptz,
  followup_on date,
  attempts int not null default 0,
  client_id uuid references clients(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);
create unique index if not exists leads_instagram_uq on leads (lower(instagram)) where instagram is not null and instagram <> '';
create unique index if not exists leads_phone_uq on leads (regexp_replace(phone, '\D', '', 'g')) where phone is not null and phone <> '';
create index if not exists leads_status_idx on leads(status);

-- Etapas do post: o cliente aprova ou pede ajuste pelo Portal do Cliente (hm-portal)
alter table posts drop constraint if exists posts_status_check;
alter table posts add constraint posts_status_check
  check (status in ('ideia', 'producao', 'aprovacao', 'ajuste', 'aprovado', 'agendado', 'publicado'));

-- Segurança: só a EQUIPE vê e mexe nos dados internos.
-- O mesmo banco também tem logins de clientes (Portal do Cliente). Eles NÃO podem ler
-- estas tabelas: só acessam os próprios dados pelas funções portal_* (supabase/portal.sql do hm-portal).
-- Equipe = e-mails da tabela team_members. Para incluir alguém da equipe:
--   insert into team_members (email) values ('pessoa@exemplo.com');
-- (Desative "Allow new users to sign up" em Authentication → Sign In / Providers.)
create table if not exists team_members (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
-- Na primeira vez, todo usuário que já existe é da equipe (antes do portal só existiam logins da equipe).
insert into team_members (email)
  select lower(email) from auth.users
  where email is not null and (select count(*) from team_members) = 0
on conflict do nothing;
alter table team_members enable row level security;
drop policy if exists "equipe lê equipe" on team_members;

create or replace function is_team() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from team_members where email = lower(auth.jwt() ->> 'email'))
$$;
revoke all on function is_team() from public, anon;
grant execute on function is_team() to authenticated;

create policy "equipe lê equipe" on team_members for select to authenticated using (is_team());

do $$
declare t text;
begin
  foreach t in array array['clients', 'projects', 'time_entries', 'transactions', 'events', 'goals', 'posts', 'bills', 'leads'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "equipe HM" on %I', t);
    execute format('create policy "equipe HM" on %I for all to authenticated using (is_team()) with check (is_team())', t);
  end loop;
end $$;
