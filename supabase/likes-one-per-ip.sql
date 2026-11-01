-- One like per piece per IP address. Paste once into Supabase's SQL Editor, after likes.sql.
-- Only a salted hash of the address is stored. The private schema isn't reachable from the API.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.like_salt (salt text not null);
insert into private.like_salt values (gen_random_uuid()::text || gen_random_uuid()::text);

create table private.piece_like_voters (
  piece_id integer not null,
  voter text not null,
  primary key (piece_id, voter)
);

create or replace function public.like_piece(piece integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  headers json := nullif(current_setting('request.headers', true), '')::json;
  ip text := coalesce(headers->>'cf-connecting-ip', split_part(headers->>'x-forwarded-for', ',', 1));
  total integer;
begin
  if nullif(ip, '') is null then
    raise exception 'No client address';
  end if;

  insert into private.piece_like_voters (piece_id, voter)
  values (piece, encode(sha256(convert_to((select salt from private.like_salt) || ip, 'UTF8')), 'hex'))
  on conflict do nothing;

  if found then
    -- An invalid piece id fails the table's check here, which also undoes the insert above
    insert into public.piece_likes as t (piece_id, likes)
    values (piece, 1)
    on conflict (piece_id) do update set likes = t.likes + 1
    returning t.likes into total;
  else
    select likes into total from public.piece_likes where piece_id = piece;
  end if;

  return coalesce(total, 0);
end;
$$;

revoke all on function public.like_piece(integer) from public, anon, authenticated;
grant execute on function public.like_piece(integer) to anon, authenticated;
