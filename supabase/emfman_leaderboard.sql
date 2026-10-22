-- EMF Man global leaderboard.
-- Run once in the Supabase SQL editor. Only creates emfman_* objects; nothing else is touched.

create table if not exists public.emfman_scores (
  id bigint generated always as identity primary key,
  player_name text not null check (char_length(player_name) between 1 and 20),
  score integer not null check (score between 0 and 9999999),
  level integer not null check (level between 1 and 999),
  created_at timestamptz not null default now()
);
create index if not exists emfman_scores_rank_idx on public.emfman_scores (score desc, created_at asc);

create table if not exists public.emfman_game_tokens (
  token_id uuid primary key,
  started_at timestamptz not null default now(),
  used boolean not null default false
);
create index if not exists emfman_game_tokens_started_idx on public.emfman_game_tokens (started_at);

-- Row-level security on, and deliberately no policies: the browser (anon / authenticated)
-- can't read or write these tables. Only the server's service_role key can.
alter table public.emfman_scores enable row level security;
alter table public.emfman_game_tokens enable row level security;
