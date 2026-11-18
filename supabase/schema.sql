-- Word Wars secure backend. Run in Supabase SQL Editor.
create extension if not exists pgcrypto;
create table if not exists public.word_wars_rooms (
  code text primary key,
  host_name text not null,
  guest_name text,
  host_token_hash text not null,
  guest_token_hash text,
  host_word text,
  guest_word text,
  host_guesses jsonb not null default '[]'::jsonb,
  guest_guesses jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);
alter table public.word_wars_rooms enable row level security;
revoke all on public.word_wars_rooms from anon, authenticated;
-- Only the Edge Function service role accesses this table. Never expose service-role credentials in the browser.
create index if not exists word_wars_rooms_expires_idx on public.word_wars_rooms(expires_at);
