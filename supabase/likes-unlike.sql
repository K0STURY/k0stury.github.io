-- Lets visitors take back their own like. Paste once into Supabase's SQL Editor, after
-- likes-one-per-ip.sql. An address with no like on the piece changes nothing.

create function public.unlike_piece(piece integer)
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

  -- Must hash exactly like like_piece, or the like won't be found
  delete from private.piece_like_voters
  where piece_id = piece
    and voter = encode(sha256(convert_to((select salt from private.like_salt) || ip, 'UTF8')), 'hex');

  if found then
    update public.piece_likes
    set likes = greatest(likes - 1, 0)
    where piece_id = piece
    returning likes into total;
  else
    select likes into total from public.piece_likes where piece_id = piece;
  end if;

  return coalesce(total, 0);
end;
$$;

revoke all on function public.unlike_piece(integer) from public, anon, authenticated;
grant execute on function public.unlike_piece(integer) to anon, authenticated;
