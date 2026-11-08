# GitHub Pages + jsDelivr + Supabase

Продакшен: `https://gestalt.forum`. Репозиторий: `nanohit/gestaltforum`.

- GitHub Pages отдаёт HTML и маршруты приложения. Публичные страницы предварительно рендерятся при сборке; браузер получает актуальные данные из API.
- jsDelivr отдаёт JS/CSS из отдельного неизменяемого git tag `pages-<run_id>-<attempt>`. HTML всегда указывает на конкретную версию ресурсов.
- Supabase Edge Function `gestalt-api` исполняет загрузчики и обработчики приложения. Postgres хранит данные в закрытой схеме `gestalt`, недоступной `anon` и `authenticated`. Доступ проверяется обработчиками на сервере.
- Изображения загружаются в публичный bucket `gestalt-uploads`. Браузер уменьшает изображение до 2000×2000 и кодирует WebP; сервер проверяет сигнатуру формата, права и размер до 10 МБ.
- Пароли сохраняют формат Argon2id. Сессия передаётся в `x-session-token`, хранится в браузере и проверяется сервером по SHA-256 хешу в БД. Секретные ключи никогда не передаются клиенту.

## Публикация через git

Push в `main` запускает `.github/workflows/pages.yml`: проверки, деплой Edge Function, сборка сайта, git tag с ресурсами для CDN и деплой Pages. GitHub secret `SUPABASE_ACCESS_TOKEN` используется только для backend-деплоя.

```sh
npm ci
npm run check
npm test
npm run check:pages
PAGES_BASE='' npm run build:pages
npm run build:edge
supabase functions deploy gestalt-api --project-ref qqxijzdjhkgbildekjdb --no-verify-jwt --use-api
```

`--no-verify-jwt` отключает только проверку Supabase Auth на входе в шлюз: приложение использует собственные сессии и проверки ролей. CORS разрешает только домены сайта и localhost:4173.

Исходные правила приложения находятся в `src/routes/**/*.server.ts` и `src/lib/server`. `scripts/port-edge.mjs` создаёт async-версию для Postgres. Сгенерированные модули в `supabase/functions/gestalt-api/server` не коммитятся. Runtime-адаптеры, поиск, резервное копирование и загрузки лежат в `supabase/functions/gestalt-api/runtime`.

## Секреты Supabase

`RESEND_API_KEY`, `EMAIL_FROM` настроены в Supabase. CloudPayments пока не подключён. Для подключения нужны `PUBLIC_CLOUDPAYMENTS_PUBLIC_ID` и `CLOUDPAYMENTS_WEBHOOK_SECRET` (или `CLOUDPAYMENTS_API_SECRET`). Адрес webhook:

`https://qqxijzdjhkgbildekjdb.supabase.co/functions/v1/gestalt-api?_path=/api/payments/cloudpayments-webhook&type=pay`

Для других событий замените `type`. Подпись проверяется сервером; запрос без корректной подписи отклоняется.

## Данные

Импортирована доступная локальная SQLite-база: 3 пользователя, 1 материал, 1 выпуск, страницы, комментарии и пометки. Это не резервная копия диска Render. Если на Render появились другие данные, их нужно восстановить из его SQLite backup отдельным импортом.

Публичный снимок `content/public.json` содержит только опубликованные открытые статьи и публичные блоки; используется для списка маршрутов при сборке. Обновить его из локальной SQLite: `npm run export:pages`. Изменения в админке сохраняются в Postgres и сразу доступны приложению; для новых HTML-страниц нужна повторная публикация. Неизвестные динамические пути открываются через SPA fallback `404.html` (с HTTP 404 от GitHub Pages).

Ручные резервные копии создаются в админке как приватный `.postgres.json.gz` и хранятся в БД 14 дней. Их формат отличается от прежних SQLite backup. Хранение копии в той же БД не заменяет независимый внешний backup.

## DNS

Домен управляется DNS Vercel. Корневой ALIAS и CNAME `www` должны указывать на `nanohit.github.io`. Email TXT/MX остаются на своих значениях. В GitHub Pages настроен custom domain `gestalt.forum`; HTTPS включается после выпуска сертификата.
