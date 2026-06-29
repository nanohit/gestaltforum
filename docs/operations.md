# Эксплуатация

## Render

`render.yaml` описывает Node Starter service, health check и диск 1 ГБ в `/var/data`.

Build:

```bash
npm ci && npm run build
```

Start:

```bash
npm start
```

Не запускайте больше одной реплики с одним SQLite-файлом. Перед deploy проверьте `npm run check && npm test && npm run build`.

## Миграции

SQL-файлы читаются в лексикографическом порядке. Применённые имена записываются в `_migrations`. Новую миграцию добавляйте как `migrations/0002_description.sql`; существующую применённую миграцию не редактируйте.

## Backup

При первом запросе scheduler проверяет последнюю копию, затем повторяет проверку раз в час. Если копия старше 24 часов:

1. SQLite делает согласованный `VACUUM INTO`;
2. файл сжимается gzip level 6;
3. при заданных `BACKUP_S3_*` отправляется PUT с AWS SigV4;
4. локальные файлы старше retention удаляются.

Копию можно создать и скачать в `/admin#operations`.

### Restore

1. Остановите web service.
2. Сохраните текущие `.sqlite`, `-wal`, `-shm`.
3. Распакуйте backup:

   ```bash
   gunzip -c app-....sqlite.gz > /var/data/gestalt.sqlite
   ```

4. Удалите только старые `gestalt.sqlite-wal` и `gestalt.sqlite-shm`.
5. Запустите сервис и проверьте `/healthz`.

Регулярно проверяйте восстановление на отдельной копии. Локальный диск не считается off-site backup.

## Загрузки

API принимает JPEG, PNG и WebP до 10 МБ и 40 megapixels. Sharp исправляет orientation, ограничивает 2000×2000 и сохраняет WebP quality 82. Файлы получают случайное имя и не перезаписываются.

## Наблюдение

Минимальные проверки:

- `GET /healthz` возвращает 200 и `database=ready`;
- свободное место на persistent disk;
- возраст последнего backup;
- рост WAL;
- очередь pending comments и open support tickets;
- ответы CloudPayments webhook.

SQLite checkpoint выполняется автоматически. При необычно большом WAL безопасно выполнить `PRAGMA wal_checkpoint(TRUNCATE)` в окне обслуживания после остановки трафика.

## Производительность

Не увеличивайте Argon2 memory cost без замеров на 512 МБ. Не добавляйте WebSocket-сервер. Большие выборки ограничены, LRU bounded, sharp обрабатывает один upload в запросе. Для нагрузки выше одного процесса следующий шаг — перенос БД в PostgreSQL, а не shared SQLite.
