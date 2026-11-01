-- Like counts for the gallery. Paste once into Supabase's SQL Editor.
-- Visitors can read the counts and add one like at a time through like_piece; nothing else.

create table public.piece_likes (
  piece_id integer primary key check (piece_id between 1 and 9999),
  likes integer not null default 0 check (likes >= 0)
);

alter table public.piece_likes enable row level security;

create policy "Anyone can read like counts"
  on public.piece_likes for select
  to anon, authenticated
  using (true);

grant select on public.piece_likes to anon, authenticated;

-- security definer: runs with the owner's rights, because visitors can't write to the table
create function public.like_piece(piece integer)
returns integer
language sql
security definer
set search_path = ''
as $$
  insert into public.piece_likes as t (piece_id, likes)
  values (piece, 1)
  on conflict (piece_id) do update set likes = t.likes + 1
  returning t.likes;
$$;

revoke all on function public.like_piece(integer) from public, anon, authenticated;
grant execute on function public.like_piece(integer) to anon, authenticated;
