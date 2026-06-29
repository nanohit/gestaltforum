# Gestalt.forum

MVP независимого журнала и читательского сообщества: SvelteKit 2 / Svelte 5, TypeScript, adapter-node, SQLite (WAL + FTS5), better-sqlite3 и Drizzle.

Проект рассчитан на один процесс Render Starter с 512 МБ RAM, 0.5 vCPU и постоянным диском `/var/data`.

## Быстрый старт

Нужен Node.js 22+.

```bash
./dev.sh
```

Скрипт создаст `.env`, установит зависимости, подготовит `.data/uploads` и `.data/backups`, применит миграции, добавит демо-контент и запустит Vite на `0.0.0.0:5173`.

Локальный администратор после seed:

- email: `admin@gestalt.local`
- пароль: `change-me-now`

Смените эти значения через `SEED_ADMIN_EMAIL` и `SEED_ADMIN_PASSWORD`; в production не запускайте seed с демонстрационным паролем.

## Команды

```bash
npm run dev       # development
npm run migrate   # применить SQL-миграции
npm run seed      # идемпотентный dev seed
npm run check     # TypeScript + Svelte diagnostics
npm test          # unit tests
npm run build     # production build
npm start         # migration + adapter-node server
```

## Что реализовано

- регистрация по email/паролю и телефону, Argon2id, серверные сессии, secure cookies;
- роли, RBAC, бан и временный mute;
- материалы, выпуски, FTS5-поиск с `bm25()`, открытый и подписной доступ;
- читательские выделения, подчёркивания и заметки с re-anchor по quote/prefix/suffix и fallback на offsets;
- избранное и read later, профиль, история платежей и тикеты;
- Курилка без WebSocket: polling, премодерация, жалобы и rate limits;
- CloudPayments Widget и HMAC-верифицированные webhook-и с идемпотентностью;
- редактор материалов, выпусков, страниц/блоков, модерация, пользователи, grants, тикеты и настройки;
- загрузка JPEG/PNG/WebP с resize и перекодированием через sharp;
- ETag/304 для uploads, Cache-Control и bounded LRU для публичного HTML;
- ежедневный `VACUUM INTO` + gzip, локальная ротация и опциональная S3-compatible копия;
- Render Blueprint и `/healthz`.

Подробности: [архитектура](docs/architecture.md), [эксплуатация](docs/operations.md), [CloudPayments](docs/cloudpayments.md).

## Переменные окружения

Скопируйте `.env.example` в `.env`.

| Переменная | Назначение |
|---|---|
| `ORIGIN` | Публичный HTTPS origin приложения |
| `DATA_DIR` | Каталог данных; локально `.data`, на Render `/var/data` |
| `DATABASE_PATH` | Полный путь к SQLite |
| `SESSION_DAYS` | Срок серверной сессии |
| `PUBLIC_CLOUDPAYMENTS_PUBLIC_ID` | Public terminal ID виджета |
| `CLOUDPAYMENTS_API_SECRET` | API Secret CloudPayments |
| `CLOUDPAYMENTS_WEBHOOK_SECRET` | Secret для HMAC webhook; fallback на API Secret |
| `BACKUP_S3_*` | Опциональная off-site копия в S3-compatible storage |

## Production

1. Создайте сервис через `render.yaml`.
2. Укажите `ORIGIN=https://ваш-домен`.
3. Создайте persistent disk с mount path `/var/data`.
4. Задайте секреты CloudPayments и S3, если используются.
5. Укажите `SEED_ADMIN_EMAIL` и `SEED_ADMIN_PASSWORD`: при первом старте будет создан администратор. После bootstrap переменные можно удалить; существующий пароль автоматически не меняется.
6. Включите webhook-и по инструкции в `docs/cloudpayments.md`.

Приложение намеренно запускается одним процессом. Несколько реплик нельзя направлять в один SQLite-файл.
