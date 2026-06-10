# TaskSite

Веб-приложение для размещения интерактивных домашних заданий по английскому языку.

Преподаватель загружает HTML-задание, получает ссылку и отправляет её ученику. Ученик выполняет задание на сайте, ответы автоматически сохраняются. Преподаватель может открыть задание и просмотреть или отредактировать ответы.

## Стек

- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Supabase** (PostgreSQL + Auth)
- **Vercel** (деплой)

## Быстрый старт

### 1. Supabase

1. Создайте проект на [supabase.com](https://supabase.com).
2. Откройте **SQL Editor** и выполните весь скрипт из файла `supabase/schema.sql`.
3. Создайте преподавателя: **Authentication → Users → Add user** (email + password).
   Триггер автоматически создаст запись в `public.users`.
4. Скопируйте из **Project Settings → API**:
   - Project URL
   - `anon` public key
   - `service_role` secret key

### 2. Локальный запуск

```bash
# Клонировать / перейти в папку проекта
cd TaskSite

# Установить зависимости
npm install

# Создать файл окружения
cp .env.local.example .env.local
```

Заполните `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

```bash
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000).

### 3. Деплой на Vercel

1. Загрузите репозиторий на GitHub.
2. Импортируйте проект в [vercel.com](https://vercel.com).
3. В настройках проекта:
   - **Framework Preset:** Next.js
   - **Root Directory:** `.` (корень репозитория, не подпапка)
   - **Build Command:** `npm run build` (по умолчанию)
   - **Output Directory:** выключить Override и оставить **пустым** (не `public`!)
4. Добавьте переменные окружения (те же, что в `.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL` = `https://ваш-проект.vercel.app`
5. Нажмите **Deploy** и дождитесь статуса **Ready**.

#### Если видите `404: NOT_FOUND` на Vercel

Это ошибка платформы — приложение не задеплоилось. Проверьте:

1. **Vercel → Project → Deployments** — есть ли успешный (зелёный) деплой?
2. Если деплой **Failed** — откройте **Build Logs** и исправьте ошибку.
3. Убедитесь, что в GitHub загружен **весь код** проекта (папки `src/`, `package.json`, `next.config.ts`).
4. Переменные окружения добавлены для **Production** (не только Preview).
5. После добавления env нажмите **Redeploy** на последнем деплое.

Локально проект должен собираться без ошибок:

```bash
npm run build
```

## Структура проекта

```
src/
├── app/
│   ├── login/              # Вход преподавателя
│   ├── dashboard/          # Панель управления
│   │   ├── create/         # Создание задания
│   │   └── tasks/[id]/     # Просмотр ответов
│   ├── task/[slug]/        # Страница ученика
│   └── api/                # API routes
├── components/             # UI и feature-компоненты
├── lib/                    # Supabase, auth, i18n, bridge
└── types/                  # TypeScript типы
```

## Маршруты

| Путь | Доступ | Описание |
|------|--------|----------|
| `/login` | Публичный | Вход преподавателя |
| `/dashboard` | Преподаватель | Таблица заданий |
| `/dashboard/create` | Преподаватель | Создание задания |
| `/dashboard/tasks/[id]` | Преподаватель | Просмотр и редактирование ответов |
| `/task/[slug]` | Публичный | Страница ученика |

## API

### Преподаватель (требуется авторизация)

- `GET /api/tasks` — список заданий
- `POST /api/tasks` — создание задания
- `GET /api/tasks/[id]` — задание с ответами
- `DELETE /api/tasks/[id]` — удаление
- `POST /api/tasks/[id]/duplicate` — дублирование (только новое имя ученика)
- `PATCH /api/tasks/[id]/answers` — сохранение ответов (редактирование)

### Ученик (публичный, по slug)

- `GET /api/public/tasks/[slug]` — задание с ответами
- `PATCH /api/public/tasks/[slug]/answers` — автосохранение
- `PATCH /api/public/tasks/[slug]/complete` — завершение задания

## Автосохранение

HTML-задание отображается в `iframe` с sandbox (`allow-scripts allow-forms allow-same-origin`).

В HTML инъецируется bridge-скрипт, который:

1. Собирает значения всех `input`, `textarea`, `select`, `radio`, `checkbox`
2. Отправляет изменения родительской странице через `postMessage`
3. Восстанавливает сохранённые ответы при загрузке

Данные сохраняются в Supabase с debounce 500 мс.

## Статусы заданий

| Статус | Условие |
|--------|---------|
| Не начато | Задание создано, ответов нет |
| В процессе | Есть хотя бы один сохранённый ответ |
| Завершено | Ученик нажал «Завершить задание» |

## Язык интерфейса

Переключатель RU / EN в шапке. Выбор сохраняется в `localStorage`.

## Пример HTML-задания

```html
<!DOCTYPE html>
<html>
<head>
  <title>Lesson 1</title>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    .question { margin-bottom: 20px; }
  </style>
</head>
<body>
  <h1>Present Simple</h1>
  <div class="question">
    <label>1. She ___ to school every day.</label>
    <input type="text" name="q1" />
  </div>
  <div class="question">
    <label>2. Choose the correct answer:</label>
    <label><input type="radio" name="q2" value="go" /> go</label>
    <label><input type="radio" name="q2" value="goes" /> goes</label>
  </div>
</body>
</html>
```

Поля должны иметь атрибут `name` или `id` для корректного сохранения.

## База данных

Таблицы:

- **users** — профили преподавателей
- **tasks** — задания (HTML, метаданные, статус)
- **task_answers** — ответы учеников (JSONB)

Полный SQL: `supabase/schema.sql`.
