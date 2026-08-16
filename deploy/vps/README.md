# Перенос TaskSite с Supabase Cloud на VPS

Бесплатный проект на supabase.com уходит на паузу после ~недели без активности.
На своём VPS паузы не будет: вы поднимаете тот же стек (Postgres + Auth + API) через Docker.

Код приложения **менять не нужно** — только URL и ключи в env (локально и на Vercel).

## Два варианта

| Вариант | Когда выбирать |
|--------|----------------|
| **A. Self-hosted Supabase на VPS** (рекомендуется) | Хотите полный контроль и без пауз; код остаётся как есть |
| **B. Supabase Pro (~$25/мес)** | Не хотите админить сервер; пауза на Pro не ставится |
| **C. Голый PostgreSQL** | Сильный VPS и готовность переписать Auth + все запросы к БД |

Ниже — вариант **A**.

## Что использует TaskSite

- PostgreSQL (таблицы `users`, `tasks`, `task_answers`)
- Auth (email/password преподавателя)
- REST API (PostgREST) через `@supabase/supabase-js`

Storage, Realtime и Edge Functions **не используются**.

## Требования к VPS

- Ubuntu 22.04+ (или аналог)
- Docker + Docker Compose plugin
- **≥ 4 GB RAM** (лучше 8 GB — полный стек Supabase тяжёлый)
- Домен, например `supabase.example.com` → A-запись на IP VPS
- Порты 80/443 открыты (для HTTPS через reverse proxy)

## 1. Установка Docker на VPS

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"
# перелогиньтесь, затем:
docker compose version
```

## 2. Развёртывание Supabase

Официальная инструкция: [Self-Hosting with Docker](https://supabase.com/docs/guides/self-hosting/docker).

Кратко (ручной путь):

```bash
git clone --depth 1 https://github.com/supabase/supabase
mkdir -p ~/supabase-project
cp -rf supabase/docker/. ~/supabase-project/
cd ~/supabase-project
cp .env.example .env
```

В `.env` обязательно смените секреты и URL:

- `POSTGRES_PASSWORD`
- `JWT_SECRET` (длинная случайная строка)
- `ANON_KEY` / `SERVICE_ROLE_KEY` — сгенерируйте скриптом из репозитория Supabase (`generate-keys.sh` / актуальный аналог в их docker-папке)
- `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD`
- `SITE_URL` = `https://ваш-фронт.vercel.app` (или домен приложения)
- `API_EXTERNAL_URL` = `https://supabase.example.com`
- `SUPABASE_PUBLIC_URL` = `https://supabase.example.com`

Запуск:

```bash
docker compose pull
docker compose up -d
docker compose ps   # все сервисы healthy/running
```

Поверх Kong (обычно порт 8000) поставьте Nginx/Caddy с HTTPS и проксируйте на `http://127.0.0.1:8000`.

**Не открывайте** порт Postgres (5432) в интернет.

## 3. Схема TaskSite

В Studio (`https://supabase.example.com`) → SQL Editor выполните весь файл:

[`supabase/schema.sql`](../../supabase/schema.sql)

Либо через `psql` внутри контейнера БД (имя сервиса смотрите в `docker compose ps`).

## 4. Перенос данных с облака (если уже есть задания)

### На облачном Supabase

Dashboard → **Project Settings → Database** → connection string (Direct), затем:

```bash
# С вашего ПК / CI (нужен доступ к облачной БД)
pg_dump "postgresql://postgres.[ref]:[PASSWORD]@aws-0-....pooler.supabase.com:5432/postgres" \
  --schema=public \
  --data-only \
  --no-owner \
  -f tasksite-public-data.sql
```

Пользователей Auth (`auth.users`) удобнее **создать заново** на VPS (Studio → Authentication → Add user), чем тащить хеши паролей.
После создания преподавателя триггер заполнит `public.users`.

Если нужен полный дамп включая auth — используйте Direct connection и дамп схем `auth` + `public` (осторожно с ролями и расширениями).

### На VPS

1. Создайте того же преподавателя (тот же email/пароль, если хотите).
2. Импортируйте данные `public.tasks` / `public.task_answers`.
3. Обновите `teacher_id` в `tasks`, если UUID пользователя на VPS другой:

```sql
-- пример: подставить id нового преподавателя
UPDATE public.tasks
SET teacher_id = '<new-teacher-uuid>'
WHERE teacher_id = '<old-teacher-uuid>';
```

Скрипт-подсказка: [`migrate-data.sh`](./migrate-data.sh).

## 5. Переключение приложения

Локально (`.env.local`) и на **Vercel → Environment Variables**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://supabase.example.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key с VPS>
SUPABASE_SERVICE_ROLE_KEY=<service_role key с VPS>
NEXT_PUBLIC_APP_URL=https://ваш-проект.vercel.app
```

Сделайте **Redeploy** на Vercel.

Проверьте:

1. `/login` — вход преподавателя
2. Dashboard — список заданий
3. `/task/[slug]` — страница ученика и автосохранение ответов

## 6. Бэкапы (обязательно)

Раз в день на VPS:

```bash
docker compose exec -T db pg_dump -U postgres postgres | gzip > ~/backups/tasksite-$(date +%F).sql.gz
```

Храните копии вне сервера.

## Если VPS слабый (&lt; 4 GB RAM)

Полный стек Supabase может не влезть. Тогда реалистичные варианты:

1. **Supabase Pro** — без паузы, без админки Docker
2. Позже — переписать приложение на голый Postgres + свою авторизацию (вариант C; заметный рефакторинг `src/lib/supabase/*` и API)

## Полезные ссылки

- [Официальный self-hosting](https://supabase.com/docs/guides/self-hosting/docker)
- Схема БД: `supabase/schema.sql`
- Пример env: `.env.local.example`
