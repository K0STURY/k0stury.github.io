// Like counts, kept in Supabase (table and rules: supabase/likes.sql). The publishable key is
// meant to be public: the database only lets it read counts and add or take back a visitor's own like.
const API = "https://qjcrqrjqczymneoapfxi.supabase.co/rest/v1";
const HEADERS = { apikey: "sb_publishable_1a-ePIU1HndIwXDTTNOscQ_qLLWGGVA", "Content-Type": "application/json" };
const STORAGE_KEY = "liked-pieces";

export const HEART_PATH = "M12 21C5 15.5 2.5 12 2.5 8.5A5 5 0 0 1 12 6a5 5 0 0 1 9.5 2.5C21.5 12 19 15.5 12 21z";

export async function fetchLikes() {
  const res = await fetch(`${API}/piece_likes?select=piece_id,likes`, { headers: HEADERS });
  if (!res.ok) throw new Error(`Couldn't load likes: ${res.status}`);
  const rows: { piece_id: number; likes: number }[] = await res.json();
  return new Map(rows.map((row) => [row.piece_id, row.likes]));
}

/** Adds one like; returns the piece's new total */
export async function addLike(piece: number): Promise<number> {
  const res = await fetch(`${API}/rpc/like_piece`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ piece }),
  });
  if (!res.ok) throw new Error(`Couldn't save like: ${res.status}`);
  return res.json();
}

/** Takes back this visitor's like; returns the piece's new total */
export async function removeLike(piece: number): Promise<number> {
  const res = await fetch(`${API}/rpc/unlike_piece`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ piece }),
  });
  if (!res.ok) throw new Error(`Couldn't remove like: ${res.status}`);
  return res.json();
}

// Which hearts to show filled. The database does the real limiting: one like per piece per IP.
export function readLiked() {
  try {
    return new Set<number>(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"));
  } catch {
    return new Set<number>();
  }
}

export function saveLiked(liked: Set<number>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...liked]));
  } catch {
    // Private window or blocked storage: the heart just won't be remembered next visit
  }
}
