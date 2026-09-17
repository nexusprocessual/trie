-- Execute no SQL Editor do Supabase.
create table if not exists public.site_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.site_visits (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  ip text not null,
  city text,
  region text,
  country text,
  path text not null,
  referrer text,
  user_agent text
);
create index if not exists site_visits_created_at_idx on public.site_visits (created_at desc);

-- RLS ativo e sem políticas: somente o servidor (service role) lê e grava.
alter table public.site_settings enable row level security;
alter table public.site_visits enable row level security;
