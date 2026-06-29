import argon2 from 'argon2';
import Database from 'better-sqlite3';
import { migrate } from './db.js';

const databasePath = migrate();
const sqlite = new Database(databasePath);
sqlite.pragma('foreign_keys = ON');

const email = (process.env.SEED_ADMIN_EMAIL || 'admin@gestalt.local').toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD || 'change-me-now';
const hash = await argon2.hash(password, { type: argon2.argon2id });

const admin = sqlite.prepare('SELECT id FROM users WHERE email = ?').get(email);
let adminId;
if (admin) {
  adminId = admin.id;
  sqlite.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(adminId);
} else {
  const result = sqlite.prepare(`
    INSERT INTO users (email, phone, first_name, last_name, pwd_hash, role)
    VALUES (?, ?, ?, ?, ?, 'admin')
  `).run(email, '+70000000000', 'Главный', 'Редактор', hash);
  adminId = Number(result.lastInsertRowid);
}

const volume = sqlite.prepare('SELECT id FROM volumes WHERE slug = ?').get('volume-1');
let volumeId = volume?.id;
if (!volumeId) {
  volumeId = Number(sqlite.prepare(`
    INSERT INTO volumes (slug, number, title, published_at)
    VALUES ('volume-1', 1, 'Пилотный выпуск', datetime('now'))
  `).run().lastInsertRowid);
}

const article = sqlite.prepare('SELECT id FROM articles WHERE slug = ?').get('welcome');
if (!article) {
  const body = [
    {
      "id": "p-intro",
      "type": "lead",
      "text": "Gestalt.forum — пространство для серьёзного разговора о психотерапии, культуре и человеческом опыте."
    },
    {
      "id": "p-reading",
      "type": "paragraph",
      "text": "Тексты можно сохранять, откладывать на потом и размечать прямо во время чтения. Выделения привязаны к цитате и переживают небольшие редакторские правки."
    },
    {
      "id": "p-lounge",
      "type": "heading",
      "text": "После чтения"
    },
    {
      "id": "p-community",
      "type": "paragraph",
      "text": "В Курилке продолжается разговор: без гонки уведомлений и лишнего шума, с премодерацией и вниманием к собеседнику."
    }
  ];
  const bodyText = body.map((block) => block.text).join('\n\n');
  const result = sqlite.prepare(`
    INSERT INTO articles
      (slug, volume_id, title, subtitle, abstract, body_json, body_text, status, access, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'published', 'public', datetime('now'))
  `).run(
    'welcome',
    volumeId,
    'Добро пожаловать в Gestalt.forum',
    'Пилотный текст о том, как устроено это пространство',
    'Знакомство с журналом, читательскими инструментами и Курилкой.',
    JSON.stringify(body),
    bodyText
  );
  sqlite.prepare('INSERT INTO article_authors (article_id, user_id) VALUES (?, ?)').run(
    Number(result.lastInsertRowid),
    adminId
  );
}

const homePage = sqlite.prepare("SELECT id FROM pages WHERE slug = 'home'").get();
const blockCount = sqlite.prepare('SELECT COUNT(*) AS count FROM blocks WHERE page_id = ?').get(homePage.id);
if (blockCount.count === 0) {
  const insert = sqlite.prepare(
    'INSERT INTO blocks (page_id, type, payload_json, position) VALUES (?, ?, ?, ?)'
  );
  insert.run(homePage.id, 'hero', JSON.stringify({
    eyebrow: 'Независимый журнал',
    title: 'Практика внимания к человеку',
    text: 'Психотерапия, культура и язык опыта — медленно, точно, без упрощений.',
    cta: 'Читать материалы',
    href: '/materials'
  }), 0);
  insert.run(homePage.id, 'note', JSON.stringify({
    title: 'Первый выпуск открыт',
    text: 'Пилотный том доступен всем читателям.'
  }), 1);
}

sqlite.close();
console.log(`Seed complete. Administrator ensured: ${email}`);
