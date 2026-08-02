alter table public.board_members
add column headshot_updated_at timestamp with time zone not null default now();
