import { pool } from './db.ts';
export async function search(url: URL) {
  const query=(url.searchParams.get('q')||'').trim().slice(0,120);
  const articles=await pool`
    SELECT a.id,a.slug,a.title,a.subtitle,a.abstract,a.access,a.published_at,v.number AS volume_number,
      (SELECT STRING_AGG(TRIM(u.first_name || ' ' || u.last_name),', ') FROM article_authors aa JOIN users u ON u.id=aa.user_id WHERE aa.article_id=a.id) AS authors
    FROM articles a LEFT JOIN volumes v ON v.id=a.volume_id
    WHERE a.status='published' AND (${query}='' OR
      to_tsvector('russian',a.title || ' ' || a.subtitle || ' ' || a.abstract || ' ' || a.body_text) @@ websearch_to_tsquery('russian',${query}) OR
      a.title ILIKE ${'%'+query+'%'})
    ORDER BY a.published_at DESC LIMIT 60`;
  return {articles,query};
}
