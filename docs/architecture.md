# Архитектура

## Границы системы

Приложение — один Node.js процесс. SvelteKit обслуживает SSR, формы и JSON API; better-sqlite3 выполняет синхронные запросы, а SQLite сериализует запись. Drizzle описывает типизированную схему приложения. Raw SQL оставлен там, где он сильнее: миграции, FTS5, триггеры, `VACUUM INTO` и тщательно подготовленные запросы.

Каталоги production:

```text
/var/data/
  gestalt.sqlite
  gestalt.sqlite-wal
  gestalt.sqlite-shm
  uploads/
  backups/
```

При запуске `scripts/start.js` создаёт каталоги, применяет миграции и запускает adapter-node build. Само приложение повторяет безопасную проверку миграций, поэтому development и production ведут себя одинаково.

## SQLite

Pragmas:

- `journal_mode=WAL`
- `synchronous=NORMAL`
- `busy_timeout=5000`
- `foreign_keys=ON`
- `mmap_size=128 MiB`
- `temp_store=MEMORY`

Миграция `migrations/0001_init.sql` содержит базовые таблицы, FK, индексы, FTS5 virtual table и sync-триггеры. `migrations/0002_email_verification_codes.sql` добавляет pending-регистрации для email-кодов.

FTS хранит `title`, `abstract`, `body_text`; поиск строит безопасное prefix-expression из не более чем восьми токенов и сортирует по `bm25(8, 3, 1)`.

## Доступ

`hooks.server.ts` читает opaque session cookie, хэширует token SHA-256 и находит серверную сессию. В `locals.user` попадает только публичный профиль.

Материал читается, если:

```text
status = published
AND (
  access = public
  OR существует entitlement, где starts_at <= now <= ends_at
)
```

Редакционные роли могут видеть preview. Entitlement не зависит от платежа: его создаёт CloudPayments или редактор вручную.

## Аннотации

Каждый блок `body_json` имеет стабильный `id`, который выводится как `data-pid`.

При выделении клиент хранит:

- точную цитату;
- 36 символов prefix и suffix;
- offsets внутри блока;
- paragraph id;
- тип, цвет и заметку.

Re-anchor сначала ищет quote с совпавшим контекстом, затем проверяет offsets, затем принимает единственное совпадение quote. Это переживает небольшие правки вокруг цитаты и не зависит от сырого DOM Range.

## Кеширование

- публичные списки: HTTP `max-age` + `stale-while-revalidate`;
- публичная статья без session: HTML в bounded LRU, 60 записей / 2 минуты;
- данные статьи: LRU, 100 записей / 5 минут;
- изменения в админке очищают оба кеша;
- uploads: fingerprinted filename, годовой immutable cache, ETag/304.

Кеши локальны процессу и не претендуют на согласованность между репликами — реплика одна.

## Форум

Темы находятся в `threads`, сообщения — в общей таблице `comments` с `target=thread`. Клиент обновляет тему с периодом из setting (по умолчанию 20 секунд). Обычные сообщения получают `pending`; редакционные роли публикуются сразу. Rate limits — token bucket в памяти, что соответствует одно-процессной архитектуре.

## Безопасность

- Argon2id: 19 MiB, 2 прохода, parallelism 1;
- email-коды регистрации хранятся только как Argon2id-хеш и живут ограниченное время;
- httpOnly, SameSite=Lax, Secure в production;
- SvelteKit origin checks для form actions и собственная same-origin проверка JSON API;
- prepared statements;
- Zod validation и лимиты длины;
- rate limits на auth, публикации, жалобы, annotations, support и uploads;
- обработка изображений с pixel limit и перекодированием;
- HMAC SHA-256 + timing-safe comparison для CloudPayments;
- карточные данные не проходят через приложение.
