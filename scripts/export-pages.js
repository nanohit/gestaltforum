// Export an explicit allowlist of public content. Never publish the SQLite file.
import Database from 'better-sqlite3';
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';

const databasePath = resolve(process.env.DATABASE_PATH || '.data/gestalt.sqlite');
if (!existsSync(databasePath)) throw new Error(`Database not found: ${databasePath}`);
const db = new Database(databasePath, { readonly: true });
const uploads = resolve(process.env.DATA_DIR || '.data', 'uploads');
const assets = resolve('public-assets');
const copied = new Set();

function publicImage(src) {
  if (typeof src !== 'string' || !src.startsWith('/uploads/')) return src;
  const source = resolve(uploads, src.slice('/uploads/'.length));
  if (!source.startsWith(`${uploads}${sep}`)) throw new Error('Invalid upload path');
  if (!/\.(png|jpe?g|webp|gif|avif)$/i.test(source)) throw new Error(`Unsupported image: ${src}`);
  if (!existsSync(source)) throw new Error(`Public image is missing: ${src}`);
  const target = resolve(assets, src.slice(1));
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  copied.add(src);
  return src;
}

function parseBlocks(value) {
  const blocks = JSON.parse(value);
  if (!Array.isArray(blocks)) throw new Error('Article body must be an array');
  return blocks.map((block, index) => ({
    id: String(block.id || `p-${index + 1}`),
    type: ['paragraph', 'lead', 'heading', 'quote', 'list', 'image'].includes(block.type) ? block.type : 'paragraph',
    text: String(block.text || ''),
    ...(Array.isArray(block.items) ? { items: block.items.map(String) } : {}),
    ...(block.type === 'image' ? { src: publicImage(block.src), alt: String(block.alt || '') } : {})
  }));
}

const articles = db.prepare(`
  SELECT a.id, a.slug, a.title, a.subtitle, a.abstract, a.access, a.published_at,
         a.volume_id, a.body_json, v.number AS volume_number, v.title AS volume_title,
         GROUP_CONCAT(TRIM(u.first_name || ' ' || u.last_name), ', ') AS authors
  FROM articles a
  LEFT JOIN volumes v ON v.id = a.volume_id
  LEFT JOIN article_authors aa ON aa.article_id = a.id
  LEFT JOIN users u ON u.id = aa.user_id
  WHERE a.status = 'published' AND a.access = 'public'
  GROUP BY a.id ORDER BY a.published_at DESC, a.id DESC
`).all().map(({ body_json, ...article }) => {
  const blocks = parseBlocks(body_json);
  return { ...article, status: 'published', comments_enabled: 0, blocks,
    body_text: blocks.map((block) => [block.text, ...(block.items || [])].join(' ')).join('\n') };
});

function pageBlocks(id) {
  return db.prepare('SELECT id, type, payload_json, position FROM blocks WHERE page_id = ? ORDER BY position, id')
    .all(id).map(({ payload_json, ...block }) => ({ ...block, payload: JSON.parse(payload_json) }));
}

const home = db.prepare("SELECT id FROM pages WHERE slug = 'home'").get();
if (!home || !articles.length) throw new Error('No public home page or articles; refusing empty export');
const content = {
  siteName: db.prepare("SELECT value FROM settings WHERE key = 'site_name'").get()?.value || 'Gestalt.forum',
  blocks: pageBlocks(home.id),
  articles,
  volumes: db.prepare('SELECT id, slug, number, title, published_at FROM volumes WHERE published_at IS NOT NULL ORDER BY number DESC')
    .all().map((volume) => ({ ...volume, article_count: articles.filter((article) => article.volume_id === volume.id).length })),
  pages: db.prepare("SELECT id, slug, title FROM pages WHERE slug IN ('editors', 'submission')")
    .all().map((page) => ({ ...page, blocks: pageBlocks(page.id) }))
};
db.close();
mkdirSync('content', { recursive: true });
writeFileSync('content/public.json', `${JSON.stringify(content, null, 2)}\n`);
console.log(`Exported ${articles.length} public articles, ${content.volumes.length} volumes and ${copied.size} images.`);
