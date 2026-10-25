-- Fase 3: recepción de solicitudes. Ejecutar en un proyecto Supabase propio.
create extension if not exists pgcrypto;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  created_at timestamptz not null default now(),
  locale text not null check (locale in ('es','en')),
  name text not null check (char_length(name) between 2 and 120),
  business text check (char_length(business) <= 160),
  email text not null check (char_length(email) between 5 and 254),
  service text not null check (char_length(service) between 2 and 100),
  budget text check (char_length(budget) <= 100),
  timing text check (char_length(timing) <= 100),
  message text not null check (char_length(message) between 10 and 6000),
  status text not null default 'nuevo' check (status in ('nuevo','contactado','presupuesto_enviado','aceptado','cerrado')),
  source text not null default 'website'
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_status_idx on public.leads (status,created_at desc);
alter table public.leads enable row level security;
-- No se crean políticas de acceso público. Sólo el backend con service_role
-- puede escribir o leer. Nunca exponer la clave service_role en GitHub Pages.
revoke all on public.leads from anon, authenticated;
