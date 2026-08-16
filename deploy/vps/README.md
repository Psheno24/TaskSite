# Перенос TaskSite с облачного Supabase на VPS

Бесплатный проект на supabase.com уходит на паузу после ~недели без активности.

В коде уже есть **два провайдера** (переключатель `DATA_PROVIDER`):

| Режим | Когда | RAM на VPS |
|------|--------|------------|
| `supabase` (по умолчанию) | Как сейчас — облако или self-hosted Supabase | облако / 4–8 GB если Docker Supabase |
| `postgres` | Голый PostgreSQL + своя auth (сессионная cookie) | ~0.5–1 GB на БД |

Текущий прод **не ломается**: пока `DATA_PROVIDER` не выставлен в `postgres`, всё работает через Supabase.

---

## Рекомендуемый план

1. Поднять Postgres на VPS (или локально через `docker compose`).
2. Прогнать `postgres/schema.sql`, создать преподавателя.
3. Локально/на preview выставить `DATA_PROVIDER=postgres` и проверить.
4. Перенести данные с Supabase.
5. На Vercel переключить env на `postgres`.
6. Позже удалить `@supabase/*` и `src/lib/supabase/`.

---

## A. Режим `postgres` (лёгкий)

### 1. Локально

```bash
cp .env.local.example .env.local
# В .env.local:
# DATA_PROVIDER=postgres
# DATABASE_URL=postgresql://tasksite:tasksite@localhost:5432/tasksite
# AUTH_SECRET=<случайная строка ≥ 32 символов>
# NEXT_PUBLIC_APP_URL=http://localhost:3000

npm run db:up
npm run create-teacher -- teacher@example.com 'your-password'
npm run dev
```

Схема применяется автоматически при первом старте Docker (`postgres/schema.sql`).
На уже существующей БД:

```bash
psql "$DATABASE_URL" -f postgres/schema.sql
```

### 2. На VPS

1. Установите PostgreSQL 16 (пакет или Docker).
2. Создайте БД/пользователя, примените `postgres/schema.sql`.
3. Откройте доступ **только** с сервера приложения (или localhost, если Next тоже на этом VPS). Не светите 5432 в интернет.
4. На Vercel (или где крутится Next) задайте:

```env
DATA_PROVIDER=postgres
DATABASE_URL=postgresql://user:pass@VPS_HOST:5432/tasksite
AUTH_SECRET=<длинный секрет ≥ 32 символов>
NEXT_PUBLIC_APP_URL=https://ваш-фронт.vercel.app
```

Переменные `NEXT_PUBLIC_SUPABASE_*` в этом режиме **не нужны**.

5. Создайте преподавателя:

```bash
DATABASE_URL=... npm run create-teacher -- teacher@example.com 'password'
```

6. Redeploy.

### 3. Перенос данных с Supabase

Таблицы `tasks` / `task_answers` совместимы по смыслу.
`users` на Postgres хранит `password_hash` — пользователей Auth лучше **создать заново** скриптом `create-teacher`, затем поправить `teacher_id` в `tasks`, если UUID изменился.

Хелпер дампа public-данных: [`migrate-data.sh`](./migrate-data.sh).

### 4. Бэкапы

```bash
pg_dump "$DATABASE_URL" | gzip > tasksite-$(date +%F).sql.gz
```

---

## B. Self-hosted Supabase на VPS (тяжёлый)

Если хотите оставить клиент Supabase как есть — поднимите [официальный Docker-стек](https://supabase.com/docs/guides/self-hosting/docker) (нужно ≈4–8 GB RAM), выполните `supabase/schema.sql`, укажите URL/ключи, оставьте `DATA_PROVIDER=supabase` (или не задавайте).

---

## C. Supabase Pro

Пауза за неактивность не ставится; сервер админить не нужно.

---

## После полного перехода на `postgres`

Можно удалить:

- зависимости `@supabase/ssr`, `@supabase/supabase-js`
- `src/lib/supabase/`
- `supabase/schema.sql` (оставить `postgres/schema.sql`)
- ветку кода `supabase*` в `src/lib/data/`
