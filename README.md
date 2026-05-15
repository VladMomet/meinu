# MeiNu 美 — B2B-маркетплейс beauty-товаров из Китая

Минимальный production-стек:
- **Next.js 15** (App Router) — отдаёт SPA из `public/index.html` и API-роуты
- **Neon Postgres** + **Drizzle ORM** — пользователи, заказы, заявки
- **JWT-сессии** (jose, httpOnly cookie) — без сторонних сервисов
- **Telegram-нотификации** — заказы и заявки идут в общий чат менеджеров с inline-кнопками для смены статусов

## Структура

```
.
├── public/
│   └── index.html              ← наш SPA (вёрстка, каталог, корзина)
├── app/
│   ├── layout.tsx              ← минимальный root
│   └── api/
│       ├── register/route.ts        POST  — регистрация физ/юр
│       ├── auth/login/route.ts      POST  — вход; DELETE — выход
│       ├── orders/route.ts          POST  — создать заказ; GET — список своих
│       └── inquiries/route.ts       POST  — заявка на подбор; GET — список своих
├── lib/
│   ├── db.ts                   ← Neon + Drizzle
│   ├── schema.ts               ← users / orders / inquiries
│   ├── auth.ts                 ← JWT-сессии в httpOnly-куке
│   ├── telegram.ts             ← sendMessage / sendPhoto + форматирование
│   └── id.ts                   ← MN-YYMMDD-NNN / CR-YYMMDD-NNN
├── drizzle.config.ts
├── next.config.mjs             ← rewrite / → /index.html
├── package.json
├── tsconfig.json
├── .env.example
└── .gitignore
```

## Деплой пошагово

### 0. Что должно быть установлено локально

```bash
node --version   # 20+ (для Next 15)
git --version
```

Аккаунты: **GitHub**, **Vercel** (через GitHub-логин), **Neon** (neon.tech), **Telegram**.

### 1. Запустить локально

```bash
cd meinu-deploy
npm install
cp .env.example .env
# заполнить переменные в .env (см. шаги 2–3)
npm run db:push       # создаёт таблицы в Neon
npm run dev           # http://localhost:3000
```

### 2. Neon Postgres

1. https://console.neon.tech → **Create project** (регион ближе всего — `eu-central-1`)
2. **Connection Details** → копируем **Connection string** (с `?sslmode=require`)
3. Вставляем в `.env` как `DATABASE_URL`
4. `npm run db:push` создаст таблицы

Полезно: `npm run db:studio` открывает GUI для просмотра данных.

### 3. Telegram-бот для менеджеров

1. В Telegram: **@BotFather** → `/newbot` → имя `MeiNu Manager` (любое) → username `meinu_mgr_bot` (любое свободное)
2. Получите токен вида `1234567890:AAH...` — это `TELEGRAM_BOT_TOKEN`
3. Создайте **группу** для менеджеров, добавьте туда вашего бота
4. Отправьте в группу любое сообщение, затем откройте в браузере:
   ```
   https://api.telegram.org/bot<TOKEN>/getUpdates
   ```
   В JSON найдите `"chat":{"id":-1001234567890,...}` — это `TELEGRAM_CHAT_ID` (для групп — отрицательное число)
5. Вставьте оба значения в `.env`

### 4. AUTH_SECRET

```bash
openssl rand -base64 48
```

Скопируйте вывод в `.env` как `AUTH_SECRET`.

### 5. GitHub

```bash
cd meinu-deploy
git init
git add .
git commit -m "init: MeiNu MVP"
# создайте репозиторий на github.com (можно private), затем:
git remote add origin git@github.com:<your-user>/meinu.git
git branch -M main
git push -u origin main
```

### 6. Vercel

1. https://vercel.com → **Add New… → Project** → импортируем репозиторий
2. Framework Preset: **Next.js** (определится автоматически)
3. **Environment Variables** → добавьте все 4 ключа из `.env`:
   - `DATABASE_URL`
   - `AUTH_SECRET`
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
4. **Deploy**
5. После сборки получите URL `https://meinu.vercel.app` — это и есть рабочий сайт

Каждый `git push` в `main` будет автоматически деплоить новую версию.

### 7. Свой домен

В Vercel: **Settings → Domains** → добавить `meinu.ru` → выдадут DNS-записи (A / CNAME), которые надо прописать у регистратора домена.

## API endpoints

| Метод     | URL                | Описание                                                           |
|-----------|--------------------|--------------------------------------------------------------------|
| `POST`    | `/api/register`    | `{ type, name, phone, email?, password, orgName?, inn?, kpp?, ogrn? }` → cookie-сессия |
| `POST`    | `/api/auth/login`  | `{ phone, password }` → cookie-сессия                              |
| `DELETE`  | `/api/auth/login`  | выход                                                              |
| `POST`    | `/api/orders`      | `{ city, items[] }` → заказ + Telegram                             |
| `GET`     | `/api/orders`      | список заказов текущего пользователя                               |
| `POST`    | `/api/inquiries`   | `{ description, quantity, budgetRub?, photos[]? }` → заявка + Telegram (фото отдельным sendPhoto) |
| `GET`     | `/api/inquiries`   | список своих заявок                                                |

## Что осталось сделать в `public/index.html`

Сейчас SPA полностью клиентский: регистрация, заказы и заявки лежат в `localStorage`. Чтобы данные шли в Postgres и Telegram, в `index.html` нужно заменить три функции на `fetch(...)`:

| Функция в `index.html` | Сейчас                              | Должно стать                                |
|------------------------|-------------------------------------|---------------------------------------------|
| `submitRegister()`     | пишет в `localStorage.meinu_user`   | `POST /api/register`, кука выставляется сервером |
| `finalizeOrder()`      | пишет в `localStorage.meinu_orders` | `POST /api/orders`                          |
| `submitCustom()`       | пишет в `localStorage.meinu_customs`| `POST /api/inquiries` (фото слать как base64 строки) |
| Списки в `renderProfile` | читает из `localStorage`          | `GET /api/orders` и `GET /api/inquiries`    |

Корзина (`meinu_cart`) и выбранный город (`meinu_city`) остаются в `localStorage` — они анонимные и серверу не нужны.

## Поток статусов через Telegram

Когда менеджер жмёт inline-кнопку («✅ Подтвердить» и т.п.) — Telegram шлёт callback на `https://api.telegram.org/bot<TOKEN>/getUpdates`, который **пока никто не слушает**. Чтобы кнопки заработали:

1. Создайте `/api/telegram/webhook/route.ts` (POST-обработчик)
2. Привяжите webhook одной командой:
   ```bash
   curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://meinu.vercel.app/api/telegram/webhook"
   ```
3. В webhook парсите `callback_query.data` (`o_confirmed_MN-...`) и обновляйте статус в БД через Drizzle.

Это следующий шаг — без него заказы будут создаваться, нотификации приходить, но менять статус придётся вручную через DB Studio.
